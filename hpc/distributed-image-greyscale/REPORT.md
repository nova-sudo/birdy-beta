# Distributed Image Greyscale — Sequential vs. MPI in C

**Project 1 — Distributed image grey scale.** For a High Definition image,
generate a greyscale image; implement it sequentially and with MPI in C, and
measure the improvement between the two solutions.

All numbers in this report were produced by the code in this directory on the
machine recorded in `results/environment.txt`, and can be regenerated with
`make bench && python3 bench/analyze.py`. The full table is in
[`results/analysis.md`](results/analysis.md); the raw rows are in
[`results/benchmark.csv`](results/benchmark.csv).

---

## 1. The problem

A colour image stores three bytes per pixel — red, green and blue. A greyscale
image stores one byte per pixel: the *luma*, or perceived brightness. Producing
the greyscale version means computing, for every pixel independently,

> **Y = 0.299·R + 0.587·G + 0.114·B**   (ITU-R BT.601)

The weights are unequal because the human eye is far more sensitive to green
than to blue; a naive `(R+G+B)/3` produces a visibly wrong image, with blue
skies too bright and foliage too dark.

At High Definition, 1920 × 1080, that is **2 073 600 pixels**: 5.9 MiB of RGB in,
2.0 MiB of luma out. We also test 4K (8.3 MPixel) and 8K (33.2 MPixel), because
— as Section 5 shows — HD turns out to be *too small* to be an interesting
parallel problem on a modern CPU, and saying so is part of the answer.

**The engineering question is not "can we compute Y".** It is: given P
processors, how do we split the image so that the work divides cleanly, the
data movement does not eat the gain, and the distributed output is
bit-for-bit identical to the sequential one?

---

## 2. The analysis

### 2.1 Dependency structure

Output pixel *i* depends **only** on input pixel *i*. There is no neighbourhood
(unlike a blur or a Sobel edge filter), no accumulator (unlike a histogram),
and no ordering constraint. In parallel-computing terms the problem is
***embarrassingly parallel***: the dependency graph is 2 073 600 disconnected
nodes.

Consequences, and they are the whole design:

* **No halo exchange.** A stencil filter would need each rank to borrow rows
  from its neighbours. We need zero.
* **No reduction.** Nothing has to be combined at the end.
* **No synchronisation inside the loop.** Ranks never wait for one another
  while computing.
* **Perfect theoretical scalability.** Amdahl's serial fraction of the
  *computation* is 0.

### 2.2 Arithmetic intensity — the real bottleneck

Per pixel the kernel does 3 multiplies, 2 adds and a shift on 3 bytes in and
1 byte out:

> **Arithmetic intensity ≈ 6 operations / 4 bytes = 1.5 ops/byte**

