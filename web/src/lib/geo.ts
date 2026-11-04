/**
 * Geography for the route map.
 *
 * Three rules run through all of this:
 *
 * 1. **Everything is looked up by IATA code.** The database keys every leg on
 *    `origin_iata`/`destination_iata`, so this module takes codes, not
 *    coordinates, and owns the code → coordinate step in one place.
 * 2. **Arcs are rendered through `geoPath`, never plotted point by point.**
 *    Projecting the samples yourself and joining them with `L` commands draws a
 *    straight line back across the entire map the moment a route crosses the
 *    antimeridian — which SGN → LAX, SGN → EZE and every Pacific route do. The
 *    projection's own stream cuts the geometry at ±180° and emits two subpaths.
 *    That cut is the whole reason `greatCirclePath` looks the way it does.
 * 3. **Nothing here touches time.** Airport `offset` values are already baked
 *    into the times the API returns; see `src/lib/format.ts`.
 */

import { geoDistance, geoInterpolate, geoPath } from 'd3-geo'
import type { GeoPath, GeoProjection } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { FeatureCollection, GeoJsonProperties, GeometryObject, LineString } from 'geojson'
import landTopology from 'world-atlas/land-110m.json'
import { AIRPORTS } from '@/data/airports'
import type { Airport } from '@/data/airports'

/** Mean Earth radius in km, the same value the About-page stats were computed with. */
const EARTH_RADIUS_KM = 6371

/**
 * Segments per great-circle arc. 64 is enough that a half-circumference route
 * stays visually smooth at full-screen scale while keeping the path string
 * short — the network has 754 routes and they may all be on screen at once.
 */
const ARC_SEGMENTS = 64

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

/**
 * Every network airport by IATA code. Exact-match: keys are the uppercase codes
 * exactly as the database stores them. For lenient lookup use {@link getAirport}.
 */
export const airportByIata: Map<string, Airport> = new Map(
  AIRPORTS.map((airport) => [airport.iata, airport]),
)

/**
 * Look up one airport. Case-insensitive, so a code straight out of a URL
 * segment (`/routes/sgn-lax`) works without normalising at the call site.
 *
 * Returns `undefined` for anything the network does not serve — including codes
 * that are perfectly real airports elsewhere in the world.
 */
export function getAirport(iata: string): Airport | undefined {
  if (!iata) return undefined
  return airportByIata.get(iata.toUpperCase())
}

/** Cached path generators, one per projection instance. */
const pathByProjection = new WeakMap<GeoProjection, GeoPath>()

function pathFor(projection: GeoProjection): GeoPath {
  let path = pathByProjection.get(projection)
  if (!path) {
    path = geoPath(projection)
    pathByProjection.set(projection, path)
  }
  return path
}

/**
 * The SVG `d` attribute for the great-circle route between two airports.
 *
 * The arc is built as a GeoJSON `LineString` of {@link ARC_SEGMENTS} + 1
 * interpolated points and handed to `geoPath(projection)`, which streams it
 * through the projection's clipping pipeline. That pipeline is what makes
 * antimeridian-crossing routes correct: SGN → LAX comes back as two `M…`
 * subpaths, one running off the right edge and one arriving at the left, rather
 * than one line dragged back across Eurasia.
 *
 * Returns `null` if either code is unknown, and — because `geoPath` may reject
 * geometry that falls entirely outside the projection's clip extent — it can
 * also return `null` for a route that is simply not visible. Treat `null` as
 * "draw nothing", never as an error.
 *
 * @param from - origin IATA code
 * @param to - destination IATA code
 * @param projection - any configured d3 projection; the generator is memoised
 *   per projection object, so mutating it in place (`projection.scale(…)`)
 *   stays correct and costs nothing.
 */
export function greatCirclePath(
  from: string,
  to: string,
  projection: GeoProjection,
): string | null {
  const origin = getAirport(from)
  const destination = getAirport(to)
  if (!origin || !destination) return null

  const interpolate = geoInterpolate(
    [origin.lon, origin.lat],
    [destination.lon, destination.lat],
  )

  const coordinates: [number, number][] = []
  for (let i = 0; i <= ARC_SEGMENTS; i += 1) {
    coordinates.push(interpolate(i / ARC_SEGMENTS))
  }

  const arc: LineString = { type: 'LineString', coordinates }
  return pathFor(projection)(arc)
}

