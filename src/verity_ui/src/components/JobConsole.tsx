/**
 * Live job progress.
 *
 * Two levels of detail from one stream: `variant="steps"` shows only the
 * named stages (what the citizen journey needs), `variant="full"` adds the
 * raw log the investigator has to be able to quote.
 */

import { useEffect, useRef } from 'react'
import {
  Button,
  InlineLoading,
  ProgressIndicator,
  ProgressStep,
  Tag,
} from '@carbon/react'

import type { Job, JobLogLine, JobStep } from '@/api/types'
import { formatDurationBetween } from '@/lib/format'

const STATUS_TAG: Record<Job['status'], 'blue' | 'green' | 'red' | 'gray' | 'magenta'> = {
  pending: 'gray',
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
  cancelled: 'magenta',
}

/** Carbon's ProgressIndicator is index-based, so derive the cursor from steps. */
function currentIndex(steps: JobStep[]): number {
  const running = steps.findIndex((step) => step.status === 'running')
  if (running >= 0) return running
  const pending = steps.findIndex((step) => step.status === 'pending')
  return pending >= 0 ? pending : Math.max(0, steps.length - 1)
}

function stepState(step: JobStep): {
  complete: boolean
  invalid: boolean
  disabled: boolean
} {
  return {
    complete: step.status === 'succeeded',
    invalid: step.status === 'failed',
    disabled: step.status === 'skipped',
  }
}

export function JobSteps({ steps }: { steps: JobStep[] }) {
  if (!steps.length) return null
  return (
    <div className="vy-steps">
      <ProgressIndicator vertical currentIndex={currentIndex(steps)} spaceEqually>
        {steps.map((step) => {
          const state = stepState(step)
          return (
            <ProgressStep
              key={step.key}
              label={step.label}
              secondaryLabel={step.detail || undefined}
              complete={state.complete}
              invalid={state.invalid}
              disabled={state.disabled}
            />
          )
        })}
      </ProgressIndicator>
    </div>
  )
}

export function JobLog({ logs }: { logs: JobLogLine[] }) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [logs.length])

  if (!logs.length) {
    return (
      <div className="vy-console__log vy-muted">Waiting for the first output from the pipeline…</div>
    )
  }

  return (
    <div className="vy-console__log" role="log" aria-live="polite">
      {logs.map((line) => (
        <div key={line.seq} className={`vy-console__line vy-console__line--${line.level}`}>
          <span className="vy-console__ts">{new Date(line.ts).toLocaleTimeString()}</span>
          {line.message}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}

export function JobConsole({
  job,
  logs,
  variant = 'full',
  onCancel,
}: {
  job: Job | null
  logs: JobLogLine[]
  variant?: 'steps' | 'full'
  onCancel?: () => void
}) {
  if (!job) {
    return (
      <div className="vy-console">
        <div className="vy-steps">
          <InlineLoading description="Starting…" />
        </div>
      </div>
    )
  }

  const active = job.status === 'running' || job.status === 'pending'

  return (
    <div className="vy-console">
      <div className="vy-row vy-row--between" style={{ padding: '1rem 1.25rem 0' }}>
        <div className="vy-row">
          <Tag type={STATUS_TAG[job.status]} size="md">
            {job.status}
          </Tag>
          <span className="vy-muted" style={{ fontSize: '0.875rem' }}>
            {job.label}
          </span>
        </div>
        <div className="vy-row">
          <span className="vy-helper" style={{ fontSize: '0.75rem' }}>
            {formatDurationBetween(job.started_at ?? job.created_at, job.finished_at)}
          </span>
          {active && onCancel ? (
            <Button kind="danger--ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <JobSteps steps={job.steps} />

      {job.error ? (
        <div className="vy-console__log vy-console__line--error">{job.error}</div>
      ) : null}

      {variant === 'full' ? <JobLog logs={logs} /> : null}
    </div>
  )
}
