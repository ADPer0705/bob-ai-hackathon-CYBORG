import pytest
import tempfile
import json
from pathlib import Path
from verity.compile.findings_compiler import FindingsCompiler
from verity.models.findings import Classification, Reasoning, Finding


class TestFindingsCompiler:
    def test_compile_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws = Path(tmp)
            compiler = FindingsCompiler(ws)
            collection = compiler.compile("nonexistent")
            assert len(collection.findings) == 0
            assert collection.aggregated_score is None

    def test_compile_with_findings(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws = Path(tmp)
            output_dir = ws / "output"
            output_dir.mkdir()

            finding = Finding(
                detector_id="xception",
                detector_version="1.0.0",
                classification=Classification.FAKE,
                confidence=0.95,
                reasoning=Reasoning(summary="Test"),
            )

            subdir = output_dir / "abc_xception"
            subdir.mkdir()
            (subdir / "finding.json").write_text(finding.model_dump_json(indent=2))

            compiler = FindingsCompiler(ws)
            collection = compiler.compile("abc")
            assert len(collection.findings) == 1
            assert collection.findings[0].detector_id == "xception"
            assert collection.aggregated_score is not None
