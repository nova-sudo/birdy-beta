/*
 * greyscale.h -- The colour-to-luma kernel shared by the sequential and the
 * MPI programs.
 *
 * Both programs call exactly the same function on exactly the same bytes, so
 * any timing difference between them comes from parallelisation and
 * communication, never from a different arithmetic path. Keeping it in a
 * header as `static inline` also lets the compiler vectorise it identically
 * in both binaries.
 */
#ifndef GREYSCALE_H
#define GREYSCALE_H

#include <stddef.h>

/*
 * ITU-R BT.601 luma:  Y = 0.299 R + 0.587 G + 0.114 B
 *
 * Implemented in 16-bit fixed point so the result is bit-for-bit identical on
 * every rank and on every machine. Floating point would be reproducible here
 * too, but integer maths removes any doubt when we diff the sequential and
 * the distributed output files.
 *
 *   round(0.299 * 65536) = 19595
 *   round(0.587 * 65536) = 38470
 *   round(0.114 * 65536) =  7471
 *   19595 + 38470 + 7471 = 65536  (exactly, so pure white stays 255)
 */
#define GS_WR 19595u
#define GS_WG 38470u
#define GS_WB  7471u

/*
 * Convert `pixels` RGB triplets at `rgb` into `pixels` luma bytes at `grey`.
 * The two buffers must not overlap. This is a pure map: output pixel i
 * depends only on input pixel i, which is what makes the problem
 * embarrassingly parallel.
 */
static inline void greyscale_kernel(const unsigned char *rgb,
                                    unsigned char *grey,
                                    size_t pixels)
{
    size_t i;
    for (i = 0; i < pixels; ++i) {
        unsigned int r = rgb[3u * i + 0u];
        unsigned int g = rgb[3u * i + 1u];
        unsigned int b = rgb[3u * i + 2u];
        grey[i] = (unsigned char)((GS_WR * r + GS_WG * g + GS_WB * b) >> 16);
    }
}

#endif /* GREYSCALE_H */
