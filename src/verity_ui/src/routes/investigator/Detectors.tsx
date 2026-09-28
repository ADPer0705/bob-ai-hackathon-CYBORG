/**
 * Detector registry and provisioning (`verity setup`).
 *
 * Weight availability is the single thing that most often silently removes a
 * detector from an examination, so it is the most prominent column here
 * rather than a footnote.
 */

import { useState } from 'react'
import {
  Button,
  Column,
  Grid,
  InlineNotification,
  Search,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableExpandedRow,
  TableExpandHeader,
  TableExpandRow,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react'
import { CloudDownload, Purchase, Renew } from '@carbon/icons-react'

import { ApiError, api } from '@/api/client'
import { useAsync } from '@/api/hooks'
import { useJobStream } from '@/api/hooks'
import { JobConsole } from '@/components/JobConsole'
import { EmptyState, ErrorBanner, KeyValue, LoadingBlock } from '@/components/Primitives'
import { formatBytes } from '@/lib/format'
import type { DetectorEntry } from '@/api/types'

function WeightsTag({ detector }: { detector: DetectorEntry }) {
  const { weights } = detector
  if (weights.available) {
    return (
      <Tag type="green" size="sm">
        {weights.self_contained ? 'self-contained' : 'weights present'}
      </Tag>
    )
  }
  return (
    <Tag type="red" size="sm">
      checkpoint missing
    </Tag>
  )
}

export default function Detectors() {
  const catalog = useAsync(() => api.detectors(), [])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const stream = useJobStream(jobId)

  const provision = async (ids: string[] | null, force = false) => {
    setError(null)
    try {
      const job = await api.setupDetectors(ids, force)
      setJobId(job.id)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : String(cause))
    }
  }

  const detectors = (catalog.data?.detectors ?? []).filter((detector) => {
    if (!query.trim()) return true
    const needle = query.trim().toLowerCase()
    return (
      detector.detector_id.toLowerCase().includes(needle) ||
      detector.name.toLowerCase().includes(needle) ||
      detector.description.toLowerCase().includes(needle)
    )
  })

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Grid className="vy-page">
      <Column sm={4} md={8} lg={16}>
        <div className="vy-row vy-row--between vy-mb-3">
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 300, margin: 0 }}>Detectors</h1>
            <p className="vy-muted" style={{ margin: '0.5rem 0 0' }}>
              {catalog.data
                ? `${catalog.data.count} registered · ${catalog.data.weights_ready} ready to run`
                : 'Reading the registry…'}
            </p>
          </div>
          <div className="vy-row">
            <Button kind="ghost" renderIcon={Renew} onClick={catalog.reload}>
              Rescan
            </Button>
            <Button
              renderIcon={Purchase}
              disabled={!catalog.data?.count || (jobId !== null && !stream.finished)}
              onClick={() => provision(null)}
            >
              Provision all environments
            </Button>
          </div>
        </div>

        <ErrorBanner error={catalog.error ?? error} onRetry={catalog.reload} />

        {jobId ? (
          <div className="vy-mb-3">
            <JobConsole
              job={stream.job}
              logs={stream.logs}
              onCancel={() => api.cancelJob(jobId).catch(() => undefined)}
            />
          </div>
        ) : null}

        {catalog.loading && !catalog.data ? (
          <LoadingBlock lines={6} />
        ) : !catalog.data?.detectors_dir_present ? (
          <EmptyState
            icon={<CloudDownload size={32} />}
            title="Detectors directory not found"
            body={
              <>
                Verity looked in{' '}
                <span className="vy-mono vy-break">{catalog.data?.detectors_dir}</span>. Point it
                somewhere else under Settings, or set the{' '}
                <span className="vy-mono">VERITY_DETECTORS_DIR</span> environment variable. Each
                detector is a directory containing a{' '}
                <span className="vy-mono">detector.yaml</span> definition.
              </>
            }
          />
        ) : catalog.data.count === 0 ? (
          <EmptyState
            icon={<CloudDownload size={32} />}
            title="No detector definitions found"
            body={
              <>
                <span className="vy-mono vy-break">{catalog.data.detectors_dir}</span> exists but
                contains no <span className="vy-mono">detector.yaml</span> files.
              </>
            }
          />
        ) : (
          <>
            <div className="vy-mb-2">
              <Search
                labelText="Search detectors"
                placeholder="Filter by name, id or description"
                size="lg"
                value={query}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setQuery(event.target.value)
                }
              />
            </div>

            <TableContainer description="Expand a row for its capabilities and weight provenance.">
              <Table size="lg">
                <TableHead>
                  <TableRow>
                    <TableExpandHeader aria-label="Expand row" />
                    <TableHeader>Method</TableHeader>
                    <TableHeader>Accepts</TableHeader>
                    <TableHeader>Weights</TableHeader>
                    <TableHeader>Explainability</TableHeader>
                    <TableHeader>Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detectors.map((detector) => (
                    <>
                      <TableExpandRow
                        key={detector.detector_id}
                        isExpanded={expanded.has(detector.detector_id)}
                        onExpand={() => toggle(detector.detector_id)}
                        aria-label={`Expand ${detector.name}`}
                      >
                        <TableCell>
                          <div>{detector.name}</div>
                          <div className="vy-mono vy-helper" style={{ fontSize: '0.6875rem' }}>
                            {detector.detector_id} v{detector.version}
                          </div>
                        </TableCell>
                        <TableCell>
                          {detector.media_types.join(', ')}
                          {detector.faces_required ? (
                            <div className="vy-helper" style={{ fontSize: '0.6875rem' }}>
                              faces required, min {detector.min_face}px
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <WeightsTag detector={detector} />
                        </TableCell>
                        <TableCell>
                          {detector.explainability ? (
                            <Tag type="blue" size="sm">
                              activation maps
                            </Tag>
                          ) : (
                            <span className="vy-muted">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            kind="ghost"
                            size="sm"
                            disabled={jobId !== null && !stream.finished}
                            onClick={() => provision([detector.detector_id])}
                          >
                            Provision
                          </Button>
                        </TableCell>
                      </TableExpandRow>
                      {expanded.has(detector.detector_id) ? (
                        <TableExpandedRow colSpan={6} key={`${detector.detector_id}-detail`}>
                          <div style={{ padding: '1rem 0' }}>
                            {detector.description ? (
                              <p className="vy-mb-3" style={{ maxWidth: '52rem' }}>
                                {detector.description}
                              </p>
                            ) : null}
                            <KeyValue
                              rows={[
                                ['Media types', detector.media_types.join(', ')],
                                ['Faces required', detector.faces_required ? 'yes' : 'no'],
                                ['Minimum face size', `${detector.min_face} px`],
                                ['Input resolution', `${detector.resolution} px`],
                                [
                                  'Temporal',
                                  detector.video_mode
                                    ? `video mode, clip size ${detector.clip_size ?? '—'}`
                                    : 'per-frame',
                                ],
                                ['Weight kind', detector.weights.kind],
                                ['Checkpoint file', detector.weights.file || '—'],
                                [
                                  'Checkpoint size',
                                  detector.weights.size ? formatBytes(detector.weights.size) : '—',
                                ],
                                [
                                  'Source',
                                  detector.weights.url ? (
                                    <a
                                      key="u"
                                      href={detector.weights.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="vy-break"
                                    >
                                      {detector.weights.url}
                                    </a>
                                  ) : (
                                    '—'
                                  ),
                                ],
                                ...(detector.weights.note
                                  ? ([['Note', detector.weights.note]] as [string, string][])
                                  : []),
                              ]}
                            />
                          </div>
                        </TableExpandedRow>
                      ) : null}
                    </>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <InlineNotification
              className="vy-mt-3"
              kind="info"
              lowContrast
              hideCloseButton
              title="About provisioning"
              subtitle="Each detector runs in its own uv-managed environment, built from that detector's own pins. Provisioning downloads and builds those environments; it does not download model checkpoints marked as missing above."
            />
          </>
        )}
      </Column>
    </Grid>
  )
}
