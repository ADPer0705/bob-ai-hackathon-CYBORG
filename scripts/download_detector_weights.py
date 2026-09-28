#!/usr/bin/env python3
"""Print (or run) the exact commands to fetch detector weights.

Usage:
    python scripts/download_detector_weights.py --detector all        # print commands for every detector
    python scripts/download_detector_weights.py --detector xception   # one detector
    python scripts/download_detector_weights.py --detector xception --run   # actually download
    python scripts/download_detector_weights.py --detector all --run

Weights are large (~1.5-2GB total) and are NOT tracked in git; they belong in
`detectors/<id>/weights/`. The script is safe to run from anywhere inside the
repo. `--run` executes the downloads with curl; otherwise it only prints them.
"""
import argparse
import shlex
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "detectors" / "weights_manifest.yaml"


def _load_manifest() -> dict:
    with open(MANIFEST) as f:
        return yaml.safe_load(f)


def _expand(url: str, rel: dict) -> str:
    for key in ("release_v101", "release_v100", "release_v103"):
        if "{" + key + "}" in url:
            url = url.replace("{" + key + "}", rel[key])
    return url


def _commands(entry: dict, det_dir: Path, rel: dict) -> list[str]:
    cmds = []
    weights_dir = det_dir / "weights"
    weights_dir.mkdir(parents=True, exist_ok=True)
    kind = entry["kind"]
    file = entry.get("file")
    if kind in ("external", "random") or file is None:
        return cmds  # nothing to download locally
    url = _expand(entry["url"], rel)
    dest = weights_dir / file
    if entry.get("zip"):
        zip_dest = weights_dir / "pretrained.zip"
        cmd = f"curl -L -o {zip_dest} '{url}'"
        cmd += f"  # zip archive; '{file}' is extracted afterwards"
    else:
        cmd = f"curl -L -o {dest} '{url}'"
        if entry.get("size"):
            cmd += f"  # expect ~{entry['size'] / 1e6:.1f} MB"
        if entry.get("md5"):
            cmd += f"  # md5: {entry['md5']}"
    cmds.append(cmd)
    if entry.get("zip"):
        cmds.append(f"unzip -o {zip_dest} -d {weights_dir}")
    return cmds


def main():
    ap = argparse.ArgumentParser(description="Fetch DeepfakeBench detector weights")
    ap.add_argument("--detector", default="all", help="Detector id or 'all'")
    ap.add_argument("--run", action="store_true", help="Execute the download commands (default: print only)")
    args = ap.parse_args()

    manifest = _load_manifest()
    rel = {k: v for k, v in manifest.items() if k.startswith("release_")}
    detectors = manifest["detectors"]

    if args.detector == "all":
        ids = sorted(detectors)
    else:
        ids = [args.detector]
        for i in ids:
            if i not in detectors:
                print(f"[error] unknown detector '{i}'", file=sys.stderr)
                sys.exit(1)

    for det_id in ids:
        entry = detectors[det_id]
        det_dir = ROOT / "detectors" / det_id
        print(f"## {det_id}  ({entry['kind']})")
        print(f"#   {entry.get('note', '')}")
        cmds = _commands(entry, det_dir, rel)
        if not cmds:
            print("#   no local download required")
        for c in cmds:
            core = c.split("  #")[0].strip()
            if args.run and core:
                print(f"  $ {core}")
                subprocess.check_call(shlex.split(core))
            else:
                print(f"  {c}")
        print()

    if not args.run:
        print("# Run with --run to execute these downloads.")


if __name__ == "__main__":
    main()
