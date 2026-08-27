import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import slides from '@/data/slideshow.json'
import { assetUrl } from '@/lib/assets'

interface Slide {
  src: string
  small: string
  width: number
  height: number
  caption: string
}

const SLIDES = slides as Slide[]
const DWELL = 6500

/**
 * The photographs behind the home page hero.
 *
 * Crossfade rather than a horizontal scroll: the panel sitting on top of this
 * never moves, and sliding pixels behind fixed text is the thing that makes a
 * hero feel cheap. Each image is served at its native 2752×1536 on anything
 * wide enough to use it, with a half-width copy for phones.
 */
export function Slideshow() {
  const [index, setIndex] = useState(0)
  const reduced = useReducedMotion()
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (reduced || SLIDES.length < 2) return
    timer.current = window.setInterval(
      () => setIndex((i) => (i + 1) % SLIDES.length),
      DWELL,
    )
    return () => window.clearInterval(timer.current)
  }, [reduced])

  if (SLIDES.length === 0) return null

  return (
    <div className="kx-slideshow" aria-roledescription="carousel" aria-label="Karination in pictures">
      {SLIDES.map((s, i) => (
        <img
          key={s.src}
          src={assetUrl(s.src)}
          srcSet={`${assetUrl(s.small)} 1376w, ${assetUrl(s.src)} ${s.width}w`}
          sizes="100vw"
          width={s.width}
          height={s.height}
          alt={i === index ? s.caption : ''}
          aria-hidden={i === index ? undefined : true}
          loading={i === 0 ? 'eager' : 'lazy'}
          fetchPriority={i === 0 ? 'high' : 'low'}
          className="kx-slide"
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}

      {/* a scrim, so anything laid over the photographs keeps its contrast */}
      <span aria-hidden className="kx-slideshow-scrim" />

      {SLIDES.length > 1 && (
        <div className="kx-slideshow-dots" role="group" aria-label="Choose a picture">
          {SLIDES.map((s, i) => (
            <button
              key={s.src}
              onClick={() => { window.clearInterval(timer.current); setIndex(i) }}
              aria-label={s.caption}
              aria-current={i === index}
              className="kx-dot"
              data-on={i === index ? 'true' : undefined}
            />
          ))}
        </div>
      )}

      <p className="kx-slideshow-caption" aria-live="off">{SLIDES[index].caption}</p>
    </div>
  )
}
