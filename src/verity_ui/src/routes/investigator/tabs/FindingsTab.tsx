/**
 * Per-detector findings with full drill-down.
 *
 * Each finding keeps its own provenance — method, version, reasoning,
 * confidence factors, raw output and explainability artifacts — rather than
 * being folded into an aggregate. The summary table is for orientation; the
 * expanded panel is the record.
 */

import { useMemo, useState } from 'react'
import {
  Accordion,
  AccordionItem,
  Button,
  CodeSnippet,
  Column,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Tag,
  UnorderedList,
  ListItem,
} from '@carbon/react'
import { ChartLineData, Search } from '@carbon/icons-react'

import { api, fileUrl } from '@/api/client'
import { useAsync } from '@/api/hooks'
import type { CaseDetail, Finding, PerFace } from '@/api/types'
import { ImageGallery } from '@/components/ImageGallery'
import type { GalleryImage } from '@/components/ImageGallery'
import { EmptyState, KeyValue, ProbabilityBar } from '@/components/Primitives'
import { formatPercent, formatTimestamp } from '@/lib/format'
import { CLASSIFICATION_TAG } from '@/lib/verdict'

const PER_FACE_PAGE = 40

function bboxText(bbox: PerFace['bbox']): string {
  if (Array.isArray(bbox)) return bbox.join(', ')
  return bbox ? String(bbox) : '—'
}

