/** Small shared building blocks used by both profiles. */

import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  ActionableNotification,
  Button,
  InlineNotification,
  SkeletonPlaceholder,
  SkeletonText,
  Tag,
} from '@carbon/react'
import { Checkmark, Copy } from '@carbon/icons-react'

import { copyToClipboard } from '@/lib/format'

// --------------------------------------------------------------------- //

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="vy-empty">
      {icon ? <div className="vy-empty__icon">{icon}</div> : null}
      <h3 className="vy-empty__title">{title}</h3>
      {body ? <div className="vy-empty__body">{body}</div> : null}
      {action}
    </div>
  )
}

// --------------------------------------------------------------------- //

export function ErrorBanner({
  error,
  title = 'Something went wrong',
  onRetry,
}: {
  error: string | null
  title?: string
  onRetry?: () => void
}) {
  if (!error) return null

  // ActionableNotification is the Carbon component that may contain an
  // interactive control; InlineNotification deliberately may not.
  if (onRetry) {
    return (
      <ActionableNotification
        kind="error"
        lowContrast
        title={title}
        subtitle={error}
        hideCloseButton
        actionButtonLabel="Retry"
        onActionButtonClick={onRetry}
      />
    )
  }

  return <InlineNotification kind="error" lowContrast title={title} subtitle={error} hideCloseButton />
}

// --------------------------------------------------------------------- //

export function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="vy-stack">
      <SkeletonPlaceholder style={{ inlineSize: '100%', blockSize: '3rem' }} />
      <SkeletonText paragraph lineCount={lines} />
    </div>
  )
}

// --------------------------------------------------------------------- //

/** Monospace value with a copy affordance — checksums, ids, paths. */
export function CopyValue({
  value,
  label,
  truncate,
}: {
  value: string
  label?: string
  truncate?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (await copyToClipboard(value)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <span className="vy-row" style={{ gap: '0.375rem' }}>
      <span className="vy-mono vy-break" title={value}>
        {truncate ?? value}
      </span>
      <Button
        kind="ghost"
        size="sm"
        hasIconOnly
        iconDescription={copied ? 'Copied' : `Copy ${label ?? 'value'}`}
        tooltipPosition="top"
        renderIcon={copied ? Checkmark : Copy}
        onClick={handleCopy}
      />
    </span>
  )
}

// --------------------------------------------------------------------- //

/** Horizontal bar for a 0–1 probability, coloured by band. */
export function ProbabilityBar({ value, showValue = true }: { value: number; showValue?: boolean }) {
  const clamped = Math.max(0, Math.min(1, value))
  const band = clamped >= 0.7 ? 'high' : clamped >= 0.3 ? 'mid' : 'low'
  return (
    <span className="vy-prob">
      <span
        className="vy-prob__track"
        role="img"
        aria-label={`Mean fake probability ${clamped.toFixed(4)} of 1`}
      >
        <span
          className={`vy-prob__fill vy-prob__fill--${band}`}
          style={{ inlineSize: `${clamped * 100}%` }}
        />
      </span>
      {showValue ? <span className="vy-prob__value">{clamped.toFixed(4)}</span> : null}
    </span>
  )
}

// --------------------------------------------------------------------- //

export interface Metric {
  label: string
  value: ReactNode
  hint?: ReactNode
}

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="vy-metrics">
      {metrics.map((metric) => (
        <div className="vy-metric" key={metric.label}>
          <div className="vy-metric__label">{metric.label}</div>
          <div className="vy-metric__value">{metric.value}</div>
          {metric.hint ? <div className="vy-metric__hint">{metric.hint}</div> : null}
        </div>
      ))}
    </div>
  )
}

// --------------------------------------------------------------------- //

export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="vy-kv">
      {rows.map(([key, value]) => (
        <div key={key} style={{ display: 'contents' }}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

// --------------------------------------------------------------------- //

export function StatusTag({
  kind,
  children,
}: {
  kind: 'red' | 'green' | 'gray' | 'blue' | 'magenta' | 'purple' | 'teal' | 'warm-gray'
  children: ReactNode
}) {
  return (
    <Tag type={kind} size="md">
      {children}
    </Tag>
  )
}
