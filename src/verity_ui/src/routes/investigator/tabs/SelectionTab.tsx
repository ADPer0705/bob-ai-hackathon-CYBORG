/**
 * Detector selection — what ran, what did not, and why.
 *
 * This is the tab that makes the examination auditable. The CLI prints the
 * exclusion count; the report hides the reasons behind a disclosure. Here
 * they are the content: an investigator asked "why wasn't X used?" needs to
 * answer from the record, not from memory.
 */

import { useState } from 'react'
import {
  Column,
  ContentSwitcher,
  Grid,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react'
import { Filter } from '@carbon/icons-react'

import type { CaseDetail } from '@/api/types'
import { EmptyState } from '@/components/Primitives'

type Filterish = 'all' | 'included' | 'excluded'

export function SelectionTab({ detail }: { detail: CaseDetail }) {
  const [filter, setFilter] = useState<Filterish>('all')

  if (!detail.selection) {
    return (
      <EmptyState
        icon={<Filter size={32} />}
        title="No detector selection recorded"
        body="Run Analyze or a full examination. The selector evaluates every registered detector against this media and records a reason for each decision."
      />
    )
  }

  const decisions = detail.selection.decisions
  const included = decisions.filter((decision) => decision.included)
  const excluded = decisions.filter((decision) => !decision.included)
  const shown =
    filter === 'included' ? included : filter === 'excluded' ? excluded : decisions

  const ranIds = new Set(detail.findings.map((finding) => finding.detector_id))

  return (
    <Grid condensed className="vy-page--tight">
      <Column sm={4} md={8} lg={16}>
        <div className="vy-row vy-row--between vy-mb-3">
          <div>
            <h3 className="vy-section-title" style={{ marginBlockEnd: '0.25rem' }}>
              Eligibility decisions
            </h3>
            <p className="vy-muted" style={{ margin: 0 }}>
              {included.length} selected · {excluded.length} excluded · evaluated against media
              type, face presence and scale, clip length and weight availability.
            </p>
          </div>
          <ContentSwitcher
            size="sm"
            selectedIndex={filter === 'all' ? 0 : filter === 'included' ? 1 : 2}
            onChange={({ index }) =>
              setFilter(index === 0 ? 'all' : index === 1 ? 'included' : 'excluded')
            }
          >
            <Switch name="all" text={`All (${decisions.length})`} />
            <Switch name="included" text={`Selected (${included.length})`} />
            <Switch name="excluded" text={`Excluded (${excluded.length})`} />
          </ContentSwitcher>
        </div>

        <TableContainer>
          <Table size="lg">
            <TableHead>
              <TableRow>
                <TableHeader>Method</TableHeader>
                <TableHeader>Decision</TableHeader>
                <TableHeader>Reasoning</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map((decision) => (
                <TableRow key={decision.detector_id}>
                  <TableCell>
                    <div>{decision.detector_name}</div>
                    <div className="vy-mono vy-helper" style={{ fontSize: '0.6875rem' }}>
                      {decision.detector_id}
                    </div>
                  </TableCell>
                  <TableCell>
                    {decision.included ? (
                      <Tag type="green" size="sm">
                        {ranIds.has(decision.detector_id) ? 'Ran' : 'Selected — no finding'}
                      </Tag>
                    ) : (
                      <Tag type="gray" size="sm">
                        Excluded
                      </Tag>
                    )}
                  </TableCell>
                  <TableCell>
                    <ul className="vy-reason-list">
                      {decision.reasons.map((reason, index) => (
                        <li key={`${decision.detector_id}-${index}`}>{reason}</li>
                      ))}
                    </ul>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {shown.length === 0 ? (
          <p className="vy-muted vy-mt-3">Nothing in this category.</p>
        ) : null}

        <p className="vy-helper vy-mt-3" style={{ fontSize: '0.75rem', maxWidth: '48rem' }}>
          "Selected — no finding" means the detector was eligible but produced no result: it either
          failed during the run or has not been executed yet. Check the Activity tab for the
          detector's stderr.
        </p>
      </Column>
    </Grid>
  )
}
