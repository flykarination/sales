/**
 * Cabin = hue.
 *
 * This is the load-bearing idea of the whole interface. Karination's promise
 * is "Colour Your Dreams", so colour is not decoration here — it is the
 * information architecture. A traveller learns four hues once and then reads
 * every fare table, every map arc and every boarding pass by colour alone.
 *
 * Because colour carries meaning, it can never be the ONLY carrier of it:
 * every swatch is paired with its cabin name in text, per WCAG 1.4.1.
 */

export type CabinCode = 'FIRST' | 'BUSINESS' | 'PREMIUM_ECONOMY' | 'ECONOMY'

export interface Cabin {
  code: CabinCode
  /** Short label for dense rows. */
  name: string
  /** Full label for headings and screen readers. */
  longName: string
  /** Bright hue — legible on the indigo ground only. */
  hue: string
  /** Darkened to clear 4.5:1 on paper without shifting hue. */
  ink: string
  /** Tint for chips and table bands on paper. */
  wash: string
  /** Ascending, so First sorts first. Matches cabin_classes.sort_order. */
  order: number
}

export const CABINS: Record<CabinCode, Cabin> = {
  FIRST: {
    code: 'FIRST',
    name: 'First',
    longName: 'First Class',
    hue: 'var(--color-spectrum-magenta)',
    ink: 'var(--color-spectrum-magenta-ink)',
    wash: 'color-mix(in oklab, var(--color-spectrum-magenta) 12%, transparent)',
    order: 1,
  },
  BUSINESS: {
    code: 'BUSINESS',
    name: 'Business',
    longName: 'Business Class',
    hue: 'var(--color-spectrum-violet)',
    ink: 'var(--color-spectrum-violet-ink)',
    wash: 'color-mix(in oklab, var(--color-spectrum-violet) 12%, transparent)',
    order: 2,
  },
  PREMIUM_ECONOMY: {
    code: 'PREMIUM_ECONOMY',
    name: 'Premium',
    longName: 'Premium Economy',
    hue: 'var(--color-spectrum-amber)',
    ink: 'var(--color-spectrum-amber-ink)',
    wash: 'color-mix(in oklab, var(--color-spectrum-amber) 14%, transparent)',
    order: 3,
  },
  ECONOMY: {
    code: 'ECONOMY',
    name: 'Economy',
    longName: 'Economy',
    hue: 'var(--color-spectrum-teal)',
    ink: 'var(--color-spectrum-teal-ink)',
    wash: 'color-mix(in oklab, var(--color-spectrum-teal) 14%, transparent)',
    order: 4,
  },
}

/** Always First → Economy. Never alphabetical. */
export const CABIN_ORDER: CabinCode[] = ['FIRST', 'BUSINESS', 'PREMIUM_ECONOMY', 'ECONOMY']

export function cabin(code: string | null | undefined): Cabin {
  return CABINS[(code ?? 'ECONOMY') as CabinCode] ?? CABINS.ECONOMY
}

/**
 * Region hues for the route map, drawn from the same six-hue spectrum as the
 * cabins so the whole site shares one colour vocabulary, plus the turquoise
 * for Oceania and sky blue for the Americas: eight regions need eight hues,
 * and until sky blue the Americas shared rose with the Middle East.
 */
export type RegionKey =
  | 'SEA' | 'EASTASIA' | 'SOUTHASIA' | 'MIDEAST'
  | 'EUROPE' | 'AFRICA' | 'OCEANIA' | 'AMERICAS'

export const REGION_STYLE: Record<RegionKey, { label: string; hue: string; ink: string }> = {
  SEA:       { label: 'Southeast Asia', hue: 'var(--color-spectrum-teal)',    ink: 'var(--color-spectrum-teal-ink)' },
  EASTASIA:  { label: 'East Asia',      hue: 'var(--color-spectrum-lime)',    ink: 'var(--color-spectrum-lime-ink)' },
  SOUTHASIA: { label: 'South Asia',     hue: 'var(--color-spectrum-amber)',   ink: 'var(--color-spectrum-amber-ink)' },
  MIDEAST:   { label: 'Middle East',    hue: 'var(--color-spectrum-rose)',    ink: 'var(--color-spectrum-rose-ink)' },
  EUROPE:    { label: 'Europe',         hue: 'var(--color-spectrum-violet)',  ink: 'var(--color-spectrum-violet-ink)' },
  AFRICA:    { label: 'Africa',         hue: 'var(--color-spectrum-magenta)', ink: 'var(--color-spectrum-magenta-ink)' },
  OCEANIA:   { label: 'Oceania',        hue: 'var(--color-aqua-mid)',         ink: 'var(--color-aqua-deep)' },
  AMERICAS:  { label: 'The Americas',   hue: 'var(--color-skyblue)',          ink: 'var(--color-skyblue-ink)' },
}