/**
 * The same great circle, cut into consecutive coloured-able pieces.
 *
 * Why this exists: a single path stroked with one `linearGradient` cannot
 * colour a great circle correctly. The gradient axis is a straight line, and
 * the arc is not — on a long route the arc bulges past the ends of the chord,
 * so both tips clamp to a flat colour. Worse, a route crossing the
 * antimeridian has its endpoints on opposite edges of the map, which makes
 * the chord run backwards across the entire world and the spectrum land
 * almost anywhere but on the route.
 *
 * Cutting the arc into pieces and giving each piece a colour taken from how
 * far along the arc it sits removes the geometry from the problem entirely.
 * Each piece is projected on its own, so the antimeridian cut is handled by
 * the projection exactly as it is for the whole arc.
 *
 * Returns the pieces in order, each with `t` — the midpoint's fraction along
 * the great circle, which is what the colour should be chosen from. Pieces
 * clipped away by the projection are dropped.
 */
export function greatCircleSegments(
  from: string,
  to: string,
  projection: GeoProjection,
  pieces = 24,
): Array<{ d: string; t: number }> {
  const origin = getAirport(from)
  const destination = getAirport(to)
  if (!origin || !destination) return []

  const interpolate = geoInterpolate(
    [origin.lon, origin.lat],
    [destination.lon, destination.lat],
  )
  const draw = pathFor(projection)

  // A few samples inside each piece, so a piece is still a smooth curve and
  // not a chord of its own.
  const perPiece = Math.max(2, Math.round(ARC_SEGMENTS / pieces))
  const out: Array<{ d: string; t: number }> = []

  for (let i = 0; i < pieces; i += 1) {
    const t0 = i / pieces
    const t1 = (i + 1) / pieces
    const coordinates: [number, number][] = []
    for (let j = 0; j <= perPiece; j += 1) {
      coordinates.push(interpolate(t0 + ((t1 - t0) * j) / perPiece))
    }
    const d = draw({ type: 'LineString', coordinates } as LineString)
    if (d) out.push({ d, t: (t0 + t1) / 2 })
  }
  return out
}

/**
 * Great-circle distance between two airports in whole km, on a sphere of
 * radius 6371 km. This is `geoDistance` (radians) × 6371, which is exactly the
 * formula `src/data/network-stats.sql` uses, so a distance rendered on the map
 * always agrees with the one on the About page.
 *
 * Returns `NaN` if either code is unknown — `0` would be indistinguishable from
 * a genuine same-airport pair. Guard with `Number.isFinite` before formatting.
 */
export function distanceKm(from: string, to: string): number {
  const origin = getAirport(from)
  const destination = getAirport(to)
  if (!origin || !destination) return Number.NaN

  const radians = geoDistance(
    [origin.lon, origin.lat],
    [destination.lon, destination.lat],
  )
  return Math.round(radians * EARTH_RADIUS_KM)
}

/**
 * Initial great-circle bearing from one airport to another, in degrees
 * clockwise from true north, normalised to `[0, 360)`.
 *
 * This is the *initial* bearing: on a long route it is not the bearing you
 * would read at the far end, and it is not the angle of the straight line
 * between the two projected screen points. Use it to orient an aircraft glyph
 * sitting at the origin, not to rotate a label along the drawn arc.
 *
 * Returns `NaN` if either code is unknown. Not rounded.
 */
export function bearingDeg(from: string, to: string): number {
  const origin = getAirport(from)
  const destination = getAirport(to)
  if (!origin || !destination) return Number.NaN

  const lat1 = origin.lat * DEG_TO_RAD
  const lat2 = destination.lat * DEG_TO_RAD
  const dLon = (destination.lon - origin.lon) * DEG_TO_RAD

  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)

  return (Math.atan2(y, x) * RAD_TO_DEG + 360) % 360
}

