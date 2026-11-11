import { useEffect, useRef } from 'react'
import { starField } from '@/lib/stars'

/**
 * The v2 night: stars, a shooting star now and then, and rainbow auroras.
 *
 * Purely decorative and aria-hidden. Everything moves by transform or
 * opacity, and the whole sky pauses when its section scrolls off screen
 * (data-paused on the nearest .kx-night) -- an animation nobody can see
 * should not be spending anyone's battery.
 */

const FAINT = starField(1996, 260, { maxY: 1400, sizes: [0, 0, 0.5], alpha: [0.25, 0.6] })
const MID = starField(2026, 90, { maxY: 1400, sizes: [0.5, 1], alpha: [0.5, 0.9] })
const BRIGHT = starField(767, 18, { maxY: 900, sizes: [1, 1.5], alpha: [0.85, 1] })

/** Spectrum ribbons. Positions and timings vary so they never move in step. */
const AURORAS = [
  { left: '-12%', top: '-18%', w: '70%', h: '46%', bg: 'linear-gradient(100deg, #3FBFA8, #5CF459 55%, transparent)', d: '38s', dx: '8%', dy: '5%', r0: '-14deg', r1: '-4deg', s: '1.1' },
  { left: '34%', top: '-24%', w: '62%', h: '50%', bg: 'linear-gradient(80deg, transparent, #F040D0 40%, #4636FF 80%)', d: '46s', dx: '-6%', dy: '6%', r0: '8deg', r1: '16deg', s: '1.15' },
  { left: '58%', top: '6%', w: '48%', h: '36%', bg: 'linear-gradient(120deg, #01DAEA, #4F9DFF 60%, transparent)', d: '31s', dx: '-8%', dy: '-4%', r0: '-6deg', r1: '6deg', s: '1.08' },
  { left: '6%', top: '22%', w: '40%', h: '26%', bg: 'linear-gradient(90deg, transparent, #FB9F23 50%, #F080A0)', d: '52s', dx: '10%', dy: '-3%', r0: '4deg', r1: '-6deg', s: '1.2', o: 0.18 },
]

export function NightSky({ auroras = true }: { auroras?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)

  // Pause the sky while it is off screen.
  useEffect(() => {
    const el = ref.current
    const section = el?.closest('.kx-night') as HTMLElement | null
    if (!el || !section || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) section.removeAttribute('data-paused')
      else section.setAttribute('data-paused', '')
    })
    io.observe(section)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className="kx-sky" aria-hidden>
      {auroras && AURORAS.map((a, i) => (
        <span
          key={i}
          className="kx-aurora"
          style={{
            left: a.left, top: a.top, width: a.w, height: a.h, background: a.bg,
            opacity: a.o,
            ['--d' as string]: a.d, ['--dx' as string]: a.dx, ['--dy' as string]: a.dy,
            ['--r0' as string]: a.r0, ['--r1' as string]: a.r1, ['--s' as string]: a.s,
          }}
        />
      ))}
      <span className="kx-stars" style={{ boxShadow: FAINT }} />
      <span className="kx-stars" data-twinkle style={{ boxShadow: MID, ['--d' as string]: '4.5s' }} />
      <span className="kx-stars" data-twinkle style={{ boxShadow: BRIGHT, ['--d' as string]: '7s', filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.8))' }} />
      <span className="kx-shooting" />
    </div>
  )
}
