from __future__ import annotations
import json
import os
import sys
import yaml
import click
from pathlib import Path

from verity.models.media import MediaType
from verity.ingest.media_ingestor import MediaIngestor
from verity.extract.frame_extractor import FrameExtractor
from verity.extract.face_extractor import FaceExtractor
from verity.extract.metadata_extractor import MetadataExtractor
from verity.extract.audio_extractor import AudioExtractor
from verity.analyze.media_analyzer import MediaAnalyzer
from verity.analyze.detector_selector import DetectorSelector
from verity.detect.detector_registry import DetectorRegistry
from verity.detect.detector_runner import DetectorRunner
from verity.compile.findings_compiler import FindingsCompiler
from verity.report.report_generator import ReportGenerator

EXTRACTORS = ["frame", "face", "metadata", "audio"]


def _default_config() -> dict:
    return {
        "detectors_dir": os.environ.get("VERITY_DETECTORS_DIR", ""),
        "workspace": os.environ.get("VERITY_WORKSPACE", "workspace"),
        "output_dir": os.environ.get("VERITY_OUTPUT_DIR", ""),
        "extractors": EXTRACTORS,
    }


def _load_config(config: str | None) -> dict:
    cfg = _default_config()
    if config and Path(config).exists():
        with open(config) as f:
            loaded = yaml.safe_load(f) or {}
        cfg.update({k: v for k, v in loaded.items() if k in cfg})
    return cfg


def _detectors_dir(cfg: dict) -> Path:
    if cfg.get("detectors_dir"):
        return Path(cfg["detectors_dir"])
    repo = Path(__file__).resolve().parents[2]
    repo_detectors = repo / "detectors"
    if repo_detectors.exists():
        return repo_detectors
    raise click.ClickException(
        "Cannot locate detectors/. Set detectors_dir in config or "
        "VERITY_DETECTORS_DIR."
    )


def _workspace(cfg: dict) -> Path:
    return Path(cfg.get("workspace", "workspace"))


def _output_dir(cfg: dict, workspace: Path) -> Path:
    return Path(cfg.get("output_dir") or (workspace / "output"))


def _extractors(ws: Path, cfg: dict):
    enabled = cfg.get("extractors") or EXTRACTORS
    mapping = {
        "frame": FrameExtractor,
        "face": FaceExtractor,
        "metadata": MetadataExtractor,
        "audio": AudioExtractor,
    }
    return [mapping[name](ws) for name in enabled if name in mapping]


def _media_files(media: Path) -> list[Path]:
    media = media.resolve()
    if media.is_dir():
        return sorted(p for p in media.iterdir() if p.is_file())
    return [media]


@click.group()
def cli():
    pass


@cli.command()
@click.option("--media", default=None, type=click.Path(exists=True),
              help="Media file or directory of media files (default: $INPUT_DIR)")
@click.option("--detector", default=None,
              help="Comma-separated detector override (default: auto-select)")
@click.option("--workspace", default=None, type=click.Path(), help="Workspace directory")
@click.option("--config", default=None, type=click.Path(), help="Pipeline config file")
@click.option("--output", default=None, type=click.Path(), help="Report output directory")
@click.option("--format", "fmt", default="pdf", type=click.Choice(["pdf", "html"]),
              help="Report format")
