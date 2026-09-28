/**
 * Case overview — identity, integrity and the aggregate position.
 *
 * Integrity verification is a first-class action here rather than buried in a
 * menu: being able to re-derive the hash on demand, in front of someone, is
 * what makes the rest of the record defensible.
 */

import { useState } from 'react'
import {
  Button,
  Column,
  Grid,
  InlineNotification,
  Tag,
} from '@carbon/react'
import { Download, FingerprintRecognition } from '@carbon/icons-react'

import { ApiError, api, mediaFileUrl } from '@/api/client'
import type { CaseDetail, IntegrityCheck } from '@/api/types'
import { ConsensusVerdict } from '@/components/ConsensusPanel'
import { MediaPreview } from '@/components/MediaPreview'
import { CopyValue, KeyValue, MetricGrid } from '@/components/Primitives'
import { formatBytes, formatDuration, formatTimestamp, shortHash } from '@/lib/format'

export function OverviewTab({ detail }: { detail: CaseDetail }) {
  const { media, analysis, consensus, summary } = detail
  const [check, setCheck] = useState<IntegrityCheck | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const verify = async () => {
    setVerifying(true)
    setVerifyError(null)
    try {
      setCheck(await api.verify(detail.media_id))
    } catch (cause) {
      setVerifyError(cause instanceof ApiError ? cause.message : String(cause))
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Grid condensed className="vy-page--tight">
      <Column sm={4} md={8} lg={10}>
        <ConsensusVerdict consensus={consensus} audience="investigator" />

        <h3 className="vy-section-title vy-mt-4">Examination state</h3>
        <MetricGrid
          metrics={[
            {
              label: 'Detectors run',
              value: summary.findings_count,
              hint: `${summary.detectors_excluded} excluded by the selector`,
            },
            {
              label: 'Agreement',
              value: consensus.total ? `${Math.round(consensus.agreement * 100)}%` : '—',
              hint: consensus.total
                ? `${consensus.fake} manipulated · ${consensus.real} authentic · ${consensus.uncertain} undecided`
                : 'No findings compiled',
            },
            {
              label: 'Mean fake probability',
              value: consensus.mean_fake_probability?.toFixed(4) ?? '—',
              hint: 'Unweighted mean across detectors',
            },
            {
              label: 'Faces detected',
              value: analysis?.media.face_count ?? '—',
              hint: analysis
                ? `across ${analysis.media.sampled_frames} sampled frames`
                : 'Media not yet characterized',
            },
          ]}
        />

        <h3 className="vy-section-title vy-mt-4">Media identity</h3>
        <KeyValue
          rows={[
            ['File name', media.file_name],
            ['Case id', <CopyValue key="id" value={detail.media_id} label="case id" />],
            ['Media type', `${media.media_type}${media.mime_type ? ` · ${media.mime_type}` : ''}`],
            ['Size', `${formatBytes(media.size_bytes)} (${media.size_bytes.toLocaleString()} bytes)`],
            [
              'SHA-256',
              <CopyValue
                key="sum"
                value={media.checksum}
                label="checksum"
                truncate={shortHash(media.checksum, 24, 12)}
              />,
            ],
            ['Source path', <span key="src" className="vy-mono vy-break">{media.original_path}</span>],
            ['Working copy', <span key="copy" className="vy-mono vy-break">{media.working_copy}</span>],
            ['Ingested', formatTimestamp(summary.ingested_at)],
            ...(analysis?.media.duration_seconds != null
              ? ([['Duration', formatDuration(analysis.media.duration_seconds)]] as [string, string][])
              : []),
            ...(analysis?.media.width && analysis?.media.height
              ? ([['Resolution', `${analysis.media.width} × ${analysis.media.height}`]] as [
                  string,
                  string,
                ][])
              : []),
          ]}
        />

        <h3 className="vy-section-title vy-mt-4">Integrity</h3>
        <p className="vy-muted vy-mb-2" style={{ maxWidth: '42rem' }}>
          Recomputes the SHA-256 of the working copy the detectors read and compares it against the
          hash recorded at ingest. Run this before citing the findings.
        </p>
        <div className="vy-row">
          <Button
            kind="tertiary"
            renderIcon={FingerprintRecognition}
            onClick={verify}
            disabled={verifying}
          >
            {verifying ? 'Verifying…' : 'Verify integrity now'}
          </Button>
          <Button
            kind="ghost"
            renderIcon={Download}
            href={mediaFileUrl(detail.media_id, true)}
            as="a"
          >
            Download working copy
          </Button>
        </div>

        {verifyError ? (
          <InlineNotification
            className="vy-mt-2"
            kind="error"
            lowContrast
            hideCloseButton
            title="Verification failed"
            subtitle={verifyError}
          />
        ) : null}

        {check ? (
          <div className="vy-mt-3">
            <InlineNotification
              kind={check.matches && check.size_matches ? 'success' : 'error'}
              lowContrast
              hideCloseButton
              title={
                check.matches && check.size_matches
                  ? 'Working copy is unaltered'
                  : 'Working copy does not match the ingest record'
              }
              subtitle={
                check.matches && check.size_matches
                  ? `Recomputed hash matches the value recorded at ingest. Verified ${formatTimestamp(check.verified_at)}.`
                  : 'The bytes on disk differ from what was admitted. Do not rely on findings derived from this copy.'
              }
            />
            <KeyValue
              rows={[
                ['Expected', <span key="e" className="vy-mono vy-break">{check.expected_checksum}</span>],
                ['Recomputed', <span key="a" className="vy-mono vy-break">{check.actual_checksum}</span>],
                [
                  'Size',
                  check.size_matches
                    ? `${check.working_copy_size.toLocaleString()} bytes — matches`
                    : `${check.working_copy_size.toLocaleString()} bytes on disk vs ${check.recorded_size.toLocaleString()} recorded`,
                ],
                [
                  'Original at source path',
                  check.original_state === 'absent' ? (
                    <span key="o" className="vy-muted">
                      Not present — the source file has moved or been removed since ingest.
                    </span>
                  ) : check.original_matches ? (
                    <Tag key="o" type="green" size="sm">
                      Still matches
                    </Tag>
                  ) : (
                    <Tag key="o" type="red" size="sm">
                      Differs from ingest
                    </Tag>
                  ),
                ],
              ]}
            />
          </div>
        ) : null}
      </Column>

      <Column sm={4} md={8} lg={6}>
        <h3 className="vy-section-title">Media</h3>
        <MediaPreview
          mediaId={detail.media_id}
          mediaType={media.media_type}
          fileName={media.file_name}
        />
        <p className="vy-helper vy-mt-2" style={{ fontSize: '0.75rem' }}>
          Played from the read-only working copy in the workspace, not the source path.
        </p>
      </Column>
    </Grid>
  )
}
