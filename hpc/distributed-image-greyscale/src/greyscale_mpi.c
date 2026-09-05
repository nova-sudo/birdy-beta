/*
 * greyscale_mpi.c -- Distributed greyscale conversion.
 *
 * Usage: mpirun -np N greyscale_mpi <input.ppm> <output.pgm> [reps] [--mpiio]
 *
 * Two data-distribution strategies are implemented, because the difference
 * between them is the whole story of this project:
 *
 *   scatter mode (default)
 *       Rank 0 reads the entire PPM, MPI_Scatterv hands every rank a
 *       contiguous band of rows, each rank converts its band, MPI_Gatherv
 *       collects the luma bytes back on rank 0, rank 0 writes the PGM.
 *       This is the textbook decomposition, and it is bounded by rank 0's
 *       disk and by the two collectives.
 *
 *   --mpiio mode
 *       Every rank opens the file collectively and reads only its own band
 *       with MPI_File_read_at_all, converts it, and writes its own band with
 *       MPI_File_write_at_all. No scatter, no gather, no serial I/O
 *       bottleneck. This is what you would actually ship.
 *
 * Partitioning is by rows, never by pixels: a row is the smallest unit that
 * keeps every rank's slice contiguous in both the RGB input (3 bytes/pixel)
 * and the greyscale output (1 byte/pixel), so no rank ever holds a partial
 * pixel and no byte has to be shuffled between neighbours.
 */
#include "ppm.h"
#include "greyscale.h"

#include <mpi.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>

/*
 * Block row decomposition with remainder spreading.
 *
 * height = 1080 over 7 ranks gives 154 rows each with 2 left over, so ranks 0
 * and 1 take 155. The maximum imbalance is therefore exactly one row --
 * 1920 pixels out of 2 073 600, i.e. under 0.1% of the work. Handing the
 * whole remainder to the last rank instead would make it 6 rows late.
 */
static void partition_rows(int height, int nranks, int rank,
                           int *first_row, int *nrows)
{
    int base = height / nranks;
    int rem  = height % nranks;

    if (rank < rem) {
        *nrows     = base + 1;
        *first_row = rank * (base + 1);
    } else {
        *nrows     = base;
        *first_row = rem * (base + 1) + (rank - rem) * base;
    }
}

static void die(int rank, const char *msg)
{
    if (rank == 0) fprintf(stderr, "greyscale_mpi: %s\n", msg);
    MPI_Abort(MPI_COMM_WORLD, 1);
}

