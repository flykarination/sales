import { useEffect, useState } from 'react'
import { SonderWave } from '@/components/v2/Universes'
import { Link } from 'react-router-dom'
import { listGroupCarriers, listHubs, type AirlineRow, type AirlineStatsRow, type HubRow } from '@/lib/queries'
import { count } from '@/lib/format'
import { CABIN_ORDER, CABINS } from '@/lib/cabins'
import { carrierByCode } from '@/data/carriers'
import { MISSION } from '@/data/about'

const HUB_CITY: Record<string, string> = {
  SGN: 'TP Hồ Chí Minh', HAN: 'Hà Nội', DAD: 'Đà Nẵng', CXR: 'Nha Trang', PQC: 'Phú Quốc',
  ICN: 'Seoul', VCA: 'Cần Thơ', DLI: 'Đà Lạt', HPH: 'Hải Phòng', HUI: 'Huế',
  UIH: 'Quy Nhơn', VCL: 'Chu Lai', DIN: 'Điện Biên', CAH: 'Cà Mau', PXU: 'Pleiku',
  VCS: 'Côn Đảo', BMV: 'Buôn Ma Thuột',
}

export default function About() {
  const [carriers, setCarriers] = useState<AirlineRow[]>([])
  const [stats, setStats] = useState<AirlineStatsRow[]>([])
  const [hubs, setHubs] = useState<HubRow[]>([])

  useEffect(() => {
    let live = true
    listGroupCarriers().then(({ airlines, stats }) => {
      if (!live) return
      if (airlines.data) setCarriers(airlines.data)
      if (stats.data) setStats(stats.data)
    })
    listHubs().then(({ data }) => { if (live && data) setHubs(data) })
    return () => { live = false }
  }, [])

  const statFor = (uid: string) => stats.find((s) => s.airline_uid === uid)
  const hubsFor = (uid: string) => hubs.filter((h) => h.airline_uid === uid)
  const kx = carriers.find((c) => c.airline_code === 'KX')
  const kxStats = kx ? statFor(kx.uid) : undefined

  return (
    <div>
      {/* ---- opening: a headline, then the page in boxes ----------------- */}
      <section className="px-5 pb-10 pt-14 md:px-8 md:pt-20">
        <div className="mx-auto max-w-6xl">
          <p className="kx-eyebrow mb-5" style={{ color: 'var(--color-aqua-deep)' }}>About Karination</p>
          <h1 className="font-display" style={{ fontSize: 'clamp(2.2rem, 5.4vw, 4.4rem)', maxWidth: '20ch' }}>
            A Vietnamese airline with a colour for every cabin.
          </h1>

          <div className="mt-10 grid gap-4 md:grid-cols-6">
            {/* the mission, as a statement */}
            <blockquote className="kx-box kx-box-statement md:col-span-4">
              <span className="kx-eyebrow mb-4 block" style={{ color: 'var(--color-ink-mute)' }}>What we are for</span>
              <p className="font-display" style={{ fontSize: 'clamp(1.35rem, 2.6vw, 2.1rem)', lineHeight: 1.05 }}>
                {MISSION}
              </p>
            </blockquote>

            {/* the facts */}
            <div className="kx-box md:col-span-2">
              <span className="kx-eyebrow mb-4 block" style={{ color: 'var(--color-ink-mute)' }}>Where we fly</span>
              <p style={{ color: 'var(--color-ink-mute)', lineHeight: 1.55 }}>
                From five hubs along the length of Vietnam &mdash; TP Hồ Chí Minh, Hà Nội,
                Đà Nẵng, Nha Trang and Phú Quốc &mdash; to{' '}
                <strong style={{ color: 'var(--color-ink)' }}>{kxStats ? count(kxStats.num_routes) : '803'} routes</strong>{' '}
                across Asia, the Middle East, Europe, Africa, Oceania and the Americas.
              </p>
            </div>

            {/* the two longer reads, as doors */}
            <Link to="/about/our-story" className="kx-box kx-card kx-box-door md:col-span-3">
              <span className="kx-eyebrow block" style={{ color: 'var(--color-ink-mute)' }}>Thirty-eight years</span>
              <span className="kx-headline mt-3 block" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)' }}>Our story &rarr;</span>
            </Link>
            <Link to="/about/what-we-believe" className="kx-box kx-card kx-box-door md:col-span-3">
              <span className="kx-eyebrow block" style={{ color: 'var(--color-ink-mute)' }}>Three convictions</span>
              <span className="kx-headline mt-3 block" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)' }}>What we believe &rarr;</span>
            </Link>

            {/* the numbers, straight from the schedule */}
            {[
              ['Aircraft', kxStats ? count(kxStats.num_aircraft) : '847', 'var(--color-spectrum-teal)'],
              ['Routes', kxStats ? count(kxStats.num_routes) : '803', 'var(--color-spectrum-amber)'],
              ['Flight pairs', kxStats ? count(kxStats.num_flights) : '1,409', 'var(--color-spectrum-rose)'],
            ].map(([label, value, hue]) => (
              <div key={label} className="kx-box md:col-span-2" style={{ borderTop: `3px solid ${hue}` }}>
                <span className="tnum kx-headline block" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>{value}</span>
                <span className="kx-eyebrow mt-1 block" style={{ color: 'var(--color-ink-mute)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- cabins: an expandable section ------------------------------ */}
      <section className="px-5 md:px-8">
        <div className="mx-auto max-w-6xl">
          <Expandable index="01" title="Four cabins, four colours"
                      teaser="One price per cabin, per passenger. No fare classes, no add-ons.">
          <p className="mb-8" style={{ color: 'var(--color-ink-mute)', maxWidth: '54ch' }}>
            Every cabin owns a colour, and it follows you from the search results
            to the boarding pass. There are no fare classes and no add-ons: one
            price per cabin, per passenger, one way.
          </p>
          <ul style={{ borderTop: '2px solid var(--color-ink)' }}>
            {CABIN_ORDER.map((code) => {
              const c = CABINS[code]
              return (
                <li key={code} className="flex flex-wrap items-baseline gap-x-5 gap-y-1 py-4" style={{ borderBottom: 'var(--rule)' }}>
                  <span aria-hidden style={{ width: 16, height: 16, background: c.hue, borderRadius: 3, flex: 'none' }} />
                  <span style={{ fontWeight: 600, color: c.ink, minWidth: '10rem' }}>{c.longName}</span>
                  <span style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
                    {code === 'FIRST' && 'Private suites and apartments on our widebody fleet.'}
                    {code === 'BUSINESS' && 'Full-flat seats and suites, on every long-haul departure.'}
                    {code === 'PREMIUM_ECONOMY' && 'Extra pitch and a separate cabin on most widebodies.'}
                    {code === 'ECONOMY' && 'The cabin most of our passengers fly, on every route we serve.'}
                  </span>
                </li>
              )
            })}
          </ul>
          </Expandable>
        </div>
      </section>

      {/* ---- the group: an expandable section ---------------------------- */}
      <section className="px-5 pb-6 md:px-8">
        <div className="mx-auto max-w-6xl">
          <Expandable index="02" title="KarinationGroup"
                      teaser="Three airlines, one booking: Karination, FORZA and Sonder, each with its own fleet and hubs.">
          <p className="mb-8" style={{ color: 'var(--color-ink-mute)', maxWidth: '58ch' }}>
            Karination is the airline you are booking with, and the one the rest
            of this page is about. It is one of three carriers in the group, each
            keeping its own fleet, hubs and alliance — and a Karination booking
            can put you on a FORZA or Sonder aeroplane, which is said plainly
            when it does.
          </p>

          <div className="grid gap-8 md:grid-cols-3">
            {carriers.map((c) => {
              const s = statFor(c.uid)
              const h = hubsFor(c.uid)
              // Whether WE can sell it, which is not the same as whether it
              // flies. Driven by the carriers this site actually sells, so a
              // future member with a fleet but no published schedule is marked
              // unbookable without anyone having to remember to.
              const sellable = Boolean(carrierByCode(c.airline_code))
              return (
                <article
                  key={c.uid}
                  className={`kx-glow kx-universe${c.airline_code === 'Z4' ? ' kx-forza-universe' : ''}${c.airline_code === 'SD' ? ' kx-sonder-universe' : ''}`}
                  style={{
                    borderTop: `3px solid ${carrierByCode(c.airline_code)?.accent ?? 'var(--color-ink)'}`,
                    padding: 20,
                    borderRadius: 'var(--radius-soft)',
                    background: c.airline_code === 'Z4' ? undefined : 'var(--color-paper-sunk)',
                  }}
                >
                  {c.airline_code === 'SD' && <div className="mb-3"><SonderWave bars={26} height={26} /></div>}
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono" style={{ color: 'var(--color-aqua-deep)', fontWeight: 600 }}>
                      {c.airline_code}
                    </span>
                    <h3 style={{ fontSize: 'var(--text-lead)', fontWeight: 600 }}>{c.airline_name}</h3>
                  </div>
                  <p className="mt-1" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
                    {c.airline_country === 'VN' ? 'Vietnam' : c.airline_country === 'KR' ? 'South Korea' : c.airline_country}
                    {c.alliance ? ` · ${c.alliance}` : ' · No alliance'}
                  </p>

                  {carrierByCode(c.airline_code) && (
                    <>
                      <p className="mt-2" style={{ fontSize: 'var(--text-small)', fontWeight: 600, color: carrierByCode(c.airline_code)!.accentInk }}>
                        {carrierByCode(c.airline_code)!.role}
                      </p>
                      <p className="mt-2" style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
                        {carrierByCode(c.airline_code)!.blurb}
                      </p>
                    </>
                  )}

                  <dl className="tnum mt-4 font-mono" style={{ fontSize: 'var(--text-small)' }}>
                    <div className="flex justify-between py-1" style={{ borderBottom: 'var(--rule)' }}>
                      <dt style={{ color: 'var(--color-ink-mute)' }}>Aircraft</dt>
                      <dd>{count(s?.num_aircraft ?? 0)}</dd>
                    </div>
                    <div className="flex justify-between py-1" style={{ borderBottom: 'var(--rule)' }}>
                      <dt style={{ color: 'var(--color-ink-mute)' }}>Routes</dt>
                      <dd>{count(s?.num_routes ?? 0)}</dd>
                    </div>
                    <div className="flex justify-between py-1" style={{ borderBottom: 'var(--rule)' }}>
                      <dt style={{ color: 'var(--color-ink-mute)' }}>Hubs</dt>
                      <dd>{h.length}</dd>
                    </div>
                  </dl>

                  <p className="mt-3" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
                    {h.slice(0, 6).map((x) => HUB_CITY[x.airport_iata] ?? x.airport_iata).join(' · ')}
                    {h.length > 6 ? ` +${h.length - 6} more` : ''}
                  </p>

                  {!sellable && (
                    <p className="mt-3" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-warn)' }}>
                      Schedule not yet published here — not bookable.
                    </p>
                  )}
                </article>
              )
            })}
          </div>

          {/* The "coming in the next months" teaser retired when Sonder
              launched; the news itself lives on Travel updates. */}
          <p className="mt-10" style={{ borderLeft: '3px solid var(--color-spectrum-rose)', paddingLeft: 16, maxWidth: '62ch' }}>
            <span
              className="mb-1 block font-mono uppercase"
              style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.18em', color: 'var(--color-spectrum-rose-ink)' }}
            >
              Now flying
            </span>
            <Link to="/updates/sonder-launch" className="underline" style={{ fontSize: 'var(--text-lead)', color: 'var(--color-ink)' }}>
              Sonder: an all new Hallyu experience, flown the KarinationGroup way
            </Link>
          </p>
          </Expandable>
        </div>
      </section>

      {/* v2: the brush tagline is retired; the page closes on the action */}
      <section className="px-5 py-16 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6">
          <p className="kx-headline" style={{ fontSize: 'clamp(1.8rem, 4vw, 3.2rem)' }}>
            Thirty years of colour, and counting.
          </p>
          <Link to="/" className="kx-cta-night ml-auto">Find a flight</Link>
        </div>
      </section>
    </div>
  )
}

/**
 * A dramatic expandable section: an oversized numbered title with a
 * one-line teaser, opening with a rise. A real <details>, so it works with
 * keyboard, find-in-page and screen readers without any script.
 */
function Expandable({ index, title, teaser, children }: {
  index: string
  title: string
  teaser: string
  children: React.ReactNode
}) {
  return (
    <details className="kx-expand">
      <summary className="kx-expand-summary">
        <span className="tnum kx-eyebrow kx-expand-index">{index}</span>
        <span className="min-w-0 flex-1">
          <span className="kx-expand-title">{title}</span>
          <span className="kx-expand-teaser">{teaser}</span>
        </span>
        <span aria-hidden className="kx-expand-plus" />
      </summary>
      <div className="kx-expand-body">{children}</div>
    </details>
  )
}
