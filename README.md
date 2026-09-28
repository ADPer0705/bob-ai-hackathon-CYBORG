# 🚀 Verity - Deepfake Detection for Criminal Investigations

---

## 👥 Team

| Field | Value |
|---|---|
| **Team Name** | CYBORG |
| **Track** | TRACK 2 - CYBER FORENSICS |
| **Team Lead** | JATIN — mail.jatinagarwal@gmail.com |
| **Members** | ANAY, ADITYA, AARSH |

---

## 🎯 Problem Statement

Deepfake media is increasingly being used in criminal contexts such as impersonation, harassment, sextortion, and fraud, while cyber cells often lack a structured workflow for examining and documenting such evidence. Investigators must assess multiple technical indicators — including metadata, compression artifacts, facial inconsistencies, and audio-video synchronization — and then translate those findings into legally and operationally useful case documentation.

---

## 💡 Solution

**Verity** is a Bob-powered cyber cell investigation assistant that guides investigators through a structured deepfake examination workflow and combines findings from multiple forensic analysis techniques into a traceable evidence record. Rather than reducing an investigation to a single "real/fake" score, Verity preserves individual findings and their provenance, allowing IBM Bob to reason over the collected evidence, explain the assessment, map potentially relevant legal provisions, and generate investigation-ready reports.

---

## ✨ Key Features

- **Structured Deepfake Investigation:** Guides investigators through a repeatable examination workflow covering metadata, compression artifacts, facial analysis, and audio-video synchronization.

- **Multi-Modal Evidence Analysis:** Combines findings from different analysis channels instead of relying on a single deepfake classifier.

- **Evidence-Centric Findings:** Records individual forensic findings with their source, analysis method, confidence, and supporting evidence.

- **Evidence-Grounded Bob Agent:** IBM Bob acts as the investigation agent, using the available forensic analysis tools and evidence to interpret findings and assist the investigator rather than independently inventing conclusions.

- **Explainable Investigation Reports:** Generates an evidence summary and internal investigation brief with traceable findings and documented limitations.

- **Legal Context Mapping:** Identifies potentially relevant provisions under the IT Act 2000 and BNS based on the documented case context, with the results presented for investigator/legal review.

- **Victim-Facing Reporting Guide:** Converts the investigation context into an accessible reporting and evidence-preservation guide for victims.

---

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| **Languages** | Python 3.10+, TypeScript |
| **Backend** | Click (CLI), FastAPI + Uvicorn (HTTP API), Pydantic v2 |
| **Frontend** | React 18, Vite, **IBM Carbon Design System** (`@carbon/react`), IBM Plex |
| **IBM Technologies** | IBM Bob, IBM Carbon Design System |
| **Deepfake / Forensic Analysis** | OpenCV, ffmpeg/ffprobe, containerized per-detector environments provisioned with `uv` |
| **Reporting** | WeasyPrint (PDF), Matplotlib (timelines) |

---

## 📁 Repository Structure

```
├── src/
│   ├── verity/           # Pipeline + CLI (reference implementation)
│   ├── verity_api/       # FastAPI service wrapping the pipeline
│   └── verity_ui/        # React + Carbon web console
├── config/pipeline.yaml  # Shared configuration
├── docs/                 # Written documentation
│   ├── problem-statement.md
│   ├── solution-overview.md
│   ├── architecture.md
│   ├── web-ui.md         # API map, UI design rationale, security posture
│   └── setup-guide.md
├── demo/                 # Demo artifacts
│   ├── screenshots/      # App screenshots
│   └── demo-video-link.txt  # Link to demo video
├── presentation/         # Slide deck
└── submission.yaml       # Structured submission metadata
```

---

## ⚡ How to Run

Verity ships two front ends over one pipeline: a **CLI** and a **web console**
built on the IBM Carbon Design System.

### Web console (recommended)

```bash
# 1. Install the pipeline plus the API extras
pip install -e ".[api]"

# 2. Build the UI
cd src/verity_ui && npm install && npm run build && cd ../..

# 3. Serve the API and the UI on one port
verity-server            # http://127.0.0.1:8000
```

Open <http://127.0.0.1:8000>, choose **Citizen** or **Investigator**, and the
whole pipeline is available from the browser. Interactive API docs live at
`/api/docs`. For hot reload during development, see
[`src/verity_ui/README.md`](src/verity_ui/README.md).

### CLI

```bash
pip install -e .

verity setup --all                       # provision detector environments (needs uv)
verity run --media path/to/evidence.mp4  # ingest -> analyze -> detect -> report
verity analyze --media path/to/file      # what would run, and why
```

Both read the same configuration — [`config/pipeline.yaml`](config/pipeline.yaml)
and the `VERITY_*` environment variables — and write to the same workspace.

> **Detectors are not bundled.** Point `VERITY_DETECTORS_DIR` at your detector
> definitions, or drop them in `detectors/`. Without them the pipeline still
> ingests, characterizes, extracts artifacts and reports — it just has nothing
> to run, and every screen says so explicitly rather than failing silently.

---

## 🖥️ Demo

| Artifact | Link |
|---|---|
| 📹 Demo Video | [See demo/demo-video-link.txt](demo/demo-video-link.txt) |
| 🌐 Live Demo | [See demo/live-demo-url.txt](demo/live-demo-url.txt) |
| 🖼️ Screenshots | [See demo/screenshots/](demo/screenshots/) |
| 📊 Presentation | [See presentation/slides.pdf](presentation/) |

---

## ⚠️ Known Limitations

> Be honest — judges appreciate transparency over overclaiming.

- [Limitation 1: e.g., "Authentication is mocked — not production-ready"]
- [Limitation 2: e.g., "Only tested on Chrome"]
- [Limitation 3: e.g., "Feature X is scaffolded but not fully implemented"]

---

## 🏅 What We're Most Proud Of

[Tell the judges what part of your submission is strongest and worth paying close attention to.]

---
