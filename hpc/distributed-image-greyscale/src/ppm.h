/*
 * ppm.h -- Minimal binary Netpbm (P6 / P5) reader and writer.
 *
 * We deliberately avoid libpng/libjpeg so the project builds anywhere with
 * nothing but a C compiler and an MPI implementation. P6 (24-bit RGB) is the
 * input format, P5 (8-bit greyscale) is the output format. Both are raw
 * uncompressed byte streams, which keeps the measurement focused on the
 * parallel work rather than on a codec.
 */
#ifndef PPM_H
#define PPM_H

#include <stddef.h>

typedef struct {
    int width;
    int height;
    int maxval;
    unsigned char *data;   /* width*height*3 bytes, row-major, RGBRGB... */
} PPMImage;

typedef struct {
    int width;
    int height;
    int maxval;
    unsigned char *data;   /* width*height bytes, row-major */
} PGMImage;

/* Return 0 on success, non-zero on failure (message printed to stderr). */
int  ppm_read(const char *path, PPMImage *img);
int  ppm_write(const char *path, const PPMImage *img);
int  pgm_write(const char *path, const PGMImage *img);

/* Read only the P6 header; leaves the stream positioned at the first pixel
 * byte. Used by the MPI version so rank 0 can broadcast dimensions before
 * anyone allocates a full-size buffer. */
int  ppm_read_header(const char *path, int *width, int *height, int *maxval,
                     long *pixel_offset);

void ppm_free(PPMImage *img);
void pgm_free(PGMImage *img);

#endif /* PPM_H */
