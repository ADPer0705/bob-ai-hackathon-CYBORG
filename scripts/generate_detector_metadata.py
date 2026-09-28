#!/usr/bin/env python3
"""Generate per-detector boilerplate files (inference.py, output_parser.py,
detector.yaml, requirements.txt, README.md, weights/README.md) from a single
table.

Usage:
    python scripts/generate_detector_metadata.py            # all detectors
    python scripts/generate_detector_metadata.py xception   # one detector

`model.py` files are NOT generated — they hold the architecture port and are
written by hand per detector.
"""
import argparse
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DETECTORS = ROOT / "detectors"

BASELINE_REQS = """# torch/torchvision resolve from PyPI by default. For a smaller CPU-only
# build instead of the CUDA wheel, use:
#   pip install torch==2.2.2 torchvision==0.17.2 --index-url https://download.pytorch.org/whl/cpu
torch==2.2.2
torchvision==0.17.2
numpy<2
opencv-python==4.10.0.84
pillow==10.2.0
matplotlib==3.9.2
scipy==1.14.1
facenet-pytorch==2.6.0
mediapipe==0.10.18
timm==1.0.14
"""

INFERENCE_PY = """import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # detectors/ -> common
from common.engine import run_detector  # noqa: E402
from model import build_model  # noqa: E402

if __name__ == "__main__":
    run_detector(build_model, Path(__file__).resolve().parent / "detector.yaml")
"""

OUTPUT_PARSER_PY = '''from pathlib import Path
from typing import Dict, Any
from verity.models.findings import Classification, Reasoning, Finding


def parse(
    raw: Dict[str, Any],
    output_path: Path,
    version: str,
    detector_id: str = "{detector_id}",
) -> Finding:
    prediction = raw.get("prediction", 0.5)
    confidence = raw.get("confidence", 0.0)

    if prediction > 0.7:
        classification = Classification.FAKE
    elif prediction < 0.3:
        classification = Classification.REAL
    else:
        classification = Classification.UNCERTAIN

    reasoning = Reasoning(
        summary=raw.get("reasoning", "No reasoning provided."),
        evidence=[],
        confidence_factors=raw.get("confidence_factors", []),
    )

    return Finding(
        detector_id=detector_id,
        detector_version=version,
        classification=classification,
        confidence=confidence,
        reasoning=reasoning,
        raw_output=raw,
    )
'''


