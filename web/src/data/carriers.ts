import type { CabinCode } from '@/lib/cabins'

/**
 * The KarinationGroup carriers, as a passenger meets them.
 *
 * The database is the authority on what each one flies. This module holds
 * only the things a schedule cannot tell you: how a carrier is described,
 * what it allows you to bring, and the note shown when it operates a flight
 * sold under someone else's code.
 */

export interface Allowance {
  /** Checked baggage included in the fare. */
  checked: string
  /** What comes into the cabin. */
  hand: string
}

export interface GroupCarrier {
  code: string
  name: string
  country: string
  alliance: string | null
  /** One line, for a list. */
  role: string
  /** The paragraph on the About page and the fleet section. */
  blurb: string
  /** Shown on any flight this carrier operates. */
  operatedNote: string
  baggage: Record<CabinCode, Allowance>
  /** Where it is based. */
  hubs: string[]
  accent: string
  accentInk: string
}

export const KARINATION: GroupCarrier = {
  code: 'KX',
  name: 'Karination',
  country: 'VN',
  alliance: 'Echo Aegis',
  role: 'The full-service airline of the group',
  blurb:
    'Karination flies from five hubs along the length of Vietnam to 481 destinations, in four cabins, with a full-flat bed in Business on every long-haul sector — including the narrowbodies, which is unusual.',
  operatedNote: 'Operated by Karination.',
  hubs: ['SGN', 'HAN', 'DAD', 'CXR', 'PQC'],
  accent: 'var(--color-spectrum-teal)',
  accentInk: 'var(--color-spectrum-teal-ink)',
  baggage: {
    FIRST: { checked: '3 × 32 kg', hand: '2 pieces, 10 kg' },
    BUSINESS: { checked: '2 × 32 kg', hand: '2 pieces, 10 kg' },
    PREMIUM_ECONOMY: { checked: '2 × 23 kg', hand: '1 piece, 7 kg' },
    ECONOMY: { checked: '1 × 23 kg', hand: '1 piece, 7 kg' },
  },
}

/**
 * FORZA's allowances sit deliberately between Karination's and a low-cost
 * carrier's. The line that matters is that every FORZA fare still includes a
 * checked bag: an LCC includes none and sells you one at the gate. What is
 * tighter is the weight — 20 kg rather than 23 in Economy, one bag rather
 * than two in the premium cabins.
 */
export const FORZA: GroupCarrier = {
  code: 'Z4',
  name: 'FORZA',
  country: 'VN',
  alliance: 'Echo Proxima',
  role: 'Lower-cost regional, and a fast-growing long-haul network',
  blurb:
    'FORZA flies from thirteen provincial airports Karination does not base at, on everything from a Dash 8 to a 787-10. It began as a regional carrier and its long-haul network is growing quickly — the Dreamliners and A330-900s now reach Europe, Africa and the Pacific.',
  operatedNote:
    'This flight is operated by FORZA, a KarinationGroup member of Echo Proxima.',
  hubs: ['CXR', 'DLI', 'PQC', 'DIN', 'HUI', 'VCL', 'UIH', 'CAH', 'PXU', 'VCA', 'VCS', 'BMV', 'HPH'],
  accent: 'var(--color-spectrum-amber)',
  accentInk: 'var(--color-spectrum-amber-ink)',
  baggage: {
    FIRST: { checked: '2 × 32 kg', hand: '2 pieces, 10 kg' },
    BUSINESS: { checked: '2 × 25 kg', hand: '1 piece, 10 kg' },
    PREMIUM_ECONOMY: { checked: '1 × 25 kg', hand: '1 piece, 7 kg' },
    ECONOMY: { checked: '1 × 20 kg', hand: '1 piece, 7 kg' },
  },
}

/**
 * Sonder is in the group's own records — Korean, based at Incheon — but has
 * no aircraft or schedule yet, so it is announced rather than sold.
 */
export const SONDER = {
  code: 'SD',
  name: 'Sonder',
  country: 'KR',
  hub: 'ICN',
} as const

export const CARRIERS: GroupCarrier[] = [KARINATION, FORZA]

const BY_CODE = new Map(CARRIERS.map((c) => [c.code, c]))

export function carrierByCode(code: string | null | undefined): GroupCarrier | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined
}

/**
 * The note to show on a flight, or null when there is nothing worth saying.
 *
 * Karination operating its own flight needs no note — that is the default
 * expectation and repeating it on every row is noise. Anything else does.
 */
export function operatedNoteFor(code: string | null | undefined): string | null {
  const carrier = carrierByCode(code)
  if (!carrier || carrier.code === 'KX') return null
  return carrier.operatedNote
}

/**
 * Which carrier's baggage rules govern a journey.
 *
 * A KarinationGroup itinerary can mix carriers -- Munich to Hải Phòng is
 * Karination as far as Phú Quốc and FORZA onward -- and a bag checked at the
 * start has to satisfy every airline that will carry it. So the tightest
 * allowance on the itinerary applies to the whole of it, which is the same
 * most-restrictive-carrier rule every interline booking uses.
 *
 * Returns the governing carrier, and whether that is stricter than what the
 * traveller would otherwise have had.
 */
export function governingCarrier(airlineCodes: Array<string | null | undefined>): {
  carrier: GroupCarrier
  mixed: boolean
} {
  const codes = new Set(
    airlineCodes.map((c) => (c ?? '').toUpperCase()).filter(Boolean),
  )
  const carrier = codes.has('Z4') ? FORZA : KARINATION
  // "mixed" means the rule is not simply the operating carrier's own: a
  // Karination flight is in there too, so the allowance is a surprise worth
  // stating rather than a given.
  return { carrier, mixed: codes.has('Z4') && codes.has('KX') }
}
