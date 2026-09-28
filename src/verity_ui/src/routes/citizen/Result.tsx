/**
 * Citizen step 3 — the result.
 *
 * Abstraction here means *fewer numbers*, not less honesty. The panel's
 * disagreement, the limits of what was examined, and the fact that this is
 * not a legal finding all stay on the page. Raw probabilities, detector ids
 * and confidence values are collapsed behind an opt-in disclosure so the
 * screen reads as a conclusion rather than a dashboard.
 */

import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Accordion,
  AccordionItem,
  Button,
  Column,
  Grid,
  InlineNotification,
  Tag,
  UnorderedList,
  ListItem,
} from '@carbon/react'
import {
  ArrowRight,
  Document,
  Download,
  ProgressBarRound,
  Warning,
} from '@carbon/icons-react'

import { api, reportUrl } from '@/api/client'
import { useAsync } from '@/api/hooks'
import { ConsensusVerdict } from '@/components/ConsensusPanel'
import { MediaPreview } from '@/components/MediaPreview'
import { EmptyState, ErrorBanner, LoadingBlock, ProbabilityBar } from '@/components/Primitives'
import { formatBytes, formatDuration } from '@/lib/format'
import { CLASSIFICATION_PLAIN, standingLimitations } from '@/lib/verdict'

export default function CitizenResult() {
  const { mediaId = '' } = useParams()
  const navigate = useNavigate()
  const { data, error, loading, reload } = useAsync(() => api.case(mediaId), [mediaId])

  if (loading && !data) {
    return (
      <Grid className="vy-page">
        <Column sm={4} md={8} lg={10}>
          <LoadingBlock lines={5} />
        </Column>
      </Grid>
    )
  }

  if (error || !data) {
    return (
      <Grid className="vy-page">
        <Column sm={4} md={8} lg={10}>
          <ErrorBanner error={error ?? 'This file could not be found.'} onRetry={reload} />
          <div className="vy-mt-3">
            <Button onClick={() => navigate('/citizen')}>Check another file</Button>
          </div>
        </Column>
      </Grid>
    )
  }

  const { summary, consensus, findings, analysis, media, reports } = data
  const examined = consensus.total > 0
  const limitations = standingLimitations(consensus, media.media_type)

  return (
    <Grid className="vy-page">
      <Column sm={4} md={8} lg={10}>
        <div className="vy-row vy-mb-2">
          <Tag type="outline" size="sm">
            Examination complete
          </Tag>
          <span className="vy-helper" style={{ fontSize: '0.75rem' }}>
            {media.file_name}
          </span>
        </div>

        {examined ? (
          <ConsensusVerdict consensus={consensus} audience="citizen" />
        ) : (
          <EmptyState
            icon={<ProgressBarRound size={32} />}
            title="No checks were able to run on this file"
            body={
              <>
                Verity recorded and fingerprinted your file, but no forensic method produced a
                finding. That usually means the installation has no detectors available, or that
                nothing in the file could be examined — for example, a video with no visible faces.
              </>
            }
            action={
              <Button kind="tertiary" onClick={() => navigate('/citizen')}>
                Try another file
              </Button>
            }
          />
        )}

        {/* ---------------- what was examined ---------------- */}

        <h2 className="vy-section-title vy-mt-4">What was examined</h2>
        <Grid condensed>
          <Column sm={4} md={4} lg={5}>
            <MediaPreview
              mediaId={mediaId}
              mediaType={media.media_type}
              fileName={media.file_name}
            />
          </Column>
          <Column sm={4} md={4} lg={5}>
            <UnorderedList>
              <ListItem>
                A {media.media_type === 'unknown' ? 'file' : media.media_type} of{' '}
                {formatBytes(media.size_bytes)}
                {analysis?.media.duration_seconds
                  ? `, ${formatDuration(analysis.media.duration_seconds)} long`
                  : ''}
                .
              </ListItem>
              {analysis ? (
                <ListItem>
                  {analysis.media.face_present
                    ? `${analysis.media.face_count} face${analysis.media.face_count === 1 ? '' : 's'} found across ${analysis.media.sampled_frames} sampled point${analysis.media.sampled_frames === 1 ? '' : 's'} in the file.`
                    : 'No faces were found. Most deepfake checks look at faces, so few could run.'}
                </ListItem>
              ) : null}
              <ListItem>
                {examined
                  ? `${consensus.total} independent forensic method${consensus.total === 1 ? '' : 's'} produced a finding.`
                  : 'No forensic method produced a finding.'}
              </ListItem>
              {summary.detectors_excluded > 0 ? (
                <ListItem>
                  {summary.detectors_excluded} other method
                  {summary.detectors_excluded === 1 ? ' was' : 's were'} not suitable for this file
                  and were skipped.
                </ListItem>
              ) : null}
            </UnorderedList>
          </Column>
        </Grid>

        {/* ---------------- per-method, simplified ---------------- */}

        {examined ? (
          <>
            <h2 className="vy-section-title vy-mt-4">How each check saw it</h2>
            <p className="vy-muted vy-mb-2" style={{ maxWidth: '44rem' }}>
              Each method examines the file in a different way. Where they agree, the result is
              stronger; where they disagree, it needs a person to resolve.
            </p>

            <div className="vy-stack">
              {findings.map((finding) => (
                <div
                  key={finding.detector_id}
                  style={{
                    background: 'var(--cds-layer-01)',
                    padding: '1rem 1.25rem',
                    borderInlineStart: `3px solid ${
                      finding.classification === 'FAKE'
                        ? 'var(--cds-support-error)'
                        : finding.classification === 'REAL'
                          ? 'var(--cds-support-success)'
                          : 'var(--cds-border-strong-01)'
                    }`,
                  }}
                >
                  <div className="vy-row vy-row--between">
                    <strong>{finding.detector_name}</strong>
                    <Tag
                      type={
                        finding.classification === 'FAKE'
                          ? 'red'
                          : finding.classification === 'REAL'
                            ? 'green'
                            : 'gray'
                      }
                      size="sm"
                    >
                      {CLASSIFICATION_PLAIN[finding.classification]}
                    </Tag>
                  </div>
                  <div className="vy-mt-2" style={{ maxWidth: '22rem' }}>
                    <ProbabilityBar value={finding.mean_fake_probability} showValue={false} />
                  </div>
                </div>
              ))}
            </div>

            <Accordion className="vy-mt-3">
              <AccordionItem title="Show the technical detail">
                <p className="vy-muted vy-mb-2">
                  These are the raw figures behind the summary above. The investigator view has the
                  full record, including the evidence images each method produced.
                </p>
                <UnorderedList>
                  {findings.map((finding) => (
                    <ListItem key={finding.detector_id}>
                      <span className="vy-mono">{finding.detector_id}</span> v
                      {finding.detector_version} — {finding.classification}, mean fake probability{' '}
                      <span className="vy-mono">{finding.mean_fake_probability.toFixed(4)}</span>,
                      confidence <span className="vy-mono">{finding.confidence.toFixed(4)}</span>
                      {finding.faces_analyzed ? `, ${finding.faces_analyzed} faces analysed` : ''}
                    </ListItem>
                  ))}
                </UnorderedList>
                <Button
                  className="vy-mt-3"
                  kind="ghost"
                  size="sm"
                  renderIcon={ArrowRight}
                  as={Link}
                  to={`/investigator/case/${mediaId}`}
                >
                  Open the full investigator record
                </Button>
              </AccordionItem>
            </Accordion>
          </>
        ) : null}

        {/* ---------------- limitations ---------------- */}

        <h2 className="vy-section-title vy-mt-4">What this does not tell you</h2>
        <InlineNotification
          kind="info"
          lowContrast
          hideCloseButton
          title="Read this before acting on the result"
          subtitle="Automated checks support an investigation; they do not replace one."
        />
        <UnorderedList className="vy-mt-2">
          {limitations.map((limitation) => (
            <ListItem key={limitation}>{limitation}</ListItem>
          ))}
        </UnorderedList>

        {/* ---------------- next steps ---------------- */}

        <h2 className="vy-section-title vy-mt-4">What to do next</h2>
        <div className="vy-row">
          <Button renderIcon={Warning} as={Link} to={`/citizen/guidance/${mediaId}`}>
            How to preserve and report this
          </Button>
          {reports.pdf ? (
            <Button
              kind="tertiary"
              renderIcon={Download}
              href={reportUrl(mediaId, 'pdf', true)}
              as="a"
            >
              Download the report (PDF)
            </Button>
          ) : reports.html ? (
            <Button
              kind="tertiary"
              renderIcon={Document}
              href={reportUrl(mediaId, 'html')}
              target="_blank"
              rel="noreferrer"
              as="a"
            >
              Open the report
            </Button>
          ) : null}
          <Button kind="ghost" onClick={() => navigate('/citizen')}>
            Check another file
          </Button>
        </div>
      </Column>
    </Grid>
  )
}