def run(media: str | None, detector: str | None, workspace: str | None, config: str | None,
        output: str | None, fmt: str):
    """Full pipeline: ingest -> analyze -> select -> run -> compile -> report."""
    media_path = Path(media) if media else Path(os.environ.get("INPUT_DIR", "/input"))
    cfg = _load_config(config)
    if workspace:
        cfg["workspace"] = workspace
    if output:
        cfg["output_dir"] = output
    ws = _workspace(cfg)
    out_dir = _output_dir(cfg, ws)

    registry = DetectorRegistry(_detectors_dir(cfg))
    runner = DetectorRunner(ws, registry)
    ingestor = MediaIngestor(ws)
    analyzer = MediaAnalyzer(ws / "media")
    selector = DetectorSelector(registry)
    compiler = FindingsCompiler(ws)
    generator = ReportGenerator(ws, registry.list_detectors())

    detector_override = [d.strip() for d in detector.split(",")] if detector else None

    for media_path in _media_files(media_path):
        click.echo(f"\n=== {media_path.name} ===")
        media_copy = ingestor.ingest(media_path)
        media_id = media_copy.media_id
        click.echo(f"Ingested: {media_id} ({media_copy.original.media_type.value})")

        for ext in _extractors(ws, cfg):
            ext.extract(media_id)

        analysis = analyzer.analyze(media_id, media_copy.original.media_type)
        faces = analysis.media.face_count
        click.echo(
            f"Analysis: {analysis.media.format or 'n/a'}, "
            f"faces detected: {faces} in {analysis.media.sampled_frames} sampled frames"
        )

        selection = selector.select(analysis)
        selected = (
            sorted(set(detector_override) & set(registry.list_detectors()))
            if detector_override
            else selection.selected
        )
        if detector_override:
            # The saved selection must reflect what actually ran: keep the
            # analyzer's decisions (and reasons) but mark the override set as
            # included.
            selection = selection.model_copy(deep=True)
            override_set = set(selected)
            for decision in selection.decisions:
                decision.included = decision.detector_id in override_set
        skipped = [d for d in (detector_override or []) if d not in registry.list_detectors()]
        if skipped:
            click.echo(f"Unknown detectors ignored: {', '.join(skipped)}")

        n_excluded = len([d for d in selection.decisions if not d.included])
        click.echo(f"Detectors selected: {len(selected)}"
                   + ("" if detector_override else " (auto)")
                   + f" / excluded: {n_excluded}")
        for det_id in selected:
            click.echo(f"  running {det_id} ...")
            finding = runner.run(media_id, det_id)
            click.echo(
                f"    -> {finding.classification.value} "
                f"(fake prob: {finding.raw_output.get('prediction', 0.5):.4f}, "
                f"confidence: {finding.confidence:.4f})"
            )

        findings = compiler.compile(media_id)
        click.echo(f"Findings: {len(findings.findings)}")

        report = generator.generate(media_id, analysis=analysis, selection=selection)
        report_dir = out_dir / media_id
        report_dir.mkdir(parents=True, exist_ok=True)
        analyzer.save(analysis, report_dir)
        selector.save(selection, report_dir)
        base = report_dir / "report"
        if fmt == "html":
            generator.save_html(report, base.with_suffix(".html"))
            click.echo(f"Report: {base.with_suffix('.html')}")
        else:
            generator.save(report, base.with_suffix(".html"))
            click.echo(f"Report: {base.with_suffix('.pdf')}")


@cli.command()
@click.option("--media", default=None, type=click.Path(exists=True),
              help="Media file or directory of media files (default: $INPUT_DIR)")
@click.option("--workspace", default=None, type=click.Path())
@click.option("--config", default=None, type=click.Path())
@click.option("--json", "as_json", is_flag=True, help="Print analysis as JSON")
def analyze(media: str | None, workspace: str | None, config: str | None, as_json: bool):
    """Analyze media and show which detectors are suitable and why."""
    media_path = Path(media) if media else Path(os.environ.get("INPUT_DIR", "/input"))
    cfg = _load_config(config)
    if workspace:
        cfg["workspace"] = workspace
    ws = _workspace(cfg)

    registry = DetectorRegistry(_detectors_dir(cfg))
    ingestor = MediaIngestor(ws)
    analyzer = MediaAnalyzer(ws / "media")
    selector = DetectorSelector(registry)

    for media_path in _media_files(media_path):
        media_copy = ingestor.ingest(media_path)
        analysis = analyzer.analyze(media_copy.media_id, media_copy.original.media_type)
        selection = selector.select(analysis)
        if as_json:
            click.echo(json.dumps({
                "media_id": media_copy.media_id,
                "analysis": analysis.model_dump(mode="json"),
                "selection": selection.model_dump(mode="json"),
            }, indent=2))
            continue

        char = analysis.media
        click.echo(f"\n=== {media_path.name} ===")
        click.echo(f"Media id : {char.media_id}")
        click.echo(f"Type     : {char.media_type.value} ({char.format or 'n/a'})")
        if char.duration_seconds is not None:
            click.echo(f"Duration : {char.duration_seconds:.2f}s")
        if char.width and char.height:
            click.echo(f"Size     : {char.width}x{char.height}")
        if char.fps:
            click.echo(f"FPS      : {char.fps}")
        click.echo(
            f"Faces    : {'yes (' + str(char.face_count) + ' in ' + str(char.sampled_frames) + ' sampled frames)' if char.face_present else 'none'}"
        )
        click.echo(f"\nSelected ({len(selection.selected)}):")
        for d in selection.selected:
            click.echo(f"  + {d}")
        excluded = [d for d in selection.decisions if not d.included]
        if excluded:
            click.echo(f"\nExcluded ({len(excluded)}):")
            for d in excluded:
                click.echo(f"  - {d.detector_id}: {'; '.join(d.reasons)}")


