/**
 * Job history and live output.
 *
 * Used both as a standalone page (all jobs) and embedded in a case (that
 * case's jobs). Jobs are held in memory by the server, so this is a session
 * record, not an audit log — the durable record is what each stage wrote to
 * the workspace.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Column,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react'
import { Activity as ActivityIcon } from '@carbon/icons-react'

import { api } from '@/api/client'
import { useJobStream, usePolling } from '@/api/hooks'
import { JobConsole } from '@/components/JobConsole'
import { EmptyState, ErrorBanner } from '@/components/Primitives'
import { formatDurationBetween, formatRelative } from '@/lib/format'
import type { Job } from '@/api/types'

const STATUS_TAG: Record<Job['status'], 'blue' | 'green' | 'red' | 'gray' | 'magenta'> = {
  pending: 'gray',
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
  cancelled: 'magenta',
}

export function ActivityPanel({ mediaId }: { mediaId?: string }) {
  const [selected, setSelected] = useState<string | null>(null)
  const { data, error, reload } = usePolling(
    () => api.jobs({ mediaId, limit: 60 }),
    4000,
    true,
    [mediaId],
  )
  const stream = useJobStream(selected)

  const jobs = data?.jobs ?? []

  return (
    <div className="vy-stack--lg">
      <ErrorBanner error={error} onRetry={reload} />

      {jobs.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon size={32} />}
          title={mediaId ? 'No jobs run for this case yet' : 'No jobs in this session'}
          body="Pipeline operations started from this interface appear here with their stages and full output."
        />
      ) : (
        <TableContainer
          title={mediaId ? 'Jobs for this case' : 'Recent jobs'}
          description="Select a job to see its stages and output."
        >
          <Table size="lg">
            <TableHead>
              <TableRow>
                <TableHeader>Operation</TableHeader>
                <TableHeader>Status</TableHeader>
                {mediaId ? null : <TableHeader>Case</TableHeader>}
                <TableHeader>Started</TableHeader>
                <TableHeader>Duration</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job) => (
                <TableRow
                  key={job.id}
                  onClick={() => setSelected(job.id)}
                  style={{
                    cursor: 'pointer',
                    background:
                      selected === job.id ? 'var(--cds-layer-selected-01)' : undefined,
                  }}
                >
                  <TableCell>
                    <div>{job.label}</div>
                    <div className="vy-mono vy-helper" style={{ fontSize: '0.6875rem' }}>
                      {job.kind} · {job.id}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Tag type={STATUS_TAG[job.status]} size="sm">
                      {job.status}
                    </Tag>
                  </TableCell>
                  {mediaId ? null : (
                    <TableCell>
                      {job.media_ids.length ? (
                        <Link to={`/investigator/case/${job.media_ids[0]}`} className="vy-mono">
                          {job.media_ids[0]}
                        </Link>
                      ) : (
                        <span className="vy-muted">—</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>{formatRelative(job.started_at ?? job.created_at)}</TableCell>
                  <TableCell>
                    {formatDurationBetween(job.started_at ?? job.created_at, job.finished_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {selected ? (
        <JobConsole
          job={stream.job}
          logs={stream.logs}
          onCancel={() => api.cancelJob(selected).catch(() => undefined)}
        />
      ) : null}
    </div>
  )
}

export default function ActivityPage() {
  return (
    <Grid className="vy-page">
      <Column sm={4} md={8} lg={16}>
        <h1 style={{ fontSize: '2rem', fontWeight: 300, margin: '0 0 0.5rem' }}>Activity</h1>
        <p className="vy-muted vy-mb-3">
          Pipeline operations started in this server session, with their stages and full output.
        </p>
        <ActivityPanel />
      </Column>
    </Grid>
  )
}