That is very low. The [roofline model](https://en.wikipedia.org/wiki/Roofline_model)
says such a kernel is **memory-bandwidth bound**, not compute bound: the CPU
spends its time waiting for bytes, not multiplying them. Our own measurement
confirms it — the sequential kernel sustains ~1.1 GPixel/s, i.e. ~4.4 GB/s of
traffic, which is DRAM-class throughput, not ALU-class.

**This single fact predicts every result in Section 6:**

1. Adding cores helps, because each core brings its own load/store ports and
   L1/L2 cache — but it will saturate at the memory controller, not at *P*.
2. Moving the image between ranks costs *more* than converting it. Scattering
   6 MiB and gathering 2 MiB is 8 MiB of traffic to save 1.9 ms of work that
   itself only touches 8 MiB. **Communication and computation are the same
   order of magnitude**, which is the worst possible ratio for a distributed
   implementation.
3. Therefore the naive "rank 0 reads, scatters, gathers, writes" design — the
   one every textbook shows first — is expected to be *slower than sequential*.
   We implemented it anyway, measured it, and then implemented the design that
   fixes it.

### 2.3 Cost model

Let *N* = pixels, *P* = ranks, *B* = per-rank memory bandwidth, *β* = network/
IPC bandwidth, *D* = disk bandwidth.

| | Sequential | MPI (scatter/gather) | MPI (parallel I/O) |
|---|---|---|---|
| read | 3N / D | 3N / D (rank 0 only) | 3N / (P·D) shared |
| distribute | — | 3N / β | — |
| compute | 4N / B | 4N / (P·B) | 4N / (P·B) |
| collect | — | N / β | — |
| write | N / D | N / D (rank 0 only) | N / (P·D) shared |

The scatter/gather column contains two terms the sequential column does not,
and *neither of them divides by P*. That is the entire story.

---

## 3. Data partitioning

### 3.1 Choice of granularity: rows, not pixels, not tiles

| Scheme | Verdict |
|---|---|
| **Per-pixel (cyclic)** | Rejected. Perfect balance, but every rank's data is strided, destroying cache locality and making the MPI transfer a gather of 2M tiny blocks. |
| **2-D tiles** | Rejected. Necessary for stencils that need 2-D neighbourhoods; here it buys nothing and each tile row is discontiguous in memory, requiring a derived datatype and a strided copy. |
| **Contiguous row bands** | **Chosen.** |

A row band is contiguous in *both* buffers simultaneously: rows
`[first, first+n)` occupy bytes `[first·W·3, (first+n)·W·3)` of the RGB image
and bytes `[first·W, (first+n)·W)` of the luma image. So one `MPI_Scatterv`
with plain `MPI_UNSIGNED_CHAR` moves it — no derived datatypes, no packing,
and every rank streams linearly through memory, which is exactly what a
bandwidth-bound kernel wants.

Crucially, **a row is also the smallest unit that never splits a pixel.**
Splitting the byte stream at an arbitrary offset could leave a rank holding
`GB` of one pixel and `R` of the next.

### 3.2 Handling a height that does not divide by P

1080 rows over 7 ranks is 154 remainder 2. We spread the remainder one row at
a time over the lowest-numbered ranks rather than dumping it on the last rank:

```c
if (rank < rem) { nrows = base + 1;  first = rank * (base + 1); }
else            { nrows = base;      first = rem * (base+1) + (rank-rem)*base; }
```

Maximum imbalance is therefore **exactly one row** — 1920 of 2 073 600 pixels,
under 0.1 % — instead of *rem* rows. With `1080 / 7`, dumping the remainder on
the last rank would make it 2 rows late instead of 1; at larger *P* the gap
grows linearly while ours stays at 1.

### 3.3 What each rank knows

Rank 0 reads the 15-byte PPM header and `MPI_Bcast`s `{width, height, maxval,
pixel_offset}`. Every rank then computes its own band with the same pure
function — no rank has to be *told* its slice, so there is no bookkeeping
message, and the partitioning table used by `Scatterv` is derived by calling
the same function in a loop.

### 3.4 The layout, in one picture

```
 1920x1080 RGB, P = 4                      luma output
 +--------------------------------+        +----------------+
 | rank 0 : rows    0 .. 269      |  ---.  | rows    0..269 |
 +--------------------------------+     |  +----------------+
 | rank 1 : rows  270 .. 539      |  ---+  | rows  270..539 |
 +--------------------------------+     |  +----------------+
 | rank 2 : rows  540 .. 809      |  ---+  | rows  540..809 |
 +--------------------------------+     |  +----------------+
 | rank 3 : rows  810 .. 1079     |  ---'  | rows  810..1079|
 +--------------------------------+        +----------------+
   1 555 200 bytes each                      518 400 bytes each
```

---

## 4. The solution

### 4.1 Repository layout

```
src/greyscale.h       the kernel, shared verbatim by both programs
src/ppm.c/.h          binary PPM (P6) reader, PGM (P5) writer
src/greyscale_seq.c   sequential baseline
src/greyscale_mpi.c   distributed version, two strategies
tools/genimage.c      deterministic HD/4K/8K test-image generator
bench/run_benchmark.sh + analyze.py
```

### 4.2 The kernel (identical in both programs)

`greyscale.h` is included by both binaries, so the sequential and the parallel
program execute *the same instructions on the same bytes*. Any time
difference is attributable to parallelisation alone — not to a different
arithmetic path, a different compiler decision, or a different rounding mode.

It uses **16-bit fixed point** rather than floating point:

```c
#define GS_WR 19595u   /* round(0.299 * 65536) */
#define GS_WG 38470u   /* round(0.587 * 65536) */
#define GS_WB  7471u   /* round(0.114 * 65536) */
/* sum == 65536 exactly, so pure white maps to exactly 255 */
grey[i] = (GS_WR*r + GS_WG*g + GS_WB*b) >> 16;
```

Two reasons. First, integer arithmetic is associativity-safe, so the result is
**bit-identical on every rank and every machine** — which lets us test
correctness with `cmp`, an exact test, instead of an epsilon comparison.
Second, the weights sum to exactly 2^16, guaranteeing the output uses the full
0–255 range with no clamping.

### 4.3 Strategy A — `MPI_Scatterv` / `MPI_Gatherv` (the textbook design)

```
rank 0: read whole PPM
  all: MPI_Bcast header
  all: MPI_Scatterv  RGB band  -->  every rank
  all: greyscale_kernel(local band)          <-- fully parallel
  all: MPI_Gatherv   luma band  -->  rank 0
rank 0: write whole PGM
```

`Scatterv`/`Gatherv` (the *v* variants) are used rather than `Scatter`/`Gather`
precisely because of §3.2: the bands are not all the same size, so we must
supply explicit `counts[]` and `displs[]` arrays.

### 4.4 Strategy B — MPI-IO (`--mpiio`)

Strategy A has a structural flaw the analysis predicted: rank 0 is a
sequential funnel for the whole image, twice. Strategy B removes it entirely:

```
  all: MPI_File_read_at_all (own byte range only)
  all: greyscale_kernel(local band)
  all: MPI_File_write_at_all (own byte range only)
```

No scatter, no gather, no rank-0 bottleneck: the collective-I/O calls let the
MPI library coalesce the requests, and each rank only ever holds its own band,
so **peak memory drops from O(4N) on rank 0 to O(4N/P) per rank**. Rank 0 still
writes the 15-byte PGM header, which is the only serial byte in the program.

### 4.5 Correctness

`make check` converts the image all three ways and byte-compares:

```
cmp images/out_seq.pgm images/out_mpi.pgm
cmp images/out_seq.pgm images/out_mpiio.pgm
OK: MPI output is byte-identical to the sequential output
```

The benchmark script repeats this comparison after **every single run**, at
every process count — so a scaling number is never reported for a
configuration that produced a wrong image. Both strategies pass at every *P*
tested.

---

## 5. Results — the improvement

Machine: Intel Xeon @ 2.80 GHz, **4 cores**, Open MPI 4.1.6, gcc 13.3 `-O2`.
Best of 5 trials, kernel repeated 50× per trial.

### 5.1 Computation — the parallel work scales essentially perfectly

Row-band decomposition, `mpi-scatter` timings (the `--mpiio` mode computes
identically, within noise):

| resolution | seq | P=2 | P=3 | P=4 | speed-up @ 4 | efficiency |
|---|---:|---:|---:|---:|---:|---:|
| 1920×1080 (HD) | 1.881 ms | 0.949 | 0.610 | 0.458 | **4.11×** | 103 % |
| 3840×2160 (4K) | 7.840 ms | 3.833 | 2.518 | 1.883 | **4.16×** | 104 % |
| 7680×4320 (8K) | 32.642 ms | 16.358 | 10.851 | 8.226 | **3.97×** | 99 % |

This is the number that answers *"how good is the decomposition"*: **~4× on
4 cores, i.e. 99–104 % parallel efficiency**, with no measurable load
imbalance.

The efficiency slightly **above 100 %** at HD and 4K is not a measurement
error: it is the classic *superlinear cache effect*. One rank converting the
whole 4K image streams 23.7 MiB past a last-level cache that cannot hold it;
four ranks each stream 5.9 MiB, which fits far better, so each runs a little
faster than one quarter of the single-rank run. The effect disappears at 8K
(99 %) exactly as that explanation predicts — a quarter of an 8K image is
still 23.7 MiB and still misses cache, so all four ranks fall back to plain
memory-bandwidth-limited speed. That is the memory wall of §2.2 becoming
visible in the data.

### 5.2 End-to-end — where the honesty is

| resolution | sequential | best MPI | speed-up | winning config |
|---|---:|---:|---:|---|
| 1920×1080 | 5.02 ms | 5.70 ms | **0.88×** *(slower)* | mpiio, P=2 |
| 3840×2160 | 21.12 ms | 19.21 ms | **1.10×** | mpiio, P=2 |
| 7680×4320 | 88.18 ms | 51.93 ms | **1.70×** | mpiio, P=2 |

And the textbook scatter/gather design, measured separately at P=4:

| resolution | seq compute | seq total | scatter/gather total | *communication alone* | speed-up |
|---|---:|---:|---:|---:|---:|
| 1920×1080 | 1.88 ms | 5.02 ms | 9.30 ms | **5.93 ms** | **0.54×** |
| 3840×2160 | 7.84 ms | 21.12 ms | 34.73 ms | **23.14 ms** | **0.61×** |
| 7680×4320 | 32.64 ms | 88.18 ms | 127.28 ms | **83.96 ms** | **0.69×** |

**Strategy A is never faster than sequential — at any resolution, at any
process count.** Across all 12 measured configurations it lands between
0.51× and 0.69×. Compare the last two numeric columns: the scatter+gather
time alone (5.93 / 23.14 / 83.96 ms) is **roughly 2.6× the entire sequential
computation** it was supposed to accelerate (1.88 / 7.84 / 32.64 ms). Cutting
the compute by 4× cannot pay for that, because the communication term does
not divide by *P* at all.

This is exactly what §2.2 predicted from the arithmetic intensity, and it is
the most important measured result in the project: **for a bandwidth-bound
kernel, distributing the data costs more than the work being distributed.**

Strategy B, which never moves a pixel between ranks, does beat the sequential
program — but only from 4K upward, and only up to P = 2, before it hits the
machine's single shared disk (§6.2).

## 6. Our limits

### 6.1 Amdahl's law is not the limit; the memory wall is

The parallel fraction of the *computation* is 1.0, so Amdahl's law predicts
unbounded scaling. We still stop at ~4×, because the true serial resource is
the **memory controller**, which Amdahl's law does not model. On a machine with
more cores than memory channels, compute speed-up would flatten well before
*P*. Our 4-core box happens to sit just below that knee, which is why we see
~100 % efficiency; we would not expect it at P = 32.

### 6.2 Single shared disk

The most visible limit in the data. Beyond P = 2, MPI-IO end-to-end time gets
*worse*, not better — 8K goes from 51.9 ms at P=2 to 150.2 ms at P=3, a 2.9×
**regression** from adding a process:

| 8K, MPI-IO | P=1 | P=2 | P=3 | P=4 |
|---|---:|---:|---:|---:|
| I/O time | 54.9 ms | **35.7 ms** | 139.4 ms | 116.1 ms |
| end-to-end | 87.1 ms | **51.9 ms** | 150.2 ms | 122.6 ms |

Note that compute at P=3 and P=4 keeps scaling perfectly (10.9 ms, 8.1 ms) —
it is purely the I/O term that collapses.

Three or more processes issuing concurrent reads and writes to **one** device
turn a sequential access pattern into a seek-thrashing one, and the OS
write-back cache stops absorbing it. `MPI_File_write_at_all` cannot fix
physics: a parallel filesystem such as Lustre or GPFS with striping is the
actual prerequisite for parallel I/O to pay off, and we do not have one.

### 6.3 A single shared-memory node

Every "rank" here is a process on one machine, so MPI messages are memcpys
through shared memory — the *best possible* case for Strategy A. On a real
cluster, with an interconnect instead of a memcpy, its scatter/gather cost
would be far worse than the 0.51–0.69× we measured. Our verdict against
Strategy A is therefore a *conservative* one.

### 6.4 The workload is too small to distribute

At HD, the whole conversion is 1.9 ms of work. Entering and leaving MPI costs
vastly more than that, before a single pixel moves — measured with
`tools/mpi_startup.c` on this machine:

| ranks | `MPI_Init` + `MPI_Finalize` |
|---|---:|
| 1 | 292 ms |
| 2 | 327 ms |
| 3 | 365 ms |
| 4 | **392 ms** |

That fixed cost is **over 200× the HD conversion itself** and **~75× even the
full sequential read-convert-write**, and it grows with *P*. We deliberately
exclude it from the timings above (the timed region starts after `MPI_Init`)
so that the speed-up figures measure the algorithm rather than the runtime —
but for a *user* converting one HD image, it is the only number that matters,
and it makes MPI a losing proposition by two orders of magnitude.

**HD is far below the threshold where distribution can pay for itself** — even
ignoring startup, the 1.10× and 1.70× wins only appear at 4K and 8K. The honest recommendation for a single HD image on
one machine is: *do not use MPI; use the sequential program, or SIMD/OpenMP
threads which share the buffer instead of copying it.* MPI earns its keep here
only for very large images, or for a **batch of images**, where each rank
takes whole files and there is no per-image communication at all.

### 6.5 Implementation limits

* **Format.** Binary PPM/PGM only — no PNG or JPEG. Deliberate: a compressed
  format would put an entropy decoder in the timing path and measure libjpeg
  rather than our decomposition. It also means 8-bit samples only (`maxval ≤
  255`); 16-bit PPM is rejected with a clear error.
* **2 GiB ceiling on Strategy A.** `MPI_Scatterv` takes `int` counts, so an
  image above ~715 MPixel overflows the count array. We detect this and
  refuse, directing the user to `--mpiio`, which uses `MPI_Offset` (64-bit).
  A general fix needs the MPI-4 `_c` large-count variants.
* **`P ≤ height`.** More ranks than rows would leave a rank with no work; we
  detect it and abort rather than silently doing nothing.
* **No fault tolerance.** A rank dying takes down `MPI_COMM_WORLD`.
* **Weights are hard-coded to BT.601.** BT.709 (the actual HD standard) uses
  0.2126 / 0.7152 / 0.0722; changing three constants would switch it, but we
  kept BT.601 as the conventional textbook definition.

---

## 7. Conclusion

Greyscale conversion is a perfect decomposition problem and a poor
distribution problem, and separating those two statements is the result of
this project.

**What worked.** Contiguous row-band partitioning with remainder spreading
gives **3.97–4.16× compute speed-up on 4 cores** — 99–104 % parallel
efficiency, superlinear at HD and 4K thanks to cache — and the distributed
output is **byte-identical** to the sequential output at every process count,
verified automatically after every benchmark run.

**What did not, and why it matters more.** The textbook `Scatterv`/`Gatherv`
design is **0.51–0.69× the sequential speed — always slower, everywhere we
measured**. Its communication cost alone is ~2.6× the entire sequential
computation. A kernel with an arithmetic intensity of 1.5 ops/byte cannot
repay the cost of shipping its own data around: the parallel work shrinks by
4× while the data movement does not shrink at all. Replacing the collectives
with collective MPI-IO, so no pixel ever crosses a rank boundary, turns 0.57×
into **1.70×** at 8K — and even then only up to P = 2, before a single shared
disk becomes the wall. On top of all of it sits a ~390 ms `MPI_Init` bill that
no amount of scaling repays for a 1.9 ms job.

**The transferable lesson.** *Speed-up of the kernel is not speed-up of the
program.* We report both throughout precisely because reporting only the first
would have made this project look like a 4.11× success when the user-visible
result at HD is 0.88× — and 0.005× once MPI startup is counted. The right question to ask before distributing a
workload is not "does it parallelise?" — everything embarrassingly parallel
does — but **"is there more arithmetic per byte than there is cost to move that
byte?"** For greyscale conversion at HD the answer is no, and the correct
engineering decision is to keep the data where it already is: use SIMD or
shared-memory threads for one image, and reserve MPI for distributing *whole
images across a batch*, where the communication is a filename instead of a
frame.
