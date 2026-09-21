import { useEffect, useMemo, useRef, useState } from 'react'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router-dom'
import {
  getAirport, greatCirclePath, greatCircleSegments, distanceKm, landFeatures,
  regionOf, REGION_KEYS, REGION_LABELS, type RegionKey,
} from '@/lib/geo'
import { listAllRoutes, type RouteRow } from '@/lib/queries'
import { REGION_STYLE } from '@/lib/cabins'
import { count, duration, price } from '@/lib/format'
import { airportLabel } from '@/data/airports'
import { CARRIERS, carrierByCode, type GroupCarrier } from '@/data/carriers'

const W = 1000
const H = 520

/** ALL, one region, or every route flown wholly inside Vietnam. */
type Filter = RegionKey | 'ALL' | 'DOMESTIC'

/** Which carrier's routes are on the map. */
type CarrierFilter = 'ALL' | GroupCarrier['code']

const isDomestic = (a: string, b: string) =>
  getAirport(a)?.country === 'VN' && getAirport(b)?.country === 'VN'

/**
 * The end of a route that decides which region it belongs to.
 *
 * v_routes holds both directions of every city pair, so one of the two is
 * dropped before drawing and the survivor is simply whichever sorted first.
 * Reading the region off `destination_iata` therefore asked "which way round
 * did this row happen to be stored?" rather than "where does this route go":
 * the pair (ADL, SGN) survives as ADL -> SGN, whose destination is Sài Gòn,
 * so Adelaide was filed and coloured as Southeast Asia. So were Auckland,
 * Algiers and Stockholm — 438 of 754 routes.
 *
 * The far end is the one away from the hub, and "away" is measured: each
 * end's distance from the nearest base of the airline flying the route, the
 * farther end winning. The hub end of a route is zero away, so a route is
 * coloured by where it goes whichever way round its row was stored. That used
 * to be decided by which end was in Vietnam, and it failed wherever neither
 * was: every Sonder route out of Incheon fell back to the stored destination,
 * so Incheon–Boston, kept as BOS -> ICN, was coloured East Asia. An onward
 * stopover sector, with no base at either end, is coloured by the end further
 * from home. Only a route between two bases ties, and there the destination
 * is as good an answer as exists.
 */
const farEnds = new Map<string, string>()

function farEnd(route: Pick<RouteRow, 'origin_iata' | 'destination_iata' | 'airline_code'>): string {
  const { origin_iata: o, destination_iata: d, airline_code } = route
  const key = `${airline_code}:${o}:${d}`
  const cached = farEnds.get(key)
  if (cached) return cached
  // a route whose airline this site does not know is judged against every base
  const bases = carrierByCode(airline_code)?.hubs ?? HUB_ORDER
  const fromBase = (iata: string) => {
    const km = Math.min(...bases.map((b) => distanceKm(b, iata)))
    return Number.isFinite(km) ? km : 0
  }
  const far = fromBase(o) > fromBase(d) ? o : d
  farEnds.set(key, far)
  return far
}

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

