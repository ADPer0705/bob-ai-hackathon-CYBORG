#!/usr/bin/env python3
"""Migrate detector environments from requirements.txt to uv-managed pyproject.toml.

For every detectors/<id>/requirements.txt this script:

  * parses plain-pip requirements (handling comments, blank lines, and
    --extra-index-url directives that have no uv equivalent),
  * writes detectors/<id>/pyproject.toml declaring the same pins,
  * deletes the requirements.txt once the pyproject parses back cleanly.

Run:  python3 scripts/requirements_to_pyproject.py
"""

from __future__ import annotations

import json
import re
import sys
import tomllib
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
DETECTORS = ROOT / "detectors"

REQ_LINE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.\-\[\]]*(?:\[[^\]]*\])?[ \t]*([<>=!~;]|$)")


def parse_requirements(text: str, det_id: str) -> list[str]:
    deps: list[str] = []
    for lineno, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("--extra-index-url"):
            continue
        if line.startswith("-"):
            print(f"  WARN {det_id}:{lineno}: dropping unsupported flag line: {line!r}")
            continue
        if not REQ_LINE.match(line):
            print(f"  WARN {det_id}:{lineno}: dropping non-requirement line: {line!r}")
            continue
        deps.append(line)
    return deps


def pyproject_for(det_id: str, deps: list[str], summary: str | None) -> str:
    description = f"Verity detector environment: {det_id}"
    if summary:
        description = f"{description} ({summary})"
    deps_json = json.dumps(deps, indent=4)
    # Preserve the detector's own Python version choice when re-migrating
    # (detectors/<id>/pyproject.toml is the source of truth once created).
    requires_python = ">=3.12,<3.13"
    existing = DETECTORS / det_id / "pyproject.toml"
    if existing.exists():
        try:
            requires_python = tomllib.loads(existing.read_text())["project"]["requires-python"]
        except (KeyError, tomllib.TOMLDecodeError):
            pass
    return f"""\
# Managed with uv (source of truth for this detector's environment).
# Migrated from requirements.txt by scripts/requirements_to_pyproject.py.
[project]
name = "verity-{det_id}"
version = "1.0.0"
description = "{description}"
requires-python = "{requires_python}"
dependencies = {deps_json}

[tool.uv]
package = false
"""


def main() -> int:
    written = 0
    for req_path in sorted(DETECTORS.glob("*/requirements.txt")):
        det_id = req_path.parent.name
        text = req_path.read_text()
        deps = parse_requirements(text, det_id)
        if not deps:
            print(f"  WARN {det_id}: no dependencies parsed; leaving requirements.txt")
            continue

        summary = None
        yaml_path = req_path.parent / "detector.yaml"
        if yaml_path.exists():
            import yaml

            try:
                meta = yaml.safe_load(yaml_path.read_text()) or {}
                summary = meta.get("name")
            except Exception:
                pass

        pyproject = pyproject_for(det_id, deps, summary)
        pyproject_path = req_path.parent / "pyproject.toml"
        pyproject_path.write_text(pyproject)

        # round-trip check
        with open(pyproject_path, "rb") as fh:
            parsed = tomllib.load(fh)
        if parsed["project"]["dependencies"] != deps:
            print(f"  ERROR {det_id}: round-trip mismatch", file=sys.stderr)
            return 1
        if not (req_path.parent / "inference.py").exists():
            print(f"  WARN {det_id}: no inference.py found (still migrated)")

        req_path.unlink()
        written += 1
        print(f"  OK   {det_id}: {len(deps)} deps -> pyproject.toml (requirements.txt removed)")

    print(f"\nMigrated {written} detectors. Source of truth is now pyproject.toml.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
