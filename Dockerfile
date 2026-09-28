# Verity: containerized deepfake detection pipeline.
#
# Ships the repository + uv. The orchestrator (verity CLI) is baked in at
# build time with `uv sync --frozen`. Each detector is its own uv-managed
# virtual environment, provisioned on first use (`verity setup --all` or
# automatically by `verity run`) under $VERITY_DETECTOR_ENVS — the same image
# works on GPU and CPU hosts; the hardware profile is chosen at runtime
# (auto/cuda/cpu, and the cpu profile swaps torch/torchvision for +cpu wheels).
#
#   docker build -t verity:latest .
#   docker compose run --rm verity setup --all                # provision 41 envs
#   docker run --rm -it \
#     -v verity-detectorenvs:/venvs -v verity-weights:/weights -v verity-cache:/cache \
#     -v $PWD/input:/input:ro -v $PWD/output:/output \
#     verity:latest                                           # run on /input -> /output
#
# GPU hosts: add `--gpus all` (or the compose deploy section) and set
# VERITY_HW_PROFILE=cuda (or leave auto).

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV UV_LINK_MODE=hardlink \
    UV_NO_PROGRESS=1 \
    VERITY_DETECTOR_ENVS=/venvs \
    VERITY_WEIGHTS_ROOT=/weights \
    VERITY_HW_PROFILE=auto \
    VERITY_WORKSPACE=/workspace \
    VERITY_DETECTORS_DIR=/app/detectors \
    VERITY_OUTPUT_DIR=/output \
    INPUT_DIR=/input \
    OUTPUT_DIR=/output \
    HOME=/cache \
    TORCH_HOME=/cache/torch \
    HF_HOME=/cache/huggingface \
    XDG_CACHE_HOME=/cache

# Runtime system packages: ffmpeg/ffprobe (frame + metadata extraction) and
# the pango/cairo stack required by WeasyPrint for PDF reports.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . /app

# Bake the orchestrator environment (no detector packages — those are
# provisioned per-detector by uv at runtime).
RUN uv sync --frozen --no-dev --no-editable

ENV PATH="/app/.venv/bin:${PATH}"
RUN ln -s /app/scripts/verity.py /usr/local/bin/verity-run && chmod +x /app/scripts/verity.py

# Volumes are provided at runtime (see docker-compose.yml / README): /venvs,
# /weights, /cache, /workspace persist state; /input and /output are the host
# bind mounts for media and reports.

ENTRYPOINT ["verity"]
CMD ["run"]
