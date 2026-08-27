import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { FlightResult } from '@/lib/queries'
import type { CabinCode } from '@/lib/cabins'

export interface Passenger {
  given_name: string
  family_name: string
  passenger_type: 'ADULT' | 'CHILD' | 'INFANT'
  date_of_birth?: string
}

export interface Draft {
  origin: string
  destination: string
  depart: string
  ret: string | null
  cabin: CabinCode
  adults: number
  outbound?: FlightResult
  inbound?: FlightResult
  passengers: Passenger[]
  contactEmail: string
  contactName: string
  pnr?: string
}

const EMPTY: Draft = {
  origin: '', destination: '', depart: '', ret: null,
  cabin: 'ECONOMY', adults: 1, passengers: [], contactEmail: '', contactName: '',
}

const KEY = 'kx.draft'

interface Ctx {
  draft: Draft
  set: (patch: Partial<Draft>) => void
  reset: () => void
  /** Total for everything selected so far, per the fares actually returned. */
  total: number
  /** How many legs the traveller is buying. */
  legs: FlightResult[]
}

const BookingCtx = createContext<Ctx | null>(null)

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const raw = sessionStorage.getItem(KEY)
      return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
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

  const reset = useCallback(() => {
    setDraft(EMPTY)
    try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
  }, [])

  const legs = useMemo(
    () => [draft.outbound, draft.inbound].filter(Boolean) as FlightResult[],
    [draft.outbound, draft.inbound],
  )

  const total = useMemo(
    () => legs.reduce((sum, l) => sum + l.price_usd, 0) * Math.max(draft.adults, 1),
    [legs, draft.adults],
  )

  return (
    <BookingCtx.Provider value={{ draft, set, reset, total, legs }}>
      {children}
    </BookingCtx.Provider>
  )
}

export function useBooking() {
  const ctx = useContext(BookingCtx)
  if (!ctx) throw new Error('useBooking must be used inside BookingProvider')
  return ctx
}
