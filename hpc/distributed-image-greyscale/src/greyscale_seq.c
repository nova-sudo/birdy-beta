/*
 * greyscale_seq.c -- Sequential baseline.
 *
 * Usage: greyscale_seq <input.ppm> <output.pgm> [repetitions]
 *
 * Reports read / compute / write times separately. The compute time is the
 * only part the MPI version can shrink, so reporting it on its own is what
 * makes the speed-up numbers in the report honest.
 */
/* clock_gettime is POSIX, not ISO C99; -std=c99 hides it without this. */
#define _POSIX_C_SOURCE 199309L

#include "ppm.h"
#include "greyscale.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

static double now_seconds(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec + (double)ts.tv_nsec * 1e-9;
}

int main(int argc, char **argv)
{
    PPMImage in;
    PGMImage out;
    size_t pixels;
    int reps = 1, r;
    double t0, t_read, t_compute, t_write, best_compute = 0.0;

    if (argc < 3 || argc > 4) {
        fprintf(stderr,
                "usage: %s <input.ppm> <output.pgm> [repetitions]\n", argv[0]);
        return 2;
    }
    if (argc == 4) {
        reps = atoi(argv[3]);
        if (reps < 1) reps = 1;
    }

    t0 = now_seconds();
    if (ppm_read(argv[1], &in)) return 1;
    t_read = now_seconds() - t0;

    pixels = (size_t)in.width * (size_t)in.height;
    out.width  = in.width;
    out.height = in.height;
    out.maxval = 255;
    out.data   = (unsigned char *)malloc(pixels);
    if (!out.data) {
        fprintf(stderr, "seq: out of memory for %zu bytes\n", pixels);
        ppm_free(&in);
        return 1;
    }

    /* Repetitions let us average away scheduler noise on small images. We
     * report the fastest run: it is the one least polluted by interference,
     * and the MPI program applies the same rule so the two are comparable. */
    t_compute = 0.0;
    for (r = 0; r < reps; ++r) {
        double s = now_seconds(), e;
        greyscale_kernel(in.data, out.data, pixels);
        e = now_seconds() - s;
        t_compute += e;
        if (r == 0 || e < best_compute) best_compute = e;
    }
    t_compute /= reps;   /* mean, kept only as a noise indicator */

    t0 = now_seconds();
    if (pgm_write(argv[2], &out)) {
        ppm_free(&in);
        pgm_free(&out);
        return 1;
    }
    t_write = now_seconds() - t0;

    printf("mode=sequential procs=1 width=%d height=%d pixels=%zu reps=%d\n",
           in.width, in.height, pixels, reps);
    printf("read_s=%.6f compute_s=%.6f compute_mean_s=%.6f write_s=%.6f "
           "total_s=%.6f\n",
           t_read, best_compute, t_compute, t_write,
           t_read + best_compute + t_write);
    printf("throughput_mpixels_per_s=%.2f\n",
           (double)pixels / best_compute / 1e6);

    ppm_free(&in);
    pgm_free(&out);
    return 0;
}
