/** Inline playback of the ingested working copy. */

import { mediaFileUrl } from '@/api/client'
import type { MediaType } from '@/api/types'

export function MediaPreview({
  mediaId,
  mediaType,
  fileName,
}: {
  mediaId: string
  mediaType: MediaType
  fileName?: string
}) {
  const source = mediaFileUrl(mediaId)

  if (mediaType === 'video') {
    return (
      <div className="vy-preview">
        {/* controls only — no autoplay: examiners choose when evidence plays */}
        <video src={source} controls preload="metadata" />
      </div>
    )
  }

  if (mediaType === 'image') {
    return (
      <div className="vy-preview">
        <img src={source} alt={fileName ? `Ingested media ${fileName}` : 'Ingested media'} />
      </div>
    )
  }

  if (mediaType === 'audio') {
    return (
      <div className="vy-preview">
        <audio src={source} controls preload="metadata" />
      </div>
    )
  }

  return (
    <div className="vy-preview">
      <p className="vy-muted" style={{ padding: '2rem' }}>
        No preview available — this file's type was not recognised as image, video or audio.
      </p>
    </div>
  )
}
