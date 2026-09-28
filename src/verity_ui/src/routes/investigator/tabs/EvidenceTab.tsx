/**
 * Extracted artifacts — the intermediate evidence the detectors consumed.
 *
 * Detectors are only as good as what they were fed. Being able to look at the
 * actual face crops and sampled frames is how an examiner distinguishes "the
 * model was wrong" from "the model was shown the wrong thing".
 */

import { Accordion, AccordionItem, Column, Grid, Tag } from '@carbon/react'
import { Layers } from '@carbon/icons-react'

import { fileUrl } from '@/api/client'
import type { ArtifactGroup, CaseDetail } from '@/api/types'
import { ImageGallery } from '@/components/ImageGallery'
import { EmptyState } from '@/components/Primitives'
import { formatBytes, titleCase } from '@/lib/format'

const IMAGE_SUFFIXES = new Set(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'])

function GroupPanel({ mediaId, group }: { mediaId: string; group: ArtifactGroup }) {
  const images = group.files.filter((file) => IMAGE_SUFFIXES.has(file.suffix))
  const others = group.files.filter((file) => !IMAGE_SUFFIXES.has(file.suffix))

  return (
    <div className="vy-stack--lg">
      {images.length ? (
        <ImageGallery
          mediaId={mediaId}
          images={images.map((file) => ({ ...file, caption: file.name.replace(/\.[^.]+$/, '') }))}
          layout={group.group.includes('face') ? 'faces' : 'maps'}
        />
      ) : null}

      {others.length ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {others.map((file) => (
            <li
              key={file.path}
              className="vy-row vy-row--between"
              style={{
                padding: '0.5rem 0.75rem',
                borderBottom: '1px solid var(--cds-border-subtle-01)',
              }}
            >
              <a
                href={fileUrl(mediaId, file.path)}
                target="_blank"
                rel="noreferrer"
                className="vy-mono"
                style={{ fontSize: '0.8125rem' }}
              >
                {file.name}
              </a>
              <span className="vy-helper" style={{ fontSize: '0.75rem' }}>
                {formatBytes(file.size_bytes)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function EvidenceTab({ detail }: { detail: CaseDetail }) {
  if (!detail.artifacts.length) {
    return (
      <EmptyState
        icon={<Layers size={32} />}
        title="No artifacts extracted yet"
        body="Run Extract (or a full examination) to produce sampled frames, face crops, container metadata and the audio track under workspace/artifacts/."
      />
    )
  }

  const total = detail.artifacts.reduce((sum, group) => sum + group.count, 0)

  return (
    <Grid condensed className="vy-page--tight">
      <Column sm={4} md={8} lg={16}>
        <div className="vy-row vy-row--between vy-mb-3">
          <div>
            <h3 className="vy-section-title" style={{ marginBlockEnd: '0.25rem' }}>
              Extracted artifacts
            </h3>
            <p className="vy-muted" style={{ margin: 0 }}>
              {total.toLocaleString()} file{total === 1 ? '' : 's'} across{' '}
              {detail.artifacts.length} group{detail.artifacts.length === 1 ? '' : 's'}.
            </p>
          </div>
        </div>

        <Accordion>
          {detail.artifacts.map((group) => (
            <AccordionItem
              key={group.group}
              title={
                <span className="vy-row" style={{ gap: '0.75rem' }}>
                  <strong>{group.group === '.' ? 'Root' : titleCase(group.group)}</strong>
                  <Tag type="outline" size="sm">
                    {group.count}
                  </Tag>
                </span>
              }
            >
              <GroupPanel mediaId={detail.media_id} group={group} />
            </AccordionItem>
          ))}
        </Accordion>
      </Column>
    </Grid>
  )
}
