#!/usr/bin/env bash
#
# make_bundle.sh -- Assemble the submission zip.
#
# The layout is organised for a reader who has never seen the project: the
# presentation first, then the two implementations kept separate (each one
# self-contained and independently compilable), then the evidence.
#
# Usage: bash bench/make_bundle.sh   ->  dist/Distributed_Image_Greyscale.zip

set -euo pipefail
cd "$(dirname "$0")/.."

NAME="Distributed_Image_Greyscale"
STAGE="dist/$NAME"

rm -rf dist
mkdir -p "$STAGE"/{01_Sequential_Code,02_MPI_Code,03_Logs_and_Data,04_Spreadsheets,05_Report}

# ---- 00 presentation + top-level guide --------------------------------
cp docs/presentation.html "$STAGE/Project_Presentation.html"

# ---- 01 sequential: self-contained, no MPI needed ---------------------
cp src/greyscale_seq.c src/greyscale.h src/ppm.c src/ppm.h "$STAGE/01_Sequential_Code/"
cp tools/genimage.c "$STAGE/01_Sequential_Code/"
cat > "$STAGE/01_Sequential_Code/Makefile" <<'MK'
# Sequential build -- needs only a C compiler, no MPI.
CC     ?= gcc
CFLAGS ?= -O2 -Wall -Wextra -std=c99

all: greyscale_seq genimage

greyscale_seq: greyscale_seq.c ppm.c ppm.h greyscale.h
	$(CC) $(CFLAGS) -o $@ greyscale_seq.c ppm.c

genimage: genimage.c ppm.c ppm.h
	$(CC) $(CFLAGS) -o $@ genimage.c ppm.c

# Generate an HD image and convert it.
demo: all
	./genimage 1920 1080 hd.ppm
	./greyscale_seq hd.ppm hd_grey.pgm 20

clean:
	rm -f greyscale_seq genimage *.ppm *.pgm
MK
# genimage.c includes "../src/ppm.h"; here ppm.h sits alongside it.
sed -i 's|#include "../src/ppm.h"|#include "ppm.h"|' "$STAGE/01_Sequential_Code/genimage.c"

cat > "$STAGE/01_Sequential_Code/README.txt" <<'TXT'
SEQUENTIAL IMPLEMENTATION
=========================

  greyscale_seq.c   the sequential program (main, timing, phase reporting)
  greyscale.h       the BT.601 fixed-point kernel  <-- IDENTICAL to the MPI copy
  ppm.c / ppm.h     binary PPM (P6) reader, PGM (P5) writer
  genimage.c        deterministic HD/4K/8K test-image generator
  Makefile

Build and run:

  make demo

or manually:

  make
  ./genimage 1920 1080 hd.ppm
  ./greyscale_seq hd.ppm hd_grey.pgm 20
                  ^input    ^output    ^kernel repetitions (timing only)

Output is one key=value line per phase:

  read_s= compute_s= compute_mean_s= write_s= total_s=

WHY greyscale.h IS DUPLICATED HERE AND IN 02_MPI_Code
-----------------------------------------------------
It is byte-for-byte the same file. Both programs include it, so they execute
identical instructions on identical bytes, and every timing difference between
them is attributable to parallelisation alone -- never to a different
arithmetic path or a different compiler decision. Verify with:

  diff 01_Sequential_Code/greyscale.h 02_MPI_Code/greyscale.h
TXT

# ---- 02 MPI -----------------------------------------------------------
cp src/greyscale_mpi.c src/greyscale.h src/ppm.c src/ppm.h "$STAGE/02_MPI_Code/"
cp tools/mpi_startup.c "$STAGE/02_MPI_Code/"
cat > "$STAGE/02_MPI_Code/Makefile" <<'MK'
# MPI build -- needs an MPI implementation (mpicc / mpirun).
MPICC  ?= mpicc
CFLAGS ?= -O2 -Wall -Wextra -std=c99

all: greyscale_mpi mpi_startup

greyscale_mpi: greyscale_mpi.c ppm.c ppm.h greyscale.h
	$(MPICC) $(CFLAGS) -o $@ greyscale_mpi.c ppm.c

mpi_startup: mpi_startup.c
	$(MPICC) $(CFLAGS) -o $@ mpi_startup.c

clean:
	rm -f greyscale_mpi mpi_startup *.pgm
MK
cat > "$STAGE/02_MPI_Code/README.txt" <<'TXT'
MPI IMPLEMENTATION
==================

  greyscale_mpi.c   the distributed program, BOTH strategies
  greyscale.h       the BT.601 fixed-point kernel  <-- IDENTICAL to the sequential copy
  ppm.c / ppm.h     binary PPM (P6) reader, PGM (P5) writer
  mpi_startup.c     measures the fixed MPI_Init + MPI_Finalize cost
  Makefile

Build:

  make

Run -- strategy A, MPI_Scatterv / MPI_Gatherv (the textbook decomposition):

  mpirun -np 4 ./greyscale_mpi hd.ppm out.pgm 20

Run -- strategy B, collective MPI-IO (no pixel crosses a rank boundary):

  mpirun -np 4 ./greyscale_mpi hd.ppm out.pgm 20 --mpiio

