# Distributed Image Greyscale — Sequential vs. MPI (C)

Convert a High Definition colour image to greyscale, implemented twice —
once sequentially and once distributed with MPI — and measure the difference
honestly.

Full write-up: **[REPORT.md](REPORT.md)** · Measured data:
[results/analysis.md](results/analysis.md) ·
Slides: [docs/presentation.html](docs/presentation.html)

## Quick start

```bash
make                 # build all four binaries
make image           # generate the 1920x1080 HD test image
make check           # convert 3 ways and prove the outputs are byte-identical
make bench           # full scaling study -> results/benchmark.csv
python3 bench/analyze.py     # -> results/analysis.md
```

Requires a C compiler and any MPI implementation (`gcc` + `mpicc`). Nothing
else — the PPM/PGM codec is ~150 lines in `src/ppm.c`, so there is no
libpng/libjpeg dependency and no image decoder in the timing path.

## Running the programs directly

```bash
./bin/greyscale_seq  input.ppm out.pgm [reps]

mpirun -np 4 ./bin/greyscale_mpi input.ppm out.pgm [reps]            # scatter/gather
mpirun -np 4 ./bin/greyscale_mpi input.ppm out.pgm [reps] --mpiio    # parallel I/O
```

`reps` repeats the kernel in-process to get a clean measurement on small
images; it does not change the output. Both programs print one `key=value`
line per phase (`read_s`, `scatter_s`, `compute_s`, `gather_s`, `write_s`,
`total_s`), which is what `bench/run_benchmark.sh` parses.

Running as root in a container needs
`export OMPI_ALLOW_RUN_AS_ROOT=1 OMPI_ALLOW_RUN_AS_ROOT_CONFIRM=1`, and
`--oversubscribe` if you ask for more ranks than cores. The benchmark script
sets both.

## What is here

| path | |
|---|---|
| `src/greyscale.h` | the BT.601 fixed-point kernel — included by **both** programs, so they run identical instructions |
| `src/ppm.c/.h` | binary PPM (P6) reader, PGM (P5) writer |
| `src/greyscale_seq.c` | sequential baseline |
| `src/greyscale_mpi.c` | distributed version, both strategies |
| `tools/genimage.c` | deterministic HD/4K/8K test-image generator |
| `tools/mpi_startup.c` | measures the fixed `MPI_Init`/`MPI_Finalize` cost |
| `bench/run_benchmark.sh` | resolution × ranks × strategy sweep, re-verifies correctness after every run |
| `bench/analyze.py` | CSV → speed-up and efficiency tables |

Generated images and binaries are not committed; `make image` recreates them
byte-for-byte (the generator is a deterministic hash, not `rand()`).

## Headline results

4-core Xeon @ 2.80 GHz, Open MPI 4.1.6, gcc 13.3 `-O2`, best of 9 trials:

| | HD 1920×1080 | 4K 3840×2160 | 8K 7680×4320 |
|---|---:|---:|---:|
| **compute speed-up** @ 4 ranks | **4.11×** | **4.16×** | **3.97×** |
| end-to-end, scatter/gather | 0.54× | 0.61× | 0.69× |
| end-to-end, MPI-IO (best) | 0.88× | 1.10× | **1.70×** |

The parallel work scales at ~100 % efficiency; the *program* does not, because
greyscale conversion is memory-bandwidth bound (1.5 ops/byte) and moving the
image between ranks costs about 2.6× more than converting it. Replacing
`Scatterv`/`Gatherv` with collective MPI-IO — so no pixel ever crosses a rank
boundary — is what turns a loss into a win. See
[REPORT.md](REPORT.md) §2.2, §5.2 and §6.

## Correctness

Fixed-point arithmetic makes the result bit-identical everywhere, so
correctness is an exact test rather than an epsilon comparison:

```
$ make check
cmp images/out_seq.pgm images/out_mpi.pgm
cmp images/out_seq.pgm images/out_mpiio.pgm
OK: MPI output is byte-identical to the sequential output
```

`bench/run_benchmark.sh` repeats this after every run at every process count,
so no timing is ever reported for a configuration that produced a wrong image.

## Slides

`docs/presentation.html` is a self-contained 11-slide deck (arrow keys to
advance, print to PDF from the browser).
