/**
 * Investigator — case list and intake.
 *
 * Every ingested media item is a case, listed with enough state to decide
 * what needs attention: whether it has been analysed, how many detectors ran,
 * whether the panel agreed, and whether a report exists.
 */

import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Column,
  DataTable,
  Grid,
  InlineNotification,
  Modal,
  ProgressBar,
  Search,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  Tag,
} from '@carbon/react'
import { Add, Folders, Renew } from '@carbon/icons-react'

import { ApiError, api } from '@/api/client'
import { usePolling } from '@/api/hooks'
import { EmptyState, ErrorBanner, LoadingBlock } from '@/components/Primitives'
import { formatBytes, formatRelative, shortHash } from '@/lib/format'
import { presentBand } from '@/lib/verdict'

const HEADERS = [
  { key: 'file_name', header: 'File' },
  { key: 'media_type', header: 'Type' },
  { key: 'assessment', header: 'Assessment' },
  { key: 'detectors', header: 'Detectors' },
  { key: 'size', header: 'Size' },
  { key: 'ingested', header: 'Ingested' },
  { key: 'report', header: 'Report' },
]

export default function InvestigatorCases() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = usePolling(() => api.cases(), 8000, true, [])
  const [query, setQuery] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [intakeError, setIntakeError] = useState<string | null>(null)

  const cases = (data?.cases ?? []).filter((item) => {
    if (!query.trim()) return true
    const needle = query.trim().toLowerCase()
    return (
      item.file_name.toLowerCase().includes(needle) ||
      item.media_id.toLowerCase().includes(needle) ||
      item.checksum.toLowerCase().includes(needle)
    )
  })

  const rows = cases.map((item) => {
    const band = presentBand(item.consensus.band)
    return {
      id: item.media_id,
      file_name: item.file_name,
      media_type: item.media_type,
      assessment: band.label,
      assessmentTag: band.tagType,
      detectors: item.findings_count
        ? `${item.findings_count} ran · ${item.detectors_excluded} skipped`
        : item.has_selection
          ? `0 ran · ${item.detectors_excluded} skipped`
          : 'not analysed',
      size: formatBytes(item.size_bytes),
      ingested: formatRelative(item.ingested_at),
      report: item.reports.pdf ? 'PDF' : item.reports.html ? 'HTML' : '—',
      checksum: item.checksum,
    }
  })

  const ingest = async () => {
    if (!file) return
    setBusy(true)
    setIntakeError(null)
    try {
      const uploaded = await api.upload(file, setProgress)
      setIntakeOpen(false)
      setFile(null)
      setBusy(false)
      navigate(`/investigator/case/${uploaded.media_id}`)
    } catch (cause) {
      setIntakeError(cause instanceof ApiError ? cause.message : String(cause))
      setBusy(false)
    }
  }

  return (
    <Grid className="vy-page">
      <Column sm={4} md={8} lg={16}>
        <div className="vy-row vy-row--between vy-mb-3">
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 300, margin: 0 }}>Cases</h1>
            <p className="vy-muted" style={{ margin: '0.5rem 0 0' }}>
              Every media item ingested into this workspace.
            </p>
          </div>
          <div className="vy-row">
            <Button kind="ghost" renderIcon={Renew} onClick={reload}>
              Refresh
            </Button>
            <Button renderIcon={Add} onClick={() => setIntakeOpen(true)}>
              Ingest media
            </Button>
          </div>
        </div>

        <ErrorBanner error={error} onRetry={reload} />

        {loading && !data ? (
          <LoadingBlock lines={6} />
        ) : cases.length === 0 && !query ? (
          <EmptyState
            icon={<Folders size={32} />}
            title="No cases in this workspace yet"
            body="Ingest a photo, video or audio file to create the first case. Verity copies it read-only, fingerprints it with SHA-256, and derives the case id from that hash."
            action={
              <Button renderIcon={Add} onClick={() => setIntakeOpen(true)}>
                Ingest media
              </Button>
            }
          />
        ) : (
          <DataTable rows={rows} headers={HEADERS} isSortable>
            {({ rows: r, headers, getHeaderProps, getRowProps, getTableProps }: any) => (
              <TableContainer
                title={`${cases.length} case${cases.length === 1 ? '' : 's'}`}
                description="Select a case to open the examination record."
              >
                <TableToolbar>
                  <TableToolbarContent>
                    <Search
                      labelText="Search cases"
                      placeholder="Filter by file name, case id or checksum"
                      size="lg"
                      value={query}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        setQuery(event.target.value)
                      }
                    />
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...getTableProps()} size="lg">
                  <TableHead>
                    <TableRow>
                      {headers.map((header: any) => (
                        <TableHeader {...getHeaderProps({ header })} key={header.key}>
                          {header.header}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {r.map((row: any) => {
                      const source = rows.find((item) => item.id === row.id)!
                      return (
                        <TableRow
                          {...getRowProps({ row })}
                          key={row.id}
                          onClick={() => navigate(`/investigator/case/${row.id}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          {row.cells.map((cell: any) => {
                            if (cell.info.header === 'assessment') {
                              return (
                                <TableCell key={cell.id}>
                                  <Tag type={source.assessmentTag} size="sm">
                                    {cell.value}
                                  </Tag>
                                </TableCell>
                              )
                            }
                            if (cell.info.header === 'file_name') {
                              return (
                                <TableCell key={cell.id}>
                                  <div>{cell.value}</div>
                                  <div
                                    className="vy-mono vy-helper"
                                    style={{ fontSize: '0.6875rem' }}
                                  >
                                    {shortHash(source.checksum, 10, 6)}
                                  </div>
                                </TableCell>
                              )
                            }
                            return <TableCell key={cell.id}>{cell.value}</TableCell>
                          })}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
        )}

        {cases.length === 0 && query ? (
          <p className="vy-muted vy-mt-3">No case matches “{query}”.</p>
        ) : null}
      </Column>

      <Modal
        open={intakeOpen}
        modalHeading="Ingest media"
        modalLabel="New case"
        primaryButtonText={busy ? 'Ingesting…' : 'Ingest'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={!file || busy}
        onRequestClose={() => {
          if (busy) return
          setIntakeOpen(false)
          setFile(null)
          setIntakeError(null)
        }}
        onRequestSubmit={ingest}
      >
        <p className="vy-muted vy-mb-3">
          The file is copied into the workspace read-only and hashed with SHA-256. The case id is
          the first 12 characters of that hash, so re-ingesting the same bytes reopens the same
          case rather than duplicating it.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="video/*,image/*,audio/*"
          hidden
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null)
            setIntakeError(null)
          }}
        />
        <Button kind="tertiary" onClick={() => inputRef.current?.click()} disabled={busy}>
          Choose file
        </Button>
        {file ? (
          <p className="vy-mt-2">
            <strong>{file.name}</strong> <span className="vy-muted">· {formatBytes(file.size)}</span>
          </p>
        ) : null}

        {busy ? (
          <div className="vy-mt-3">
            <ProgressBar label="Uploading" value={progress * 100} max={100} />
          </div>
        ) : null}

        {intakeError ? (
          <InlineNotification
            className="vy-mt-3"
            kind="error"
            lowContrast
            hideCloseButton
            title="Ingest failed"
            subtitle={intakeError}
          />
        ) : null}
      </Modal>
    </Grid>
  )
}
