import { useEffect, useMemo, useRef, useState } from 'react'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router-dom'
import {
  getAirport, greatCirclePath, distanceKm, landFeatures,
  regionOf, REGION_KEYS, REGION_LABELS, type RegionKey,
} from '@/lib/geo'
import { listRoutes, type RouteRow } from '@/lib/queries'
import { REGION_STYLE } from '@/lib/cabins'
import { count, duration, price } from '@/lib/format'

const W = 1000
const H = 520

/** ALL, one region, or every route flown wholly inside Vietnam. */
type Filter = RegionKey | 'ALL' | 'DOMESTIC'

const isDomestic = (a: string, b: string) =>
  getAirport(a)?.country === 'VN' && getAirport(b)?.country === 'VN'

/**
 * The viewBox rectangle that frames a set of projected points.
 *
 * Zooming by animating the viewBox rather than transforming a group: CSS
 * transforms on an SVG <g> are computed away to identity here, and the
 * viewBox is the one mechanism every engine honours. It also keeps the
 * projection itself untouched, so the great-circle geometry never re-projects.
 *
 * The rect is widened to the viewport's aspect so nothing is squashed, and the
 * zoom is capped so a single short hop cannot magnify the map into abstraction.
 */
type Rect = [number, number, number, number]
const WORLD: Rect = [0, 0, W, H]

function frameFor(points: Array<[number, number]>, maxZoom = 6): Rect {
  if (points.length === 0) return WORLD
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const pad = 34
  const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad
  const y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad

  let w = Math.max(x1 - x0, W / maxZoom)
  let h = Math.max(y1 - y0, H / maxZoom)
  const aspect = W / H
  if (w / h > aspect) h = w / aspect
  else w = h * aspect

  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  return [cx - w / 2, cy - h / 2, w, h]
}

