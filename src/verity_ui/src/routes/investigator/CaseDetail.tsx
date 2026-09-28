/**
 * The case workbench.
 *
 * The action bar exposes every pipeline stage individually — the same
 * granularity the CLI gives (`ingest`, `extract`, `analyze`, `compile`,
 * `report`, `run`) — because re-running one stage against an existing
 * workspace is the normal way to work a case, not an edge case.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Column,
  Grid,
  InlineNotification,
  Modal,
  OverflowMenu,
  OverflowMenuItem,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Tag,
} from '@carbon/react'
import { Play, Renew, TrashCan } from '@carbon/icons-react'

import { ApiError, api } from '@/api/client'
import { useAsync, useJobStream } from '@/api/hooks'
import { JobConsole } from '@/components/JobConsole'
import { ErrorBanner, LoadingBlock } from '@/components/Primitives'
import { formatBytes } from '@/lib/format'
import { presentBand } from '@/lib/verdict'
import { RunPanel } from './RunPanel'
import type { RunConfig } from './RunPanel'
import { ActivityPanel } from './Activity'
import { AnalysisTab } from './tabs/AnalysisTab'
import { EvidenceTab } from './tabs/EvidenceTab'
import { FindingsTab } from './tabs/FindingsTab'
import { OverviewTab } from './tabs/OverviewTab'
import { ReportTab } from './tabs/ReportTab'
import { SelectionTab } from './tabs/SelectionTab'

export default function CaseDetail() {
  const { mediaId = '' } = useParams()
  const navigate = useNavigate()

  const detail = useAsync(() => api.case(mediaId), [mediaId])
  const system = useAsync(() => api.system(), [])

  const [jobId, setJobId] = useState<string | null>(null)
  const [runOpen, setRunOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const stream = useJobStream(jobId)
  const { reload } = detail

  // A finished job changes what is on disk; re-read the case once.
  useEffect(() => {
    if (stream.finished) reload()
  }, [stream.finished, reload])

  const launch = useCallback(
    async (start: () => Promise<{ id: string }>) => {
      setBusy(true)
      setActionError(null)
      try {
        const job = await start()
        setJobId(job.id)
      } catch (cause) {
        setActionError(cause instanceof ApiError ? cause.message : String(cause))
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const runExamination = (config: RunConfig) => {
    setRunOpen(false)
    void launch(() =>
      api.run({
        media_id: mediaId,
        detectors: config.detectors,
        extractors: config.extractors,
        format: config.format,
        skip_report: config.skipReport,
      }),
    )
  }

  const remove = async () => {
    try {
      await api.deleteCase(mediaId)
      navigate('/investigator')
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : String(cause))
      setDeleteOpen(false)
    }
  }

  if (detail.loading && !detail.data) {
    return (
      <Grid className="vy-page">
        <Column sm={4} md={8} lg={16}>
          <LoadingBlock lines={8} />
        </Column>
      </Grid>
    )
  }

  if (detail.error || !detail.data) {
    return (
      <Grid className="vy-page">
        <Column sm={4} md={8} lg={10}>
          <ErrorBanner error={detail.error ?? 'Case not found.'} onRetry={detail.reload} />
          <Button className="vy-mt-3" as={Link} to="/investigator">
            Back to cases
          </Button>
        </Column>
      </Grid>
    )
  }

  const data = detail.data
  const band = presentBand(data.consensus.band)
  const readiness = system.data?.readiness
  const canReportPdf = readiness?.can_report_pdf ?? true
  const pdfBlocker = readiness?.blockers.find((b) => b.capability === 'report-pdf')?.message
  const active = jobId !== null && !stream.finished

  return (
    <>
      <div className="vy-sticky-actions">
        <Grid>
          <Column sm={4} md={8} lg={16}>
            <Breadcrumb noTrailingSlash className="vy-mb-2">
              <BreadcrumbItem>
                <Link to="/investigator">Cases</Link>
              </BreadcrumbItem>
              <BreadcrumbItem isCurrentPage>{data.media.file_name}</BreadcrumbItem>
            </Breadcrumb>

            <div className="vy-row vy-row--between">
              <div className="vy-row">
                <h1 style={{ fontSize: '1.5rem', fontWeight: 400, margin: 0 }}>
                  {data.media.file_name}
                </h1>
                <Tag type={band.tagType} size="sm">
                  {band.label}
                </Tag>
                <span className="vy-helper" style={{ fontSize: '0.75rem' }}>
                  {data.media.media_type} · {formatBytes(data.media.size_bytes)} ·{' '}
                  <span className="vy-mono">{data.media_id}</span>
                </span>
              </div>

              <div className="vy-row">
                <Button kind="ghost" size="sm" renderIcon={Renew} onClick={detail.reload}>
                  Refresh
                </Button>
                <Button
                  size="sm"
                  renderIcon={Play}
                  disabled={busy || active}
                  onClick={() => setRunOpen(true)}
                >
                  Run examination
                </Button>
                <OverflowMenu aria-label="More pipeline actions" size="sm" flipped>
                  <OverflowMenuItem
                    itemText="Extract artifacts"
                    disabled={busy || active}
                    onClick={() => void launch(() => api.extract(mediaId))}
                  />
                  <OverflowMenuItem
                    itemText="Analyze and select detectors"
                    disabled={busy || active}
                    onClick={() => void launch(() => api.analyze(mediaId))}
                  />
                  <OverflowMenuItem
                    itemText="Compile findings"
                    disabled={busy || active}
                    onClick={() => void launch(() => api.compileFindings(mediaId))}
                  />
                  <OverflowMenuItem
                    itemText="Generate HTML report"
                    disabled={busy || active}
                    onClick={() => void launch(() => api.report(mediaId, 'html'))}
                  />
                  <OverflowMenuItem
                    itemText="Generate PDF report"
                    disabled={busy || active || !canReportPdf}
                    onClick={() => void launch(() => api.report(mediaId, 'pdf'))}
                  />
                  <OverflowMenuItem
                    hasDivider
                    isDelete
                    itemText="Delete case"
                    disabled={active}
                    onClick={() => setDeleteOpen(true)}
                  />
                </OverflowMenu>
              </div>
            </div>
          </Column>
        </Grid>
      </div>

      <Grid className="vy-page--tight">
        <Column sm={4} md={8} lg={16}>
          {actionError ? (
            <InlineNotification
              className="vy-mb-2"
              kind="error"
              lowContrast
              onCloseButtonClick={() => setActionError(null)}
              title="Could not start"
              subtitle={actionError}
            />
          ) : null}

          {jobId ? (
            <div className="vy-mb-3">
              <JobConsole
                job={stream.job}
                logs={stream.logs}
                onCancel={() => jobId && api.cancelJob(jobId).catch(() => undefined)}
              />
            </div>
          ) : null}
        </Column>
      </Grid>

      <Tabs>
        <Grid>
          <Column sm={4} md={8} lg={16}>
            <TabList aria-label="Case sections" contained>
              <Tab>Overview</Tab>
              <Tab>Analysis</Tab>
              <Tab>Selection ({data.selection?.decisions.length ?? 0})</Tab>
              <Tab>Findings ({data.findings.length})</Tab>
              <Tab>Evidence</Tab>
              <Tab>Report</Tab>
              <Tab>Activity</Tab>
            </TabList>
          </Column>
        </Grid>
        <TabPanels>
          <TabPanel>
            <OverviewTab detail={data} />
          </TabPanel>
          <TabPanel>
            <AnalysisTab detail={data} />
          </TabPanel>
          <TabPanel>
            <SelectionTab detail={data} />
          </TabPanel>
          <TabPanel>
            <FindingsTab detail={data} />
          </TabPanel>
          <TabPanel>
            <EvidenceTab detail={data} />
          </TabPanel>
          <TabPanel>
            <ReportTab
              detail={data}
              canReportPdf={canReportPdf}
              pdfBlocker={pdfBlocker}
              busy={busy || active}
              onGenerate={(format) => void launch(() => api.report(mediaId, format))}
            />
          </TabPanel>
          <TabPanel>
            <Grid condensed className="vy-page--tight">
              <Column sm={4} md={8} lg={16}>
                <ActivityPanel mediaId={mediaId} />
              </Column>
            </Grid>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <RunPanel
        open={runOpen}
        onClose={() => setRunOpen(false)}
        onSubmit={runExamination}
        canReportPdf={canReportPdf}
      />

      <Modal
        open={deleteOpen}
        danger
        modalHeading={`Delete case ${data.media.file_name}?`}
        modalLabel="Irreversible"
        primaryButtonText="Delete everything"
        secondaryButtonText="Cancel"
        onRequestClose={() => setDeleteOpen(false)}
        onRequestSubmit={remove}
      >
        <p>
          This removes the read-only working copy, its ingest record, every extracted artifact,
          all detector outputs and findings, and any generated report. It cannot be undone.
        </p>
        <p className="vy-mt-2">
          <TrashCan size={16} style={{ verticalAlign: 'text-bottom' }} /> The original file at{' '}
          <span className="vy-mono vy-break">{data.media.original_path}</span> is not touched.
        </p>
      </Modal>
    </>
  )
}