/** The shape of `world-atlas/land-110m.json`: one `land` GeometryCollection. */
type LandTopology = Topology<{ land: GeometryCollection<GeoJsonProperties> }>

let landCache: FeatureCollection<GeometryObject, GeoJsonProperties> | null = null

/**
 * World land masses as a GeoJSON `FeatureCollection`, decoded from
 * `world-atlas/land-110m.json` (Natural Earth 1:110m, ~56 kB of TopoJSON).
 *
 * The decode is memoised because `feature()` walks and delta-decodes every arc
 * in the topology — cheap once, wasteful on every render. The returned object
 * is shared: treat it as frozen and never mutate it in place.
 *
 * 110m is the right resolution for a whole-world route map. If a regional view
 * ever needs coastline detail, import `land-50m.json` in that view rather than
 * upgrading this one — the finer files are several times larger and this module
 * is imported by anything that draws an arc.
 */
export function landFeatures(): FeatureCollection<GeometryObject, GeoJsonProperties> {
  if (!landCache) {
    const topology = landTopology as unknown as LandTopology
    landCache = feature(topology, topology.objects.land)
  }
  return landCache
}

/**
 * The eight buckets the route map and the destination filters group by.
 *
 * They are marketing regions, not continents: they exist so the network reads
 * sensibly to a passenger, and a few countries sit where an atlas would not put
 * them. See {@link REGION_BY_COUNTRY} for the specific calls.
 */
export type RegionKey =
  | 'SEA'
  | 'EASTASIA'
  | 'SOUTHASIA'
  | 'MIDEAST'
  | 'EUROPE'
  | 'AFRICA'
  | 'OCEANIA'
  | 'AMERICAS'

/**
 * Regions in the order they should be listed: home region first, then outward.
 * Alphabetical order would put Africa above South East Asia, which is wrong for
 * a carrier whose entire network radiates from Vietnam.
 */
export const REGION_KEYS: RegionKey[] = [
  'SEA',
  'EASTASIA',
  'SOUTHASIA',
  'MIDEAST',
  'EUROPE',
  'AFRICA',
  'OCEANIA',
  'AMERICAS',
]

/** Display names for {@link RegionKey}. */
export const REGION_LABELS: Record<RegionKey, string> = {
  SEA: 'South East Asia',
  EASTASIA: 'East Asia',
  SOUTHASIA: 'South Asia',
  MIDEAST: 'Middle East & Central Asia',
  EUROPE: 'Europe',
  AFRICA: 'Africa',
  OCEANIA: 'Oceania',
  AMERICAS: 'Americas',
}

/**
 * Country code → region. Covers every country code among the network's
 * airports (148 in September 2026), plus the near neighbours most likely to
 * be added next. The Americas are listed in full: FORZA's long-haul growth
 * reached the Caribbean and Central America, and islands arrive one country
 * code at a time.
 *
 * Three judgement calls worth knowing about before you colour a map with this:
 *
 * - **Central Asia has no bucket of its own**, so KZ, UZ, TM, TJ and KG sit in
 *   `MIDEAST`, which is why that region is labelled "Middle East & Central
 *   Asia". This is the common airline grouping; an atlas would disagree.
 * - **Russia and Turkey are wholly `EUROPE`**, following IATA's region
 *   definitions. Geographically that misplaces Vladivostok, Khabarovsk and
 *   Irkutsk, which are further east than Beijing. If the map ever needs them in
 *   `EASTASIA`, override those three by IATA code at the call site rather than
 *   splitting RU here — the region is a country-level fact everywhere else.
 * - **Egypt is `AFRICA`**, not `MIDEAST`. IATA puts it in the Middle East;
 *   passengers looking at a map do not. The Caucasus (GE, AM, AZ) is `EUROPE`
 *   on the same reasoning.
 *
 * `KS` is not an ISO 3166-1 code — the database uses it for Kosovo, where the
 * user-assigned code is normally `XK`. Both are mapped.
 */
