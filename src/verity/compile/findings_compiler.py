from __future__ import annotations
import json
from pathlib import Path
from typing import List, Optional
from verity.models.findings import Finding, FindingsCollection, Classification


class FindingsCompiler:
    def __init__(self, workspace: Path):
        self.workspace = workspace
        self.output_dir = workspace / "output"

    def compile(self, media_id: str) -> FindingsCollection:
        findings: List[Finding] = []

        self.output_dir.mkdir(parents=True, exist_ok=True)
        for subdir in sorted(self.output_dir.iterdir()):
            if not subdir.name.startswith(f"{media_id}_"):
                continue
            result_path = subdir / "finding.json"
            if result_path.exists():
                with open(result_path) as f:
                    data = json.load(f)
                findings.append(Finding(**data))

        # Deterministic ordering: findings are presented in detector-id order.
        findings.sort(key=lambda f: f.detector_id)

        aggregated = self._aggregate(findings) if findings else None

        return FindingsCollection(
            media_id=media_id,
            findings=findings,
            aggregated_score=aggregated,
        )

    @staticmethod
    def _aggregate(findings: List[Finding]) -> Optional[float]:
        if not findings:
            return None
        weighted = sum(f.confidence * (1.0 if f.classification == Classification.FAKE else 0.0)
                       for f in findings)
        total = sum(f.confidence for f in findings)
        return weighted / total if total > 0 else None
