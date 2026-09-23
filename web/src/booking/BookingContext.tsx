import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { FlightResult } from '@/lib/queries'
import type { CabinCode } from '@/lib/cabins'

export interface Passenger {
  given_name: string
  family_name: string
  passenger_type: 'ADULT' | 'CHILD' | 'INFANT'
  date_of_birth?: string
}

export type TripType = 'return' | 'oneway' | 'multi'

/**
 * A slice is one journey the traveller asked for -- "Sài Gòn to Bangkok on
 * the 10th". What fills it may be a single flight or a connection of two or
 * three, which is why `flights` is an array.
 *
 * This is the airline model (slice / segment) rather than outbound-and-
 * inbound, and it is the same shape for all three trip types: a one-way is
 * one slice, a return is two, a multi-city is however many were asked for.
 * Connections then need no separate concept at all -- they are simply a
 * slice whose `flights` has more than one entry.
 */
export interface Slice {
  from: string
  to: string
  date: string
  /** What the traveller chose for this slice. Empty until they pick. */
  flights?: FlightResult[]
}

/**
 * What each passenger type pays, as a fraction of the adult fare.
 *
 * Mirrors kx_pax_fare_factor() in the database, which is what actually
 * prices the tickets. If one changes the other must: the number shown before
 * paying has to be the number charged.
 */
export const PAX_FARE_FACTOR: Record<Passenger['passenger_type'], number> = {
  ADULT: 1,
  CHILD: 0.75,
  INFANT: 0.1,
}

export interface Draft {
  tripType: TripType
  slices: Slice[]
  cabin: CabinCode
  adults: number
  children: number
  /** Under two, travelling on an adult's lap. Takes no seat. */
  infants: number
  passengers: Passenger[]
  contactEmail: string
  contactName: string
  pnr?: string
  /** Whether to put this booking on the signed-in member's RainbowOne account. */
  addToAccount?: boolean
  /** What came back when we tried, so the confirmation can say so. */
  accountResult?: { ok: boolean; message: string }
}

const EMPTY: Draft = {
  tripType: 'return',
  slices: [],
  cabin: 'ECONOMY',
  adults: 1,
  children: 0,
  infants: 0,
  passengers: [],
  contactEmail: '',
  contactName: '',
}

const KEY = 'kx.draft'

interface Ctx {
  draft: Draft
  set: (patch: Partial<Draft>) => void
  reset: () => void
  /** Replace what is booked for one slice. */
  setSliceFlights: (index: number, flights: FlightResult[] | undefined) => void
  /** Total for everything selected so far, per the fares actually returned. */
  total: number
  /** Every flight being bought, in travel order. What the funnel sells. */
  legs: FlightResult[]
  /** True once every slice has something in it. */
  complete: boolean
  /** Seats needed. Infants travel on a lap, so they are not counted. */
  seats: number
  /** Everyone travelling, infants included. */
  headCount: number
}

const BookingCtx = createContext<Ctx | null>(null)

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const raw = sessionStorage.getItem(KEY)
      if (!raw) return EMPTY
      const saved = JSON.parse(raw) as Partial<Draft>
      // Guard against a draft written by an older build, where the shape was
      // outbound/inbound: without this the funnel would restore a draft with
      // no slices and quietly send the traveller back to the start.
      if (!Array.isArray(saved.slices)) return EMPTY
      return { ...EMPTY, ...saved }
    } catch {
      return EMPTY
    }
  })

  // survive a refresh mid-funnel; a traveller who reloads must not lose the
  // flight they picked three steps ago
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(draft))
    } catch {
      /* private mode: the funnel still works, it just will not survive reload */
    }
  }, [draft])

  const set = useCallback((patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
  }, [])

  const setSliceFlights = useCallback((index: number, flights: FlightResult[] | undefined) => {
    setDraft((d) => {
      const slices = d.slices.map((s, i) => (i === index ? { ...s, flights } : s))
      return { ...d, slices }
    })
  }, [])

  const reset = useCallback(() => {
    setDraft(EMPTY)
    try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
  }, [])

  const legs = useMemo(
    () => draft.slices.flatMap((s) => s.flights ?? []),
    [draft.slices],
  )

  const complete = useMemo(
    () => draft.slices.length > 0 && draft.slices.every((s) => (s.flights?.length ?? 0) > 0),
    [draft.slices],
  )

  const seats = useMemo(
    () => Math.max(draft.adults, 1) + Math.max(draft.children, 0),
    [draft.adults, draft.children],
  )

  const headCount = useMemo(
    () => seats + Math.max(draft.infants, 0),
    [seats, draft.infants],
  )

  /**
   * Priced the way the database prices it: per passenger, per leg, each
   * ticket rounded on its own. Multiplying a leg total by a head count would
   * drift from the charged amount once a child or infant is aboard.
   */
  const total = useMemo(() => {
    const counts: Array<[Passenger['passenger_type'], number]> = [
      ['ADULT', Math.max(draft.adults, 1)],
      ['CHILD', Math.max(draft.children, 0)],
      ['INFANT', Math.max(draft.infants, 0)],
    ]
    return legs.reduce(
      (sum, leg) =>
        sum +
        counts.reduce(
          (legSum, [type, n]) => legSum + n * Math.round(leg.price_usd * PAX_FARE_FACTOR[type]),
          0,
        ),
      0,
    )
  }, [legs, draft.adults, draft.children, draft.infants])

  return (
    <BookingCtx.Provider
      value={{ draft, set, reset, setSliceFlights, total, legs, complete, seats, headCount }}
    >
      {children}
    </BookingCtx.Provider>
  )
}

export function useBooking() {
  const ctx = useContext(BookingCtx)
  if (!ctx) throw new Error('useBooking must be used inside BookingProvider')
  return ctx
}
