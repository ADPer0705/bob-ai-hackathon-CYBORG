/**
 * The shared result surface.
 *
 * Both profiles render the same consensus object; the `audience` prop only
 * changes vocabulary and how much detail is shown. Crucially, the agreement
 * bar is always present — it is the honest representation of a panel of
 * detectors, and hiding it from the citizen view would reduce Verity to the
 * single score it was built to avoid.
 */

import { Tag, Tooltip } from '@carbon/react'
import { Information } from '@carbon/icons-react'

import type { Consensus } from '@/api/types'
import { presentBand, reliability } from '@/lib/verdict'

export function AgreementBar({ consensus }: { consensus: Consensus }) {
  const { fake, real, uncertain, total } = consensus
  if (total === 0) return null

  const segments = [
    { key: 'fake', count: fake, label: 'Signs of manipulation' },
    { key: 'real', count: real, label: 'No signs of manipulation' },
    { key: 'uncertain', count: uncertain, label: 'Undecided' },
  ].filter((segment) => segment.count > 0)

  return (
    <div>
      <div
        className="vy-agreement"
        role="img"
        aria-label={`${fake} of ${total} methods reported manipulation, ${real} reported no manipulation, ${uncertain} were undecided.`}
      >
        {segments.map((segment) => (
          <span
            key={segment.key}
            className={`vy-agreement__segment vy-agreement__segment--${segment.key}`}
            style={{ flexGrow: segment.count }}
          />
        ))}
      </div>
      <div className="vy-agreement__legend">
        {segments.map((segment) => (
          <span className="vy-agreement__key" key={segment.key}>
            <span className={`vy-agreement__swatch vy-agreement__segment--${segment.key}`} />
            {segment.count} × {segment.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ConsensusVerdict({
  consensus,
  audience,
}: {
  consensus: Consensus
  audience: 'citizen' | 'investigator'
}) {
  const presentation = presentBand(consensus.band)
  const trust = reliability(consensus)

  return (
    <section className={`vy-verdict vy-verdict--${presentation.tone}`}>
      <div className="vy-row">
        <Tag type={presentation.tagType} size="md">
          {presentation.label}
        </Tag>
        {consensus.total > 0 ? (
          <Tag type="outline" size="md">
            {trust.label}
          </Tag>
        ) : null}
        {consensus.disagreement ? (
          <Tooltip align="bottom" label={trust.explanation}>
            <button type="button" className="cds--toolbar-action" aria-label="Why methods disagree">
              <Information size={16} />
            </button>
          </Tooltip>
        ) : null}
      </div>

      <h2 className="vy-verdict__headline">
        {audience === 'citizen' ? presentation.citizenHeadline : presentation.label}
      </h2>

      <p className="vy-verdict__body">
        {audience === 'citizen' ? presentation.citizenBody : presentation.investigatorSummary}
      </p>

      {consensus.total > 0 ? (
        <div className="vy-mt-4">
          <AgreementBar consensus={consensus} />
        </div>
      ) : null}

      {audience === 'investigator' && consensus.total > 0 ? (
        <p className="vy-helper vy-mt-3" style={{ fontSize: '0.75rem', margin: '1.5rem 0 0' }}>
          Mean fake probability across detectors{' '}
          <span className="vy-mono">{consensus.mean_fake_probability?.toFixed(4) ?? '—'}</span>{' '}
          · agreement <span className="vy-mono">{Math.round(consensus.agreement * 100)}%</span>.
          This aggregate is presented for orientation only; the per-detector findings below are
          the record.
        </p>
      ) : null}
    </section>
  )
}
