/**
 * Examination launcher — the CLI's `run` flags as a form.
 *
 * Exposes exactly what `verity run` accepts: a detector override (`--detector`),
 * the extractor set, and the report format (`--format`). Leaving the detector
 * list untouched is the CLI's default auto-selection; overriding it is the
 * escape hatch for re-running one method against a known case.
 */

import { useEffect, useState } from 'react'
import {
  Checkbox,
  FormGroup,
  InlineNotification,
  Modal,
  RadioButton,
  RadioButtonGroup,
  Toggle,
} from '@carbon/react'

import { api } from '@/api/client'
import { useAsync } from '@/api/hooks'
import type { DetectorEntry } from '@/api/types'

const EXTRACTORS: { key: string; label: string; hint: string }[] = [
  { key: 'frame', label: 'Frames', hint: 'Sampled video frames' },
  { key: 'face', label: 'Faces', hint: 'Cropped faces — required by most detectors' },
  { key: 'metadata', label: 'Metadata', hint: 'Container and stream metadata' },
  { key: 'audio', label: 'Audio', hint: 'Extracted audio track' },
]

export interface RunConfig {
  detectors: string[] | null
  extractors: string[] | null
  format: 'pdf' | 'html'
  skipReport: boolean
}

export function RunPanel({
  open,
  onClose,
  onSubmit,
  canReportPdf = true,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (config: RunConfig) => void
  canReportPdf?: boolean
}) {
  const catalog = useAsync(() => api.detectors(), [])
  const [override, setOverride] = useState(false)
  const [chosen, setChosen] = useState<string[]>([])
  const [extractors, setExtractors] = useState<string[]>(EXTRACTORS.map((e) => e.key))
  const [format, setFormat] = useState<'pdf' | 'html'>('pdf')
  const [skipReport, setSkipReport] = useState(false)

  useEffect(() => {
    if (!canReportPdf) setFormat('html')
  }, [canReportPdf])

  const detectors: DetectorEntry[] = catalog.data?.detectors ?? []

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

  return (
    <Modal
      open={open}
      modalHeading="Run examination"
      modalLabel="verity run"
      primaryButtonText="Start"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={override && chosen.length === 0}
      onRequestClose={onClose}
      size="md"
      onRequestSubmit={() =>
        onSubmit({
          detectors: override ? chosen : null,
          extractors: extractors.length === EXTRACTORS.length ? null : extractors,
          format,
          skipReport,
        })
      }
    >
      <p className="vy-muted vy-mb-3">
        This runs the full pipeline: extract → characterize → select → detect → compile → report.
        Each stage writes to the workspace as it completes, so a run that is stopped part-way
        leaves everything produced up to that point intact.
      </p>

      <FormGroup legendText="Detector selection">
        <Toggle
          id="detector-override"
          labelText=""
          labelA="Automatic — rule-based selection"
          labelB="Manual override"
          toggled={override}
          onToggle={setOverride}
        />
        {override ? (
          <div className="vy-mt-2">
            {detectors.length === 0 ? (
              <InlineNotification
                kind="warning"
                lowContrast
                hideCloseButton
                title="No detectors registered"
                subtitle={
                  catalog.data?.detectors_dir_present
                    ? 'The detectors directory contains no detector.yaml definitions.'
                    : `Directory not found: ${catalog.data?.detectors_dir ?? 'unknown'}`
                }
              />
            ) : (
              <div style={{ maxBlockSize: '16rem', overflowY: 'auto' }}>
                {detectors.map((detector) => (
                  <Checkbox
                    key={detector.detector_id}
                    id={`det-${detector.detector_id}`}
                    labelText={`${detector.name} (${detector.detector_id})${
                      detector.weights.available ? '' : ' — weights missing'
                    }`}
                    checked={chosen.includes(detector.detector_id)}
                    onChange={() => setChosen((list) => toggle(list, detector.detector_id))}
                  />
                ))}
              </div>
            )}
            <p className="vy-helper vy-mt-2" style={{ fontSize: '0.75rem' }}>
              An override bypasses the eligibility rules. The saved selection still records why
              each detector would or would not have been chosen automatically.
            </p>
          </div>
        ) : (
          <p className="vy-helper vy-mt-1" style={{ fontSize: '0.75rem' }}>
            Detectors are chosen by media type, face presence and scale, clip length and weight
            availability. Every exclusion is recorded with its reason.
          </p>
        )}
      </FormGroup>

      <FormGroup legendText="Artifact extraction" className="vy-mt-3">
        {EXTRACTORS.map((extractor) => (
          <Checkbox
            key={extractor.key}
            id={`ext-${extractor.key}`}
            labelText={`${extractor.label} — ${extractor.hint}`}
            checked={extractors.includes(extractor.key)}
            onChange={() => setExtractors((list) => toggle(list, extractor.key))}
          />
        ))}
      </FormGroup>

      <FormGroup legendText="Report" className="vy-mt-3">
        <Toggle
          id="skip-report"
          labelText=""
          labelA="Generate a report at the end"
          labelB="Skip report generation"
          toggled={skipReport}
          onToggle={setSkipReport}
        />
        {!skipReport ? (
          <div className="vy-mt-2">
            <RadioButtonGroup
              legendText="Format"
              name="report-format"
              valueSelected={format}
              onChange={(value) => setFormat(value as 'pdf' | 'html')}
            >
              <RadioButton
                labelText={canReportPdf ? 'PDF' : 'PDF — WeasyPrint unavailable'}
                value="pdf"
                id="fmt-pdf"
                disabled={!canReportPdf}
              />
              <RadioButton labelText="HTML" value="html" id="fmt-html" />
            </RadioButtonGroup>
          </div>
        ) : null}
      </FormGroup>
    </Modal>
  )
}
