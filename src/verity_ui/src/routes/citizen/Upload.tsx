/**
 * Citizen step 1 — choose a file.
 *
 * One decision per screen. The privacy and limitation notes sit *before* the
 * upload control rather than in a footer, because someone about to hand over
 * a distressing file deserves to know what happens to it first.
 */

import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Column,
  Grid,
  InlineNotification,
  ProgressBar,
  ProgressIndicator,
  ProgressStep,
} from '@carbon/react'
import { CloudUpload, Document, Locked } from '@carbon/icons-react'

import { ApiError, api } from '@/api/client'
import { useAsync } from '@/api/hooks'
import { formatBytes } from '@/lib/format'

const ACCEPTED = 'video/*,image/*,audio/*'

export default function CitizenUpload() {
  const navigate = useNavigate()
  const status = useAsync(() => api.system(), [])

  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = useCallback((chosen: File | null) => {
    setFile(chosen)
    setError(null)
    setProgress(0)
  }, [])

  const start = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const uploaded = await api.upload(file, setProgress)
      const format = status.data?.readiness.can_report_pdf ? 'pdf' : 'html'
      const job = await api.run({ media_id: uploaded.media_id, format })
      navigate(`/citizen/checking/${uploaded.media_id}?job=${job.id}`)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : String(cause))
      setBusy(false)
    }
  }

  const cannotDetect = status.data && !status.data.readiness.can_detect

  return (
    <Grid className="vy-page">
      <Column sm={4} md={8} lg={10}>
        <ProgressIndicator currentIndex={0} spaceEqually className="vy-mb-3">
          <ProgressStep label="Choose a file" secondaryLabel="Photo, video or voice note" />
          <ProgressStep label="Examine" secondaryLabel="Automated forensic checks" />
          <ProgressStep label="Read the result" secondaryLabel="Plain-language explanation" />
        </ProgressIndicator>

        <h1 style={{ fontSize: '2.25rem', fontWeight: 300, margin: '2rem 0 1rem' }}>
          Check whether a file has been manipulated
        </h1>
        <p className="vy-muted" style={{ fontSize: '1.0625rem', lineHeight: 1.6, maxWidth: '40rem' }}>
          Upload the photo, video or voice recording you are unsure about. Verity runs a set of
          independent forensic checks and explains what they found — including when they disagree.
        </p>

        <div className="vy-mt-4 vy-stack">
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            title="What happens to your file"
            subtitle="It is copied into this system's local case workspace and fingerprinted so it can be shown to be unaltered. It is not sent to any third-party service. Keep your own original copy — do not delete it."
          />

          {cannotDetect ? (
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title="Examination is not available on this installation"
              subtitle={
                status.data?.readiness.blockers.find((b) => b.capability === 'detection')?.message ??
                'No detectors are installed, so the file can be recorded but not examined.'
              }
            />
          ) : null}

          {status.error ? (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title="Cannot reach the Verity service"
              subtitle={status.error}
            />
          ) : null}
        </div>

        <div
          className={`vy-dropzone vy-mt-4 ${dragging ? 'vy-dropzone--active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            const dropped = event.dataTransfer.files?.[0]
            if (dropped) pick(dropped)
          }}
        >
          <div className="vy-empty__icon">
            <CloudUpload size={32} />
          </div>
          <h2 className="vy-empty__title">Drag a file here</h2>
          <p className="vy-empty__body">
            Video, image or audio. Large video files are fine — they are uploaded in one piece and
            you will see the progress.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            hidden
            onChange={(event) => pick(event.target.files?.[0] ?? null)}
          />
          <Button kind="tertiary" onClick={() => inputRef.current?.click()} disabled={busy}>
            Browse for a file
          </Button>
        </div>

        {file ? (
          <div className="vy-mt-3">
            <div className="vy-row vy-row--between" style={{ padding: '1rem', background: 'var(--cds-layer-01)' }}>
              <span className="vy-row">
                <Document size={20} />
                <span>
                  <strong>{file.name}</strong>
                  <span className="vy-muted"> · {formatBytes(file.size)}</span>
                </span>
              </span>
              {!busy ? (
                <Button kind="ghost" size="sm" onClick={() => pick(null)}>
                  Remove
                </Button>
              ) : null}
            </div>

            {busy ? (
              <div className="vy-mt-3">
                <ProgressBar
                  label="Uploading"
                  helperText={progress < 1 ? `${Math.round(progress * 100)}%` : 'Starting the examination…'}
                  value={progress * 100}
                  max={100}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <InlineNotification
            className="vy-mt-3"
            kind="error"
            lowContrast
            hideCloseButton
            title="Upload failed"
            subtitle={error}
          />
        ) : null}

        <div className="vy-row vy-mt-4">
          <Button
            size="lg"
            renderIcon={Locked}
            disabled={!file || busy}
            onClick={start}
          >
            {busy ? 'Working…' : 'Start the check'}
          </Button>
          <span className="vy-helper" style={{ fontSize: '0.75rem' }}>
            Nothing is uploaded until you press this.
          </span>
        </div>
      </Column>
    </Grid>
  )
}
