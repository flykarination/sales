import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listFleet, type FleetRow } from '@/lib/queries'
import { CABIN_ORDER, CABINS, type CabinCode } from '@/lib/cabins'
import { count } from '@/lib/format'

/**
 * What the four cabins are actually like.
 *
 * Built entirely from the fleet: which seat products are fitted, at what pitch,
 * and on which types. Nothing here is a stock photograph or a claim we cannot
 * point at a row of the database for.
 */

/** The game's product codes, said the way a passenger would say them. */
const PRODUCT: Record<string, { name: string; blurb: string }> = {
  apartment: {
    name: 'Apartment',
    blurb: 'An enclosed room with a door, a separate bed and a chair. The largest thing we fly.',
  },
  private_suite: {
    name: 'Private suite',
    blurb: 'A closing suite with a full-length bed, on our newest 777-9 frames.',
  },
  open_suite: {
    name: 'Open suite',
    blurb: 'A private shell without a door, with direct aisle access on both sides.',
  },
  premium_suite: {
    name: 'Premium suite',
    blurb: 'A wider shell with a fixed bed, on the A330 fleet.',
  },
  wide_suite: {
    name: 'Wide suite',
    blurb: 'The broadest seat in the fleet, fitted only to the A350-1000.',
  },
  studio_suite: {
    name: 'Studio suite',
    blurb: 'A twin-surface suite with a separate lounging seat.',
  },
  staggered_suite: {
    name: 'Staggered suite',
    blurb: 'Offset rows giving every seat the aisle, at the deepest pitch we fly.',
  },
  suite: {
    name: 'Suite',
    blurb: 'A full-flat bed inside its own shell, on every widebody.',
  },
  full_flat: {
    name: 'Full-flat bed',
    blurb: 'A seat that lies completely flat — on narrowbodies too, which is unusual.',
  },
  regional: {
    name: 'Regional recliner',
    blurb: 'A deep recliner for the shorter sectors, where a bed would be wasted.',
  },
  luxury: {
    name: 'Luxury',
    blurb: 'Our best economy-class seat, with the deepest recline in the cabin.',
  },
  comfort: { name: 'Comfort', blurb: 'Extra width and pitch over the standard fit.' },
  standard: { name: 'Standard', blurb: 'The everyday fit across the older narrowbodies.' },
  basic: { name: 'Basic', blurb: 'A simpler seat on the short-sector aircraft.' },
}

const CABIN_INTRO: Record<CabinCode, string> = {
  FIRST:
    'Five different First products across the fleet, from an enclosed apartment on the A350-1000 down to a deep recliner on the narrowbodies. What you get depends entirely on the aircraft, so it is worth checking the type before you book.',
  BUSINESS:
    'Every long-haul Business seat we fly lies completely flat, including on the A321 family — which is why a narrowbody can sensibly work a nine-hour sector for us. The deepest pitch in the fleet is in Business, not First.',
  PREMIUM_ECONOMY:
    'A separate cabin with its own crew, between 38 and 42 inches of pitch, on every widebody and most of the A321 fleet.',
  ECONOMY:
    'The cabin most of our passengers fly, on every route we serve. Two fits across the fleet, and the better of them is on almost every aircraft.',
}

interface ProductGroup {
  product: string
  frames: number
  minPitch: number
  maxPitch: number
  types: string[]
}

