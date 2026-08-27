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

export interface Draft {
  tripType: TripType
  slices: Slice[]
  cabin: CabinCode
  adults: number
  passengers: Passenger[]
  contactEmail: string
  contactName: string
  pnr?: string
}

const EMPTY: Draft = {
  tripType: 'return',
  slices: [],
  cabin: 'ECONOMY',
  adults: 1,
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

  const total = useMemo(
    () => legs.reduce((sum, l) => sum + l.price_usd, 0) * Math.max(draft.adults, 1),
    [legs, draft.adults],
  )

  return (
    <BookingCtx.Provider value={{ draft, set, reset, setSliceFlights, total, legs, complete }}>
      {children}
    </BookingCtx.Provider>
  )
}

export function useBooking() {
  const ctx = useContext(BookingCtx)
  if (!ctx) throw new Error('useBooking must be used inside BookingProvider')
  return ctx
}
