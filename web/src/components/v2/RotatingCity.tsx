import { useEffect, useState } from 'react'
import { airportByCode, airportLabel } from '@/data/airports'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

/**
 * A destination that changes every couple of seconds, slotting in from
 * below like a split-flap board, each lit by a different slice of the
 * fluoro. Decorative: the heading it sits in carries the real sentence for
 * screen readers. Under reduced motion it stands still on a plain fact.
 */
const CITIES = ['LIM', 'HAV', 'BDA', 'SCL', 'KRT', 'HAN', 'MEL', 'BOG', 'ICN', 'USH', 'CPT', 'MLA', 'CDG', 'GRU', 'DAD', 'MEX']

export function RotatingCity({ still }: { still: string }) {
  const reduced = usePrefersReducedMotion()
  const names = CITIES.filter((c) => airportByCode(c)).map((c) => airportLabel(c))
  const [i, setI] = useState(0)

  useEffect(() => {
    if (reduced) return
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') setI((n) => (n + 1) % names.length)
    }, 2300)
    return () => window.clearInterval(t)
  }, [reduced, names.length])

  if (reduced) return <span className="kx-fluoro-text block" style={{ backgroundPositionX: '40%' }}>{still}</span>

  return (
    <span className="kx-ticker block" aria-hidden>
      <span
        key={i}
        className="kx-ticker-word kx-fluoro-text"
        style={{ backgroundPositionX: `${(i * 23) % 88}%` }}
      >
        {names[i]}
      </span>
    </span>
  )
}
