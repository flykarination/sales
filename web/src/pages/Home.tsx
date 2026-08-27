import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchPanel, type SearchValues } from '@/components/SearchPanel'
import { listRoutes, type RouteRow } from '@/lib/queries'
import { CABINS } from '@/lib/cabins'
import { duration, price } from '@/lib/format'
import { assetUrl } from '@/lib/assets'

export default function Home() {
  return (
    <div id="top">
      <Booking />
      <Destinations />
      <WhyUs />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* The top. Compact: a passenger came here to find a flight, so the    */
/* search panel is the largest thing on the screen, not the branding.  */
/* ------------------------------------------------------------------ */
function Booking() {
  const navigate = useNavigate()

  function go(v: SearchValues) {
    const q = new URLSearchParams({
      from: v.origin, to: v.destination, depart: v.depart,
      cabin: v.cabin, adults: String(v.adults),
      ...(v.ret ? { return: v.ret } : {}),
    })
    navigate(`/search?${q}`)
  }

  return (
    <section id="book" className="px-5 pb-14 pt-8 md:px-8 md:pt-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          {/* The tagline artwork itself, on paper, exactly as painted — it is
              the loudest thing on the page and everything else stays quiet. */}
          <img
            src={assetUrl('/brand/tagline.png')}
            alt="Colour your dreams"
            className="block w-full"
            style={{ maxWidth: 'min(560px, 82vw)', height: 'auto' }}
            fetchPriority="high"
          />
          <h1
            className="mt-5"
            style={{
              fontSize: 'clamp(1.25rem, 2.4vw, 1.65rem)',
              fontWeight: 400,
              lineHeight: 1.35,
              color: 'var(--color-ink-mute)',
              maxWidth: '34ch',
            }}
          >
            Fly to <strong style={{ fontWeight: 600, color: 'var(--color-ink)' }}>481 destinations</strong> from
            Sài Gòn, Hà Nội, Đà Nẵng, Nha Trang and Phú Quốc.
          </h1>
        </div>

        <SearchPanel onSearch={go} />

        {/* the network, as a ruled rail rather than three floating numbers */}
        <dl
          className="mt-6 grid grid-cols-2 sm:grid-cols-4"
          style={{ borderTop: '1px solid var(--color-paper-edge)' }}
        >
          {[
            ['766', 'routes', 'var(--color-spectrum-teal)'],
            ['481', 'destinations', 'var(--color-spectrum-amber)'],
            ['717', 'aircraft', 'var(--color-spectrum-rose)'],
            ['5', 'hubs', 'var(--color-spectrum-violet)'],
          ].map(([n, l, hue]) => (
            <div key={l} className="pt-4" style={{ paddingRight: 24 }}>
              <span aria-hidden className="mb-3 block" style={{ width: 24, height: 2, background: hue }} />
              <dd className="tnum font-mono" style={{ fontSize: '1.6rem', fontWeight: 500, lineHeight: 1 }}>{n}</dd>
              <dt
                className="mt-1 font-mono uppercase"
                style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.16em', color: 'var(--color-ink-faint)' }}
              >
                {l}
              </dt>
            </div>
          ))}
        </dl>


      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Where we fly. Real fares from v_routes, cheapest first, so the      */
/* passenger sees somewhere they could actually afford to go today.    */
/* ------------------------------------------------------------------ */
/** True even when the network is unreachable, so the band is never empty. */
const HUBS_FALLBACK = [
  { code: 'SGN', city: 'Sài Gòn', note: 'Tân Sơn Nhất · main hub' },
  { code: 'HAN', city: 'Hà Nội', note: 'Nội Bài' },
  { code: 'DAD', city: 'Đà Nẵng', note: 'Đà Nẵng' },
  { code: 'CXR', city: 'Nha Trang', note: 'Cam Ranh' },
  { code: 'PQC', city: 'Phú Quốc', note: 'Phú Quốc' },
]

function Destinations() {
  const [routes, setRoutes] = useState<RouteRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    listRoutes(60).then(({ data, error }) => {
      if (!live) return
      if (error || !data) setFailed(true)
      else setRoutes(data.filter((r) => r.from_price_economy_usd).slice(0, 12))
    })
    return () => { live = false }
  }, [])

  return (
    <section
      id="destinations"
      className="on-ink px-5 py-16 md:px-8 md:py-20"
      style={{ background: 'var(--color-ink)' }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display" style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', color: 'var(--color-paper)', lineHeight: 1.05 }}>
            Where we fly
          </h2>
          <p style={{ color: '#B9B6D8', fontSize: 'var(--text-small)', maxWidth: '38ch' }}>
            Lowest one-way Economy fare on each route, per passenger. Prices move as seats sell.
          </p>
        </div>

        {/* An empty band is worse than no band. When fares cannot load, the
            hubs are still true and still useful, so the section always says
            something rather than leaving a hole. */}
        {(failed || (routes && routes.length === 0)) && (
          <>
            <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              {HUBS_FALLBACK.map((h) => (
                <li key={h.code}>
                  <a
                    href="#book"
                    className="kx-route flex items-baseline gap-3 py-4"
                    style={{ borderBottom: '1px solid rgba(255,255,255,.12)' }}
                  >
                    <span className="tnum font-mono" style={{ color: 'var(--color-aqua)', fontSize: 'var(--text-small)' }}>
                      {h.code}
                    </span>
                    <span style={{ color: 'var(--color-paper)', fontWeight: 500 }}>{h.city}</span>
                    <span className="ml-auto" style={{ color: '#8F8CB4', fontSize: 'var(--text-micro)' }}>
                      {h.note}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-6" style={{ color: '#8F8CB4', fontSize: 'var(--text-small)' }}>
              {failed ? 'Live fares are unavailable right now. ' : 'No fares published yet. '}
              <button
                className="underline"
                onClick={() => location.reload()}
                style={{ color: 'var(--color-aqua)', minHeight: 44 }}
              >
                Try again
              </button>
            </p>
          </>
        )}

        {!routes && !failed && (
          <ul className="grid gap-px sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} style={{ height: 92, background: 'rgba(255,255,255,.04)', borderRadius: 'var(--radius-edge)' }} />
            ))}
          </ul>
        )}

        {routes && routes.length > 0 && (
          <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((r) => (
              <li key={`${r.origin_iata}-${r.destination_iata}`}>
                <a
                  href="#book"
                  className="kx-route flex items-baseline gap-3 py-4"
                  style={{ borderBottom: '1px solid rgba(255,255,255,.12)' }}
                >
                  <span className="tnum font-mono" style={{ color: 'var(--color-aqua)', fontSize: 'var(--text-small)' }}>
                    {r.origin_iata}<span style={{ opacity: .5 }}>→</span>{r.destination_iata}
                  </span>
                  <span className="tnum ml-auto font-mono" style={{ color: 'var(--color-paper)', fontSize: 'var(--text-lead)' }}>
                    {price(r.from_price_economy_usd)}
                  </span>
                </a>
                <p style={{ fontSize: 'var(--text-micro)', color: '#8F8CB4', paddingBottom: 10 }}>
                  {duration(r.fastest_minutes)} · {r.days_served_per_week}× weekly
                  {r.has_stopover_service ? ' · via one stop' : ''}
                </p>
              </li>
            ))}
          </ul>
        )}

      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function WhyUs() {
  const items = [
    {
      title: 'Four cabins, one colour each',
      body: 'First, Business, Premium Economy and Economy carry their own colour across every page, so you always know what you are looking at.',
      swatch: CABINS.FIRST,
    },
    {
      title: 'Times as they are, where you are',
      body: 'Every departure and arrival is shown on the clock of the airport it happens at. No conversions, no guessing.',
      swatch: CABINS.BUSINESS,
    },
    {
      title: 'No fare classes, no add-ons',
      body: 'One price per cabin, per passenger, one way. What you see is what you pay.',
      swatch: CABINS.PREMIUM_ECONOMY,
    },
  ]

  return (
    <section id="about" className="px-5 py-16 md:px-8 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3">
        {items.map((it) => (
          <div key={it.title}>
            <span
              aria-hidden
              className="mb-4 block"
              style={{ width: 40, height: 3, background: it.swatch.hue, borderRadius: 2 }}
            />
            <h3 style={{ fontSize: 'var(--text-lead)', fontWeight: 600, marginBottom: 8 }}>{it.title}</h3>
            <p style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

