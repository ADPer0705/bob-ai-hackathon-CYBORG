/**
 * Evidence image grid with a zoom modal.
 *
 * The report embeds these as base64 at fixed widths; here they are served as
 * files so an investigator can actually inspect them at full resolution —
 * which is the difference between reading a report and verifying one.
 */

import { useState } from 'react'
import { Button, Modal } from '@carbon/react'
import { Download } from '@carbon/icons-react'

import { fileUrl } from '@/api/client'
import type { FileEntry } from '@/api/types'

export interface GalleryImage extends FileEntry {
  caption?: string
  badge?: string
}

export function ImageGallery({
  mediaId,
  images,
  layout = 'faces',
  emptyMessage = 'No images were produced for this section.',
}: {
  mediaId: string
  images: GalleryImage[]
  layout?: 'faces' | 'maps' | 'wide'
  emptyMessage?: string
}) {
  const [active, setActive] = useState<GalleryImage | null>(null)

  if (!images.length) {
    return <p className="vy-muted">{emptyMessage}</p>
  }

  return (
    <>
      <div className={`vy-gallery vy-gallery--${layout}`}>
        {images.map((image) => (
          <button
            type="button"
            key={image.path}
            className="vy-thumb"
            onClick={() => setActive(image)}
            aria-label={`Enlarge ${image.caption ?? image.name}`}
          >
            <img src={fileUrl(mediaId, image.path)} alt={image.caption ?? image.name} loading="lazy" />
            <span className="vy-thumb__caption">
              <span>{image.caption ?? image.name.replace(/\.[^.]+$/, '')}</span>
              {image.badge ? <span>{image.badge}</span> : null}
            </span>
          </button>
        ))}
      </div>

      <Modal
        open={active !== null}
        onRequestClose={() => setActive(null)}
        passiveModal
        size="lg"
        modalHeading={active?.caption ?? active?.name ?? ''}
        modalLabel="Evidence artifact"
      >
        {active ? (
          <div className="vy-lightbox">
            <img src={fileUrl(mediaId, active.path)} alt={active.caption ?? active.name} />
            <div className="vy-row vy-row--between vy-mt-3">
              <span className="vy-mono vy-helper vy-break" style={{ fontSize: '0.75rem' }}>
                {active.path}
              </span>
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Download}
                href={fileUrl(mediaId, active.path)}
                download={active.name}
                as="a"
              >
                Download
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
