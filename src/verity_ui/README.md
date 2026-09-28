# Verity UI

IBM Carbon Design System front end for the Verity deepfake examination
pipeline. React 18 + TypeScript + Vite, talking to `verity_api` over REST.

## Running it

The UI needs the API. From the repository root:

```bash
# once
pip install -e ".[api]"
cd src/verity_ui && npm install
```

### Development (two processes, hot reload)

```bash
# terminal 1 — API on :8000
uvicorn verity_api.main:app --reload --port 8000

# terminal 2 — UI on :5173, proxying /api to :8000
cd src/verity_ui && npm run dev
```

Point the proxy elsewhere with `VERITY_API=http://host:port npm run dev`.

### Production (one process, one port)

```bash
cd src/verity_ui && npm run build     # writes dist/
verity-server                          # serves the API *and* the built SPA
```

`verity-server` honours `VERITY_HOST` (default `127.0.0.1`) and `VERITY_PORT`
(default `8000`). It serves `dist/` with history-API fallback, so deep links
like `/investigator/case/<id>` work on refresh.

## The two profiles

Choosing a profile on the landing page changes vocabulary and density, not
permissions — both reach the same API. A deployment that needs to genuinely
restrict the investigator surface must enforce that server-side.

| | Citizen | Investigator |
|---|---|---|
| Theme | Carbon `white` | Carbon `g100` |
| Shape | Linear 3-step wizard | Navigable console |
| Result | Plain-language headline, agreement bar, limitations, next steps | Full record: per-detector drill-down, raw JSON, logs, artifacts |
| Numbers | Behind "Show the technical detail" | Foreground |
| Actions | Upload, read, get guidance, download report | Every pipeline stage individually, integrity verification, detector provisioning, settings |

Both see the **agreement bar**. Hiding detector disagreement from the citizen
view would reduce Verity to the single real/fake score it exists to avoid.

## CLI coverage

Every `verity` command is reachable from the UI:

| CLI | Where |
|---|---|
| `verity ingest` | Citizen upload · Investigator → Cases → Ingest media |
| `verity extract` | Case → ⋯ → Extract artifacts |
| `verity analyze` | Case → ⋯ → Analyze; results on the Analysis and Selection tabs |
| `verity run` | Case → Run examination (detector override, extractor subset, report format) |
| `verity compile` | Case → ⋯ → Compile findings |
| `verity report --format pdf\|html` | Case → Report tab |
| `verity setup --all/--detector/--force` | Detectors page |

## Layout

```
src/
  api/          client.ts (fetch + XHR upload), hooks.ts (polling + SSE), types.ts
  components/   AppShell, ConsensusPanel, JobConsole, ImageGallery, MediaPreview, Primitives
  lib/          format.ts, verdict.ts (band → language, per audience)
  routes/
    Landing.tsx
    citizen/      Upload · Checking · Result · Guidance
    investigator/ Cases · CaseDetail (+tabs/) · Detectors · Activity · Settings
  state/        role.tsx
  styles/       index.scss (Carbon + `vy-` custom layer, all token-based)
```

## Notes

- **Fonts.** IBM Plex loads from the Google Fonts CDN (`index.html`); Carbon's
  own `@font-face` emission is disabled because it would add several hundred
  rules to the bundle. For an air-gapped deployment, drop the
  `$css--font-face: false` override in `styles/index.scss`, set
  `$font-path: '@ibm/plex'`, install `@ibm/plex`, and alias it in
  `vite.config.ts`.
- **Live progress.** Jobs stream over SSE with an automatic fall back to
  polling — some proxies buffer SSE into uselessness, and a frozen progress
  bar during a long detector run is worse than a chattier poll.
- **Colour.** Every custom rule uses Carbon tokens (`var(--cds-*)`), so the
  same markup renders correctly in both theme zones.