function PerFaceTable({ rows }: { rows: PerFace[] }) {
  const [limit, setLimit] = useState(PER_FACE_PAGE)

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          (b.fake_prob ?? 0) - (a.fake_prob ?? 0) ||
          String(a.face_id ?? '').localeCompare(String(b.face_id ?? '')),
      ),
    [rows],
  )

  if (!rows.length) return <p className="vy-muted">This detector did not emit per-face scores.</p>

  return (
    <>
      <TableContainer
        title={`${rows.length} face${rows.length === 1 ? '' : 's'}`}
        description="Sorted by fake probability, highest first — the same ordering the report uses."
      >
        <Table size="sm">
          <TableHead>
            <TableRow>
              <TableHeader>Face id</TableHeader>
              <TableHeader>Frame</TableHeader>
              <TableHeader>BBox (x, y, w, h)</TableHeader>
              <TableHeader>Fake probability</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.slice(0, limit).map((face, index) => (
              <TableRow key={`${face.face_id ?? index}`}>
                <TableCell className="vy-mono">{face.face_id ?? '—'}</TableCell>
                <TableCell>{face.frame_idx ?? '—'}</TableCell>
                <TableCell className="vy-mono">{bboxText(face.bbox)}</TableCell>
                <TableCell style={{ minInlineSize: '12rem' }}>
                  <ProbabilityBar value={face.fake_prob ?? 0} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {limit < sorted.length ? (
        <Button
          kind="ghost"
          size="sm"
          className="vy-mt-2"
          onClick={() => setLimit((value) => value + PER_FACE_PAGE * 4)}
        >
          Show more ({sorted.length - limit} remaining)
        </Button>
      ) : null}
    </>
  )
}

function RegionEnergyTable({ finding }: { finding: Finding }) {
  const entries = Object.entries(finding.region_aggregate ?? {})
  if (!entries.length) return null

  const hasResidual = entries.some(([, value]) => value.residual_pct != null)
  const sorted = entries.sort(
    (a, b) => (b[1].residual_pct ?? b[1].attention_pct ?? 0) - (a[1].residual_pct ?? a[1].attention_pct ?? 0),
  )

  return (
    <TableContainer
      title="Face region energy attribution"
      description="Where in the face the model concentrated. High energy in a region that should be structurally uniform is the signal worth checking against the attention maps."
    >
      <Table size="sm">
        <TableHead>
          <TableRow>
            <TableHeader>Region</TableHeader>
            {hasResidual ? <TableHeader>Residual energy</TableHeader> : null}
            <TableHeader>Attention energy</TableHeader>
            <TableHeader>Faces</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map(([region, value]) => (
            <TableRow key={region}>
              <TableCell>{region.replace(/_/g, ' ')}</TableCell>
              {hasResidual ? <TableCell>{value.residual_pct ?? '—'}%</TableCell> : null}
              <TableCell>{value.attention_pct ?? 0}%</TableCell>
              <TableCell>{value.face_count ?? 0}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function FindingPanel({ mediaId, finding }: { mediaId: string; finding: Finding }) {
  const assets = useAsync(
    () => api.detectorAssets(mediaId, finding.detector_id),
    [mediaId, finding.detector_id],
  )
  const logs = useAsync(
    () => api.detectorLogs(mediaId, finding.detector_id),
    [mediaId, finding.detector_id],
  )
  const raw = useAsync(
    () => api.detectorRaw(mediaId, finding.detector_id).catch(() => ({})),
    [mediaId, finding.detector_id],
  )

  const probabilityByFace = useMemo(() => {
    const map = new Map<string, number>()
    for (const face of finding.per_face) {
      if (face.face_id) map.set(String(face.face_id), face.fake_prob ?? 0)
    }
    return map
  }, [finding.per_face])

  const decorate = (files: { name: string; path: string }[], suffix?: string): GalleryImage[] =>
    files.map((file) => {
      const stem = file.name.replace(/\.[^.]+$/, '').replace(suffix ?? '', '')
      const probability = probabilityByFace.get(stem)
      return {
        ...(file as GalleryImage),
        caption: stem,
        badge: probability != null ? probability.toFixed(3) : undefined,
      }
    })

  const faces = decorate(assets.data?.faces ?? [])
  const attention = decorate(assets.data?.attention_maps ?? [], '_attention')
  const reconstructions = decorate(assets.data?.reconstructions ?? [], '_recon')

  return (
    <Tabs>
      <TabList aria-label={`${finding.detector_name} detail`} contained>
        <Tab>Reasoning</Tab>
        <Tab>Per-face ({finding.per_face.length})</Tab>
        <Tab>Explainability</Tab>
        <Tab>Raw output</Tab>
        <Tab>Logs</Tab>
      </TabList>
      <TabPanels>
        {/* ----- reasoning ----- */}
        <TabPanel>
          <blockquote
            style={{
              borderInlineStart: '4px solid var(--cds-border-subtle-02)',
              margin: '0 0 1.5rem',
              padding: '0.75rem 1.25rem',
              background: 'var(--cds-layer-01)',
              lineHeight: 1.6,
            }}
          >
            {finding.reasoning.summary}
          </blockquote>

          {finding.reasoning.confidence_factors.length ? (
            <>
              <h4 className="vy-section-title" style={{ fontSize: '1rem' }}>
                Confidence factors
              </h4>
              <UnorderedList className="vy-mb-3">
                {finding.reasoning.confidence_factors.map((factor) => (
                  <ListItem key={factor}>{factor}</ListItem>
                ))}
              </UnorderedList>
            </>
          ) : null}

          <h4 className="vy-section-title" style={{ fontSize: '1rem' }}>
            Key figures
          </h4>
          <KeyValue
            rows={[
              ['Classification', finding.classification],
              ['Mean fake probability', finding.mean_fake_probability.toFixed(4)],
              ['Detector confidence', finding.confidence.toFixed(4)],
              ['Faces analyzed', finding.faces_analyzed?.toLocaleString() ?? '—'],
              ...(finding.stats.min != null
                ? ([['Score range', `[${finding.stats.min}, ${finding.stats.max}]`]] as [
                    string,
                    string,
                  ][])
                : []),
              ...(finding.stats.above_threshold != null && finding.stats.count
                ? ([
                    [
                      'Above 0.7 threshold',
                      `${finding.stats.above_threshold} / ${finding.stats.count}`,
                    ],
                  ] as [string, string][])
                : []),
              ...(finding.sampling.coverage_pct != null
                ? ([['Video sampling coverage', `${finding.sampling.coverage_pct}%`]] as [
                    string,
                    string,
                  ][])
                : []),
              ['Detector version', finding.detector_version],
              ['Produced', formatTimestamp(finding.timestamp)],
            ]}
          />

          <div className="vy-mt-3">
            <RegionEnergyTable finding={finding} />
          </div>
        </TabPanel>

        {/* ----- per face ----- */}
        <TabPanel>
          <PerFaceTable rows={finding.per_face} />
        </TabPanel>

        {/* ----- explainability ----- */}
        <TabPanel>
          {assets.loading ? (
            <p className="vy-muted">Loading artifacts…</p>
          ) : !assets.data?.exists ? (
            <p className="vy-muted">
              No output directory found for this detector run. Artifacts are written to{' '}
              <span className="vy-mono">workspace/output/{mediaId}_{finding.detector_id}/</span>.
            </p>
          ) : (
            <div className="vy-stack--lg">
              {assets.data.timeline ? (
                <div>
                  <h4 className="vy-section-title" style={{ fontSize: '1rem' }}>
                    Prediction timeline
                  </h4>
                  <p className="vy-muted vy-mb-2">
                    Per-face fake probability across sampled frames. Red above 0.7, green below 0.3.
                  </p>
                  <a
                    href={fileUrl(mediaId, assets.data.timeline.path)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={fileUrl(mediaId, assets.data.timeline.path)}
                      alt="Prediction timeline"
                      style={{ inlineSize: '100%', background: 'var(--cds-layer-02)' }}
                    />
                  </a>
                </div>
              ) : null}

              <div>
                <h4 className="vy-section-title" style={{ fontSize: '1rem' }}>
                  Faces ({faces.length})
                </h4>
                <p className="vy-muted vy-mb-2">
                  Crops the detector actually scored, badged with their fake probability.
                </p>
                <ImageGallery mediaId={mediaId} images={faces} layout="faces" />
              </div>

              {attention.length ? (
                <div>
                  <h4 className="vy-section-title" style={{ fontSize: '1rem' }}>
                    Attention maps ({attention.length})
                  </h4>
                  <p className="vy-muted vy-mb-2">
                    Gradient-weighted activation — the regions that drove the classification. Check
                    these against the region energy table before quoting a localisation claim.
                  </p>
                  <ImageGallery mediaId={mediaId} images={attention} layout="maps" />
                </div>
              ) : null}

              {reconstructions.length ? (
                <div>
                  <h4 className="vy-section-title" style={{ fontSize: '1rem' }}>
                    Reconstructions ({reconstructions.length})
                  </h4>
                  <p className="vy-muted vy-mb-2">
                    Original → reconstruction → residual difference.
                  </p>
                  <ImageGallery mediaId={mediaId} images={reconstructions} layout="wide" />
                </div>
              ) : null}
            </div>
          )}
        </TabPanel>

        {/* ----- raw ----- */}
        <TabPanel>
          <p className="vy-muted vy-mb-2">
            Verbatim <span className="vy-mono">result.json</span> from the detector and the parsed{' '}
            <span className="vy-mono">finding.json</span> Verity stored.
          </p>
          {raw.loading ? (
            <p className="vy-muted">Loading…</p>
          ) : (
            <CodeSnippet type="multi" feedback="Copied" minCollapsedNumberOfRows={12}>
              {JSON.stringify(raw.data ?? {}, null, 2)}
            </CodeSnippet>
          )}
        </TabPanel>

        {/* ----- logs ----- */}
        <TabPanel>
          {logs.loading ? (
            <p className="vy-muted">Loading…</p>
          ) : (
            <div className="vy-stack--lg">
              <div>
                <h4 className="vy-section-title" style={{ fontSize: '1rem' }}>
                  stderr
                </h4>
                <pre className="vy-json">{logs.data?.stderr || '(empty)'}</pre>
              </div>
              <div>
                <h4 className="vy-section-title" style={{ fontSize: '1rem' }}>
                  stdout
                </h4>
                <pre className="vy-json">{logs.data?.stdout || '(empty)'}</pre>
              </div>
            </div>
          )}
        </TabPanel>
      </TabPanels>
    </Tabs>
  )
}

export function FindingsTab({ detail }: { detail: CaseDetail }) {
  if (!detail.findings.length) {
    return (
      <EmptyState
        icon={<Search size={32} />}
        title="No findings compiled for this case"
        body="Run a full examination, or use Compile if detector outputs already exist in the workspace. Findings are read from workspace/output/<case>_<detector>/finding.json."
      />
    )
  }

  return (
    <Grid condensed className="vy-page--tight">
      <Column sm={4} md={8} lg={16}>
        <h3 className="vy-section-title">Findings summary</h3>
        <TableContainer description="One row per detector that produced a finding. Figures match the exported report exactly.">
          <Table size="lg">
            <TableHead>
              <TableRow>
                <TableHeader>Method</TableHeader>
                <TableHeader>Classification</TableHeader>
                <TableHeader>Faces</TableHeader>
                <TableHeader>Mean fake probability</TableHeader>
                <TableHeader>Confidence</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {detail.findings.map((finding) => (
                <TableRow key={finding.detector_id}>
                  <TableCell>
                    <div>{finding.detector_name}</div>
                    <div className="vy-mono vy-helper" style={{ fontSize: '0.6875rem' }}>
                      {finding.detector_id} v{finding.detector_version}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Tag type={CLASSIFICATION_TAG[finding.classification]} size="sm">
                      {finding.classification}
                    </Tag>
                  </TableCell>
                  <TableCell>{finding.faces_analyzed?.toLocaleString() ?? '—'}</TableCell>
                  <TableCell style={{ minInlineSize: '13rem' }}>
                    <ProbabilityBar value={finding.mean_fake_probability} />
                  </TableCell>
                  <TableCell className="vy-mono">{finding.confidence.toFixed(4)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {detail.consensus.disagreement ? (
          <p className="vy-helper vy-mt-2" style={{ fontSize: '0.75rem', maxWidth: '52rem' }}>
            These detectors did not agree. Before citing any one of them, check whether the
            disagreement tracks a property of the media — heavy compression, small faces, few
            sampled frames — in the Analysis tab.
          </p>
        ) : null}

        <h3 className="vy-section-title vy-mt-4">
          <ChartLineData size={20} style={{ verticalAlign: 'text-bottom', marginInlineEnd: '0.5rem' }} />
          Detail by method
        </h3>
        <Accordion>
          {detail.findings.map((finding) => (
            <AccordionItem
              key={finding.detector_id}
              title={
                <span className="vy-row" style={{ gap: '0.75rem' }}>
                  <strong>{finding.detector_name}</strong>
                  <Tag type={CLASSIFICATION_TAG[finding.classification]} size="sm">
                    {finding.classification}
                  </Tag>
                  <span className="vy-muted" style={{ fontSize: '0.75rem' }}>
                    mean {finding.mean_fake_probability.toFixed(4)} · confidence{' '}
                    {formatPercent(finding.confidence, 1)}
                  </span>
                </span>
              }
            >
              <FindingPanel mediaId={detail.media_id} finding={finding} />
            </AccordionItem>
          ))}
        </Accordion>
      </Column>
    </Grid>
  )
}
