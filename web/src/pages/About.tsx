import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listGroupCarriers, listHubs, type AirlineRow, type AirlineStatsRow, type HubRow } from '@/lib/queries'
import { count } from '@/lib/format'
import { CABIN_ORDER, CABINS } from '@/lib/cabins'
import { assetUrl } from '@/lib/assets'
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
      {/* ---- opening ------------------------------------------------- */}
      <section className="on-ink px-5 py-16 md:px-8 md:py-24" style={{ background: 'var(--color-ink)' }}>
        <div className="mx-auto max-w-6xl">
          <p
            className="mb-6 font-mono uppercase"
            style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.24em', color: 'var(--color-aqua)' }}
          >
            About Karination
          </p>
          <h1
            className="font-display"
            style={{ fontSize: 'clamp(2.2rem, 6vw, 4.5rem)', lineHeight: 1.02, color: 'var(--color-paper)', maxWidth: '18ch' }}
          >
            A Vietnamese airline with a colour for every cabin.
          </h1>
          <p
            className="mt-6 font-display"
            style={{ color: 'var(--color-paper)', fontSize: 'clamp(1.3rem, 2.8vw, 1.9rem)', lineHeight: 1.25, maxWidth: '26ch' }}
          >
            {MISSION}
          </p>
          <p className="mt-6" style={{ color: '#B9B6D8', fontSize: 'var(--text-lead)', maxWidth: '58ch' }}>
            Karination flies from five hubs along the length of Vietnam — TP Hồ Chí Minh,
            Hà Nội, Đà Nẵng, Nha Trang and Phú Quốc — to{' '}
            {kxStats ? count(kxStats.num_routes) : '766'} routes across Asia, the
            Middle East, Europe, Africa, Oceania and the Americas. It is the
            largest of the KarinationGroup airlines, and the one this site is
            about.
          </p>
        </div>
      </section>

      <section className="on-ink px-5 pb-14 md:px-8" style={{ background: 'var(--color-ink)' }}>
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-8 gap-y-3">
          <Link to="/about/our-story" className="kx-navlink" style={{ color: 'var(--color-aqua)' }}>
            Our story — thirty-eight years →
          </Link>
          <Link to="/about/what-we-believe" className="kx-navlink" style={{ color: 'var(--color-aqua)' }}>
            What we believe →
          </Link>
        </div>
      </section>

      {/* ---- the numbers, straight from the schedule ------------------ */}
      <section className="px-5 py-14 md:px-8">
        <div className="mx-auto max-w-6xl">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
            {[
              ['Aircraft', kxStats ? count(kxStats.num_aircraft) : '712', 'var(--color-spectrum-teal)'],
              ['Routes', kxStats ? count(kxStats.num_routes) : '766', 'var(--color-spectrum-amber)'],
              ['Flight pairs', kxStats ? count(kxStats.num_flights) : '1,302', 'var(--color-spectrum-rose)'],
              ['Flagship', kxStats?.flagship_aircraft_model ?? 'Airbus A321XLR', 'var(--color-spectrum-violet)'],
            ].map(([label, value, hue]) => (
              <div key={label}>
                <span aria-hidden className="mb-3 block" style={{ width: 28, height: 2, background: hue }} />
                <dd className="tnum font-mono" style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 500, lineHeight: 1.1 }}>
                  {value}
                </dd>
                <dt
                  className="mt-1 font-mono uppercase"
                  style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.16em', color: 'var(--color-ink-faint)' }}
                >
                  {label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---- cabins --------------------------------------------------- */}
      <section className="px-5 pb-14 md:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display mb-2" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)' }}>
            Four cabins, four colours
          </h2>
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
        </div>
      </section>

      {/* ---- the group ------------------------------------------------ */}
      <section className="px-5 py-14 md:px-8" style={{ background: 'var(--color-paper-sunk)' }}>
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display mb-2" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)' }}>
            KarinationGroup
          </h2>
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
                  style={{
                    borderTop: `3px solid ${carrierByCode(c.airline_code)?.accent ?? 'var(--color-ink)'}`,
                    paddingTop: 16,
                  }}
                >
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
        </div>
      </section>

      <section className="px-5 py-16 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6">
          <img src={assetUrl('/brand/tagline.png')} alt="Colour your dreams" style={{ maxWidth: 320, height: 'auto' }} />
          <Link
            to="/"
            className="ml-auto font-mono uppercase"
            style={{
              background: 'var(--color-ink)', color: 'var(--color-paper)',
              padding: '14px 22px', minHeight: 52, letterSpacing: '0.16em',
              fontSize: 'var(--text-small)', borderRadius: 'var(--radius-edge)',
              display: 'inline-flex', alignItems: 'center',
            }}
          >
            Find a flight
          </Link>
        </div>
      </section>
    </div>
  )
}
