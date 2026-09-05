/*
 * genimage.c -- Synthesise a deterministic colour PPM test image.
 *
 * Usage: genimage <width> <height> <output.ppm>
 *
 * The assignment asks for a High Definition image; rather than committing a
 * multi-megabyte binary to git we generate one on demand. The pattern mixes
 * smooth gradients (which compress the luma range) with a hashed noise field
 * (which does not), so the output greyscale is visually meaningful and the
 * per-pixel work is never optimised away by the compiler.
 */
#include "../src/ppm.h"

#include <stdio.h>
#include <stdlib.h>

/* Cheap integer hash -- reproducible on every machine, unlike rand(). */
static unsigned int hash2d(unsigned int x, unsigned int y)
{
    unsigned int h = x * 374761393u + y * 668265263u;
    h = (h ^ (h >> 13)) * 1274126177u;
    return h ^ (h >> 16);
}

int main(int argc, char **argv)
{
    PPMImage img;
    int x, y;
    size_t idx = 0;

    if (argc != 4) {
        fprintf(stderr, "usage: %s <width> <height> <output.ppm>\n", argv[0]);
        return 2;
    }
    img.width  = atoi(argv[1]);
    img.height = atoi(argv[2]);
    img.maxval = 255;
    if (img.width <= 0 || img.height <= 0) {
        fprintf(stderr, "genimage: width and height must be positive\n");
        return 2;
    }

    img.data = (unsigned char *)malloc((size_t)img.width * img.height * 3u);
    if (!img.data) {
        fprintf(stderr, "genimage: out of memory\n");
        return 1;
    }

    for (y = 0; y < img.height; ++y) {
        for (x = 0; x < img.width; ++x) {
            unsigned int n = hash2d((unsigned)x, (unsigned)y);
            /* Horizontal red ramp, vertical green ramp, diagonal blue bands,
             * plus +/-16 of stable noise on every channel. */
            int rr = (int)(255u * (unsigned)x / (unsigned)img.width);
            int gg = (int)(255u * (unsigned)y / (unsigned)img.height);
            int bb = (int)(((x + y) / 8) % 256);

            rr += (int)(n        & 31u) - 16;
            gg += (int)((n >> 5) & 31u) - 16;
            bb += (int)((n >> 10)& 31u) - 16;

            img.data[idx++] = (unsigned char)(rr < 0 ? 0 : rr > 255 ? 255 : rr);
            img.data[idx++] = (unsigned char)(gg < 0 ? 0 : gg > 255 ? 255 : gg);
            img.data[idx++] = (unsigned char)(bb < 0 ? 0 : bb > 255 ? 255 : bb);
        }
    }

    if (ppm_write(argv[3], &img)) { ppm_free(&img); return 1; }
    printf("genimage: wrote %s (%dx%d, %.1f MiB)\n", argv[3],
           img.width, img.height,
           (double)img.width * img.height * 3.0 / (1024.0 * 1024.0));
    ppm_free(&img);
    return 0;
}
