import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'
import gallery from '@/data/hero-gallery.json'
import { assetUrl } from '@/lib/assets'
import { starField } from '@/lib/stars'

/**
 * The hero's rotating gallery: the v2 aircraft crossing the night sky,
 * then the photographs listed in data/hero-gallery.json (generated from
 * web-assets/v2/scroll by web/scripts/hero_gallery.py).
 *
 * Accessibility, because auto-moving content is where carousels fail:
 *  * it advances on its own only when nothing is pointing at it, nothing
 *    inside it has focus, the tab is visible and motion is allowed -- and
 *    a pause button stops it outright (WCAG 2.2.2);
 *  * hidden slides are inert, so focus never lands on something unseen;
 *  * a manual change announces the new caption; autoplay announces nothing.
 *
 * The timer is the progress bar's own CSS animation: when the bar finishes
 * filling, the slide advances. Pausing the bar therefore pauses the timer,
 * with no second clock to keep in step.
 */

interface Photo {
  src: string
  srcSmall: string
  width: number
  height: number
  alt: string
  caption: string
  fit: 'cover' | 'contain'
  position: string
}

type Slide = { kind: 'flight'; caption: string; alt: string } | ({ kind: 'photo' } & Photo)

const SLIDES: Slide[] = [
  {
    kind: 'flight',
    caption: 'In flight · Airbus A321XLR in the new colours',
    alt: 'The new Karination livery in flight at night: white at the nose, washed in rainbow colour towards a black, starry tail, trailing a streak of light.',
  },
  ...(gallery as Photo[]).map((p) => ({ kind: 'photo' as const, ...p })),
]

const DWELL_MS = 7000
const STARS = starField(321, 120, { maxY: 700, sizes: [0, 0.5, 1], alpha: [0.3, 0.95] })

export function HeroGallery({ className = '' }: { className?: string }) {
  const reduced = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)        // the pause button
  const [held, setHeld] = useState(false)            // hover or focus within
  const [hidden, setHidden] = useState(false)        // tab in the background
  const [announce, setAnnounce] = useState('')
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const autoplay = !reduced && !paused
  const running = autoplay && !held && !hidden

  function go(next: number, manual: boolean) {
    const n = (next + SLIDES.length) % SLIDES.length
    setIndex(n)
    if (manual) setAnnounce(`Slide ${n + 1} of ${SLIDES.length}: ${SLIDES[n].caption}`)
  }

  return (
    <section
      ref={rootRef}
      className={className}
      aria-roledescription="carousel"
      aria-label="Karination in the new colours"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => { if (!rootRef.current?.contains(e.relatedTarget as Node)) setHeld(false) }}
    >
      <div className="kx-window" style={{ aspectRatio: '16 / 10' }}>
        {SLIDES.map((s, i) => {
          const on = i === index
          return (
            <div
              key={i}
              className="kx-slide-v2"
              data-on={on || undefined}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${SLIDES.length}: ${s.caption}`}
              aria-hidden={!on}
              inert={!on}
            >
              {s.kind === 'flight' ? <FlightSlide alt={s.alt} /> : <PhotoSlide photo={s} eager={i === 1} />}
            </div>
          )
        })}

        <div className="kx-window-scrim" aria-hidden />

        <div className="kx-progress">
          {SLIDES.map((s, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show slide ${i + 1}: ${s.caption}`}
              aria-current={i === index || undefined}
              data-on={i === index || undefined}
              data-done={i < index || undefined}
              data-still={!autoplay || undefined}
              onClick={() => go(i, true)}
            >
              <span
                className="kx-progress-fill"
                style={{
                  ['--dwell' as string]: `${DWELL_MS}ms`,
                  animationPlayState: running ? 'running' : 'paused',
                }}
                onAnimationEnd={() => { if (autoplay) go(index + 1, false) }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <p className="kx-eyebrow min-w-0 flex-1 truncate" style={{ color: 'var(--color-starlight-mute)' }}>
          <span className="tnum" style={{ color: 'var(--color-starlight)' }}>
            {String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
          </span>
          {'  ·  '}
          {SLIDES[index].caption}
        </p>
        {!reduced && (
          <button
            type="button"
            className="kx-roundbtn"
            aria-label={paused ? 'Play the gallery' : 'Pause the gallery'}
            aria-pressed={paused}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
        )}
        <button type="button" className="kx-roundbtn" aria-label="Previous slide" onClick={() => go(index - 1, true)}>
          <Chevron dir="left" />
        </button>
        <button type="button" className="kx-roundbtn" aria-label="Next slide" onClick={() => go(index + 1, true)}>
          <Chevron dir="right" />
        </button>
      </div>

      <p className="sr-only" aria-live="polite">{announce}</p>
    </section>
  )
}

/** The v2 A321XLR crossing the night, trailing the fluoro from its tail. */
function FlightSlide({ alt }: { alt: string }) {
  return (
    <div className="kx-flight" role="img" aria-label={alt}>
      <span className="kx-flight-stars" aria-hidden>
        <span className="kx-stars" style={{ boxShadow: STARS }} />
      </span>
      <div className="kx-flight-craft" aria-hidden>
        <span className="kx-flight-trail" />
        <img className="kx-flight-plane" src={assetUrl('/v2/livery-a321xlr-cut.webp')} alt="" width={1036} height={271} fetchPriority="high" />
      </div>
    </div>
  )
}

function PhotoSlide({ photo, eager }: { photo: Photo; eager: boolean }) {
  const srcSet = `${assetUrl(photo.srcSmall)} 1280w, ${assetUrl(photo.src)} 2400w`
  const sizes = '(min-width: 1024px) 58vw, 100vw'
  const common = { srcSet, sizes, src: assetUrl(photo.src), decoding: 'async' as const, loading: eager ? ('eager' as const) : ('lazy' as const) }
  if (photo.fit === 'contain') {
    return (
      <>
        <img {...common} className="kx-blurfill" alt="" aria-hidden />
        <img {...common} className="kx-contain" alt={photo.alt} width={photo.width} height={photo.height} />
      </>
    )
  }
  return (
    <img {...common} className="kx-cover" alt={photo.alt} width={photo.width} height={photo.height}
         style={{ objectPosition: photo.position }} />
  )
}

const icon = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, focusable: false } as const
function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg {...icon}>
      <path d={dir === 'left' ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function PauseIcon() {
  return <svg {...icon}><path d="M5.5 3.5v9M10.5 3.5v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
}
function PlayIcon() {
  return <svg {...icon}><path d="M5 3.2v9.6L12.5 8 5 3.2Z" fill="currentColor" /></svg>
}
