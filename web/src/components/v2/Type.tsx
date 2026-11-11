import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

/**
 * Words lit by the fluoro: the streak shows through the letters and slides
 * along them as the page scrolls past, so a headline brightens and shifts
 * colour while you read down into it. Still under reduced motion.
 *
 * One passive scroll listener, attached only while the words are on screen
 * and coalesced to a frame -- no animation library, which on the home page
 * would cost more than everything else in the hero together.
 */
export function FluoroText({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced) { el.style.backgroundPositionX = '38%'; return }

    let frame = 0
    const paint = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      // 0 as the word rises into view, 1 as it leaves at the top
      const t = Math.min(Math.max((vh - r.top) / (vh + r.height), 0), 1)
      // 8% shows the white-hot end, 86% the blue vortex; travel the warm middle
      el.style.backgroundPositionX = `${(8 + t * 78).toFixed(2)}%`
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(paint) }

    let listening = false
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !listening) {
        window.addEventListener('scroll', onScroll, { passive: true })
        listening = true
        paint()
      } else if (!entry.isIntersecting && listening) {
        window.removeEventListener('scroll', onScroll)
        listening = false
      }
    })
    io.observe(el)
    paint()
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [reduced])

  return <span ref={ref} className={`kx-fluoro-text ${className}`}>{children}</span>
}

/**
 * Text set like the LED display on the v2 engine nacelle. The dots are a
 * mask over real text, so it stays selectable and screen readers read it.
 */
export function DotMatrix({ children, size = '1.05rem', className = '' }: {
  children: React.ReactNode
  size?: string
  className?: string
}) {
  return (
    <span className={`kx-dotmatrix ${className}`} style={{ fontSize: size }}>
      {children}
    </span>
  )
}