export const REGION_BY_COUNTRY: Record<string, RegionKey> = {
  // South East Asia
  BN: 'SEA', ID: 'SEA', KH: 'SEA', LA: 'SEA', MM: 'SEA',
  MY: 'SEA', PH: 'SEA', SG: 'SEA', TH: 'SEA', VN: 'SEA',
  TL: 'SEA',

  // East Asia
  CN: 'EASTASIA', HK: 'EASTASIA', JP: 'EASTASIA', KR: 'EASTASIA',
  MN: 'EASTASIA', MO: 'EASTASIA', TW: 'EASTASIA', KP: 'EASTASIA',

  // South Asia
  AF: 'SOUTHASIA', BD: 'SOUTHASIA', IN: 'SOUTHASIA', LK: 'SOUTHASIA',
  MV: 'SOUTHASIA', PK: 'SOUTHASIA', BT: 'SOUTHASIA', NP: 'SOUTHASIA',

  // Middle East, and Central Asia with it
  AE: 'MIDEAST', BH: 'MIDEAST', IQ: 'MIDEAST', IR: 'MIDEAST', JO: 'MIDEAST',
  KW: 'MIDEAST', OM: 'MIDEAST', QA: 'MIDEAST', SA: 'MIDEAST', SY: 'MIDEAST',
  KG: 'MIDEAST', KZ: 'MIDEAST', TJ: 'MIDEAST', TM: 'MIDEAST', UZ: 'MIDEAST',
  IL: 'MIDEAST', LB: 'MIDEAST', PS: 'MIDEAST', YE: 'MIDEAST',

  // Europe, including Turkey, Russia and the Caucasus
  AL: 'EUROPE', AM: 'EUROPE', AT: 'EUROPE', AZ: 'EUROPE', BA: 'EUROPE',
  BE: 'EUROPE', BG: 'EUROPE', BY: 'EUROPE', CH: 'EUROPE', CY: 'EUROPE',
  CZ: 'EUROPE', DE: 'EUROPE', DK: 'EUROPE', EE: 'EUROPE', FI: 'EUROPE',
  FR: 'EUROPE', GB: 'EUROPE', GE: 'EUROPE', GR: 'EUROPE', HR: 'EUROPE',
  HU: 'EUROPE', IT: 'EUROPE', KS: 'EUROPE', LT: 'EUROPE', LU: 'EUROPE',
  LV: 'EUROPE', ME: 'EUROPE', MK: 'EUROPE', MT: 'EUROPE', NL: 'EUROPE',
  NO: 'EUROPE', PL: 'EUROPE', PT: 'EUROPE', RO: 'EUROPE', RS: 'EUROPE',
  RU: 'EUROPE', SE: 'EUROPE', SI: 'EUROPE', SK: 'EUROPE', TR: 'EUROPE',
  UA: 'EUROPE',
  ES: 'EUROPE', IE: 'EUROPE', IS: 'EUROPE', MD: 'EUROPE', XK: 'EUROPE',

  // Africa
  BI: 'AFRICA', BW: 'AFRICA', CD: 'AFRICA', DJ: 'AFRICA', DZ: 'AFRICA',
  EG: 'AFRICA', ET: 'AFRICA', KE: 'AFRICA', KM: 'AFRICA', LY: 'AFRICA',
  MG: 'AFRICA', MZ: 'AFRICA', NG: 'AFRICA', RW: 'AFRICA', SC: 'AFRICA',
  SS: 'AFRICA', TN: 'AFRICA', TZ: 'AFRICA', UG: 'AFRICA', ZA: 'AFRICA',
  ZM: 'AFRICA', ZW: 'AFRICA',
  AO: 'AFRICA', CI: 'AFRICA', CM: 'AFRICA', GH: 'AFRICA', MA: 'AFRICA',
  NA: 'AFRICA', SD: 'AFRICA', SN: 'AFRICA',

  // Oceania
  AU: 'OCEANIA', FJ: 'OCEANIA', GU: 'OCEANIA', KI: 'OCEANIA', NC: 'OCEANIA',
  NZ: 'OCEANIA', PG: 'OCEANIA', SB: 'OCEANIA', VU: 'OCEANIA',
  PF: 'OCEANIA', TO: 'OCEANIA', WS: 'OCEANIA',
  MP: 'OCEANIA',

  // Americas: North America
  AR: 'AMERICAS', US: 'AMERICAS',
  BR: 'AMERICAS', CA: 'AMERICAS', CL: 'AMERICAS', CO: 'AMERICAS',
  MX: 'AMERICAS', PE: 'AMERICAS',
  BM: 'AMERICAS', PM: 'AMERICAS',
  // Central America
  BZ: 'AMERICAS', CR: 'AMERICAS', GT: 'AMERICAS', HN: 'AMERICAS', NI: 'AMERICAS',
  PA: 'AMERICAS', SV: 'AMERICAS',
  // The Caribbean
  AG: 'AMERICAS', AI: 'AMERICAS', AW: 'AMERICAS', BB: 'AMERICAS', BL: 'AMERICAS',
  BQ: 'AMERICAS', BS: 'AMERICAS', CU: 'AMERICAS', CW: 'AMERICAS', DM: 'AMERICAS',
  DO: 'AMERICAS', GD: 'AMERICAS', GP: 'AMERICAS', HT: 'AMERICAS', JM: 'AMERICAS',
  KN: 'AMERICAS', KY: 'AMERICAS', LC: 'AMERICAS', MF: 'AMERICAS', MQ: 'AMERICAS',
  MS: 'AMERICAS', PR: 'AMERICAS', SX: 'AMERICAS', TC: 'AMERICAS', TT: 'AMERICAS',
  VC: 'AMERICAS', VG: 'AMERICAS', VI: 'AMERICAS',
  // the rest of South America
  BO: 'AMERICAS', EC: 'AMERICAS', FK: 'AMERICAS', GF: 'AMERICAS', GY: 'AMERICAS',
  PY: 'AMERICAS', SR: 'AMERICAS', UY: 'AMERICAS', VE: 'AMERICAS',
}

