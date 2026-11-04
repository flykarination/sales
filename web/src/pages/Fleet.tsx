import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listFleet, type FleetRow } from '@/lib/queries'
import { count, duration } from '@/lib/format'
import { CABINS } from '@/lib/cabins'
import { FLEET_NOTES, FORZA_FLEET_NOTES, SONDER_FLEET_NOTES, type FleetNote } from '@/data/fleet-notes'
import { FORZA, SONDER } from '@/data/carriers'
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

/** Types for one carrier, largest fleet first. */
function groupTypes(list: FleetRow[]): TypeGroup[] {
  const map = new Map<string, TypeGroup>()
  for (const r of list) {
    let g = map.get(r.aircraft_model)
    if (!g) {
      g = { model: r.aircraft_model, manufacturer: r.manufacturer, airframes: [], hubs: {}, sample: r }
      map.set(r.aircraft_model, g)
    }
    g.airframes.push(r)
    if (r.hub_airport_iata) g.hubs[r.hub_airport_iata] = (g.hubs[r.hub_airport_iata] ?? 0) + 1
  }
  return [...map.values()].sort((a, b) => b.airframes.length - a.airframes.length)
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

  // The page is Karination's fleet with FORZA's beneath it, so the two are
  // never mixed into one list. The same aircraft type does different work at
  // each carrier — a 777-300ER is Karination's hardest-worked widebody and
  // one of nineteen frames opening Belfast at FORZA — and a combined count would
  // describe neither airline.
  const kx = useMemo(() => (rows ?? []).filter((r) => r.airline_code === 'KX'), [rows])
  const z4 = useMemo(() => (rows ?? []).filter((r) => r.airline_code === 'Z4'), [rows])
  const sd = useMemo(() => (rows ?? []).filter((r) => r.airline_code === 'SD'), [rows])

  const types = useMemo(() => groupTypes(kx), [kx])
  const forzaTypes = useMemo(() => groupTypes(z4), [z4])
  const sonderTypes = useMemo(() => groupTypes(sd), [sd])

  /** The group's other airlines, each in its own closed section below ours. */
  const subsidiaries = [
    { carrier: FORZA, aircraft: z4.length, types: forzaTypes, notes: FORZA_FLEET_NOTES,
      allowance: 'Its baggage allowances are tighter than ours.' },
    { carrier: SONDER, aircraft: sd.length, types: sonderTypes, notes: SONDER_FLEET_NOTES,
      allowance: 'Its baggage allowances sit between ours and FORZA’s, with a fan bag in every cabin.' },
  ].filter((s) => s.types.length > 0)

  const total = kx.length
  const idle = kx.filter((r) => r.is_unassigned).length

  return (
    <div>
      <section className="on-ink px-5 pt-14 pb-8 md:px-8 md:pt-20 md:pb-10" style={{ background: 'var(--color-ink)' }}>
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
            {total ? count(total) : '847'} aircraft, {types.length || 12} types.
          </h1>
          <p className="mt-5" style={{ color: '#B9B6D8', maxWidth: '52ch' }}>
            Every airframe below is a real aircraft in our operation, with the
            cabin it actually flies. Seat pitch is in inches.
            {subsidiaries.length > 0 && (
              <>
                {' '}Our {subsidiaries.length === 1 ? 'subsidiary' : 'subsidiaries'}{' '}
                {subsidiaries.map((s) => s.carrier.name).join(' and ')}{' '}
                {subsidiaries.length === 1 ? 'flies' : 'fly'} a further{' '}
                {subsidiaries.map((s) => count(s.aircraft)).join(' and ')};{' '}
                {subsidiaries.length === 1 ? 'its fleet is' : 'their fleets are'} at the foot of the page.
              </>
            )}
          </p>
        </div>
      </section>

      {/* The line at the delivery centre, bled to both edges and faded up into
          the indigo so the join reads as one surface rather than a pasted-in
          picture. Decorative on its own, but it is the fleet, so it carries an
          alt text. */}
      <div className="kx-fleet-band" style={{ background: 'var(--color-ink)' }}>
        <img
          src={assetUrl('/brand/777x-lineup.jpg')}
          alt="Karination 777-9s lined up nose-to-tail at the delivery centre"
          width={1077}
          height={252}
          loading="eager"
          className="kx-fleet-band-img"
        />
        <span aria-hidden className="kx-fleet-band-veil" />
      </div>

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
              <TypeList types={types} notes={FLEET_NOTES} />

              {idle > 0 && (
                <p className="mt-6" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
                  {idle} {idle === 1 ? 'aircraft is' : 'aircraft are'} delivered but not yet
                  rostered onto a route.
                </p>
              )}
            </>
          )}

          {/* ---- FORZA and Sonder ------------------------------------------
              Separate airlines, with their own allowances and their own idea
              of what an aircraft is for. Closed by default: most people on
              this page came to read about Karination. */}
          {subsidiaries.map((s) => (
            <details key={s.carrier.code} className="kx-carrier">
              <summary className="kx-carrier-summary">
                <span aria-hidden className="kx-carrier-mark" style={{ background: s.carrier.accent }} />
                <span className="min-w-0 flex-1">
                  <span className="kx-carrier-name">{s.carrier.name}</span>
                  <span className="kx-carrier-role">{s.carrier.role}</span>
                </span>
                <span className="tnum font-mono kx-carrier-count">
                  {count(s.aircraft)} aircraft · {s.types.length} {s.types.length === 1 ? 'type' : 'types'}
                </span>
                <span aria-hidden className="kx-carrier-chevron">
                  <svg viewBox="0 0 16 16" width="16" height="16" focusable="false">
                    <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6"
                          strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </summary>

              <div className="pt-6">
                <p className="mb-6" style={{ color: 'var(--color-ink-mute)', maxWidth: '64ch' }}>
                  {s.carrier.blurb}{' '}
                  <Link to="/travel-info#baggage" className="underline">{s.allowance}</Link>
                </p>
                <TypeList types={s.types} notes={s.notes} />
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */

/** One carrier's types. The same rendering for both; different notes. */
function TypeList({ types, notes }: { types: TypeGroup[]; notes: Record<string, FleetNote> }) {
  return (
    <ul style={{ borderTop: '2px solid var(--color-ink)' }}>
      {types.map((t) => {
        const s = t.sample
        const note = notes[t.model]
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
                  {note && (
                    <span
                      className="font-mono uppercase"
                      style={{
                        fontSize: 'var(--text-micro)', letterSpacing: '0.14em',
                        color: 'var(--color-ink-faint)',
                      }}
                    >
                      {note.role}
                    </span>
                  )}
                </div>

                {note && (
                  <>
                    <p className="mt-2" style={{ color: 'var(--color-ink-mute)', maxWidth: '64ch' }}>
                      {note.description}
                    </p>
                    {note.signature.km > 0 && (
                      <p className="tnum mt-2 font-mono" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
                        Longest sector · {note.signature.route} ·{' '}
                        {count(note.signature.km)} km · {duration(note.signature.minutes)}
                      </p>
                    )}
                    {note.configuration && (
                      <p className="mt-1" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
                        {note.configuration}
                      </p>
                    )}
                  </>
                )}

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
  )
}
