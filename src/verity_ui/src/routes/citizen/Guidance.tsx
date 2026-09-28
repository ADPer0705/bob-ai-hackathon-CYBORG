/**
 * Citizen — preserving and reporting.
 *
 * The README commits to a "victim-facing reporting guide". This is procedural
 * guidance only: what to keep, what not to do, and where to report. It
 * deliberately does not name offences or cite provisions — that mapping is
 * the investigator's and the legal reviewer's call, and a wrong citation on a
 * public-facing screen would be worse than none.
 */

import { Link, useParams } from 'react-router-dom'
import {
  Button,
  Column,
  Grid,
  InlineNotification,
  ListItem,
  OrderedList,
  Tile,
  UnorderedList,
} from '@carbon/react'
import { ArrowLeft, Download, Phone, Launch } from '@carbon/icons-react'

import { api, mediaFileUrl, reportUrl } from '@/api/client'
import { useAsync } from '@/api/hooks'
import { CopyValue } from '@/components/Primitives'
import { shortHash } from '@/lib/format'

export default function CitizenGuidance() {
  const { mediaId = '' } = useParams()
  const { data } = useAsync(() => (mediaId ? api.case(mediaId) : Promise.resolve(null)), [mediaId])

  return (
    <Grid className="vy-page">
      <Column sm={4} md={8} lg={10}>
        {mediaId ? (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={ArrowLeft}
            as={Link}
            to={`/citizen/result/${mediaId}`}
            className="vy-mb-2"
          >
            Back to the result
          </Button>
        ) : null}

        <h1 style={{ fontSize: '2.25rem', fontWeight: 300, margin: '0.5rem 0 1rem' }}>
          Preserving and reporting this file
        </h1>
        <p className="vy-muted" style={{ fontSize: '1.0625rem', lineHeight: 1.6, maxWidth: '42rem' }}>
          If this file is being used to harass, impersonate, extort or defraud, what you do in the
          next few hours matters. Evidence is lost easily and it is rarely recoverable.
        </p>

        <InlineNotification
          className="vy-mt-3"
          kind="info"
          lowContrast
          hideCloseButton
          title="This is procedural guidance, not legal advice"
          subtitle="Which offences apply to your situation is a decision for the investigating officer and a legal professional, based on the full facts."
        />

        {/* ---------------- do now ---------------- */}

        <h2 className="vy-section-title vy-mt-4">Do these first</h2>
        <OrderedList>
          <ListItem>
            <strong>Keep the original.</strong> Do not delete, crop, re-save, re-upload or forward
            it to more people. Every re-share strips information an examiner needs.
          </ListItem>
          <ListItem>
            <strong>Capture where it came from.</strong> Screenshot the message, post or email
            showing the sender's name or handle, the account profile, and the date and time — with
            the surrounding conversation visible.
          </ListItem>
          <ListItem>
            <strong>Write down the timeline.</strong> When you first saw it, who sent it, what they
            demanded, and every contact since. Do this while it is fresh.
          </ListItem>
          <ListItem>
            <strong>Do not pay and do not negotiate</strong> if money or more images are being
            demanded. Payment does not end the demands.
          </ListItem>
          <ListItem>
            <strong>Report it.</strong> Use the channels below. Bring the original file, your
            screenshots and your timeline.
          </ListItem>
        </OrderedList>

        {/* ---------------- avoid ---------------- */}

        <h2 className="vy-section-title vy-mt-4">Avoid these</h2>
        <UnorderedList>
          <ListItem>
            Editing the file to "prove" it is fake — this destroys the very traces an examination
            relies on.
          </ListItem>
          <ListItem>
            Confronting the sender before you have reported it, which often prompts them to delete
            accounts and evidence.
          </ListItem>
          <ListItem>
            Relying on the automated result alone. It is a signal for an investigator, not a
            finding a platform or court will act on by itself.
          </ListItem>
        </UnorderedList>

        {/* ---------------- where ---------------- */}

        <h2 className="vy-section-title vy-mt-4">Where to report, in India</h2>
        <Grid condensed>
          <Column sm={4} md={4} lg={5}>
            <Tile style={{ blockSize: '100%' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 400, marginBlockStart: 0 }}>
                National Cyber Crime Reporting Portal
              </h3>
              <p className="vy-muted vy-mb-2">
                The official channel for cybercrime complaints, including a dedicated route for
                crimes against women and children that allows anonymous reporting.
              </p>
              <Button
                kind="tertiary"
                size="sm"
                renderIcon={Launch}
                href="https://cybercrime.gov.in"
                target="_blank"
                rel="noreferrer noopener"
                as="a"
              >
                cybercrime.gov.in
              </Button>
            </Tile>
          </Column>
          <Column sm={4} md={4} lg={5}>
            <Tile style={{ blockSize: '100%' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 400, marginBlockStart: 0 }}>
                Cyber crime helpline — 1930
              </h3>
              <p className="vy-muted vy-mb-2">
                For financial fraud, call as soon as possible. The first hours are what decide
                whether a transfer can still be stopped.
              </p>
              <Button kind="tertiary" size="sm" renderIcon={Phone} href="tel:1930" as="a">
                Call 1930
              </Button>
            </Tile>
          </Column>
        </Grid>
        <p className="vy-helper vy-mt-2">
          You can also go to your nearest police station or cyber cell in person. They cannot refuse
          to record a complaint on the grounds that the offence happened online.
        </p>

        {/* ---------------- what to bring ---------------- */}

        {data ? (
          <>
            <h2 className="vy-section-title vy-mt-4">What to take with you</h2>
            <p className="vy-muted vy-mb-2" style={{ maxWidth: '42rem' }}>
              Verity fingerprinted your file when it was recorded. Quoting that fingerprint lets an
              examiner confirm the copy you hand over is the same one that was examined here.
            </p>
            <Tile>
              <div className="vy-stack">
                <div>
                  <div className="vy-metric__label">File</div>
                  <div>{data.media.file_name}</div>
                </div>
                <div>
                  <div className="vy-metric__label">Reference (case id)</div>
                  <CopyValue value={data.media_id} label="case id" />
                </div>
                <div>
                  <div className="vy-metric__label">SHA-256 fingerprint</div>
                  <CopyValue
                    value={data.media.checksum}
                    label="checksum"
                    truncate={shortHash(data.media.checksum, 16, 12)}
                  />
                </div>
              </div>
              <div className="vy-row vy-mt-3">
                {data.reports.pdf ? (
                  <Button
                    size="sm"
                    renderIcon={Download}
                    href={reportUrl(mediaId, 'pdf', true)}
                    as="a"
                  >
                    Download the examination report
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  kind="tertiary"
                  renderIcon={Download}
                  href={mediaFileUrl(mediaId, true)}
                  as="a"
                >
                  Download the recorded copy
                </Button>
              </div>
            </Tile>
          </>
        ) : null}

        <div className="vy-row vy-mt-4">
          <Button kind="ghost" as={Link} to="/citizen">
            Check another file
          </Button>
        </div>
      </Column>
    </Grid>
  )
}
