import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRoutes, type RouteRow } from '@/lib/queries'
import { getAirport, regionOf, REGION_KEYS, REGION_LABELS, type RegionKey } from '@/lib/geo'
import { REGION_STYLE } from '@/lib/cabins'
import { count, duration, price } from '@/lib/format'
import { hasGuide } from '@/data/destinations'
import photos from '@/data/destination-photos.json'
import { assetUrl } from '@/lib/assets'

const thumbs = new Map(
  (photos as Array<{ iata: string; thumb: string; city: string }>).map((p) => [p.iata, p]),
)

export default function Destinations() {
  const [routes, setRoutes] = useState<RouteRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    let live = true
    listRoutes(900).then(({ data, error }) => {
      if (!live) return
      if (error || !data) setFailed(true); else setRoutes(data)
    })
    return () => { live = false }
  }, [])

  /** Cheapest fare per destination city, grouped by region. */
  const byRegion = useMemo(() => {
    const best = new Map<string, RouteRow>()
    for (const r of routes ?? []) {
      const cur = best.get(r.destination_iata)
      if (!cur || (r.from_price_economy_usd ?? 9e9) < (cur.from_price_economy_usd ?? 9e9)) {
        best.set(r.destination_iata, r)
      }
    }
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const needle = norm(q.trim())
    const groups = new Map<RegionKey, RouteRow[]>()
    for (const r of best.values()) {
      const ap = getAirport(r.destination_iata)
      if (needle && !(norm(r.destination_iata).includes(needle) ||
                      norm(ap?.city ?? '').includes(needle) ||
                      norm(ap?.country ?? '').includes(needle))) continue
      const key = regionOf(r.destination_iata)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }
    for (const list of groups.values()) {
      list.sort((a, b) => (getAirport(a.destination_iata)?.city ?? '').localeCompare(getAirport(b.destination_iata)?.city ?? ''))
    }
    return groups
  }, [routes, q])

  const total = [...byRegion.values()].reduce((n, l) => n + l.length, 0)

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-8">
      <h1 className="font-display" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', lineHeight: 1.05 }}>
        Every destination
      </h1>
      <p className="mt-3" style={{ color: 'var(--color-ink-mute)', maxWidth: '48ch' }}>
        Lowest one-way Economy fare to each city we serve. Prices move as seats sell.
      </p>

      {/* featured guides: the cities we have written up, with photographs */}
      <section className="mt-9">
        <h2 className="mb-4 font-mono uppercase"
            style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.2em', color: 'var(--color-ink-mute)' }}>
          Destination guides
        </h2>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[...thumbs.values()].map((t) => (
            <li key={t.iata}>
              <Link to={`/destinations/${t.iata}`} className="kx-card block">
                <span className="kx-card-frame block" style={{ borderRadius: 'var(--radius-soft)', overflow: 'hidden' }}>
                  <img src={assetUrl(t.thumb)} alt="" loading="lazy" width={640} height={360}
                       style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                </span>
                <span className="mt-2 flex items-baseline gap-2">
                  <span className="tnum font-mono" style={{ color: 'var(--color-aqua-deep)', fontSize: 'var(--text-small)' }}>
                    {t.iata}
                  </span>
                  <span style={{ fontWeight: 600 }}>{t.city}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <label className="mt-10 block" style={{ maxWidth: 380 }}>
        <span className="kx-label">Search destinations</span>
        <input className="kx-input" value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="City, country or code" type="search" />
      </label>

      {failed && (
        <p className="mt-8" style={{ color: 'var(--color-danger)', borderLeft: '2px solid var(--color-danger)', paddingLeft: 12 }}>
          Destinations are unavailable right now.{' '}
          <button className="underline" onClick={() => location.reload()} style={{ minHeight: 44 }}>Try again</button>
        </p>
      )}

      {!routes && !failed && <p className="mt-8" style={{ color: 'var(--color-ink-mute)' }} aria-busy="true">Loading…</p>}

      {routes && total === 0 && (
        <div className="mt-8" style={{ borderTop: '2px solid var(--color-ink)', paddingTop: 18 }}>
          <p style={{ fontSize: 'var(--text-lead)' }}>Nothing matches “{q}”.</p>
          <button className="underline mt-2" onClick={() => setQ('')} style={{ minHeight: 44 }}>Clear the search</button>
        </div>
      )}

      {routes && total > 0 && (
        <>
          <p className="mt-6" role="status" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
            {count(total)} destinations
          </p>
          {REGION_KEYS.filter((k) => byRegion.has(k)).map((key) => (
            <section key={key} className="mt-10">
              <h2 className="mb-3 flex items-center gap-2 font-mono uppercase"
                  style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.2em' }}>
                <span aria-hidden style={{ width: 10, height: 10, background: REGION_STYLE[key].hue, borderRadius: 2 }} />
                {REGION_LABELS[key]}
                <span style={{ color: 'var(--color-ink-faint)' }}>({byRegion.get(key)!.length})</span>
              </h2>
              <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3" style={{ borderTop: '2px solid var(--color-ink)' }}>
                {byRegion.get(key)!.map((r) => {
                  const ap = getAirport(r.destination_iata)
                  return (
                    <li key={r.destination_iata} className="min-w-0">
                      <Link to={hasGuide(r.destination_iata) ? `/destinations/${r.destination_iata}` : `/timetable?from=${r.origin_iata}&to=${r.destination_iata}`}
                            className="kx-row flex min-w-0 items-baseline gap-3 py-3"
                            style={{ borderBottom: 'var(--rule)', minHeight: 44 }}>
                        <span className="tnum font-mono" style={{ color: 'var(--color-aqua-deep)', fontSize: 'var(--text-small)', flex: 'none' }}>
                          {r.destination_iata}
                        </span>
                        <span className="min-w-0 truncate" style={{ fontWeight: 500 }}>{ap?.city ?? r.destination_iata}</span>
                        {hasGuide(r.destination_iata) && (
                          <span aria-label="has a destination guide" title="Destination guide"
                                style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--color-spectrum-amber)', flex: 'none' }} />
                        )}
                        <span className="tnum ml-auto font-mono" style={{ color: 'var(--color-ink-mute)', flex: 'none' }}>
                          {price(r.from_price_economy_usd)}
                        </span>
                      </Link>
                      <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)', paddingBottom: 8 }}>
                        from {r.origin_iata} · {duration(r.fastest_minutes)} · {r.days_served_per_week}× weekly
                      </p>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