int main(int argc, char **argv)
{
    int rank, nranks;
    int width = 0, height = 0, maxval = 0;
    long pixel_offset = 0;
    int hdr[4];
    int reps = 1, r, use_mpiio = 0, i, err = 0;
    int first_row = 0, my_rows = 0;
    size_t my_pixels, my_rgb_bytes;
    unsigned char *my_rgb = NULL, *my_grey = NULL;
    unsigned char *whole_rgb = NULL, *whole_grey = NULL;
    int *rgb_counts = NULL, *rgb_displs = NULL;
    int *grey_counts = NULL, *grey_displs = NULL;
    double t_start, t_read = 0, t_scatter = 0, t_compute = 0, t_gather = 0,
           t_write = 0, t_total = 0, best_compute = 0, t_extra_reps = 0;
    double max_compute, max_read, max_write, max_scatter, max_gather,
           max_total;

    MPI_Init(&argc, &argv);
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &nranks);

    if (argc < 3) {
        if (rank == 0)
            fprintf(stderr,
                    "usage: mpirun -np N %s <input.ppm> <output.pgm> "
                    "[repetitions] [--mpiio]\n", argv[0]);
        MPI_Finalize();
        return 2;
    }
    for (i = 3; i < argc; ++i) {
        if (strcmp(argv[i], "--mpiio") == 0) use_mpiio = 1;
        else {
            reps = atoi(argv[i]);
            if (reps < 1) reps = 1;
        }
    }

    /* ---- Header: read once on rank 0, broadcast to everybody ------------
     * Four ints is nothing, but broadcasting them is what lets the other
     * ranks size their buffers before any pixel moves. */
    if (rank == 0) {
        if (ppm_read_header(argv[1], &width, &height, &maxval, &pixel_offset))
            err = 1;
        hdr[0] = width; hdr[1] = height; hdr[2] = maxval;
        hdr[3] = (int)pixel_offset;
    }
    MPI_Bcast(&err, 1, MPI_INT, 0, MPI_COMM_WORLD);
    if (err) { MPI_Finalize(); return 1; }
    MPI_Bcast(hdr, 4, MPI_INT, 0, MPI_COMM_WORLD);
    width = hdr[0]; height = hdr[1]; maxval = hdr[2];
    pixel_offset = hdr[3];

    if (nranks > height)
        die(rank, "more ranks than image rows; a rank would get zero work");
    if ((double)width * height * 3.0 > (double)INT_MAX)
        die(rank, "image exceeds the 2 GiB int-count limit of the scatter "
                  "path; use --mpiio");

    partition_rows(height, nranks, rank, &first_row, &my_rows);
    my_pixels    = (size_t)width * (size_t)my_rows;
    my_rgb_bytes = my_pixels * 3u;

    my_rgb  = (unsigned char *)malloc(my_rgb_bytes);
    my_grey = (unsigned char *)malloc(my_pixels);
    if (!my_rgb || !my_grey) die(rank, "out of memory for the local band");

    MPI_Barrier(MPI_COMM_WORLD);
    t_start = MPI_Wtime();

    if (!use_mpiio) {
        /* ---- Scatter path ------------------------------------------- */
        rgb_counts  = (int *)malloc(nranks * sizeof(int));
        rgb_displs  = (int *)malloc(nranks * sizeof(int));
        grey_counts = (int *)malloc(nranks * sizeof(int));
        grey_displs = (int *)malloc(nranks * sizeof(int));
        if (!rgb_counts || !rgb_displs || !grey_counts || !grey_displs)
            die(rank, "out of memory for the partition tables");

        for (i = 0; i < nranks; ++i) {
            int fr, nr;
            partition_rows(height, nranks, i, &fr, &nr);
            rgb_counts[i]  = nr * width * 3;
            rgb_displs[i]  = fr * width * 3;
            grey_counts[i] = nr * width;
            grey_displs[i] = fr * width;
        }

        if (rank == 0) {
            PPMImage in;
            double s = MPI_Wtime();
            if (ppm_read(argv[1], &in)) err = 1;
            t_read = MPI_Wtime() - s;
            if (!err) {
                whole_rgb  = in.data;              /* ownership transferred */
                whole_grey = (unsigned char *)malloc((size_t)width * height);
                if (!whole_grey) err = 1;
            }
        }
        MPI_Bcast(&err, 1, MPI_INT, 0, MPI_COMM_WORLD);
        if (err) die(rank, "rank 0 could not load the image");

        {
            double s = MPI_Wtime();
            MPI_Scatterv(whole_rgb, rgb_counts, rgb_displs, MPI_UNSIGNED_CHAR,
                         my_rgb, (int)my_rgb_bytes, MPI_UNSIGNED_CHAR,
                         0, MPI_COMM_WORLD);
            t_scatter = MPI_Wtime() - s;
        }
    } else {
        /* ---- Parallel I/O path --------------------------------------- */
        MPI_File fh;
        MPI_Status st;
        double s = MPI_Wtime();

        if (MPI_File_open(MPI_COMM_WORLD, argv[1], MPI_MODE_RDONLY,
                          MPI_INFO_NULL, &fh) != MPI_SUCCESS)
            die(rank, "MPI_File_open failed on the input image");
        MPI_File_read_at_all(fh,
                             (MPI_Offset)pixel_offset +
                                 (MPI_Offset)first_row * width * 3,
                             my_rgb, (int)my_rgb_bytes, MPI_UNSIGNED_CHAR, &st);
        MPI_File_close(&fh);
        t_read = MPI_Wtime() - s;
    }

    /* ---- The parallel work itself -------------------------------------
     * Each rank owns a disjoint band, so there is no halo, no reduction and
     * no synchronisation inside the loop. */
    for (r = 0; r < reps; ++r) {
        double s = MPI_Wtime(), e;
        greyscale_kernel(my_rgb, my_grey, my_pixels);
        e = MPI_Wtime() - s;
        t_compute += e;
        if (r == 0 || e < best_compute) best_compute = e;
    }
    t_extra_reps = t_compute - best_compute;   /* charged to nobody */
    t_compute /= reps;

    if (!use_mpiio) {
        double s = MPI_Wtime();
        MPI_Gatherv(my_grey, (int)my_pixels, MPI_UNSIGNED_CHAR,
                    whole_grey, grey_counts, grey_displs, MPI_UNSIGNED_CHAR,
                    0, MPI_COMM_WORLD);
        t_gather = MPI_Wtime() - s;

        if (rank == 0) {
            PGMImage out;
            out.width = width; out.height = height; out.maxval = 255;
            out.data = whole_grey;
            s = MPI_Wtime();
            if (pgm_write(argv[2], &out)) err = 1;
            t_write = MPI_Wtime() - s;
        }
    } else {
        MPI_File fh;
        MPI_Status st;
        char header[64];
        int header_len;
        double s = MPI_Wtime();

        header_len = snprintf(header, sizeof(header), "P5\n%d %d\n255\n",
                              width, height);

        MPI_File_delete(argv[2], MPI_INFO_NULL);   /* stale file would keep
                                                    * its old length */
        MPI_Barrier(MPI_COMM_WORLD);
        if (MPI_File_open(MPI_COMM_WORLD, argv[2],
                          MPI_MODE_CREATE | MPI_MODE_WRONLY,
                          MPI_INFO_NULL, &fh) != MPI_SUCCESS)
            die(rank, "MPI_File_open failed on the output image");
        if (rank == 0)
            MPI_File_write_at(fh, 0, header, header_len, MPI_CHAR, &st);
        MPI_File_write_at_all(fh,
                              (MPI_Offset)header_len +
                                  (MPI_Offset)first_row * width,
                              my_grey, (int)my_pixels, MPI_UNSIGNED_CHAR, &st);
        MPI_File_close(&fh);
        t_write = MPI_Wtime() - s;
    }

    /* The repetition loop is a measurement device, not part of the job: a
     * real conversion runs the kernel once. Subtract the surplus iterations
     * so this total is directly comparable to the sequential total. */
    t_total = (MPI_Wtime() - t_start) - t_extra_reps;

    /* The cost of a parallel phase is set by its slowest rank, so we reduce
     * with MPI_MAX rather than averaging. */
    MPI_Reduce(&best_compute, &max_compute, 1, MPI_DOUBLE, MPI_MAX, 0,
               MPI_COMM_WORLD);
    MPI_Reduce(&t_read,    &max_read,    1, MPI_DOUBLE, MPI_MAX, 0, MPI_COMM_WORLD);
    MPI_Reduce(&t_write,   &max_write,   1, MPI_DOUBLE, MPI_MAX, 0, MPI_COMM_WORLD);
    MPI_Reduce(&t_scatter, &max_scatter, 1, MPI_DOUBLE, MPI_MAX, 0, MPI_COMM_WORLD);
    MPI_Reduce(&t_gather,  &max_gather,  1, MPI_DOUBLE, MPI_MAX, 0, MPI_COMM_WORLD);
    MPI_Reduce(&t_total,   &max_total,   1, MPI_DOUBLE, MPI_MAX, 0, MPI_COMM_WORLD);

    if (rank == 0) {
        size_t pixels = (size_t)width * (size_t)height;
        printf("mode=%s procs=%d width=%d height=%d pixels=%zu reps=%d\n",
               use_mpiio ? "mpi-mpiio" : "mpi-scatter",
               nranks, width, height, pixels, reps);
        printf("read_s=%.6f scatter_s=%.6f compute_s=%.6f gather_s=%.6f "
               "write_s=%.6f total_s=%.6f\n",
               max_read, max_scatter, max_compute, max_gather, max_write,
               max_total);
        printf("throughput_mpixels_per_s=%.2f\n",
               (double)pixels / max_compute / 1e6);
    }

    free(my_rgb);
    free(my_grey);
    free(whole_rgb);
    free(whole_grey);
    free(rgb_counts); free(rgb_displs);
    free(grey_counts); free(grey_displs);

    MPI_Finalize();
    return err;
}