# detector_id -> metadata
D = {
    # ---------------- Tier 1: official v1.0.1 checkpoints ----------------
    "meso4": dict(name="MesoNet", params=0, w="meso4_best.pth", wsize=117943,
                  arch="MesoNet (4-layer CNN)", ext=[]),
    "meso4Inception": dict(name="MesoInception", params=0, w="meso4Incep_best.pth", wsize=126419,
                           arch="MesoInception (4-layer Inception CNN)", ext=[]),
    "resnet34": dict(name="CNN-Aug (ResNet34)", params=21300000, w="cnnaug_best.pth", wsize=85285901,
                     arch="ResNet-34 + augmentation", ext=[]),
    "efficientnetb4": dict(name="EfficientNet-B4", params=17600000, w="effnb4_best.pth", wsize=70979261,
                           arch="EfficientNet-B4", ext=["efficientnet-pytorch==0.7.1"]),
    "capsule_net": dict(name="Capsule", params=0, w="capsule_best.pth", wsize=15694749,
                        arch="VGG19 features + Capsule network", ext=[]),
    "core": dict(name="CORE", params=0, w="core_best.pth", wsize=87766765,
                 arch="Xception backbone + CORE consistency head", ext=[]),
    "f3net": dict(name="F3Net", params=0, w="f3net_best.pth", wsize=90398839,
                  arch="Xception backbone + FAD frequency head (12ch)", ext=[]),
    "ffd": dict(name="FFD", params=0, w="ffd_best.pth", wsize=87796541,
                arch="Xception backbone + mask regression", ext=[]),
    "spsl": dict(name="SPSL", params=0, w="spsl_best.pth", wsize=87764683,
                 arch="Xception backbone + phase spectrum (4ch)", ext=[]),
    "srm": dict(name="SRM", params=0, w="srm_best.pth", wsize=222088575,
                arch="Dual Xception + SRM filters + cross-modal attention", ext=[]),
    "ucf": dict(name="UCF", params=0, w="ucf_best.pth", wsize=188006161,
                arch="Dual Xception encoder + fingerprint reconstruction", ext=[]),
    # ---------------- Tier 2: external / backbone weights ----------------
    "clip": dict(name="CLIP", params=0, w=None, res=224,
                 arch="CLIP ViT-B/16 (openai/clip-vit-base-patch16)",
                 ext=["transformers>=4.36", "accelerate", "safetensors"]),
    "videomae": dict(name="VideoMAE", params=0, w=None, res=224, video=True, clip=16,
                     arch="VideoMAE (MCG-NJU/videomae-base)", ext=["transformers>=4.36", "accelerate", "safetensors"]),
    "xclip": dict(name="X-CLIP", params=0, w=None, res=224, video=True, clip=32,
                  arch="X-CLIP (microsoft/xclip-base-patch32)", ext=["transformers>=4.36", "accelerate", "safetensors"]),
    "timesformer": dict(name="TimeSformer", params=0, w=None, res=224, video=True, clip=8,
                        arch="TimeSformer (facebook/timesformer-base-finetuned-k400)",
                        ext=["transformers>=4.36", "accelerate", "safetensors"]),
    "uia_vit": dict(name="UIA-ViT", params=86000000, w=None, res=224,
                    arch="ViT-B/16 + UIA inconsistency-attention head", ext=[]),
    "stil": dict(name="STIL", params=0, w=None, res=224, video=True, clip=8,
                 arch="SCNet50-v1d + spatiotemporal inconsistency head",
                 ext=["torch.hub-fetched SCNet weights (OSS)"]),
    "i3d": dict(name="I3D", params=0, w="I3D_8x8_R50.pth", wsize=112495617, res=224, video=True, clip=16,
                kind="backbone", arch="I3D 3D-ResNet50 (Kinetics pretrained)",
                ext=["fvcore", "yaml"]),
    "ftcn": dict(name="FTCN", params=0, w="I3D_8x8_R50.pth", wsize=112495617, res=224, video=True, clip=16,
                 kind="backbone", arch="I3D 3D-ResNet50 + temporal coherence head",
                 ext=["fvcore", "yaml"]),
    "altfreezing": dict(name="AltFreezing", params=0, w="I3D_8x8_R50.pth", wsize=112495617, res=224, video=True, clip=16,
                        kind="backbone", arch="I3D 3D-ResNet50 + alternate freezing",
                        ext=["fvcore", "yaml"]),
    "effort": dict(name="Effort", params=0, w=None, res=224,
                   arch="CLIP ViT-L/14 + orthogonal subspace decomposition",
                   mean=[0.48145466, 0.4578275, 0.40821073],
                   std=[0.26862954, 0.26130258, 0.27577711],
                   ext=["transformers>=4.36", "accelerate", "safetensors"]),
    "facexray": dict(name="Face X-ray", params=0, w="hrnetv2_w48_imagenet_pretrained.pth",
                     kind="backbone", arch="HRNet-W48", ext=[]),
    "iid": dict(name="IID", params=0, w="backbone.pth", kind="backbone",
                arch="Xception + iresnet50 implicit-identity branch",
                ext=["einops", "filterpy", "kornia", "simplejson", "loralib"]),
    # ---------------- Tier 3: no released weights ------------------------
    "sbi": dict(name="SBI", params=0, w=None, kind="random", arch="EfficientNet-B4 + self-blended images",
                ext=["efficientnet-pytorch==0.7.1"]),
    "sladd": dict(name="SLADD", params=0, w=None, kind="random", arch="Xception + adversarial synthesizer",
                  ext=["einops", "kornia"]),
    "pcl_xception": dict(name="PCL-I2G", params=0, w=None, kind="random", arch="Xception + pair-wise consistency",
                         ext=["einops"]),
    "lrl": dict(name="LRL", params=0, w=None, kind="random", arch="EfficientNet-B4 dual encoder (RGB+DCT)",
                ext=["efficientnet-pytorch==0.7.1"]),
    "lsda": dict(name="LSDA", params=0, w=None, kind="random", arch="EfficientNet-B4 + latent space augmentation",
                 ext=["efficientnet-pytorch==0.7.1", "einops"]),
    "multi_attention": dict(name="Multi-Attention", params=0, w=None, kind="random",
                            arch="EfficientNet-B4 + multi-attentional head",
                            ext=["efficientnet-pytorch==0.7.1"]),
    "sia": dict(name="SIA", params=0, w=None, kind="random", arch="EfficientNet-B4 + attention-driven head",
                ext=["efficientnet-pytorch==0.7.1"]),
    "rfm": dict(name="RFM", params=0, w=None, kind="random", arch="Xception + representative forgery mining", ext=[]),
    "fwa": dict(name="DSP-FWA", params=0, w=None, kind="random", arch="Xception + face warp artifacts", ext=[]),
    "tall": dict(name="TALL", params=0, w=None, kind="random", video=True, clip=4, res=224,
                 arch="Swin thumbnail-layout transformer", ext=[]),
}

MANIFEST = yaml.safe_load((DETECTORS / "weights_manifest.yaml").read_text())
REL = {k: v for k, v in MANIFEST.items() if k.startswith("release_")}


def _reqs(meta):
    extras = "\n".join(meta.get("ext", []))
    return BASELINE_REQS + (("\n" + extras + "\n") if extras else "")


