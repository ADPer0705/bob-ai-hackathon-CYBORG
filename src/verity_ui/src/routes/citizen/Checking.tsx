/**
 * Citizen step 2 — the wait.
 *
 * Detector runs take minutes, sometimes much longer. This screen is honest
 * about that rather than showing a spinner and hoping: named stages, what is
 * happening in each, and no fake percentage.
 */

import { useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Column, Grid, InlineNotification, ProgressIndicator, ProgressStep } from '@carbon/react'

import { api } from '@/api/client'
import { useJobStream } from '@/api/hooks'
import { JobSteps } from '@/components/JobConsole'

const STAGE_COPY: Record<string, string> = {
  extract: 'Pulling out the frames, faces and audio the checks need.',
  analyze: 'Measuring the file and finding the faces in it.',
  select: 'Working out which forensic methods can be used on this file.',
  compile: 'Collecting everything the methods reported.',
  report: 'Writing up the record of this examination.',
}

export default function CitizenChecking() {
  const { mediaId = '' } = useParams()
  const [params] = useSearchParams()
  const jobId = params.get('job')
  const navigate = useNavigate()
  const { job, error } = useJobStream(jobId)

  useEffect(() => {
    if (job?.status === 'succeeded') {
      const timer = window.setTimeout(() => navigate(`/citizen/result/${mediaId}`), 700)
      return () => window.clearTimeout(timer)
    }
  }, [job?.status, mediaId, navigate])

  const running = job?.steps.find((step) => step.status === 'running')
  const detectorStep = running?.key.startsWith('detect:')
  const failed = job?.status === 'failed'
  const cancelled = job?.status === 'cancelled'

  return (
    <Grid className="vy-page">
      <Column sm={4} md={8} lg={10}>
        <ProgressIndicator currentIndex={1} spaceEqually className="vy-mb-3">
          <ProgressStep label="Choose a file" complete />
          <ProgressStep label="Examine" secondaryLabel="In progress" />
          <ProgressStep label="Read the result" />
        </ProgressIndicator>

        <h1 style={{ fontSize: '2.25rem', fontWeight: 300, margin: '2rem 0 0.5rem' }}>
          {failed
            ? 'The check could not finish'
            : cancelled
              ? 'The check was stopped'
              : 'Examining your file'}
        </h1>

        <p className="vy-muted" style={{ fontSize: '1.0625rem', lineHeight: 1.6, maxWidth: '40rem' }}>
          {failed || cancelled
            ? 'Nothing has been lost — the file is saved and you can try again.'
            : detectorStep
              ? 'Running the forensic methods. This is the slow part and can take several minutes for video.'
              : running
                ? (STAGE_COPY[running.key] ?? 'Working through the examination.')
                : 'Getting started.'}
        </p>

        <p className="vy-helper vy-mt-2">You can leave this page open — it updates by itself.</p>

        {error ? (
          <InlineNotification
            className="vy-mt-3"
            kind="warning"
            lowContrast
            hideCloseButton
            title="Lost contact with the examination"
            subtitle={error}
          />
        ) : null}

        {job?.error ? (
          <InlineNotification
            className="vy-mt-3"
            kind="error"
            lowContrast
            hideCloseButton
            title="The examination stopped with an error"
            subtitle={job.error}
          />
        ) : null}

        <div className="vy-console vy-mt-4">
          <JobSteps steps={job?.steps ?? []} />
        </div>

        <div className="vy-row vy-mt-4">
          {failed || cancelled ? (
            <>
              <Button onClick={() => navigate('/citizen')}>Try another file</Button>
              <Button kind="tertiary" onClick={() => navigate(`/citizen/result/${mediaId}`)}>
                See what was found anyway
              </Button>
            </>
          ) : (
            <Button
              kind="danger--tertiary"
              disabled={!jobId}
              onClick={() => jobId && api.cancelJob(jobId).catch(() => undefined)}
            >
              Stop the check
            </Button>
          )}
        </div>
      </Column>
    </Grid>
  )
}
