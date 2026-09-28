/**
 * Role selection.
 *
 * Deliberately not a login: Verity runs inside a cyber cell, and a fake
 * authentication screen would imply an access boundary the tool does not
 * enforce. What the landing page does instead is set expectations — each
 * tile states plainly what that profile will and will not show you.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Column, Grid, Tag, Theme, Tile } from '@carbon/react'
import {
  ArrowRight,
  Checkmark,
  FingerprintRecognition,
  Microscope,
  UserMultiple,
} from '@carbon/icons-react'

import { api } from '@/api/client'
import { useAsync } from '@/api/hooks'
import { ROLE_HOME, useRole } from '@/state/role'
import type { Role } from '@/state/role'

interface RoleOption {
  role: Role
  icon: typeof UserMultiple
  title: string
  body: string
  points: string[]
  cta: string
}

const OPTIONS: RoleOption[] = [
  {
    role: 'citizen',
    icon: UserMultiple,
    title: 'I want to check a file',
    body:
      'You received a photo, video or voice note and you are not sure it is real. Verity walks you through the check and explains the result in plain language.',
    points: [
      'Guided, three-step check — upload, examine, read the result',
      'Plain-language explanation with no technical jargon',
      'What the result does and does not prove, stated up front',
      'Guidance on preserving the file and reporting it',
    ],
    cta: 'Check a file',
  },
  {
    role: 'investigator',
    icon: Microscope,
    title: 'I am examining evidence',
    body:
      'You need the full examination record: every detector, every exclusion reason, the raw output, the explainability artifacts and an exportable report.',
    points: [
      'Complete case workbench with per-detector drill-down',
      'Detector selection with the reason each one ran or was skipped',
      'Face crops, attention maps, reconstructions and per-face scores',
      'On-demand checksum verification and PDF/HTML report export',
    ],
    cta: 'Open the console',
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const { role, setRole } = useRole()
  const status = useAsync(() => api.system(), [])

  // A returning user should not have to re-answer a question they answered.
  useEffect(() => {
    if (role) navigate(ROLE_HOME[role], { replace: true })
  }, [role, navigate])

  const choose = (next: Role) => {
    setRole(next)
    navigate(ROLE_HOME[next])
  }

  const detectorCount = status.data?.detectors_registered ?? null

  return (
    <Theme theme="g100">
      <div className="vy-landing">
        <Grid className="vy-landing__masthead">
          <Column sm={4} md={8} lg={10}>
            <div className="vy-landing__eyebrow">
              <FingerprintRecognition size={16} />
              Cyber forensics · deepfake examination
            </div>
            <h1 className="vy-landing__title">
              <strong>Verity</strong> examines media,
              <br />
              and shows its working.
            </h1>
            <p className="vy-landing__lede">
              Verity runs a panel of independent forensic detectors over a photo, video or audio
              file and keeps every finding separate — with its method, its confidence and its
              supporting evidence intact. It does not collapse an investigation into a single
              real-or-fake score.
            </p>
          </Column>
        </Grid>

        <Grid>
          <Column sm={4} md={8} lg={16}>
            <div className="vy-landing__rule" />
            <div className="vy-landing__prompt">Who is using Verity right now?</div>
          </Column>
        </Grid>

        <Grid>
          {OPTIONS.map((option) => {
            const Icon = option.icon
            return (
              <Column sm={4} md={4} lg={8} key={option.role} className="vy-mb-3">
                <Tile
                  id={`role-${option.role}`}
                  className="vy-role-tile"
                  onClick={() => choose(option.role)}
                  onKeyDown={(event: React.KeyboardEvent) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      choose(option.role)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={option.cta}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="vy-role-tile__icon">
                    <Icon size={32} />
                  </div>
                  <h2 className="vy-role-tile__title">{option.title}</h2>
                  <p className="vy-role-tile__body">{option.body}</p>
                  <ul className="vy-role-tile__list">
                    {option.points.map((point) => (
                      <li key={point}>
                        <Checkmark size={16} />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="vy-role-tile__cta">
                    <span>{option.cta}</span>
                    <ArrowRight size={20} />
                  </div>
                </Tile>
              </Column>
            )
          })}
        </Grid>

        <Grid>
          <Column sm={4} md={8} lg={12}>
            <div className="vy-landing__footer">
              <div className="vy-row vy-mb-2">
                {detectorCount !== null ? (
                  <Tag type="outline" size="sm">
                    {detectorCount} detector{detectorCount === 1 ? '' : 's'} registered
                  </Tag>
                ) : null}
                {status.data?.environment.hw_profile ? (
                  <Tag type="outline" size="sm">
                    hardware profile: {status.data.environment.hw_profile}
                  </Tag>
                ) : null}
                {status.error ? (
                  <Tag type="red" size="sm">
                    API unreachable
                  </Tag>
                ) : null}
              </div>
              <p style={{ margin: 0, maxWidth: '46rem', lineHeight: 1.5 }}>
                Your profile choice only changes how much detail this interface shows. It is not a
                security control — both profiles reach the same pipeline. You can switch at any
                time from the header.
              </p>
            </div>
          </Column>
        </Grid>
      </div>
    </Theme>
  )
}
