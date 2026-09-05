#!/usr/bin/env bash
#
# capture_logs.sh -- Produce the raw evidence logs that back every number in
# the report and the presentation.
#
# run_benchmark.sh keeps only the best trial and reduces it to a CSV row. That
# is the right thing for analysis and the wrong thing for evidence: a reader
# who wants to check a claim needs the untouched program output. This script
# writes exactly that, one file per configuration, plus a build log and a
# correctness log with checksums.
#
# Output: logs/
#   00_build.log             compiler invocations and warnings
#   01_environment.log       CPU, MPI, compiler, image inventory
#   02_correctness.log       cmp + SHA-256 of every output, at every P
#   10_sequential_<res>.log  raw stdout, sequential
#   20_scatter_<res>_p<N>.log
#   30_mpiio_<res>_p<N>.log
#   99_session.log           everything above concatenated in order

set -uo pipefail
cd "$(dirname "$0")/.."

RESOLUTIONS=${RESOLUTIONS:-"1920x1080 3840x2160 7680x4320"}
PROCS=${PROCS:-"1 2 3 4"}
REPS=${REPS:-60}
LOGS=${LOGS:-logs}

export OMPI_ALLOW_RUN_AS_ROOT=1
export OMPI_ALLOW_RUN_AS_ROOT_CONFIRM=1
MPIRUN_FLAGS=${MPIRUN_FLAGS:-"--oversubscribe"}

rm -rf "$LOGS"; mkdir -p "$LOGS" images

banner() { printf '=== %s\n=== %s\n\n' "$1" "$(date -u +%FT%TZ)"; }

# ---- build ------------------------------------------------------------
{
  banner "BUILD"
  make clean
  make
} > "$LOGS/00_build.log" 2>&1
echo "logged build"

# ---- environment ------------------------------------------------------
{
  banner "ENVIRONMENT"
  echo "--- host ---";     uname -srmo
  echo; echo "--- cpu ---";  sed -n 's/^model name[[:space:]]*: /model: /p' /proc/cpuinfo | head -1
  echo "logical cores: $(nproc)"
  lscpu 2>/dev/null | grep -Ei 'cache|socket|thread|core' || true
  echo; echo "--- memory ---"; free -h 2>/dev/null | head -2
  echo; echo "--- compiler ---"; gcc --version | head -1; mpicc --version | head -1
  echo; echo "--- mpi ---"; mpirun --version | head -1
  echo; echo "--- mpi fixed startup cost (3 runs each) ---"
  for np in $PROCS; do
    for _ in 1 2 3; do
      printf 'np=%s  ' "$np"
      mpirun $MPIRUN_FLAGS -np "$np" ./bin/mpi_startup
    done
  done
} > "$LOGS/01_environment.log" 2>&1
echo "logged environment"

# ---- one raw log per configuration ------------------------------------
for res in $RESOLUTIONS; do
  w=${res%x*}; h=${res#*x}
  img="images/hd_${w}x${h}.ppm"
  [[ -f $img ]] || ./bin/genimage "$w" "$h" "$img" >> "$LOGS/01_environment.log" 2>&1

  {
    banner "SEQUENTIAL  ${w}x${h}  reps=$REPS"
    echo "\$ ./bin/greyscale_seq $img images/out_seq.pgm $REPS"
    echo
    ./bin/greyscale_seq "$img" "images/out_seq_${res}.pgm" "$REPS"
  } > "$LOGS/10_sequential_${res}.log" 2>&1

  for np in $PROCS; do
    {
      banner "MPI SCATTER/GATHER  ${w}x${h}  P=$np  reps=$REPS"
      echo "\$ mpirun -np $np ./bin/greyscale_mpi $img images/out_mpi.pgm $REPS"
      echo
      mpirun $MPIRUN_FLAGS -np "$np" ./bin/greyscale_mpi \
        "$img" "images/out_mpi_${res}_p${np}.pgm" "$REPS"
    } > "$LOGS/20_scatter_${res}_p${np}.log" 2>&1

    {
      banner "MPI COLLECTIVE I/O  ${w}x${h}  P=$np  reps=$REPS"
      echo "\$ mpirun -np $np ./bin/greyscale_mpi $img images/out_mpiio.pgm $REPS --mpiio"
      echo
      mpirun $MPIRUN_FLAGS -np "$np" ./bin/greyscale_mpi \
        "$img" "images/out_mpiio_${res}_p${np}.pgm" "$REPS" --mpiio
    } > "$LOGS/30_mpiio_${res}_p${np}.log" 2>&1
  done
  echo "logged ${res}"
done

# ---- correctness ------------------------------------------------------
{
  banner "CORRECTNESS"
  echo "Every MPI output is compared byte-for-byte against the sequential"
  echo "output for the same image. Fixed-point arithmetic makes this an exact"
  echo "test, so any difference at all is a failure."
  echo
  fail=0
  for res in $RESOLUTIONS; do
    ref="images/out_seq_${res}.pgm"
    echo "--- ${res} ---"
    printf '  reference  %s  %s\n' "$(sha256sum "$ref" | cut -c1-16)" "$ref"
    for np in $PROCS; do
      for f in "images/out_mpi_${res}_p${np}.pgm" "images/out_mpiio_${res}_p${np}.pgm"; do
        if cmp -s "$ref" "$f"; then r="IDENTICAL"; else r="*** DIFFERS ***"; fail=1; fi
        printf '  %-10s %s  %s\n' "$r" "$(sha256sum "$f" | cut -c1-16)" "$f"
      done
    done
    echo
  done
  if [[ $fail -eq 0 ]]; then
    echo "RESULT: all outputs byte-identical to the sequential reference."
  else
    echo "RESULT: FAILURE -- at least one output differs."
  fi
} > "$LOGS/02_correctness.log" 2>&1
echo "logged correctness"

# ---- one concatenated transcript --------------------------------------
{
  echo "Distributed Image Greyscale -- full run transcript"
  echo "Generated $(date -u +%FT%TZ)"
  echo
  for f in $(ls "$LOGS" | grep -v 99_session | sort); do
    printf '\n\n########## %s ##########\n\n' "$f"
    cat "$LOGS/$f"
  done
} > "$LOGS/99_session.log"

rm -f images/out_*.pgm
echo "wrote $LOGS/ ($(ls "$LOGS" | wc -l) files)"
