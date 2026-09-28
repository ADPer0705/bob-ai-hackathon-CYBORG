/**
 * Runtime configuration and environment diagnostics.
 *
 * Mirrors `config/pipeline.yaml` and the `VERITY_*` environment variables.
 * Changes apply to this server process only — they are not written back to
 * the config file, because silently rewriting a checked-in pipeline
 * configuration from a browser is not a thing a forensics tool should do.
 */

import { useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  Column,
  FormGroup,
  Grid,
  InlineNotification,
  Tag,
  TextInput,
  Toggle,
} from '@carbon/react'
import { CheckmarkFilled, MisuseOutline, Save } from '@carbon/icons-react'

import { ApiError, api } from '@/api/client'
import { useAsync } from '@/api/hooks'
import { ErrorBanner, KeyValue, LoadingBlock } from '@/components/Primitives'

function Availability({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="vy-row" style={{ gap: '0.375rem' }}>
      {ok ? (
        <CheckmarkFilled size={16} style={{ fill: 'var(--cds-support-success)' }} />
      ) : (
        <MisuseOutline size={16} style={{ fill: 'var(--cds-support-error)' }} />
      )}
      <span>{children}</span>
    </span>
  )
}

export default function Settings() {
  const status = useAsync(() => api.system(), [])

  const [detectorsDir, setDetectorsDir] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [outputDir, setOutputDir] = useState('')
  const [extractors, setExtractors] = useState<string[]>([])
  const [offline, setOffline] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!status.data) return
    const settings = status.data.settings
    setDetectorsDir(settings.detectors_dir)
    setWorkspace(settings.workspace)
    setOutputDir(settings.output_dir)
    setExtractors(settings.extractors)
    setOffline(settings.offline)
  }, [status.data])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await api.updateSettings({
        detectors_dir: detectorsDir,
        workspace,
        output_dir: outputDir,
        extractors,
        offline,
      })
      setSaved(true)
      status.reload()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
  }

  if (status.loading && !status.data) {
    return (
      <Grid className="vy-page">
        <Column sm={4} md={8} lg={12}>
          <LoadingBlock lines={6} />
        </Column>
      </Grid>
    )
  }

  const environment = status.data?.environment
  const readiness = status.data?.readiness

  return (
    <Grid className="vy-page">
      <Column sm={4} md={8} lg={9}>
        <h1 style={{ fontSize: '2rem', fontWeight: 300, margin: '0 0 0.5rem' }}>Settings</h1>
        <p className="vy-muted vy-mb-3" style={{ maxWidth: '44rem' }}>
          Effective configuration for this server process. Relative paths resolve against the
          repository root. Edits here are not written back to{' '}
          <span className="vy-mono">{status.data?.settings.config_path ?? 'config/pipeline.yaml'}</span>{' '}
          — they last until the server restarts.
        </p>

        <ErrorBanner error={status.error ?? error} onRetry={status.reload} />

        {saved ? (
          <InlineNotification
            className="vy-mb-3"
            kind="success"
            lowContrast
            title="Settings applied"
            subtitle="Subsequent operations use these paths."
            onCloseButtonClick={() => setSaved(false)}
          />
        ) : null}

        <div className="vy-stack--lg">
          <FormGroup legendText="Paths">
            <TextInput
              id="detectors-dir"
              labelText="Detectors directory"
              helperText="Contains one directory per detector, each with a detector.yaml. Env: VERITY_DETECTORS_DIR"
              value={detectorsDir}
              onChange={(event) => setDetectorsDir(event.target.value)}
            />
            <TextInput
              className="vy-mt-2"
              id="workspace"
              labelText="Workspace"
              helperText="Holds media/, artifacts/ and output/. Env: VERITY_WORKSPACE"
              value={workspace}
              onChange={(event) => setWorkspace(event.target.value)}
            />
            <TextInput
              className="vy-mt-2"
              id="output-dir"
              labelText="Report output directory"
              helperText="Reports and saved analysis are written to <output>/<case id>/. Env: VERITY_OUTPUT_DIR"
              value={outputDir}
              onChange={(event) => setOutputDir(event.target.value)}
            />
          </FormGroup>

          <FormGroup legendText="Default extractors">
            {(status.data?.available_extractors ?? []).map((key) => (
              <Checkbox
                key={key}
                id={`settings-ext-${key}`}
                labelText={key}
                checked={extractors.includes(key)}
                onChange={() =>
                  setExtractors((list) =>
                    list.includes(key) ? list.filter((item) => item !== key) : [...list, key],
                  )
                }
              />
            ))}
          </FormGroup>

          <FormGroup legendText="Network">
            <Toggle
              id="offline"
              labelText=""
              labelA="Online — detectors may download weights at first run"
              labelB="Offline — only locally present checkpoints are eligible"
              toggled={offline}
              onToggle={setOffline}
            />
            <p className="vy-helper vy-mt-1" style={{ fontSize: '0.75rem' }}>
              Offline mode makes the selector exclude any detector whose weights are not already on
              disk, and records that as the exclusion reason.
            </p>
          </FormGroup>

          <Button renderIcon={Save} onClick={save} disabled={saving}>
            {saving ? 'Applying…' : 'Apply settings'}
          </Button>
        </div>
      </Column>

      <Column sm={4} md={8} lg={7}>
        <h2 className="vy-section-title">Environment</h2>
        {environment ? (
          <KeyValue
            rows={[
              [
                'Detectors',
                <Availability key="d" ok={environment.detector_count > 0}>
                  {environment.detector_count} definition
                  {environment.detector_count === 1 ? '' : 's'} found
                </Availability>,
              ],
              [
                'Detector runtime',
                <Availability key="r" ok={Boolean(environment.detector_runner)}>
                  <span className="vy-mono vy-break">
                    {environment.detector_runner ?? 'not found'}
                  </span>
                </Availability>,
              ],
              [
                'uv',
                <Availability key="u" ok={Boolean(environment.uv)}>
                  {environment.uv ?? 'not on PATH — provisioning unavailable'}
                </Availability>,
              ],
              [
                'ffprobe',
                <Availability key="f" ok={Boolean(environment.ffprobe)}>
                  {environment.ffprobe ?? 'not on PATH — duration, resolution and FPS unavailable'}
                </Availability>,
              ],
              [
                'OpenCV',
                <Availability key="c" ok={environment.opencv}>
                  {environment.opencv ? 'available — face scanning enabled' : 'missing'}
                </Availability>,
              ],
              [
                'WeasyPrint',
                <Availability key="w" ok={environment.weasyprint}>
                  {environment.weasyprint
                    ? 'available — PDF export enabled'
                    : (environment.weasyprint_error ?? 'missing — HTML reports only')}
                </Availability>,
              ],
              ['Hardware profile', <Tag key="h" type="outline" size="sm">{environment.hw_profile}</Tag>],
            ]}
          />
        ) : null}

        {readiness?.blockers.length ? (
          <div className="vy-mt-3 vy-stack">
            {readiness.blockers.map((blocker) => (
              <InlineNotification
                key={`${blocker.capability}-${blocker.message}`}
                kind="warning"
                lowContrast
                hideCloseButton
                title={blocker.capability}
                subtitle={blocker.message}
              />
            ))}
          </div>
        ) : (
          <InlineNotification
            className="vy-mt-3"
            kind="success"
            lowContrast
            hideCloseButton
            title="Fully operational"
            subtitle="Every pipeline capability is available in this environment."
          />
        )}
      </Column>
    </Grid>
  )
}