export default function Cabins() {
  const [fleet, setFleet] = useState<FleetRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    listFleet().then(({ data, error }) => {
      if (!live) return
      if (error || !data) setFailed(true)
      else setFleet(data)
    })
    return () => { live = false }
  }, [])

  const byCabin = useMemo(() => {
    const out = {} as Record<CabinCode, ProductGroup[]>
    const pick = (r: FleetRow, c: CabinCode): [string | null, number | null] => {
      if (c === 'FIRST') return [r.first_product, r.first_pitch]
      if (c === 'BUSINESS') return [r.biz_product, r.biz_pitch]
      if (c === 'PREMIUM_ECONOMY') return [r.prem_eco_product, r.prem_eco_pitch]
      return [r.eco_product, r.eco_pitch]
    }
    for (const c of CABIN_ORDER) {
      const map = new Map<string, ProductGroup>()
      for (const r of fleet ?? []) {
        const [product, pitch] = pick(r, c)
        if (!product || !pitch) continue
        let g = map.get(product)
        if (!g) {
          g = { product, frames: 0, minPitch: pitch, maxPitch: pitch, types: [] }
          map.set(product, g)
        }
        g.frames += 1
        g.minPitch = Math.min(g.minPitch, pitch)
        g.maxPitch = Math.max(g.maxPitch, pitch)
        if (!g.types.includes(r.aircraft_model)) g.types.push(r.aircraft_model)
      }
      out[c] = [...map.values()].sort((a, b) => b.maxPitch - a.maxPitch)
    }
    return out
  }, [fleet])

  return (
    <div>
      <section className="on-ink px-5 py-14 md:px-8 md:py-20" style={{ background: 'var(--color-ink)' }}>
        <div className="mx-auto max-w-5xl">
          <p className="mb-5 font-mono uppercase"
             style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.24em', color: 'var(--color-aqua)' }}>
            On board
          </p>
          <h1 className="font-display"
              style={{ fontSize: 'clamp(2rem,5.5vw,4rem)', lineHeight: 1.04, color: 'var(--color-paper)', maxWidth: '16ch' }}>
            Four cabins, and what is actually in them.
          </h1>
          <p className="mt-5" style={{ color: '#B9B6D8', maxWidth: '56ch' }}>
            Seat pitch is in inches, measured from one seat back to the next. Every
            figure below is the real fit on the real aircraft — not a brochure
            number.
          </p>
        </div>
      </section>

      <section className="px-5 py-14 md:px-8">
        <div className="mx-auto max-w-5xl">
          {failed && (
            <p style={{ color: 'var(--color-danger)', borderLeft: '2px solid var(--color-danger)', paddingLeft: 12 }}>
              Cabin details are unavailable right now.{' '}
              <button className="underline" onClick={() => location.reload()} style={{ minHeight: 44 }}>Try again</button>
            </p>
          )}
          {!fleet && !failed && <p style={{ color: 'var(--color-ink-mute)' }} aria-busy="true">Loading…</p>}

          {fleet && CABIN_ORDER.map((code) => {
            const c = CABINS[code]
            const groups = byCabin[code] ?? []
            if (groups.length === 0) return null
            return (
              <section key={code} id={code.toLowerCase()} className="mb-16 scroll-mt-32">
                <div className="mb-3 flex flex-wrap items-baseline gap-3">
                  <span aria-hidden style={{ width: 16, height: 16, background: c.hue, borderRadius: 3 }} />
                  <h2 className="font-display" style={{ fontSize: 'clamp(1.6rem,3.5vw,2.2rem)', color: c.ink }}>
                    {c.longName}
                  </h2>
                  <span className="tnum font-mono"
                        style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-faint)' }}>
                    {groups.length} {groups.length === 1 ? 'product' : 'products'}
                  </span>
                </div>
                <p className="mb-6" style={{ color: 'var(--color-ink-mute)', maxWidth: '62ch' }}>
                  {CABIN_INTRO[code]}
                </p>

                <ul style={{ borderTop: `2px solid ${c.hue}` }}>
                  {groups.map((g) => {
                    const p = PRODUCT[g.product] ?? { name: g.product.replace(/_/g, ' '), blurb: '' }
                    return (
                      <li key={g.product} className="grid gap-4 py-5 md:grid-cols-[1fr_auto]"
                          style={{ borderBottom: 'var(--rule)' }}>
                        <div className="min-w-0">
                          <h3 style={{ fontWeight: 600, marginBottom: 3 }}>{p.name}</h3>
                          <p style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)', maxWidth: '56ch' }}>
                            {p.blurb}
                          </p>
                          <p className="mt-2" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
                            {g.types.join(' · ')}
                          </p>
                        </div>
                        <div className="md:text-right">
                          <p className="tnum font-mono" style={{ fontSize: '1.5rem', fontWeight: 500, color: c.ink }}>
                            {g.minPitch === g.maxPitch ? `${g.maxPitch}"` : `${g.minPitch}–${g.maxPitch}"`}
                          </p>
                          <p className="tnum font-mono"
                             style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
                            {count(g.frames)} aircraft
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}

          <p style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
            Which product you get depends on the aircraft working your flight.{' '}
            <Link to="/fleet" className="underline">See the fleet</Link> to check what
            flies your route.
          </p>
        </div>
      </section>
    </div>
  )
}
