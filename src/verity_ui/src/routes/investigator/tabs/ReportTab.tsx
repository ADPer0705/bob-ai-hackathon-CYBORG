/**
 * Report generation and preview.
 *
 * The HTML report is rendered inline in a sandboxed iframe so an examiner can
 * read exactly what will be exported — the PDF is produced from the same
 * string, so what is previewed is what is filed.
 */

import {
  Button,
  Column,
  Grid,
  InlineNotification,
  Tag,
} from '@carbon/react'
import { Document, DocumentPdf, Launch, Renew } from '@carbon/icons-react'

import { reportUrl } from '@/api/client'
import type { CaseDetail } from '@/api/types'
import { EmptyState, KeyValue } from '@/components/Primitives'
import { formatBytes, formatTimestamp } from '@/lib/format'

export function ReportTab({
  detail,
  canReportPdf,
  pdfBlocker,
  onGenerate,
  busy,
}: {
  detail: CaseDetail
  canReportPdf: boolean
  pdfBlocker?: string
  onGenerate: (format: 'pdf' | 'html') => void
  busy: boolean
}) {
  const { reports } = detail
  const hasAny = Boolean(reports.html || reports.pdf)

  return (
    <Grid condensed className="vy-page--tight">
      <Column sm={4} md={8} lg={16}>
        <div className="vy-row vy-row--between vy-mb-3">
          <div>
            <h3 className="vy-section-title" style={{ marginBlockEnd: '0.25rem' }}>
              Examination report
            </h3>
            <p className="vy-muted" style={{ margin: 0, maxWidth: '46rem' }}>
              Deterministic: the same media and detectors always produce the same report. It states
              findings and their provenance — it does not render a verdict.
            </p>
          </div>
          <div className="vy-row">
            <Button
              kind={hasAny ? 'tertiary' : 'primary'}
              renderIcon={Renew}
              disabled={busy}
              onClick={() => onGenerate('html')}
            >
              {busy ? 'Generating…' : 'Generate HTML'}
            </Button>
            <Button
              renderIcon={DocumentPdf}
              disabled={busy || !canReportPdf}
              onClick={() => onGenerate('pdf')}
            >
              Generate PDF
            </Button>
          </div>
        </div>

        {!canReportPdf ? (
          <InlineNotification
            className="vy-mb-3"
            kind="warning"
            lowContrast
            hideCloseButton
            title="PDF export unavailable"
            subtitle={`${
              pdfBlocker ?? 'WeasyPrint is not available in this environment.'
            } HTML reports work and can be printed to PDF from the browser.`}
          />
        ) : null}

        {detail.findings.length === 0 ? (
          <InlineNotification
            className="vy-mb-3"
            kind="info"
            lowContrast
            hideCloseButton
            title="No findings to report"
            subtitle="A report generated now will contain the media identity and the selection record, but no detector findings."
          />
        ) : null}

        {!hasAny ? (
          <EmptyState
            icon={<Document size={32} />}
            title="No report generated yet"
            body="Generate one to produce the media identity block, the findings summary, the excluded-detector table and one section per finding with its reasoning, key figures and evidence images."
          />
        ) : (
          <>
            <Grid condensed className="vy-mb-3">
              {reports.html ? (
                <Column sm={4} md={4} lg={8}>
                  <KeyValue
                    rows={[
                      ['Format', <Tag key="t" type="blue" size="sm">HTML</Tag>],
                      ['Generated', formatTimestamp(reports.html.generated_at)],
                      ['Size', formatBytes(reports.html.size_bytes)],
                      ['Path', <span key="p" className="vy-mono vy-break">{reports.html.path}</span>],
                    ]}
                  />
                </Column>
              ) : null}
              {reports.pdf ? (
                <Column sm={4} md={4} lg={8}>
                  <KeyValue
                    rows={[
                      ['Format', <Tag key="t" type="magenta" size="sm">PDF</Tag>],
                      ['Generated', formatTimestamp(reports.pdf.generated_at)],
                      ['Size', formatBytes(reports.pdf.size_bytes)],
                      ['Path', <span key="p" className="vy-mono vy-break">{reports.pdf.path}</span>],
                    ]}
                  />
                </Column>
              ) : null}
            </Grid>

            <div className="vy-row vy-mb-3">
              {reports.html ? (
                <>
                  <Button
                    kind="tertiary"
                    size="sm"
                    renderIcon={Launch}
                    href={reportUrl(detail.media_id, 'html')}
                    target="_blank"
                    rel="noreferrer"
                    as="a"
                  >
                    Open HTML in a new tab
                  </Button>
                  <Button
                    kind="ghost"
                    size="sm"
                    href={reportUrl(detail.media_id, 'html', true)}
                    as="a"
                  >
                    Download HTML
                  </Button>
                </>
              ) : null}
              {reports.pdf ? (
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={DocumentPdf}
                  href={reportUrl(detail.media_id, 'pdf', true)}
                  as="a"
                >
                  Download PDF
                </Button>
              ) : null}
            </div>

            {reports.html ? (
              <>
                <h4 className="vy-section-title" style={{ fontSize: '1rem' }}>
                  Preview
                </h4>
                <iframe
                  title="Examination report preview"
                  src={reportUrl(detail.media_id, 'html')}
                  sandbox=""
                  style={{
                    inlineSize: '100%',
                    blockSize: '70vh',
                    border: '1px solid var(--cds-border-subtle-01)',
                    background: '#fff',
                  }}
                />
              </>
            ) : null}
          </>
        )}
      </Column>
    </Grid>
  )
}
