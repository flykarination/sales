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
  /**
   * How generous the allowance is, highest first. On an itinerary that mixes
   * carriers the lowest rank governs the whole journey. Carriers with the
   * same allowance share a rank, so mixing them says nothing.
   */
  baggageRank: number
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
  baggageRank: 2,
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
    'FORZA flies from thirteen provincial airports Karination does not base at, on everything from a Dash 8 to a 787-10. It began as a regional carrier and its long-haul network is growing quickly — the A350s, Dreamliners and A330-900s now reach Europe, Africa, the Pacific and across the Americas to the Caribbean.',
  operatedNote:
    'This flight is operated by FORZA, a KarinationGroup member of Echo Proxima.',
  hubs: ['CXR', 'DLI', 'PQC', 'DIN', 'HUI', 'VCL', 'UIH', 'CAH', 'PXU', 'VCA', 'VCS', 'BMV', 'HPH'],
  baggageRank: 1,
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
 * Sonder, the group's Korean carrier, based at Incheon.
 *
 * PROVISIONAL. The notice follows FORZA's wording exactly, minus the alliance
 * — the group's own records give Sonder none, and inventing one would be the
 * kind of claim this site does not make. Its colour and its allowances are
 * placeholders pending a decision on how Sonder is portrayed: the allowances
 * match Karination's, so on a mixed itinerary nothing changes and nothing is
 * shown, which is the least surprising default until that is settled.
 */
export const SONDER: GroupCarrier = {
  code: 'SD',
  name: 'Sonder',
  country: 'KR',
  alliance: null,
  role: 'The group’s Korean carrier',
  blurb:
    'Sonder flies from Incheon, on A350-1000s and 787-8s, to a network that looks like no one else’s: Ashgabat and Khartoum, Malta and Port Moresby, Boston and Sacramento.',
  operatedNote: 'This flight is operated by Sonder, a KarinationGroup member.',
  hubs: ['ICN'],
  baggageRank: 2,
  accent: 'var(--color-spectrum-magenta)',
  accentInk: 'var(--color-spectrum-magenta-ink)',
  baggage: {
    FIRST: { checked: '3 × 32 kg', hand: '2 pieces, 10 kg' },
    BUSINESS: { checked: '2 × 32 kg', hand: '2 pieces, 10 kg' },
    PREMIUM_ECONOMY: { checked: '2 × 23 kg', hand: '1 piece, 7 kg' },
    ECONOMY: { checked: '1 × 23 kg', hand: '1 piece, 7 kg' },
  },
}

export const CARRIERS: GroupCarrier[] = [KARINATION, FORZA, SONDER]

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
  const present = [...new Set(airlineCodes.map((c) => (c ?? '').toUpperCase()).filter(Boolean))]
    .map((c) => BY_CODE.get(c))
    .filter((c): c is GroupCarrier => Boolean(c))
  if (present.length === 0) return { carrier: KARINATION, mixed: false }

  // The tightest allowance on the journey governs all of it.
  const carrier = present.reduce((a, b) => (b.baggageRank < a.baggageRank ? b : a))
  // "mixed" means someone on this itinerary would have allowed more, so the
  // governing allowance is a surprise worth stating rather than a given.
  const mixed = present.some((c) => c.baggageRank > carrier.baggageRank)
  return { carrier, mixed }
}

/** True when a carrier allows less than Karination, the published default. */
export function isTighterThanDefault(carrier: GroupCarrier): boolean {
  return carrier.baggageRank < KARINATION.baggageRank
}
