from __future__ import annotations
import base64
import html
import json
from pathlib import Path
from typing import List, Optional, Dict

from verity.compile.findings_compiler import FindingsCompiler
from verity.models.findings import Finding
from verity.models.media import MediaInfo
from verity.models.report import Report
from verity.analyze.models import MediaAnalysis, DetectorSelection
from verity.detect.base_detector import DetectorDefinition


class ReportGenerator:
    """Deterministic, detector-agnostic HTML/PDF report generator.

    Reports contain only what an analyst needs: the media identity, a neutral
    findings summary, and one section per finding with the reasoning, key
    figures, and explainability artifacts. No verdicts or judgements are
    rendered. Every list is sorted with explicit tie-breakers so the same
    media + detectors always produce the same report.
    """

    def __init__(
        self,
        workspace: Path,
        definitions: Optional[Dict[str, DetectorDefinition]] = None,
    ):
        self.workspace = workspace
        self.media_dir = workspace / "media"
        self.compiler = FindingsCompiler(workspace)
        self.definitions = definitions or {}

    def generate(
        self,
        media_id: str,
        analysis: Optional[MediaAnalysis] = None,
        selection: Optional[DetectorSelection] = None,
    ) -> Report:
        self._media_id = media_id
        media = self._load_media(media_id)
        findings = self.compiler.compile(media_id)
        # The report reflects this run's decisions: findings are limited to
        # the detectors the selection included (deterministic order kept).
        if selection is not None:
            included = {d.detector_id for d in selection.decisions if d.included}
            findings.findings = [f for f in findings.findings if f.detector_id in included]
        summary = self._build_summary(media, findings)
        return Report(
            media=media,
            findings=findings,
            analysis=analysis,
            selection=selection,
            summary=summary,
        )

    def save(self, report: Report, path: Path):
        html_str = self._to_html(report)
        path.write_text(html_str)
        pdf_path = path.with_suffix(".pdf")
        self._html_to_pdf(html_str, pdf_path)

    def save_html(self, report: Report, path: Path):
        path.write_text(self._to_html(report))

    def _html_to_pdf(self, html_str: str, pdf_path: Path):
        from weasyprint import HTML
        HTML(string=html_str).write_pdf(str(pdf_path))

    # ------------------------------------------------------------------ #
    #  Data loading                                                       #
    # ------------------------------------------------------------------ #

    def _load_media(self, media_id: str) -> MediaInfo:
        meta_path = self.media_dir / f".{media_id}.json"
        if meta_path.exists():
            return MediaInfo(**json.loads(meta_path.read_text()))
        return MediaInfo(original_path=Path(media_id))

    def _build_summary(self, media: MediaInfo, findings) -> str:
        lines = [f"Media: {media.original_path.name}", f"Type: {media.media_type.value}"]
        lines.append(f"Detectors: {len(findings.findings)}")
        for f in findings.findings:
            lines.append(
                f"  {self._method_name(f.detector_id)}: "
                f"mean fake probability {self._mean_probability(f):.4f}, "
                f"confidence {f.confidence:.4f}"
            )
        return "\n".join(lines)

    # ------------------------------------------------------------------ #
    #  HTML                                                               #
    # ------------------------------------------------------------------ #

    _CSS = """
    @page {
        size: A4;
        margin: 2cm 2.2cm;
        @bottom-center { content: counter(page) " / " counter(pages); font-size: 9px; color: #888; }
    }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #222; }
    h1 { font-size: 20pt; color: #1a1a2e; border-bottom: 3px solid #1a1a2e; padding-bottom: 6px; }
    h2 { font-size: 15pt; color: #1a1a2e; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 28px; }
    h3 { font-size: 12pt; color: #333; margin-top: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 10pt; }
    th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    img { max-width: 100%; height: auto; border-radius: 4px; }
    .gallery { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
    .gallery-item { text-align: center; font-size: 9px; color: #555; }
    .gallery-item img { border: 1px solid #ddd; border-radius: 4px; }
    .collapsible-content { margin: 8px 0 16px 0; }
    code { background: #f4f4f4; padding: 1px 5px; border-radius: 3px; font-size: 10pt; }
    pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 9pt; }
    .section { page-break-inside: avoid; }
    blockquote { border-left: 4px solid #ccc; margin: 10px 0; padding: 8px 16px; background: #fafafa; border-radius: 0 4px 4px 0; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9pt; color: #888; text-align: center; }
    summary { cursor: pointer; margin: 8px 0; }
    .muted { color: #777; font-size: 9.5pt; }
    """

    def _to_html(self, report: Report) -> str:
        parts = [
            '<!DOCTYPE html>\n<html lang="en">\n<head>',
            '<meta charset="utf-8">',
            "<title>Verity Analysis Report</title>",
            f"<style>{self._CSS}</style>",
            "</head>",
            "<body>",
            self._header_html(report),
            self._summary_html(report),
        ]

        for finding in report.findings.findings:
            parts.append(self._finding_html(finding))

        parts.append(self._footer_html())
        parts.append("</body></html>")
        return "\n".join(parts)

    # ----- header ----- #

    def _header_html(self, report: Report) -> str:
        media = report.media
        m = media.metadata
        rows = [
            ("File", f"<code>{html.escape(media.original_path.name)}</code>"),
            ("Media Type", media.media_type.value),
            ("Size", f"{media.size_bytes:,} bytes"),
            ("SHA-256", f"<code>{media.checksum}</code>"),
        ]
        char = report.analysis.media if report.analysis else None
        if char:
            if char.duration_seconds is not None:
                rows.append(("Duration", f"{char.duration_seconds:.2f}s"))
            if char.width and char.height:
                rows.append(("Resolution", f"{char.width} x {char.height}"))
            if char.fps:
                rows.append(("FPS", f"{char.fps}"))
            if char.face_present:
                rows.append(("Faces Detected", f"{char.face_count} (in {char.sampled_frames} sampled frames)"))
            else:
                rows.append(("Faces Detected", "none"))
        rows.append(("Report Generated", report.generated_at.strftime("%Y-%m-%d %H:%M:%S UTC")))

        table = "".join(
            f"<tr><th>{k}</th><td>{v}</td></tr>" for k, v in rows
        )
        return f"""
<h1>Verity Analysis Report</h1>
<div class="muted">{html.escape(m.get("original_name", ""))} &middot; media id <code>{report.media.original_path.stem}</code></div>
<table>{table}</table>
"""

    # ----- findings summary (neutral) ----- #

    def _summary_html(self, report: Report) -> str:
        parts = ['<h2>Findings Summary</h2>']
        if report.selection:
            included = [d for d in report.selection.decisions if d.included]
            excluded = [d for d in report.selection.decisions if not d.included]
            items = [(d.detector_id, self._finding_for(report, d.detector_id))
                     for d in included]
        else:
            excluded = []
            items = [(f.detector_id, f) for f in report.findings.findings]

        rows = ""
        for detector_id, finding in items:
            label = (
                f"{html.escape(self._method_name(detector_id))} "
                f"<span class='muted'><code>{detector_id}</code></span>"
            )
            if finding:
                rows += (
                    f"<tr><td>{label}</td>"
                    f"<td>{self._faces_analyzed(finding)}</td>"
                    f"<td>{self._mean_probability(finding):.4f}</td>"
                    f"<td>{finding.confidence:.4f}</td></tr>"
                )
            else:
                rows += (
                    f"<tr><td>{label}</td>"
                    f"<td class='muted' colspan='3'>no finding</td></tr>"
                )

        parts.append(f"""
<table>
<tr><th>Method</th><th>Faces Analyzed</th><th>Mean Fake Probability</th><th>Confidence</th></tr>
{rows}
</table>
""")

        if excluded:
            excl_rows = "".join(
                f"<tr><td>{html.escape(self._method_name(d.detector_id))}"
                f" <span class='muted'><code>{d.detector_id}</code></span></td>"
                f"<td>{html.escape('; '.join(d.reasons))}</td></tr>"
                for d in excluded
            )
            parts.append(f"""
<details><summary><b>Excluded Detectors ({len(excluded)})</b></summary>
<div class="collapsible-content">
<table>
<tr><th>Method</th><th>Reason</th></tr>
{excl_rows}
</table>
</div></details>
""")
        return "\n".join(parts)

    # ----- per-finding ----- #

    def _finding_html(self, finding: Finding) -> str:
        parts = [
            '<div class="page-break"></div>',
            self._heading_html(finding),
            self._reasoning_html(finding),
            self._key_figures_html(finding),
            self._artifacts_html(finding),
        ]
        return "\n".join(parts)

    def _heading_html(self, finding: Finding) -> str:
        return f"""
<h2>{html.escape(self._method_name(finding.detector_id))}
<span class="muted"><code>{finding.detector_id}</code> v{finding.detector_version}</span></h2>
"""

    def _reasoning_html(self, finding: Finding) -> str:
        parts = [f"""
<h3>Reasoning</h3>
<blockquote>{html.escape(finding.reasoning.summary)}</blockquote>
"""]
        cf = finding.reasoning.confidence_factors
        if cf:
            items = "".join(f"<li>{html.escape(str(item))}</li>" for item in cf)
            parts.append(f"""
<h3>Confidence Factors</h3>
<ul>{items}</ul>
""")
        region_table = self._region_energy_table(finding)
        if region_table:
            parts.append(region_table)
        return "\n".join(parts)

    def _key_figures_html(self, finding: Finding) -> str:
        raw = finding.raw_output
        stats = raw.get("stats", {})
        sampling = raw.get("sampling", {})
        rows = []
        faces = self._faces_analyzed(finding)
        if faces is not None:
            rows.append(("Faces Analyzed", str(faces)))
        rows.append(("Mean Fake Probability", f"{self._mean_probability(finding):.4f}"))
        if stats.get("min") is not None:
            rows.append(("Score Range", f"[{stats['min']}, {stats['max']}]"))
        if stats.get("above_threshold") is not None and stats.get("count"):
            rows.append(("Above Threshold (&gt;0.7)", f"{stats['above_threshold']} / {stats['count']}"))
        if sampling.get("coverage_pct") is not None:
            rows.append(("Video Sampling Coverage", f"{sampling['coverage_pct']}%"))
        detail = "".join(f"<tr><td><b>{k}</b></td><td>{v}</td></tr>" for k, v in rows)
        return f"""
<h3>Key Figures</h3>
<table style="width:auto">{detail}</table>
"""

    @staticmethod
    def _region_energy_table(finding: Finding) -> str:
        ra = finding.raw_output.get("region_aggregate")
        if not ra:
            return ""
        has_residual = any("residual_pct" in v for v in ra.values())
        rows = []
        for k, v in sorted(ra.items(), key=lambda kv: (-kv[1].get("residual_pct", 0), kv[0])):
            cells = [f"<td>{html.escape(str(k))}</td>"]
            if has_residual:
                cells.append(f"<td>{v.get('residual_pct', 'n/a')}%</td>")
            cells.append(f"<td>{v.get('attention_pct', 0)}%</td>")
            cells.append(f"<td>{v.get('face_count', 0)}</td>")
            rows.append("<tr>" + "".join(cells) + "</tr>")
        headers = ["Region"]
        if has_residual:
            headers.append("Residual Energy (%)")
        headers.extend(["Attention Energy (%)", "Faces"])
        return f"""
<details><summary><b>Face Region Energy Attribution</b></summary>
<div class="collapsible-content">
<table>
<tr>{''.join(f'<th>{h}</th>' for h in headers)}</tr>
{''.join(rows)}
</table>
</div></details>
"""

    def _artifacts_html(self, finding: Finding) -> str:
        parts = []
        out_dir = self._finding_output_dir(finding)
        if out_dir is None:
            return ""

        timeline = out_dir / "timeline.png"
        if timeline.exists():
            parts.append(f"""
<h3>Prediction Timeline</h3>
<p class="muted">Per-face fake probability across sampled frames (red &gt; 0.7, green &lt; 0.3).</p>
{self._b64_img(timeline, w=700)}
""")

        sections = []

        faces = self._sorted_images(out_dir / "faces", "*.png")
        per_face = {f["face_id"]: f["fake_prob"] for f in finding.raw_output.get("per_face", [])}
        faces.sort(key=lambda p: (-per_face.get(p.stem, 0), p.name))
        if faces:
            sections.append((
                "Faces",
                "Top suspicious faces (highest fake probability)",
                faces[:6],
                faces,
                220,
                3,
            ))

        attns = self._sorted_images(out_dir / "attention_maps", "*_attention.png")
        if attns:
            sections.append((
                "Attention Maps",
                "Regions most influential to the classification",
                attns[:4],
                attns,
                320,
                2,
            ))

        recons = self._sorted_images(out_dir / "reconstructions", "*_recon.png")
        if recons:
            sections.append((
                "Reconstructions",
                "Original &rarr; reconstruction &rarr; residual |&Delta;|",
                recons[:4],
                recons,
                320,
                2,
            ))

        for title, caption, top, all_, w, cols in sections:
            parts.append(f"""
<h3>{title}</h3>
<p class="muted">{caption}.</p>
{self._gallery(top, w=w, cols=cols)}
""")
            if len(all_) > len(top):
                parts.append(f"""
<details><summary><b>All {title} ({len(all_)} total)</b></summary>
<div class="collapsible-content">{self._gallery(all_, w=180, cols=5)}</div></details>
""")

        if per_face:
            pf_rows = "".join(
                f"<tr><td>{html.escape(str(f.get('face_id','')))}</td>"
                f"<td>{f.get('frame_idx','N/A')}</td>"
                f"<td>{f.get('bbox','N/A')}</td>"
                f"<td>{f.get('fake_prob','N/A')}</td></tr>"
                for f in sorted(
                    finding.raw_output.get("per_face", []),
                    key=lambda r: (-r.get("fake_prob", 0), str(r.get("face_id", ""))),
                )
            )
            parts.append(f"""
<details><summary><b>Per-Face Results ({len(per_face)} total)</b></summary>
<div class="collapsible-content">
<table>
<tr><th>Face ID</th><th>Frame</th><th>BBox (x,y,w,h)</th><th>Fake Prob</th></tr>
{pf_rows}
</table>
</div></details>
""")
        return "\n".join(parts)

    def _finding_output_dir(self, finding: Finding) -> Optional[Path]:
        media_id = getattr(self, "_media_id", None)
        if media_id is None:
            return None
        candidate = self.workspace / "output" / f"{media_id}_{finding.detector_id}"
        return candidate if candidate.exists() else None

    def _footer_html(self) -> str:
        return (
            '<div class="footer"><p>Findings are deterministic: the same media '
            'and detectors always produce the same report.</p></div>'
        )

    # ----- helpers ----- #

    def _method_name(self, detector_id: str) -> str:
        definition = self.definitions.get(detector_id)
        if definition is not None and definition.name:
            return definition.name
        return detector_id

    def _mean_probability(self, finding: Finding) -> float:
        per_face = [f.get("fake_prob") for f in finding.raw_output.get("per_face", [])
                    if isinstance(f.get("fake_prob"), (int, float))]
        if per_face:
            return sum(per_face) / len(per_face)
        pred = finding.raw_output.get("prediction")
        if isinstance(pred, (int, float)):
            return float(pred)
        return 0.0

    def _faces_analyzed(self, finding: Finding) -> Optional[int]:
        stats = finding.raw_output.get("stats", {})
        if stats.get("count") is not None:
            return int(stats["count"])
        per_face = finding.raw_output.get("per_face", [])
        if per_face:
            return len(per_face)
        return None

    def _finding_for(self, report: Report, detector_id: str) -> Optional[Finding]:
        for f in report.findings.findings:
            if f.detector_id == detector_id:
                return f
        return None

    @staticmethod
    def _sorted_images(directory: Path, pattern: str) -> List[Path]:
        if not directory.exists():
            return []
        return sorted(directory.glob(pattern), key=lambda p: p.name)

    def _b64_img(self, path: Path, w: int = 400) -> str:
        if not path.exists():
            return ""
        b64 = base64.b64encode(path.read_bytes()).decode()
        ext = path.suffix.lstrip(".")
        return f'<img src="data:image/{ext};base64,{b64}" width="{w}px"/>'

    def _gallery(self, paths: List[Path], w: int = 250, cols: int = 4) -> str:
        if not paths:
            return ""
        items = "".join(
            f'<div class="gallery-item">{self._b64_img(p, w)}<br/>{html.escape(p.stem)}</div>\n'
            for p in paths
        )
        return f'<div class="gallery">{items}</div>'