function frameFor(points: Array<[number, number]>, maxZoom = 6, pad = 34): Rect {
  if (points.length === 0) return WORLD
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
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

/**
 * The tagline spectrum as a ramp, so a colour can be taken at any point
 * along a route rather than only at six fixed stops.
 *
 * These mirror --color-spectrum-* in styles/theme.css. They are repeated as
 * literals because interpolating between two colours needs their components,
 * and a CSS custom property is an opaque string at this point.
 */
const SPECTRUM: Array<[number, [number, number, number]]> = [
  [0.00, [0x3f, 0xbf, 0xa8]], // teal
  [0.22, [0x9b, 0xd6, 0x4a]], // lime
  [0.44, [0xf0, 0xa0, 0x20]], // amber
  [0.66, [0xf0, 0x80, 0xa0]], // rose
  [0.84, [0xf0, 0x40, 0xd0]], // magenta
  [1.00, [0xa0, 0x60, 0xf0]], // violet
]

/** The spectrum colour at fraction `t` along a route, 0 at the origin. */
function spectrumAt(t: number): string {
  const x = Math.min(Math.max(t, 0), 1)
  let i = 0
  while (i < SPECTRUM.length - 2 && x > SPECTRUM[i + 1][0]) i += 1
  const [t0, c0] = SPECTRUM[i]
  const [t1, c1] = SPECTRUM[i + 1]
  const k = t1 === t0 ? 0 : (x - t0) / (t1 - t0)
  const mix = c0.map((v, j) => Math.round(v + (c1[j] - v) * k))
  return `rgb(${mix[0]} ${mix[1]} ${mix[2]})`
}

/**
 * Every base in the group, in carrier order — Karination's five, then FORZA's
 * and Sonder's. Every carrier's routes are on this map because all of them
 * are bookable here, so grouping by Karination's hubs alone would file most
 * of the group's network under "Onward". A hub two carriers share is headed
 * by the first to claim it.
 */
const HUB_ORDER: string[] = []
/** Which carrier bases at a hub, for the section heading: the first to claim it. */
const HUB_CARRIER = new Map<string, GroupCarrier>()
for (const c of CARRIERS) {
  for (const h of c.hubs) {
    if (HUB_CARRIER.has(h)) continue
    HUB_ORDER.push(h)
    HUB_CARRIER.set(h, c)
  }
}

/** Ease-out cubic: quick departure, soft landing, matching --ease-paint. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)


export default function Network() {
  const [routes, setRoutes] = useState<RouteRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [region, setRegion] = useState<Filter>('ALL')
  const [carrier, setCarrier] = useState<CarrierFilter>('ALL')
  const [active, setActive] = useState<RouteRow | null>(null)
  const reduced = useReducedMotion()
  const liveRef = useRef<HTMLParagraphElement>(null)
  const viewRef = useRef<Rect>(WORLD)

  useEffect(() => {
    let live = true
    // The whole network, paged. This used to ask for the 900 cheapest, which
    // sounds generous until you notice v_routes is ordered by fare and holds
    // 1,508 rows: every long-haul sat past the cut and the Americas filter
    // drew an empty world. Raising the limit does not help — PostgREST caps
    // any single request at 1,000 rows — so listAllRoutes() pages instead.
    listAllRoutes().then(({ data, error }) => {
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
    return routes
      // The carrier test runs BEFORE the de-duplication, not inside it. Both
      // airlines fly some of the same city pairs, and the key is
      // direction-agnostic, so filtering afterwards would let a Karination row
      // consume the key and make FORZA's own service disappear from its own
      // filter.
      .filter((r) => carrier === 'ALL' || r.airline_code === carrier)
      .filter((r) => {
        const key = [r.origin_iata, r.destination_iata].sort().join('-')
        if (seen.has(key)) return false
        seen.add(key)
        if (region === 'ALL') return true
        if (region === 'DOMESTIC') return isDomestic(r.origin_iata, r.destination_iata)
        return regionOf(farEnd(r)) === region
      })
  }, [routes, region, carrier])

  const arcs = useMemo(
    () =>
      shown
        .map((r) => {
          const from = getAirport(r.origin_iata)
          const to = getAirport(r.destination_iata)
          if (!from || !to) return null
          const d = greatCirclePath(r.origin_iata, r.destination_iata, projection)
          if (!d) return null
          const far = farEnd(r)
          return { route: r, d, far, region: regionOf(far) }
        })
        .filter(Boolean) as Array<{ route: RouteRow; d: string; far: string; region: RegionKey }>,
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

  /**
   * Where the map should be looking; the whole world when unfiltered.
   *
   * Vietnam is small enough that the general 6x ceiling framed it from
   * somewhere over the South China Sea, so the domestic view gets its own,
   * much closer limit and far tighter padding. It cannot fill the frame
   * horizontally — the country is long and thin and the map is wide, so
   * squeezing it sideways would mean cropping Hà Nội or Cà Mau off the ends —
   * but it now fills the height, which is the dimension that carries it.
   */
  const target = useMemo<Rect>(
    () => {
      if (region === 'ALL') return WORLD
      const points = dots.map(([, p]) => p)
      return region === 'DOMESTIC'
        ? frameFor(points, 22, 6)
        : frameFor(points)
    },
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

  const activeSegments = useMemo(
    () => (active ? greatCircleSegments(active.origin_iata, active.destination_iata, projection) : []),
    [active, projection],
  )

  /** The two ends of the selected route, ready to label. */
  const activeEnds = useMemo(() => {
    if (!active) return []
    const ends = [active.origin_iata, active.destination_iata]
      .map((code) => {
        const ap = getAirport(code)
        const pt = ap ? projection([ap.lon, ap.lat]) : null
        return pt ? { code, x: pt[0], y: pt[1] } : null
      })
      .filter(Boolean) as Array<{ code: string; x: number; y: number }>
    if (ends.length < 2) return ends.map((e) => ({ ...e, anchor: 'start' as const }))
    // push each label away from the other end, so they never collide
    const [a, b] = ends
    return [
      { ...a, anchor: (a.x <= b.x ? 'end' : 'start') as 'start' | 'end' },
      { ...b, anchor: (b.x < a.x ? 'end' : 'start') as 'start' | 'end' },
    ]
  }, [active, projection])

  /**
   * The route list, gathered under the hub each route is flown from.
   *
   * A flat list of 700 city pairs tells a reader nothing about how the
   * airline is arranged. Grouped by hub it does: this is what Sài Gòn flies,
   * this is what Đà Nẵng flies. A route is filed under its near end — the one
   * that is not its far end — so Karination's Sài Gòn–Incheon sits under Sài
   * Gòn, not under Sonder's base at the other end of it. The handful that
   * touch no hub — the second leg of a stopover service — are gathered at the
   * end rather than dropped.
   */
  const byHub = useMemo(() => {
    const hubs = new Map<string, typeof arcs>()
    const other: typeof arcs = []
    for (const a of arcs) {
      const near = a.far === a.route.origin_iata ? a.route.destination_iata : a.route.origin_iata
      const hub = HUB_ORDER.includes(near) ? near : null
      if (!hub) { other.push(a); continue }
      const list = hubs.get(hub)
      if (list) list.push(a)
      else hubs.set(hub, [a])
    }
    const groups = HUB_ORDER
      .filter((h) => hubs.has(h))
      .map((h) => ({
        hub: h,
        city: airportLabel(h),
        carrier: HUB_CARRIER.get(h) ?? null,
        total: hubs.get(h)!.length,
        arcs: hubs.get(h)!.slice(0, 24),
      }))
    if (other.length) {
      groups.push({
        hub: 'Onward', city: 'Stopover sectors', carrier: null,
        total: other.length, arcs: other.slice(0, 24),
      })
    }
    return groups
  }, [arcs])

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
            {region === 'DOMESTIC' ? 'routes within Vietnam' : 'city pairs'}
            {carrier === 'ALL'
              ? ` across ${CARRIERS.map((c) => c.name).join(', ').replace(/, ([^,]*)$/, ' and $1')}`
              : ` flown by ${carrierByCode(carrier)?.name ?? carrier}`}.
            Each arc is the real great-circle track; colour shows the region it
            reaches. Choose a region to fly the map to it, or select a route to draw it.
          </p>

          {/* Airline first: it changes what the region counts even mean. */}
          <div className="mt-7 flex flex-wrap gap-2" role="group" aria-label="Filter by airline">
            {([
              ['ALL', 'All airlines', 'var(--color-aqua)'],
              ...CARRIERS.map((c) => [c.code, c.name, c.accent] as [CarrierFilter, string, string]),
            ] as Array<[CarrierFilter, string, string]>).map(([key, label, hue]) => {
              const on = carrier === key
              return (
                <button
                  key={key}
                  onClick={() => { setCarrier(key); setActive(null) }}
                  aria-pressed={on}
                  className="inline-flex items-center gap-2 font-mono uppercase"
                  style={{
                    fontSize: 'var(--text-micro)', letterSpacing: '0.12em',
                    padding: '8px 14px', minHeight: 40, borderRadius: 'var(--radius-edge)',
                    border: `1px solid ${on ? hue : 'rgba(255,255,255,.18)'}`,
                    background: on ? 'rgba(255,255,255,.12)' : 'transparent',
                    color: on ? 'var(--color-paper)' : '#B9B6D8',
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: hue }} />
                  {label}
                </button>
              )
            })}
          </div>

          {/* region filter — colour is paired with a word, never alone */}
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by region">
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
              <path d={path({ type: 'Sphere' } as never) ?? ''} fill="#12123F" />

              {/* Everything geographic sits in one group so a single animated
                  transform can fly the map to a region. transform-origin is
                  pinned to the viewBox origin so translate-then-scale composes
                  exactly like the maths in focusOn(). */}
              <path d={land} fill="#1E1F5C" stroke="#2A2B72" strokeWidth={0.5}
                    vectorEffect="non-scaling-stroke" />

              {/* Every route, static.
                  vector-effect goes on each path, not on the group: unlike
                  stroke-width it is not an inherited property, so on the <g>
                  it did nothing at all and the arcs scaled with the zoom —
                  0.8 screen pixels on the world view became 8 on the domestic
                  one, which is what made that map unreadable. */}
              <g fill="none" strokeWidth={0.7} strokeLinecap="round">
                {arcs.map((a) => (
                  <path
                    key={`${a.route.origin_iata}-${a.route.destination_iata}`}
                    d={a.d}
                    stroke={REGION_STYLE[a.region].hue}
                    opacity={active ? 0.16 : 0.42}
                    vectorEffect="non-scaling-stroke"
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

              {/* The signature: the selected route draws itself, once.
                  Each piece carries its own colour, taken from how far along
                  the great circle it sits, and they draw in order so the whole
                  thing still reads as one stroke travelling to its
                  destination. */}
              {active && activeSegments.map((seg, i) => (
                <motion.path
                  key={`${active.origin_iata}-${active.destination_iata}-${i}`}
                  d={seg.d}
                  fill="none"
                  stroke={spectrumAt(seg.t)}
                  strokeWidth={2.4}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  initial={reduced ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          pathLength: { duration: 1.1 / activeSegments.length, ease: 'linear',
                                        delay: (i * 1.1) / activeSegments.length },
                          opacity: { duration: 0.12, delay: (i * 1.1) / activeSegments.length },
                        }
                  }
                />
              ))}

              {/* Both ends, named. A selected route is a specific pair of
                  cities, and an unlabelled dot on a world map is not one. */}
              {active && activeEnds.map(({ code, x, y, anchor }) => (
                <g key={code} style={{ pointerEvents: 'none' }}>
                  <circle cx={x} cy={y} r={3.2 / zoom} fill="var(--color-paper)" />
                  <text
                    x={x + (anchor === 'end' ? -7 / zoom : 7 / zoom)}
                    y={y - 7 / zoom}
                    textAnchor={anchor}
                    className="tnum font-mono"
                    style={{
                      fontSize: `${13 / zoom}px`,
                      letterSpacing: `${0.08 * (13 / zoom)}px`,
                      fill: 'var(--color-paper)',
                      paintOrder: 'stroke',
                      stroke: 'var(--color-ink)',
                      strokeWidth: 4 / zoom,
                      strokeLinejoin: 'round',
                    }}
                  >
                    {code}
                  </text>
                </g>
              ))}
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
                {airportLabel(farEnd(active))}
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

          {byHub.map((group) => (
            <section key={group.hub} className="mb-10">
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1"
                   style={{ borderBottom: '1px solid rgba(255,255,255,.22)', paddingBottom: 8 }}>
                <h2 className="tnum font-mono" style={{ color: 'var(--color-aqua)', fontSize: 'var(--text-lead)' }}>
                  {group.hub}
                </h2>
                <span style={{ color: 'var(--color-paper)', fontWeight: 500 }}>{group.city}</span>
                <span className="tnum font-mono" style={{ color: '#8F8CB4', fontSize: 'var(--text-small)' }}>
                  {count(group.total)} {group.total === 1 ? 'route' : 'routes'}
                </span>
                {group.carrier && group.carrier.code !== 'KX' && (
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: 'var(--text-micro)', letterSpacing: '0.14em',
                      color: group.carrier.accent,
                    }}
                  >
                    {group.carrier.name} base
                  </span>
                )}
              </div>

              <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                {group.arcs.map((a) => {
                  const on = active === a.route
                  const far = a.far
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
                          {far}
                        </span>
                        <span className="min-w-0 truncate" style={{ color: '#8F8CB4', fontSize: 'var(--text-micro)' }}>
                          {airportLabel(far)}
                        </span>
                        {carrier === 'ALL' && a.route.airline_code && a.route.airline_code !== 'KX' && (
                          <span
                            className="font-mono"
                            style={{
                              fontSize: 'var(--text-micro)', letterSpacing: '0.08em',
                              color: carrierByCode(a.route.airline_code)?.accent ?? '#B9B6D8', flex: 'none',
                            }}
                          >
                            {a.route.airline_code}
                          </span>
                        )}
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

              {group.total > group.arcs.length && (
                <p className="mt-3" style={{ color: '#8F8CB4', fontSize: 'var(--text-micro)' }}>
                  Showing {group.arcs.length} of {count(group.total)} from {group.hub}.
                </p>
              )}
            </section>
          ))}
        </div>
      </section>
    </div>
  )
}