@cli.command()
@click.option("--all", "all_", is_flag=True, help="Provision all detector environments")
@click.option("--detector", default=None, help="Provision one detector environment")
@click.option("--force", is_flag=True, help="Re-provision even if up to date")
@click.option("--workspace", default=None, type=click.Path())
@click.option("--config", default=None, type=click.Path())
def setup(all_: bool, detector: str | None, force: bool, workspace: str | None,
          config: str | None):
    """Provision detector environments with uv (cached under $VERITY_DETECTOR_ENVS)."""
    cfg = _load_config(config)
    if workspace:
        cfg["workspace"] = workspace
    ws = _workspace(cfg)
    registry = DetectorRegistry(_detectors_dir(cfg))
    runner = DetectorRunner(ws, registry)
    ids = [detector] if detector else (None if all_ else None)
    if ids is None and not all_:
        raise click.ClickException("Use --all or --detector <id>")
    sys.exit(runner.setup(detector_ids=ids, force=force))


@cli.command()
@click.option("--media", required=True, type=click.Path(exists=True))
@click.option("--workspace", default=None, type=click.Path())
@click.option("--config", default=None, type=click.Path())
def ingest(media: str, workspace: str | None, config: str | None):
    """Ingest media: create checksummed read-only copy."""
    cfg = _load_config(config)
    if workspace:
        cfg["workspace"] = workspace
    ws = _workspace(cfg)
    for media_path in _media_files(Path(media)):
        copy = MediaIngestor(ws).ingest(media_path)
        click.echo(f"Media ID: {copy.media_id}")
        click.echo(f"Type: {copy.original.media_type.value}")
        click.echo(f"Checksum: {copy.original.checksum}")
        click.echo(f"Copy: {copy.copy_path}")


@cli.command()
@click.option("--media-id", required=True)
@click.option("--workspace", default=None, type=click.Path())
@click.option("--config", default=None, type=click.Path())
def extract(media_id: str, workspace: str | None, config: str | None):
    """Extract frames, faces, metadata and audio from ingested media."""
    cfg = _load_config(config)
    if workspace:
        cfg["workspace"] = workspace
    ws = _workspace(cfg)
    total = 0
    for ext in _extractors(ws, cfg):
        result = ext.extract(media_id)
        total += len(result.artifacts)
        click.echo(f"  {ext.__class__.__name__}: {len(result.artifacts)} artifact(s)")
    click.echo(f"Total artifacts extracted: {total}")


@cli.command()
@click.option("--media-id", required=True)
@click.option("--workspace", default=None, type=click.Path())
@click.option("--config", default=None, type=click.Path())
def compile(media_id: str, workspace: str | None, config: str | None):
    """Compile all findings for a media item."""
    cfg = _load_config(config)
    if workspace:
        cfg["workspace"] = workspace
    ws = _workspace(cfg)
    collection = FindingsCompiler(ws).compile(media_id)
    click.echo(f"Findings: {len(collection.findings)}")
    for f in collection.findings:
        click.echo(f"  {f.detector_id}: {f.classification.value} ({f.confidence:.4f})")


@cli.command()
@click.option("--media-id", required=True)
@click.option("--workspace", default=None, type=click.Path())
@click.option("--config", default=None, type=click.Path())
@click.option("--output", default=None, type=click.Path())
@click.option("--format", "fmt", default="pdf", type=click.Choice(["pdf", "html"]))
def report(media_id: str, workspace: str | None, config: str | None,
           output: str | None, fmt: str):
    """Generate a report for one media item."""
    cfg = _load_config(config)
    if workspace:
        cfg["workspace"] = workspace
    ws = _workspace(cfg)
    registry = DetectorRegistry(_detectors_dir(cfg))
    generator = ReportGenerator(ws, registry.list_detectors())
    report_obj = generator.generate(media_id)
    report_dir = Path(output) if output else _output_dir(cfg, ws) / media_id
    report_dir.mkdir(parents=True, exist_ok=True)
    base = report_dir / "report"
    if fmt == "html":
        generator.save_html(report_obj, base.with_suffix(".html"))
        click.echo(f"Report: {base.with_suffix('.html')}")
    else:
        generator.save(report_obj, base.with_suffix(".html"))
        click.echo(f"Report: {base.with_suffix('.pdf')}")


if __name__ == "__main__":
    cli()
