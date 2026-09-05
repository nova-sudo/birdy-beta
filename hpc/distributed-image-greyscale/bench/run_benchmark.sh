#!/usr/bin/env bash
#
# run_benchmark.sh -- Scaling study for the greyscale project.
#
# Sweeps image resolution x process count x distribution strategy and writes
# one tidy CSV row per run to results/benchmark.csv. Every configuration is
# repeated (TRIALS) and the fastest trial is kept: on a shared machine the
# minimum is a far better estimate of the true cost than the mean, which is
# dragged around by whatever else the scheduler decided to run.
#
# Environment overrides:
#   RESOLUTIONS  "1920x1080 3840x2160"   images to test
#   PROCS        "1 2 3 4"               MPI ranks to test
#   REPS         50                      kernel repetitions inside one run
#   TRIALS       5                       whole-program repeats per config
#   OUT          results/benchmark.csv

set -euo pipefail
cd "$(dirname "$0")/.."

RESOLUTIONS=${RESOLUTIONS:-"1920x1080 3840x2160 7680x4320"}
PROCS=${PROCS:-"1 2 3 4"}
REPS=${REPS:-50}
TRIALS=${TRIALS:-5}
OUT=${OUT:-results/benchmark.csv}

# Open MPI refuses to run as root and hard-limits ranks to physical cores
# unless told otherwise. Both are fine for a benchmark in a container.
export OMPI_ALLOW_RUN_AS_ROOT=1
export OMPI_ALLOW_RUN_AS_ROOT_CONFIRM=1
MPIRUN_FLAGS=${MPIRUN_FLAGS:-"--oversubscribe"}

mkdir -p results images

# Pull one "key=value" field out of a program's stdout.
field() { sed -n "s/.*[[:space:]]\?$2=\([0-9.]*\).*/\1/p" <<<"$1" | head -1; }

echo "mode,procs,width,height,pixels,read_s,scatter_s,compute_s,gather_s,write_s,total_s" > "$OUT"

# Record the machine the numbers came from -- a speed-up figure without it is
# not reproducible.
{
  echo "# host: $(uname -srm)"
  echo "# cores: $(nproc)"
  echo "# cpu: $(sed -n 's/^model name[[:space:]]*: //p' /proc/cpuinfo | head -1)"
  echo "# mpi: $(mpirun --version 2>&1 | head -1)"
  echo "# cc: $(gcc --version | head -1)"
  echo "# reps: $REPS  trials: $TRIALS  date: $(date -u +%FT%TZ)"
} > results/environment.txt

run_and_keep_best() {
  # $1 = csv label, remaining args = command to run
  local label=$1; shift
  local best_total="" best_line=""
  for ((t = 0; t < TRIALS; ++t)); do
    local out; out=$("$@")
    local total; total=$(field "$out" total_s)
    if [[ -z $best_total ]] || awk "BEGIN{exit !($total < $best_total)}"; then
      best_total=$total
      best_line="$label,$(field "$out" procs),$(field "$out" width),$(field "$out" height),$(field "$out" pixels),$(field "$out" read_s),$(field "$out" scatter_s),$(field "$out" compute_s),$(field "$out" gather_s),$(field "$out" write_s),$total"
    fi
  done
  echo "$best_line" >> "$OUT"
  echo "  $best_line"
}

for res in $RESOLUTIONS; do
  w=${res%x*}; h=${res#*x}
  img="images/hd_${w}x${h}.ppm"
  [[ -f $img ]] || ./bin/genimage "$w" "$h" "$img"

  echo "== ${w}x${h} =="
  # Sequential prints no scatter_s/gather_s; field() yields empty, which is a
  # correct CSV cell for "phase does not exist in this mode".
  run_and_keep_best sequential ./bin/greyscale_seq "$img" images/out_seq.pgm "$REPS"

  for np in $PROCS; do
    run_and_keep_best mpi-scatter \
      mpirun $MPIRUN_FLAGS -np "$np" ./bin/greyscale_mpi "$img" images/out_mpi.pgm "$REPS"
    cmp -s images/out_seq.pgm images/out_mpi.pgm \
      || { echo "FAIL: scatter output differs at np=$np"; exit 1; }

    run_and_keep_best mpi-mpiio \
      mpirun $MPIRUN_FLAGS -np "$np" ./bin/greyscale_mpi "$img" images/out_mpiio.pgm "$REPS" --mpiio
    cmp -s images/out_seq.pgm images/out_mpiio.pgm \
      || { echo "FAIL: mpiio output differs at np=$np"; exit 1; }
  done
done

# The fixed cost of entering and leaving MPI, independent of image size. On a
# job this short it is not a footnote -- see the report's "limits" section.
{
  echo
  echo "# MPI fixed startup cost (best of 3):"
  for np in $PROCS; do
    best=""
    for _ in 1 2 3; do
      line=$(mpirun $MPIRUN_FLAGS -np "$np" ./bin/mpi_startup)
      v=$(field "$line" startup_total_ms)
      if [[ -z $best ]] || awk "BEGIN{exit !($v < $best)}"; then best=$v; fi
    done
    echo "#   np=$np: ${best} ms"
  done
} >> results/environment.txt

echo
echo "wrote $OUT"
sed -n '/MPI fixed startup/,$p' results/environment.txt