Measure the fixed cost of entering and leaving MPI:

  mpirun -np 4 ./mpi_startup

Generate the input image with genimage from 01_Sequential_Code, or use any
binary PPM (P6) file with 8-bit samples.

WHERE TO LOOK IN greyscale_mpi.c
--------------------------------
  partition_rows()        the row-band decomposition and remainder spreading
  MPI_Bcast(hdr, ...)     header broadcast, before any pixel is allocated
  the !use_mpiio branch   strategy A: Scatterv -> kernel -> Gatherv
  the use_mpiio branch    strategy B: read_at_all -> kernel -> write_at_all
  MPI_Reduce(..., MPI_MAX) phase timing: a phase costs what its slowest rank costs

RUNNING AS ROOT IN A CONTAINER
------------------------------
  export OMPI_ALLOW_RUN_AS_ROOT=1 OMPI_ALLOW_RUN_AS_ROOT_CONFIRM=1
  add --oversubscribe to mpirun if you ask for more ranks than cores.
TXT

# ---- 03 logs and data -------------------------------------------------
cp -r logs "$STAGE/03_Logs_and_Data/logs"
cp results/benchmark.csv results/environment.txt results/analysis.md "$STAGE/03_Logs_and_Data/"
cat > "$STAGE/03_Logs_and_Data/README.txt" <<'TXT'
LOGS AND MEASURED DATA
======================

logs/                     raw, untouched program output -- the primary evidence
  00_build.log            compiler invocations and warnings (clean build)
  01_environment.log      CPU, cache, memory, compiler, MPI version, and the
                          measured MPI_Init + MPI_Finalize cost at every P
  02_correctness.log      cmp + SHA-256 of all 24 MPI outputs against the
                          sequential reference. THIS IS THE CORRECTNESS PROOF.
  10_sequential_<res>.log sequential run, one file per resolution
  20_scatter_<res>_p<N>.log   strategy A, one file per resolution and rank count
  30_mpiio_<res>_p<N>.log     strategy B, one file per resolution and rank count
  99_session.log          all of the above concatenated, in order

benchmark.csv             the timing table: one row per configuration, best of
                          9 trials. This is what the spreadsheets and the
                          report's tables are computed from.
environment.txt           machine, toolchain and startup cost, recorded by the
                          benchmark script at the moment it ran
analysis.md               speed-up and efficiency tables generated from
                          benchmark.csv by bench/analyze.py

A NOTE ON TWO DIFFERENT NUMBERS
-------------------------------
The per-run logs in logs/ are single uncached runs, so their read/write times
are noticeably slower than benchmark.csv, which reports the best of 9 trials
with a warm page cache. The compute times agree closely, because compute does
not touch the disk. Both are honest; they answer different questions -- "what
happened on this one cold run" versus "what is this configuration capable of".
Every figure quoted in the report and the presentation comes from benchmark.csv.
TXT

# ---- 04 spreadsheets --------------------------------------------------
cp results/Comparison_Sequential_vs_MPI.xlsx "$STAGE/04_Spreadsheets/"
# Clear the tool name openpyxl leaves in the author field.
python3 bench/set_doc_props.py "$STAGE/04_Spreadsheets/Comparison_Sequential_vs_MPI.xlsx" ""
cp results/benchmark.csv "$STAGE/04_Spreadsheets/benchmark_raw_data.csv"
python3 bench/export_csv_tables.py "$STAGE/04_Spreadsheets"
cat > "$STAGE/04_Spreadsheets/README.txt" <<'TXT'
COMPARISON SPREADSHEETS
=======================

Comparison_Sequential_vs_MPI.xlsx      the main workbook, 6 sheets:

  README                  legend and method
  Raw Data                every measured run. BLUE cells are measured inputs;
                          every other sheet is live formulas over this one, so
                          changing a measured time recalculates the workbook
  Compute Comparison      compute time, speed-up and parallel efficiency,
                          with a speed-up-vs-ideal chart per resolution
  End-to-End Comparison   whole-program time and speed-up -- the honest number
  Overhead Analysis       communication cost set against the computation it was
                          meant to accelerate (ratio > 1 means it cannot win)
  MPI Startup Cost        the fixed MPI_Init + MPI_Finalize bill, with a chart

Plain-CSV copies of the same tables, for anyone who would rather not open Excel:

  benchmark_raw_data.csv        identical to 03_Logs_and_Data/benchmark.csv
  table_compute_comparison.csv
  table_end_to_end_comparison.csv
  table_overhead_analysis.csv
  table_mpi_startup_cost.csv

All 408 formulas in the workbook were recalculated and verified error-free.
TXT

# ---- 05 report --------------------------------------------------------
cp REPORT.md "$STAGE/05_Report/"
cp README.md "$STAGE/05_Report/PROJECT_README.md"

# ---- top-level guide --------------------------------------------------
cp docs/START_HERE.txt "$STAGE/START_HERE.txt"

# ---- zip --------------------------------------------------------------
( cd dist && zip -qr "$NAME.zip" "$NAME" )
echo "wrote dist/$NAME.zip"
( cd dist && unzip -l "$NAME.zip" | tail -3 )