/** Ease-out cubic: quick departure, soft landing, matching --ease-paint. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)


export default function Network() {
  const [routes, setRoutes] = useState<RouteRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [region, setRegion] = useState<Filter>('ALL')
  const [active, setActive] = useState<RouteRow | null>(null)
  const reduced = useReducedMotion()
  const liveRef = useRef<HTMLParagraphElement>(null)
  const viewRef = useRef<Rect>(WORLD)

  useEffect(() => {
    let live = true
    listRoutes(900).then(({ data, error }) => {
      if (!live) return
      if (error || !data) setFailed(true)
      else setRoutes(data)
    })
    return () => { live = false }
  }, [])

  const projection = useMemo(
    () => geoNaturalEarth1().fitExtent([[8, 8], [W - 8, H - 8]], { type: 'Sphere' }),
    [],
  )
  const path = useMemo(() => geoPath(projection), [projection])
  const land = useMemo(() => {
    try { return path(landFeatures() as never) ?? '' } catch { return '' }
  }, [path])

  /** Only routes whose far end is in the chosen region. */
  const shown = useMemo(() => {
    if (!routes) return []
    const seen = new Set<string>()
    return routes.filter((r) => {
      const key = [r.origin_iata, r.destination_iata].sort().join('-')
      if (seen.has(key)) return false
      seen.add(key)
      if (region === 'ALL') return true
      if (region === 'DOMESTIC') return isDomestic(r.origin_iata, r.destination_iata)
      return regionOf(r.destination_iata) === region
    })
  }, [routes, region])

  const arcs = useMemo(
    () =>
      shown
        .map((r) => {
          const from = getAirport(r.origin_iata)
          const to = getAirport(r.destination_iata)
          if (!from || !to) return null
          const d = greatCirclePath(r.origin_iata, r.destination_iata, projection)
          if (!d) return null
          return { route: r, d, region: regionOf(r.destination_iata) }
        })
        .filter(Boolean) as Array<{ route: RouteRow; d: string; region: RegionKey }>,
    [shown, projection],
  )

  const dots = useMemo(() => {
    const set = new Map<string, [number, number]>()
    for (const a of arcs) {
      for (const code of [a.route.origin_iata, a.route.destination_iata]) {
        if (set.has(code)) continue
        const ap = getAirport(code)
        if (!ap) continue
        const p = projection([ap.lon, ap.lat])
        if (p) set.set(code, p)
      }
    }
    return [...set.entries()]
  }, [arcs, projection])

  /** Where the map should be looking; the whole world when unfiltered. */
  const target = useMemo<Rect>(
    () => (region === 'ALL' ? WORLD : frameFor(dots.map(([, p]) => p))),
    [region, dots],
  )
  const [view, setView] = useState<Rect>(WORLD)

  // Tween the viewBox to the target. Reduced motion jumps straight there —
  // the framing is the information, the flight to it is the flourish.
  useEffect(() => {
    const from = viewRef.current
    if (reduced) { viewRef.current = target; setView(target); return }
    if (from.every((v, i) => Math.abs(v - target[i]) < 0.5)) return
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min((now - t0) / 850, 1)
      const e = easeOut(t)
      const next = from.map((v, i) => v + (target[i] - v) * e) as Rect
      viewRef.current = next
      setView(next)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced])

  /** How much the map is magnified, so marks can hold their on-screen size. */
  const zoom = W / view[2]

  const activeArc = active
    ? greatCirclePath(active.origin_iata, active.destination_iata, projection)
    : null
  const activeKm = active ? distanceKm(active.origin_iata, active.destination_iata) : NaN

  return (
    <div>
      <section className="on-ink px-5 pt-14 md:px-8 md:pt-20" style={{ background: 'var(--color-ink)' }}>
        <div className="mx-auto max-w-6xl">
          <p
            className="mb-5 font-mono uppercase"
            style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.24em', color: 'var(--color-aqua)' }}
          >
            Route network
          </p>
          <h1
            className="font-display"
            style={{ fontSize: 'clamp(2rem, 5.5vw, 4rem)', lineHeight: 1.04, color: 'var(--color-paper)', maxWidth: '16ch' }}
          >
            Every route we fly.
          </h1>
          <p className="mt-5" style={{ color: '#B9B6D8', maxWidth: '52ch' }}>
            {routes ? count(shown.length) : '—'}{' '}
            {region === 'DOMESTIC' ? 'routes within Vietnam' : 'city pairs from five Vietnamese hubs'}.
            Each arc is the real great-circle track; colour shows the region it
            reaches. Choose a region to fly the map to it, or select a route to draw it.
          </p>

          {/* region filter — colour is paired with a word, never alone */}
          <div className="mt-7 flex flex-wrap gap-2" role="group" aria-label="Filter by region">
            {(['ALL', 'DOMESTIC', ...REGION_KEYS] as const).map((key) => {
              const on = region === key
              const hue =
                key === 'ALL' ? 'var(--color-aqua)'
                : key === 'DOMESTIC' ? 'var(--color-spectrum-lime)'
                : REGION_STYLE[key as RegionKey].hue
              return (
                <button
                  key={key}
                  onClick={() => { setRegion(key); setActive(null) }}
                  aria-pressed={on}
                  className="inline-flex items-center gap-2 font-mono uppercase"
                  style={{
                    fontSize: 'var(--text-micro)', letterSpacing: '0.12em',
                    padding: '8px 12px', minHeight: 40, borderRadius: 'var(--radius-edge)',
                    border: `1px solid ${on ? hue : 'rgba(255,255,255,.18)'}`,
                    background: on ? 'rgba(255,255,255,.08)' : 'transparent',
                    color: on ? 'var(--color-paper)' : '#B9B6D8',
                  }}
                >
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: hue }} />
                  {key === 'ALL' ? 'All regions'
                    : key === 'DOMESTIC' ? 'Domestic · Việt Nam'
                    : (REGION_LABELS[key as RegionKey] ?? key)}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---- the map ------------------------------------------------- */}
      <section className="on-ink px-5 pb-6 md:px-8" style={{ background: 'var(--color-ink)' }}>
        <div className="mx-auto max-w-6xl">
          <div style={{ overflowX: 'auto' }}>
            <svg
              viewBox={view.join(' ')}
              role="img"
              aria-label={`Route map showing ${arcs.length} city pairs`}
              style={{ width: '100%', minWidth: 640, height: 'auto', display: 'block' }}
            >
              <defs>
                {/* the spectrum runs along the arc, so it must be in user space */}
                {active && (() => {
                  const a = getAirport(active.origin_iata)
                  const b = getAirport(active.destination_iata)
                  const p1 = a ? projection([a.lon, a.lat]) : null
                  const p2 = b ? projection([b.lon, b.lat]) : null
                  if (!p1 || !p2) return null
                  return (
                    <linearGradient
                      id="kx-spectrum" gradientUnits="userSpaceOnUse"
                      x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]}
                    >
                      <stop offset="0%" stopColor="var(--color-spectrum-teal)" />
                      <stop offset="22%" stopColor="var(--color-spectrum-lime)" />
                      <stop offset="44%" stopColor="var(--color-spectrum-amber)" />
                      <stop offset="66%" stopColor="var(--color-spectrum-rose)" />
                      <stop offset="84%" stopColor="var(--color-spectrum-magenta)" />
                      <stop offset="100%" stopColor="var(--color-spectrum-violet)" />
                    </linearGradient>
                  )
                })()}
              </defs>

              <path d={path({ type: 'Sphere' } as never) ?? ''} fill="#12123F" />

              {/* Everything geographic sits in one group so a single animated
                  transform can fly the map to a region. transform-origin is
                  pinned to the viewBox origin so translate-then-scale composes
                  exactly like the maths in focusOn(). */}
              <path d={land} fill="#1E1F5C" stroke="#2A2B72" strokeWidth={0.5}
                    vectorEffect="non-scaling-stroke" />

              {/* every route, static */}
              <g fill="none" strokeWidth={0.7} strokeLinecap="round" vectorEffect="non-scaling-stroke">
                {arcs.map((a) => (
                  <path
                    key={`${a.route.origin_iata}-${a.route.destination_iata}`}
                    d={a.d}
                    stroke={REGION_STYLE[a.region].hue}
                    opacity={active ? 0.16 : 0.42}
                  />
                ))}
              </g>

              {/* airports */}
              <g>
                {dots.map(([code, [x, y]]) => (
                  <circle key={code} cx={x} cy={y} r={1.5 / zoom} fill="#78F5FB"
                          opacity={active ? 0.3 : 0.6} />
                ))}
              </g>

              {/* the signature: the selected arc draws itself, once */}
              {active && activeArc && (
                <motion.path
                  key={`${active.origin_iata}-${active.destination_iata}`}
                  d={activeArc}
                  fill="none"
                  stroke="url(#kx-spectrum)"
                  strokeWidth={2.4}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  initial={reduced ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { pathLength: { duration: 1.1, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }
                  }
                />
              )}
            </svg>
          </div>

          <p ref={liveRef} role="status" className="sr-only">
            {active ? `${active.origin_iata} to ${active.destination_iata} selected` : ''}
          </p>
        </div>
      </section>

      {/* ---- the route list ------------------------------------------ */}
      <section className="on-ink px-5 pb-16 md:px-8" style={{ background: 'var(--color-ink)' }}>
        <div className="mx-auto max-w-6xl">
          {failed && (
            <p style={{ color: '#D7B8C8' }}>
              The route list is unavailable right now.{' '}
              <button className="underline" onClick={() => location.reload()} style={{ color: 'var(--color-aqua)', minHeight: 44 }}>
                Try again
              </button>
            </p>
          )}

          {active && (
            <div
              className="mb-6 flex flex-wrap items-baseline gap-x-6 gap-y-2"
              style={{ borderTop: '2px solid var(--color-aqua)', paddingTop: 14 }}
            >
              <span className="tnum font-mono" style={{ color: 'var(--color-paper)', fontSize: 'var(--text-lead)' }}>
                {active.origin_iata} → {active.destination_iata}
              </span>
              <span style={{ color: '#B9B6D8', fontSize: 'var(--text-small)' }}>
                {getAirport(active.destination_iata)?.city || active.destination_iata}
              </span>
              {Number.isFinite(activeKm) && (
                <span className="tnum font-mono" style={{ color: '#8F8CB4', fontSize: 'var(--text-small)' }}>
                  {count(activeKm)} km
                </span>
              )}
              <span className="tnum font-mono" style={{ color: '#8F8CB4', fontSize: 'var(--text-small)' }}>
                {duration(active.fastest_minutes)}
              </span>
              {active.from_price_economy_usd && (
                <span className="tnum font-mono" style={{ color: 'var(--color-aqua)' }}>
                  from {price(active.from_price_economy_usd)}
                </span>
              )}
              <Link
                to={`/?from=${active.origin_iata}&to=${active.destination_iata}`}
                className="ml-auto"
                style={{ color: 'var(--color-aqua)', fontSize: 'var(--text-small)' }}
              >
                Search this route →
              </Link>
            </div>
          )}

          {!routes && !failed && (
            <p style={{ color: '#8F8CB4' }} aria-busy="true">Loading the network…</p>
          )}

          {arcs.length > 0 && (
            <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              {arcs.slice(0, 45).map((a) => {
                const on = active === a.route
                return (
                  <li key={`${a.route.origin_iata}-${a.route.destination_iata}`}>
                    <button
                      onClick={() => setActive(on ? null : a.route)}
                      aria-pressed={on}
                      className="kx-route flex w-full items-baseline gap-3 py-3 text-left"
                      style={{ borderBottom: '1px solid rgba(255,255,255,.12)', minHeight: 44 }}
                    >
                      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: REGION_STYLE[a.region].hue, flex: 'none' }} />
                      <span className="tnum font-mono" style={{ color: on ? 'var(--color-aqua)' : 'var(--color-paper)', fontSize: 'var(--text-small)' }}>
                        {a.route.origin_iata}→{a.route.destination_iata}
                      </span>
                      <span className="min-w-0 truncate" style={{ color: '#8F8CB4', fontSize: 'var(--text-micro)' }}>
                        {getAirport(a.route.destination_iata)?.city ?? ''}
                      </span>
                      {a.route.from_price_economy_usd && (
                        <span className="tnum ml-auto font-mono" style={{ color: '#B9B6D8', fontSize: 'var(--text-small)' }}>
                          {price(a.route.from_price_economy_usd)}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {arcs.length > 45 && (
            <p className="mt-6" style={{ color: '#8F8CB4', fontSize: 'var(--text-small)' }}>
              Showing 45 of {count(arcs.length)} routes in this region.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
