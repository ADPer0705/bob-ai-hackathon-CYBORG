/**
 * Media characterization — what the selector's decisions were based on.
 *
 * The per-frame face histogram is the part worth reading closely: it shows
 * exactly which sampled frames contained faces, which is what determines
 * whether a face-based detector had anything to work with.
 */

import { Column, Grid, CodeSnippet } from '@carbon/react'
import { ChartHistogram } from '@carbon/icons-react'

import type { CaseDetail } from '@/api/types'
import { EmptyState, KeyValue } from '@/components/Primitives'
import { formatDuration } from '@/lib/format'

function FaceHistogram({
  frames,
}: {
  frames: { frame: number; face_count: number; max_face_size: number }[]
}) {
  if (!frames.length) {
    return (
      <p className="vy-muted">
        No sampled frame contained a detectable face. Face-based detectors are excluded on that
        basis — see the Selection tab.
      </p>
    )
  }

  const peak = Math.max(...frames.map((frame) => frame.face_count))

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '2px',
          blockSize: '8rem',
          padding: '0.5rem',
          background: 'var(--cds-layer-01)',
          border: '1px solid var(--cds-border-subtle-01)',
          overflowX: 'auto',
        }}
        role="img"
        aria-label={`Face counts across ${frames.length} sampled frames, peaking at ${peak}.`}
      >
        {frames.map((frame) => (
          <div
            key={frame.frame}
            title={`Frame ${frame.frame}: ${frame.face_count} face(s), largest ${frame.max_face_size}px`}
            style={{
              flex: '1 0 6px',
              minInlineSize: '6px',
              blockSize: `${Math.max(4, (frame.face_count / peak) * 100)}%`,
              background: 'var(--cds-support-info)',
            }}
          />
        ))}
      </div>
      <p className="vy-helper vy-mt-2" style={{ fontSize: '0.75rem' }}>
        {frames.length} sampled frame{frames.length === 1 ? '' : 's'} contained faces · peak{' '}
        {peak} face{peak === 1 ? '' : 's'} in a single frame. Hover a bar for the frame index and
        largest face size.
      </p>
    </div>
  )
}

export function AnalysisTab({ detail }: { detail: CaseDetail }) {
  const { analysis } = detail

  if (!analysis) {
    return (
      <EmptyState
        icon={<ChartHistogram size={32} />}
        title="This media has not been characterized yet"
        body="Run Analyze (or a full examination) to measure the file with ffprobe and scan sampled frames for faces. Detector eligibility is decided from these values."
      />
    )
  }

  const media = analysis.media

  return (
    <Grid condensed className="vy-page--tight">
      <Column sm={4} md={8} lg={8}>
        <h3 className="vy-section-title">Characteristics</h3>
        <KeyValue
          rows={[
            ['Media type', media.media_type],
            ['Container format', media.format || '—'],
            ['Duration', formatDuration(media.duration_seconds)],
            ['Resolution', media.width && media.height ? `${media.width} × ${media.height}` : '—'],
            ['Frame rate', media.fps ? `${media.fps} fps` : '—'],
            ['Frame count', media.frame_count?.toLocaleString() ?? '—'],
            ['Video codec', media.video_codec || '—'],
            ['Audio track', media.has_audio_track ? media.audio_codec || 'present' : 'none'],
            ['Faces present', media.face_present ? 'yes' : 'no'],
            ['Total faces', media.face_count.toLocaleString()],
            ['Sampled frames', media.sampled_frames.toLocaleString()],
            [
              'Largest face',
              media.max_face_size ? `${media.max_face_size} px` : '—',
            ],
          ]}
        />
        <p className="vy-helper vy-mt-2" style={{ fontSize: '0.75rem' }}>
          Blank video fields mean ffprobe was unavailable or could not read the container. Face
          figures come from OpenCV's Haar cascade over evenly sampled frames and are deterministic
          for the same file.
        </p>
      </Column>

      <Column sm={4} md={8} lg={8}>
        <h3 className="vy-section-title">Faces per sampled frame</h3>
        <FaceHistogram frames={analysis.faces_per_frame} />

        <h3 className="vy-section-title vy-mt-4">Raw analysis</h3>
        <CodeSnippet type="multi" feedback="Copied" minCollapsedNumberOfRows={8}>
          {JSON.stringify(analysis, null, 2)}
        </CodeSnippet>
      </Column>
    </Grid>
  )
}
