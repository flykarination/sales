import { useEffect, useMemo, useState } from 'react'
import { listFleet, type FleetRow } from '@/lib/queries'
import { count } from '@/lib/format'
import { CABINS } from '@/lib/cabins'
import { assetUrl } from '@/lib/assets'

/** The game's product codes, said the way a passenger would say them. */
const PRODUCT: Record<string, string> = {
  private_suite: 'Private suite',
  premium_suite: 'Premium suite',
  apartment: 'Apartment',
  open_suite: 'Open suite',
  studio_suite: 'Studio suite',
  wide_suite: 'Wide suite',
  staggered_suite: 'Staggered suite',
  suite: 'Suite',
  full_flat: 'Full-flat bed',
  regional: 'Regional recliner',
  luxury: 'Luxury',
  comfort: 'Comfort',
  standard: 'Standard',
  basic: 'Basic',
  dense: 'High density',
}
const say = (v: string | null) => (v ? (PRODUCT[v] ?? v.replace(/_/g, ' ')) : '—')

interface TypeGroup {
  model: string
  manufacturer: string | null
  airframes: FleetRow[]
  hubs: Record<string, number>
  sample: FleetRow
}

export default function Fleet() {
  const [rows, setRows] = useState<FleetRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    listFleet().then(({ data, error }) => {
      if (!live) return
      if (error || !data) setFailed(true)
      else setRows(data)
    })
    return () => { live = false }
  }, [])

  const types = useMemo<TypeGroup[]>(() => {
    if (!rows) return []
    const map = new Map<string, TypeGroup>()
    for (const r of rows) {
      let g = map.get(r.aircraft_model)
      if (!g) {
        g = { model: r.aircraft_model, manufacturer: r.manufacturer, airframes: [], hubs: {}, sample: r }
        map.set(r.aircraft_model, g)
      }
      g.airframes.push(r)
      if (r.hub_airport_iata) g.hubs[r.hub_airport_iata] = (g.hubs[r.hub_airport_iata] ?? 0) + 1
    }
    return [...map.values()].sort((a, b) => b.airframes.length - a.airframes.length)
  }, [rows])

  const total = rows?.length ?? 0
  const idle = rows?.filter((r) => r.is_unassigned).length ?? 0

  return (
    <div>
      <section className="on-ink px-5 py-14 md:px-8 md:py-20" style={{ background: 'var(--color-ink)' }}>
        <div className="mx-auto max-w-6xl">
          <p
            className="mb-5 font-mono uppercase"
            style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.24em', color: 'var(--color-aqua)' }}
          >
            Our fleet
          </p>
          <h1
            className="font-display"
            style={{ fontSize: 'clamp(2rem, 5.5vw, 4rem)', lineHeight: 1.04, color: 'var(--color-paper)', maxWidth: '16ch' }}
          >
            {total ? count(total) : '717'} aircraft, {types.length || 13} types.
          </h1>
          <p className="mt-5" style={{ color: '#B9B6D8', maxWidth: '52ch' }}>
            Every airframe below is a real aircraft in our operation, with the
            cabin it actually flies. Seat pitch is in inches.
          </p>
          <img
            src={assetUrl('/brand/tail.png')}
            alt=""
            className="mt-8"
            style={{ height: 96, width: 'auto', opacity: 0.9 }}
          />
        </div>
      </section>

      <section className="px-5 py-14 md:px-8">
        <div className="mx-auto max-w-6xl">
          {failed && (
            <p style={{ color: 'var(--color-danger)', borderLeft: '2px solid var(--color-danger)', paddingLeft: 12 }}>
              The fleet list is unavailable right now.{' '}
              <button className="underline" onClick={() => location.reload()} style={{ minHeight: 44 }}>Try again</button>
            </p>
          )}

          {!rows && !failed && (
            <ul aria-busy="true" style={{ borderTop: '2px solid var(--color-ink)' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="animate-pulse" style={{ height: 96, borderBottom: 'var(--rule)', background: 'var(--color-paper-sunk)', opacity: 0.5 }} />
              ))}
            </ul>
          )}

          {types.length > 0 && (
            <>
              <ul style={{ borderTop: '2px solid var(--color-ink)' }}>
                {types.map((t) => {
                  const s = t.sample
                  const hubList = Object.entries(t.hubs).sort((a, b) => b[1] - a[1])
                  return (
                    <li key={t.model} className="py-6" style={{ borderBottom: 'var(--rule)' }}>
                      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-4">
                            <h2 style={{ fontSize: 'var(--text-lead)', fontWeight: 600 }}>{t.model}</h2>
                            <span
                              className="tnum font-mono"
                              style={{ fontSize: 'var(--text-small)', color: 'var(--color-aqua-deep)' }}
                            >
                              {t.airframes.length} in fleet
                            </span>
                          </div>

                          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                            {([
                              ['FIRST', s.first_product, s.first_pitch],
                              ['BUSINESS', s.biz_product, s.biz_pitch],
                              ['PREMIUM_ECONOMY', s.prem_eco_product, s.prem_eco_pitch],
                              ['ECONOMY', s.eco_product, s.eco_pitch],
                            ] as const).map(([code, product, pitch]) => {
                              if (!pitch) return null
                              const c = CABINS[code]
                              return (
                                <li key={code} className="flex items-baseline gap-2">
                                  <span aria-hidden style={{ width: 8, height: 8, background: c.hue, borderRadius: 2 }} />
                                  <span style={{ fontSize: 'var(--text-small)', color: c.ink, fontWeight: 600 }}>{c.name}</span>
                                  <span className="tnum" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
                                    {say(product)} · {pitch}"
                                  </span>
                                </li>
                              )
                            })}
                          </ul>

                          <p className="mt-3" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
                            Based at {hubList.map(([h, n]) => `${h} (${n})`).join(' · ') || 'unassigned'}
                            {s.eco_config_type === 'dense' ? ' · high-density economy' : ''}
                          </p>
                        </div>

                        <p
                          className="tnum font-mono md:text-right"
                          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)', minWidth: 130 }}
                        >
                          {t.airframes.slice(0, 3).map((a) => a.registration).join(' · ')}
                          {t.airframes.length > 3 ? ` +${t.airframes.length - 3}` : ''}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>

              {idle > 0 && (
                <p className="mt-6" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
                  {idle} {idle === 1 ? 'aircraft is' : 'aircraft are'} delivered but not yet
                  rostered onto a route.
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
