/*
 * mpi_startup.c -- Measure what MPI costs before any pixel is touched.
 *
 * Usage: mpirun -np N mpi_startup
 *
 * MPI_Init has to wire up the runtime, discover peers and set up shared-memory
 * segments. On a small workload that fixed cost can dwarf the job itself, so
 * the report quotes a measured figure rather than hand-waving about "some
 * overhead". Timing MPI_Init requires MPI_Wtime, which Open MPI supports
 * before MPI_Init; if a strict implementation refuses, the figure can be taken
 * from wall-clock time around the whole binary instead.
 */
#include <mpi.h>
#include <stdio.h>

int main(int argc, char **argv)
{
    double t0, t1, t2;
    int rank;

    t0 = MPI_Wtime();
    MPI_Init(&argc, &argv);
    t1 = MPI_Wtime();

    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Barrier(MPI_COMM_WORLD);
    MPI_Finalize();
    t2 = MPI_Wtime();

    if (rank == 0)
        printf("init_ms=%.3f finalize_ms=%.3f startup_total_ms=%.3f\n",
               (t1 - t0) * 1000.0, (t2 - t1) * 1000.0, (t2 - t0) * 1000.0);
    return 0;
}
