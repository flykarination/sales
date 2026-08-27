import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SearchPanel, type SearchValues } from '@/components/SearchPanel'
import { listRoutes, type RouteRow } from '@/lib/queries'
import { Link } from 'react-router-dom'
import photos from '@/data/destination-photos.json'
import { hasGuide } from '@/data/destinations'
import { assetUrl } from '@/lib/assets'
import { CABINS } from '@/lib/cabins'
import { duration, price } from '@/lib/format'

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
  const [params] = useSearchParams()
  const fromParam = params.get('from') ?? undefined
  const toParam = params.get('to') ?? undefined

  // Arriving from a route link: bring the search panel into view rather than
  // leaving the traveller to spot that two fields quietly changed.
  useEffect(() => {
    if (!fromParam && !toParam) return
    const el = document.querySelector('form[aria-label="Search flights"]')
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [fromParam, toParam])

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

        <SearchPanel onSearch={go} initialOrigin={fromParam} initialDestination={toParam} />

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
    listRoutes(900).then(({ data, error }) => {
      if (!live) return
      if (error || !data) setFailed(true)
      else setRoutes(data.filter((r) => r.from_price_economy_usd))
    })
    return () => { live = false }
  }, [])

  /**
   * A postcard per photographed city, priced from the cheapest real route to
   * it. Only cities we actually hold a photograph for appear here — a card
   * with a missing image is worse than no card.
   */
  const postcards = useMemo(() => {
    if (!routes) return []
    const best = new Map<string, RouteRow>()
    for (const r of routes) {
      const cur = best.get(r.destination_iata)
      if (!cur || (r.from_price_economy_usd ?? 9e9) < (cur.from_price_economy_usd ?? 9e9)) {
        best.set(r.destination_iata, r)
      }
    }
    return (photos as Array<{ iata: string; city: string; thumb: string }>)
      .map((ph) => {
        const r = best.get(ph.iata)
        if (!r?.from_price_economy_usd) return null
        return {
          iata: ph.iata, city: ph.city, thumb: ph.thumb,
          fare: r.from_price_economy_usd, from: r.origin_iata,
          minutes: r.fastest_minutes, weekly: r.days_served_per_week,
        }
      })
      .filter(Boolean)
      .sort((a, b) => a!.fare - b!.fare) as Array<{
        iata: string; city: string; thumb: string; fare: number
        from: string; minutes: number | null; weekly: number
      }>
  }, [routes])

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
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i}>
                <div style={{ aspectRatio: '16/9', background: 'rgba(255,255,255,.05)', borderRadius: 'var(--radius-soft)' }} />
                <div className="mt-3" style={{ height: 14, width: '60%', background: 'rgba(255,255,255,.05)' }} />
                <div className="mt-2" style={{ height: 20, width: '38%', background: 'rgba(255,255,255,.05)' }} />
              </li>
            ))}
          </ul>
        )}

        {routes && routes.length > 0 && (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {postcards.map((card) => (
              <li key={card.iata} className="min-w-0">
                <Link
                  to={hasGuide(card.iata) ? `/destinations/${card.iata}` : `/?to=${card.iata}`}
                  className="kx-card block"
                  aria-label={`${card.city}, from ${price(card.fare)} one way`}
                >
                  <span
                    className="kx-card-frame block"
                    style={{ borderRadius: 'var(--radius-soft)', overflow: 'hidden' }}
                  >
                    <img
                      src={assetUrl(card.thumb)}
                      alt=""
                      loading="lazy"
                      width={640}
                      height={360}
                      style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
                    />
                  </span>
                  <span className="mt-3 flex items-baseline gap-2">
                    <span
                      className="tnum font-mono"
                      style={{ color: 'var(--color-aqua)', fontSize: 'var(--text-micro)' }}
                    >
                      {card.iata}
                    </span>
                    <span
                      className="min-w-0 truncate"
                      style={{ color: 'var(--color-paper)', fontWeight: 600 }}
                    >
                      {card.city}
                    </span>
                  </span>
                  <span className="mt-1 flex items-baseline gap-2">
                    <span
                      className="tnum font-mono"
                      style={{ color: 'var(--color-paper)', fontSize: '1.35rem', fontWeight: 500 }}
                    >
                      {price(card.fare)}
                    </span>
                    <span style={{ color: '#8F8CB4', fontSize: 'var(--text-micro)' }}>
                      one way from {card.from}
                    </span>
                  </span>
                  <span className="mt-0.5 block" style={{ color: '#6B6790', fontSize: 'var(--text-micro)' }}>
                    {duration(card.minutes)} · {card.weekly}× weekly
                  </span>
                </Link>
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

