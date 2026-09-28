# Verity

Containerized deepfake detection pipeline for investigations. Verity ingests
media from the host, analyzes it, selects the detectors that are suitable for
it, runs each detector in its own isolated uv-managed environment, and
produces a deterministic, explainable report.

**Proprietary.** See [LICENSE](LICENSE). Not open source.

## What Verity does

```
host /input ─► ingest ─► analyze ─► select ─► detect ─► compile ─► report ─► host /output
                │            │           │          │            │
              checksummed  ffprobe +  rule-based  uv venvs,     findings    trimmed HTML/PDF
              copy         face scan   suitability 41 isolated   sorted      + dropdowns
```

- **Analyze** — characterizes the media deterministically: format, duration,
  fps, resolution, audio track, and a face-presence scan over up to 30 evenly
  sampled frames.
- **Select** — every detector's capabilities (media types, faces required,
  weights availability) are matched against the analysis. Each decision is
  recorded, so the report explains both what ran and what was skipped and why.
- **Detect** — each detector runs in its own uv project
  (`detectors/<id>/pyproject.toml` is the single source of truth — exact pins,
  no shared global env). Every detector's environment is tailored to it alone:
  the Python version (3.12 everywhere today — the pinned wheels cap at 3.12)
  and only the dependencies its code actually imports, on top of the
  `detectors/common` runtime (face detection, sampling, overlays).
  `scripts/verity.py` provisions and runs them, hardware-adaptive: `auto`
  (GPU when `nvidia-smi` works, else CPU), `cuda`, or `cpu` (+cpu torch wheels,
  ~12x smaller installs). Environments are cached per `(profile, detector)`
  under `$VERITY_DETECTOR_ENVS` (`cuda/<id>/` and `cpu/<id>/`); weights live
  in a persistent `$VERITY_WEIGHTS_ROOT` volume.
- **Report** — a trimmed, detector-agnostic report: verdict, reasoning,
  confidence factors, and explainability artifacts. Top faces / attention
  maps / reconstructions are shown; all the rest are in dropdowns. Detector
  metadata, timings, and benchmark noise are gone.

Reports are **deterministic**: media IDs derive from the SHA-256 checksum,
findings and every list are explicitly sorted, and inference runs with fixed
seeds. The same media and detectors always produce the same report (the only
wall-clock value is the report's generation timestamp).

## Quick start (container)

The distribution unit is a single image containing the repository, uv, and
the baked-in orchestrator. Detector environments are provisioned on first use
and cached in a volume.

```bash
docker build -t verity:latest .

# one-time: provision all 41 detector environments (cached under /venvs)
docker run --rm -v verity-detectorenvs:/venvs -v verity-weights:/weights -v verity-cache:/cache \
  verity:latest setup --all

# analyze everything in ./input, write reports to ./output
docker run --rm \
  -v verity-detectorenvs:/venvs -v verity-weights:/weights -v verity-cache:/cache \
  -v verity-workspace:/workspace \
  -v $PWD/input:/input:ro -v $PWD/output:/output \
  verity:latest

# or explicitly: analyze a single file with an explicit detector list
docker run --rm \
  -v verity-detectorenvs:/venvs -v verity-weights:/weights -v verity-cache:/cache \
  -v verity-workspace:/workspace \
  -v $PWD/input:/input:ro -v $PWD/output:/output \
  verity:latest run --media /input/suspect.mp4 --detector recce,xception
```

Weights are **not** in the image: put checkpoints under the `/weights` volume
(the per-detector `weights/` dirs symlink there automatically). Download them
with `scripts/download_detector_weights.py`. Detectors whose checkpoint is
missing are skipped — with the reason recorded in the report.

GPU hosts: add `--gpus all` and set `VERITY_HW_PROFILE=cuda` (or leave `auto`).

### docker compose

```bash
docker compose run --rm verity setup --all     # provision environments
docker compose run --rm verity run             # analyze ./input -> ./output
docker compose run --rm verity analyze         # print suitability + rationale
```

## CLI

```bash
verity run --media <file|dir> [--detector a,b,c] [--format html|pdf]
verity analyze --media <file|dir> [--json]        # characteristics + selection rationale
verity setup [--all | --detector <id>] [--force]  # provision detector environments
verity ingest|extract|compile|report              # step-by-step debugging
```

`run` and `analyze` default `--media` to `$INPUT_DIR` (set to `/input` in the
container). Reports land in `$VERITY_OUTPUT_DIR/<media_id>/` with `report.html`
+ `report.pdf`, `analysis.json` (media characteristics), and `selection.json`
(detector decisions with reasons). Per-detector artifacts live in the
workspace (`$VERITY_WORKSPACE`).

## Requirements

- Linux with **Docker** (or podman) for the runtime image
- `uv` (>= 0.5) for native runs and development
- System packages for WeasyPrint: `libpango-1.0-0 libpangocairo-1.0-0
  libcairo2`, and `ffmpeg` for extraction (all baked into the image)
- GPU optional — the runtime auto-selects the CUDA or CPU torch profile

## Native usage (development)

```bash
uv sync                          # orchestrator env (click, pydantic, cv2, weasyprint...)
uv run pytest                    # run the test suite
uv run verity analyze --media sample.mp4 --workspace ws
uv run verity run --media sample.mp4 --detector recce --workspace ws --output out
python scripts/verity.py --profile cpu setup --detector <id>   # one detector env
```

## Detectors

41 detectors are ported under `detectors/`, each with `model.py` /
`inference.py` / `detector.yaml` / `pyproject.toml` / `output_parser.py`.
Coverage: images, videos, GANs, diffusion (including AEROBLADE and GenD),
universal detectors, and audio-free lip/video motion analysis
(LipForensics). The full matrix (weights sources, kinds, input modalities,
status) is in `detectors/weights_manifest.yaml`.

Selection is driven by each detector's `detector.yaml`: the `artifacts.required`
entries (video / face_crop / audio) define what it can consume, and the
`weights` block (kind: official | backbone | external | random) determines
whether a local checkpoint is needed.

### RECCE honest-degradation note

The official DeepfakeBench v1.0.1 checkpoint ships with an **untrained
reconstruction decoder**. Verity audits decoder liveness at load and, when
dead, omits reconstruction visualizations/claims entirely and says so in the
reasoning. The verdict itself is valid — it rests on the trained classifier
head and attention maps.

## Configuration

`config/pipeline.yaml` (all overridable via env / CLI flags):

```yaml
detectors_dir: "detectors"     # detector definitions
workspace: "workspace"         # runtime data (ingested media, artifacts)
output_dir: "output"           # reports
extractors: [frame, face, metadata, audio]
```

Environment variables: `VERITY_DETECTORS_DIR`, `VERITY_WORKSPACE`,
`VERITY_OUTPUT_DIR`, `VERITY_DETECTOR_ENVS`, `VERITY_WEIGHTS_ROOT`,
`VERITY_HW_PROFILE` (auto|cuda|cpu), `VERITY_DETECTOR_TIMEOUT` (seconds,
default 3600).

## Development

```bash
uv sync                    # create .venv
uv run pytest              # run tests
python scripts/verity.py --profile cpu setup --detector <id>   # one detector env
python scripts/verity.py --profile cpu run <id> /input /output # run it natively
```