def _detector_yaml(det_id, meta):
    m = MANIFEST["detectors"][det_id]
    w = None
    if m.get("kind") in ("official", "backbone") and m.get("url"):
        url = m["url"].format(**REL)
    else:
        url = None
    if meta.get("w"):
        w = dict(file=meta["w"], kind=meta.get("kind", m.get("kind", "official")),
                 url=url, size=meta.get("wsize"), note=m.get("note", ""))
    data = {
        "detector_id": det_id,
        "version": "1.0.0",
        "name": meta["name"],
        "description": f"{meta['name']} deepfake detector (DeepfakeBench port).",
        "architecture": meta["arch"],
        "parameters": meta.get("params"),
        "pretrained": m.get("note", ""),
        "resolution": meta.get("res", 256),
        "mean": meta.get("mean", [0.5, 0.5, 0.5]),
        "std": meta.get("std", [0.5, 0.5, 0.5]),
        "video_mode": meta.get("video", False),
        "clip_size": meta.get("clip"),
        "cam": True,
    }
    if w:
        data["weights"] = w
    data["artifacts"] = {"required": [{"type": "video" if meta.get("video") else "face_crop", "params": {"resolution": meta.get("res", 256)}}]}
    data["output"] = {"format": "json", "schema": {"prediction": "float", "confidence": "float", "reasoning": "str"}}
    return yaml.safe_dump(data, sort_keys=False)


def _readme(det_id, meta):
    m = MANIFEST["detectors"][det_id]
    kind = m.get("kind")
    if kind == "official":
        wstatus = f"Place `{meta['w']}` in `weights/` (see `weights/README.md`)."
    elif kind == "backbone":
        wstatus = (f"Place `{meta['w']}` in `weights/` (backbone init only; no "
                   f"detector-trained checkpoint is released, so scores are unreliable).")
    elif kind == "external":
        wstatus = "Weights are fetched at runtime from HuggingFace / torch hub."
    else:
        wstatus = "No released weights exist; the model is randomly initialized (scores are NOT meaningful)."
    return f"""# {meta['name']} Detector

{meta['name']} deepfake detector ported from DeepfakeBench.

## Setup (own venv)

```bash
cd detectors/{det_id}
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
INPUT_DIR=/path/to/dir/containing/media OUTPUT_DIR=/path/to/output \\
python inference.py
```

`INPUT_DIR/media/` is scanned for media files; artifacts (faces, attention
maps, timeline, top frames, `result.json`) are written to `OUTPUT_DIR`.

## Weights

{wstatus}

## Explainability

Per-face fake probability + Grad-CAM attention overlays + facial region
energy analysis + prediction timeline + most-suspicious frames.
"""


def _weights_readme(det_id, meta):
    m = MANIFEST["detectors"][det_id]
    kind = m.get("kind")
    if kind == "official":
        size = meta.get("wsize")
        cmd = f"python scripts/download_detector_weights.py --detector {det_id} --run"
        return f"""# {meta['name']} Weights

| Property | Value |
|---|---|
| File | `{meta['w']}` |
| Size | {size:,} bytes |
| Origin | Official DeepfakeBench v1.0.1 release |
| Training | FaceForensics++ (c23) |
| License | Follows DeepfakeBench project terms; research use only |

Download:

```bash
{cmd}
```

The checkpoint is the full detector state dict; the model loads it with
`strict=False` and no separate ImageNet backbone is needed.
"""
    if kind == "backbone":
        url = m.get("url", "").format(**REL) if m.get("url") else ""
        return f"""# {meta['name']} Weights (backbone only)

| Property | Value |
|---|---|
| File | `{meta['w']}` |
| Source | {url or 'pretrained.zip'} |
| Kind | Pretrained backbone (no detector-trained checkpoint released) |

This file only initializes the backbone; the classification head is untrained,
so predictions are unreliable. Download via:

```bash
python scripts/download_detector_weights.py --detector {det_id} --run
```
"""
    if kind == "external":
        return f"""# {meta['name']} Weights

Weights are fetched automatically at runtime from HuggingFace or torch hub
(no local file needed): {m.get('note', '')}
"""
    return f"""# {meta['name']} Weights

**No released trained weights exist for this detector.** The model is randomly
initialized and any scores are not meaningful. See
{meta['name']} (DeepfakeBench) for training instructions if this detector
must be used in anger.
"""


def generate(det_id):
    meta = D[det_id]
    d = DETECTORS / det_id
    d.mkdir(exist_ok=True)
    (d / "weights").mkdir(exist_ok=True)
    (d / "inference.py").write_text(INFERENCE_PY)
    (d / "output_parser.py").write_text(OUTPUT_PARSER_PY.format(detector_id=det_id))
    (d / "requirements.txt").write_text(_reqs(meta))
    (d / "detector.yaml").write_text(_detector_yaml(det_id, meta))
    (d / "README.md").write_text(_readme(det_id, meta))
    (d / "weights" / "README.md").write_text(_weights_readme(det_id, meta))
    print(f"[ok] {det_id}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("detector", nargs="?", default="all")
    args = ap.parse_args()
    ids = sorted(D) if args.detector == "all" else [args.detector]
    for i in ids:
        if i not in D:
            print(f"[skip] unknown: {i}", file=sys.stderr)
            continue
        generate(i)


if __name__ == "__main__":
    main()
