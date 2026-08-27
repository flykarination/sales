import type { Slice, TripType } from '@/booking/BookingContext'
import type { CabinCode } from '@/lib/cabins'

/**
 * The search URL is the single source of truth for what was asked for, so a
 * result page can be shared, bookmarked or reloaded and come back the same.
 *
 *   /search?trip=return&from=SGN&to=BKK&depart=2026-09-10&return=2026-09-20
 *   /search?trip=oneway&from=SGN&to=BKK&depart=2026-09-10
 *   /search?trip=multi&legs=SGN-BKK-2026-09-10_BKK-ICN-2026-09-14
 *
 * The one-way and return forms are the shape the site already used, and are
 * still read when `trip` is absent, so links written before multi-city
 * existed keep working.
 */

export interface SearchQuery {
  tripType: TripType
  slices: Slice[]
  cabin: CabinCode
  adults: number
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const IATA = /^[A-Z]{3}$/

/** `SGN-BKK-2026-09-10`, joined by `_`. */
function parseMultiLegs(raw: string): Slice[] {
  const out: Slice[] = []
  for (const part of raw.split('_')) {
    const m = part.trim().toUpperCase().match(/^([A-Z]{3})-([A-Z]{3})-(\d{4}-\d{2}-\d{2})$/)
    if (m) out.push({ from: m[1], to: m[2], date: m[3] })
  }
  return out
}

export function serialiseMultiLegs(slices: Slice[]): string {
  return slices.map((s) => `${s.from}-${s.to}-${s.date}`).join('_')
}

export function parseSearchQuery(params: URLSearchParams): SearchQuery {
  const cabin = (params.get('cabin')?.toUpperCase() as CabinCode) || 'ECONOMY'
  const adults = Math.min(Math.max(Number(params.get('adults') ?? 1) || 1, 1), 9)

  const legsParam = params.get('legs')
  const declared = params.get('trip') as TripType | null

  if (declared === 'multi' || (!declared && legsParam)) {
    const slices = parseMultiLegs(legsParam ?? '')
    if (slices.length > 0) return { tripType: 'multi', slices, cabin, adults }
  }

  const from = (params.get('from') ?? '').toUpperCase()
  const to = (params.get('to') ?? '').toUpperCase()
  const depart = params.get('depart') ?? ''
  const ret = params.get('return')

  const slices: Slice[] = []
  if (IATA.test(from) && IATA.test(to) && ISO.test(depart)) {
    slices.push({ from, to, date: depart })
    if (ret && ISO.test(ret) && declared !== 'oneway') {
      slices.push({ from: to, to: from, date: ret })
    }
  }
  return {
    tripType: declared ?? (slices.length > 1 ? 'return' : 'oneway'),
    slices,
    cabin,
    adults,
  }
}

/** Build the querystring for a search. The inverse of parseSearchQuery. */
export function searchQueryString(q: SearchQuery): string {
  const p = new URLSearchParams()
  p.set('trip', q.tripType)
  if (q.tripType === 'multi') {
    p.set('legs', serialiseMultiLegs(q.slices))
  } else {
    const [out, back] = q.slices
    if (out) {
      p.set('from', out.from)
      p.set('to', out.to)
      p.set('depart', out.date)
    }
    if (back) p.set('return', back.date)
  }
  p.set('cabin', q.cabin)
  p.set('adults', String(q.adults))
  return p.toString()
}

/** How this slice reads in a heading: "Sài Gòn to Bangkok". */
export function sliceLabel(s: Slice): string {
  return `${s.from} → ${s.to}`
}
