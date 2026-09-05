# Distributed image greyscale -- sequential and MPI builds.
#
#   make            build everything
#   make image      generate the 1920x1080 HD test image
#   make run        convert it both ways and diff the outputs
#   make bench      full scaling study -> results/benchmark.csv
#   make clean

CC      ?= gcc
MPICC   ?= mpicc
CFLAGS  ?= -O2 -Wall -Wextra -std=c99
LDFLAGS ?=

BIN      := bin
SRC      := src
TOOLS    := tools
IMAGES   := images

# 1920x1080 is the reference "High Definition" case from the assignment.
WIDTH  ?= 1920
HEIGHT ?= 1080
NP     ?= 4
REPS   ?= 20

IMAGE  := $(IMAGES)/hd_$(WIDTH)x$(HEIGHT).ppm

.PHONY: all image run bench clean check

all: $(BIN)/greyscale_seq $(BIN)/greyscale_mpi $(BIN)/genimage $(BIN)/mpi_startup

$(BIN):
	mkdir -p $(BIN)

$(BIN)/greyscale_seq: $(SRC)/greyscale_seq.c $(SRC)/ppm.c $(SRC)/ppm.h $(SRC)/greyscale.h | $(BIN)
	$(CC) $(CFLAGS) -o $@ $(SRC)/greyscale_seq.c $(SRC)/ppm.c $(LDFLAGS)

$(BIN)/greyscale_mpi: $(SRC)/greyscale_mpi.c $(SRC)/ppm.c $(SRC)/ppm.h $(SRC)/greyscale.h | $(BIN)
	$(MPICC) $(CFLAGS) -o $@ $(SRC)/greyscale_mpi.c $(SRC)/ppm.c $(LDFLAGS)

$(BIN)/mpi_startup: $(TOOLS)/mpi_startup.c | $(BIN)
	$(MPICC) $(CFLAGS) -o $@ $(TOOLS)/mpi_startup.c $(LDFLAGS)

$(BIN)/genimage: $(TOOLS)/genimage.c $(SRC)/ppm.c $(SRC)/ppm.h | $(BIN)
	$(CC) $(CFLAGS) -o $@ $(TOOLS)/genimage.c $(SRC)/ppm.c $(LDFLAGS)

image: $(IMAGE)

$(IMAGE): $(BIN)/genimage
	mkdir -p $(IMAGES)
	$(BIN)/genimage $(WIDTH) $(HEIGHT) $@

run: all $(IMAGE)
	$(BIN)/greyscale_seq $(IMAGE) $(IMAGES)/out_seq.pgm $(REPS)
	mpirun $(MPIRUN_FLAGS) -np $(NP) $(BIN)/greyscale_mpi $(IMAGE) $(IMAGES)/out_mpi.pgm $(REPS)
	mpirun $(MPIRUN_FLAGS) -np $(NP) $(BIN)/greyscale_mpi $(IMAGE) $(IMAGES)/out_mpiio.pgm $(REPS) --mpiio

# Correctness gate: the distributed outputs must be byte-identical to the
# sequential one. Fixed-point arithmetic makes that an exact test, not an
# approximate one.
check: run
	cmp $(IMAGES)/out_seq.pgm $(IMAGES)/out_mpi.pgm
	cmp $(IMAGES)/out_seq.pgm $(IMAGES)/out_mpiio.pgm
	@echo "OK: MPI output is byte-identical to the sequential output"

bench: all
	bash bench/run_benchmark.sh

clean:
	rm -rf $(BIN) $(IMAGES)/*.ppm $(IMAGES)/*.pgm
