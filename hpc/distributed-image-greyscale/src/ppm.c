#include "ppm.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

/* Netpbm headers allow whitespace and '#' comments between the tokens, so we
 * cannot simply fscanf("%d %d %d"). This helper skips both. */
static int read_token_int(FILE *f, int *out)
{
    int c;
    long value = 0;
    int digits = 0;

    for (;;) {
        c = fgetc(f);
        if (c == EOF) return -1;
        if (c == '#') {                       /* comment runs to end of line */
            while (c != '\n' && c != EOF) c = fgetc(f);
            continue;
        }
        if (isspace(c)) continue;
        break;
    }
    while (isdigit(c)) {
        value = value * 10 + (c - '0');
        digits++;
        c = fgetc(f);
    }
    if (digits == 0) return -1;
    /* Push the delimiter back. The caller must consume exactly one
     * whitespace byte after maxval -- that byte is part of the header, and
     * everything after it is pixel data. */
    if (c != EOF) ungetc(c, f);
    *out = (int)value;
    return 0;
}

static int read_magic(FILE *f, char *m0, char *m1)
{
    int a = fgetc(f), b = fgetc(f);
    if (a == EOF || b == EOF) return -1;
    *m0 = (char)a;
    *m1 = (char)b;
    return 0;
}

int ppm_read_header(const char *path, int *width, int *height, int *maxval,
                    long *pixel_offset)
{
    FILE *f = fopen(path, "rb");
    char m0, m1;

    if (!f) {
        fprintf(stderr, "ppm: cannot open '%s'\n", path);
        return 1;
    }
    if (read_magic(f, &m0, &m1) != 0 || m0 != 'P' || m1 != '6') {
        fprintf(stderr, "ppm: '%s' is not a binary PPM (P6) file\n", path);
        fclose(f);
        return 1;
    }
    if (read_token_int(f, width) || read_token_int(f, height) ||
        read_token_int(f, maxval)) {
        fprintf(stderr, "ppm: malformed header in '%s'\n", path);
        fclose(f);
        return 1;
    }
    if (*width <= 0 || *height <= 0 || *maxval <= 0 || *maxval > 255) {
        fprintf(stderr, "ppm: unsupported dimensions/maxval in '%s' "
                        "(only 8-bit samples are handled)\n", path);
        fclose(f);
        return 1;
    }
    /* Consume the single whitespace byte that terminates maxval. */
    fgetc(f);
    if (pixel_offset) *pixel_offset = ftell(f);
    fclose(f);
    return 0;
}

int ppm_read(const char *path, PPMImage *img)
{
    FILE *f;
    long offset;
    size_t n, got;

    if (ppm_read_header(path, &img->width, &img->height, &img->maxval, &offset))
        return 1;

    n = (size_t)img->width * (size_t)img->height * 3u;
    img->data = (unsigned char *)malloc(n);
    if (!img->data) {
        fprintf(stderr, "ppm: out of memory for %zu bytes\n", n);
        return 1;
    }

    f = fopen(path, "rb");
    if (!f) { free(img->data); img->data = NULL; return 1; }
    fseek(f, offset, SEEK_SET);
    got = fread(img->data, 1, n, f);
    fclose(f);

    if (got != n) {
        fprintf(stderr, "ppm: truncated pixel data in '%s' (%zu/%zu bytes)\n",
                path, got, n);
        free(img->data);
        img->data = NULL;
        return 1;
    }
    return 0;
}

int ppm_write(const char *path, const PPMImage *img)
{
    FILE *f = fopen(path, "wb");
    size_t n = (size_t)img->width * (size_t)img->height * 3u;

    if (!f) { fprintf(stderr, "ppm: cannot write '%s'\n", path); return 1; }
    fprintf(f, "P6\n%d %d\n%d\n", img->width, img->height, img->maxval);
    if (fwrite(img->data, 1, n, f) != n) {
        fprintf(stderr, "ppm: short write to '%s'\n", path);
        fclose(f);
        return 1;
    }
    fclose(f);
    return 0;
}

int pgm_write(const char *path, const PGMImage *img)
{
    FILE *f = fopen(path, "wb");
    size_t n = (size_t)img->width * (size_t)img->height;

    if (!f) { fprintf(stderr, "pgm: cannot write '%s'\n", path); return 1; }
    fprintf(f, "P5\n%d %d\n%d\n", img->width, img->height, img->maxval);
    if (fwrite(img->data, 1, n, f) != n) {
        fprintf(stderr, "pgm: short write to '%s'\n", path);
        fclose(f);
        return 1;
    }
    fclose(f);
    return 0;
}

void ppm_free(PPMImage *img) { free(img->data); img->data = NULL; }
void pgm_free(PGMImage *img) { free(img->data); img->data = NULL; }
