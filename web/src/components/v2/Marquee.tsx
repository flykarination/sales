import { airportByCode, airportLabel } from '@/data/airports'

/**
 * Destinations sliding past like a departure board, in outlined capitals
 * with every fourth one lit by the fluoro.
 *
 * Decorative: the same cities are reachable through the search and the
 * destinations page, so the band is hidden from screen readers. It pauses
 * on hover and, with the rest of the night, when off screen; under reduced
 * motion it stands still.
 */
const CITIES = [
  'HAN', 'LIM', 'SCL', 'BDA', 'HAV', 'GRU', 'ICN', 'USH', 'CDG', 'MEX', 'CPT', 'AKL',
  'DAD', 'BOG', 'KRT', 'MLA', 'SFO', 'ASB', 'POM', 'MVD', 'PQC', 'EZE', 'CUN', 'CXR',
]

export function Marquee() {
  // Only cities the network actually serves; a typo in the list drops out
  // rather than printing a bare code.
  const names = CITIES.filter((c) => airportByCode(c)).map((c) => airportLabel(c))
  const run = (keyPrefix: string) =>
    names.map((n, i) => (
      <span key={`${keyPrefix}${i}`} className="kx-marquee-item" data-lit={i % 4 === 1 || undefined}>
        {i % 4 === 1 ? <span className="kx-fluoro-text" style={{ backgroundPositionX: `${(i * 13) % 90}%` }}>{n}</span> : n}
        <span className="kx-marquee-sep" />
      </span>
    ))

  return (
    <div className="kx-marquee" aria-hidden>
      {/* two copies, so the loop joins without a seam */}
      <div className="kx-marquee-track" style={{ ['--d' as string]: '90s' }}>
        {run('a')}
        {run('b')}
      </div>
    </div>
  )
}