/** For an IATA code the network does not serve at all: the home region. */
const DEFAULT_REGION: RegionKey = 'SEA'

/**
 * The region of an airport whose country is not in {@link REGION_BY_COUNTRY}:
 * that of the nearest airport whose country is.
 *
 * This used to be a flat default of South East Asia, on the theory that any
 * new destination would be somewhere near Vietnam. FORZA's September 2026
 * schedule disproved it: 42 airports in 28 Caribbean, Central and South
 * American countries arrived unmapped, and the route map painted Havana and
 * Punta Cana as South East Asia. The nearest mapped airport cannot be that
 * wrong — an unmapped island takes the region of the coast beside it. The
 * table stays the real answer; development builds say which code to add.
 */
const inferredRegion = new Map<string, RegionKey>()

function nearestMappedRegion(airport: Airport): RegionKey {
  const cached = inferredRegion.get(airport.iata)
  if (cached) return cached
  let region = DEFAULT_REGION
  let nearest = Infinity
  for (const other of AIRPORTS) {
    const known = REGION_BY_COUNTRY[other.country]
    if (!known) continue
    const km = distanceKm(airport.iata, other.iata)
    if (km < nearest) { nearest = km; region = known }
  }
  inferredRegion.set(airport.iata, region)
  if (import.meta.env.DEV) {
    console.warn(
      `regionOf: no region for country ${airport.country} (${airport.iata}); ` +
      `using the nearest mapped airport's, ${region}. Add it to REGION_BY_COUNTRY.`,
    )
  }
  return region
}

/**
 * The region an airport belongs to, resolved through its country code.
 *
 * An unmapped country takes the region of the nearest mapped airport; an IATA
 * code outside the network returns {@link DEFAULT_REGION}. Neither throws, so
 * this is safe to call while rendering.
 */
export function regionOf(iata: string): RegionKey {
  const airport = getAirport(iata)
  if (!airport) return DEFAULT_REGION
  return REGION_BY_COUNTRY[airport.country] ?? nearestMappedRegion(airport)
}
