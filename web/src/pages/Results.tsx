import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { FunnelPage } from '@/components/Funnel'
import { FlightRow } from '@/components/FlightRow'
import { searchFlights, type FlightResult } from '@/lib/queries'
import { useBooking } from '@/booking/BookingContext'
import { CABINS, type CabinCode } from '@/lib/cabins'
import { addDays, longDate, shortDate } from '@/lib/format'

type Leg = 'outbound' | 'inbound'

export default function Results() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { draft, set } = useBooking()

  const origin = params.get('from') ?? draft.origin
  const destination = params.get('to') ?? draft.destination
  const depart = params.get('depart') ?? draft.depart
  const ret = params.get('return') ?? draft.ret
  const cabin = (params.get('cabin') as CabinCode) ?? draft.cabin
  const adults = Number(params.get('adults') ?? draft.adults ?? 1)

  const [leg, setLeg] = useState<Leg>('outbound')
  const [rows, setRows] = useState<FlightResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const forOutbound = leg === 'outbound'
  const from = forOutbound ? origin : destination
  const to = forOutbound ? destination : origin
  const date = forOutbound ? depart : (ret ?? depart)

  useEffect(() => {
    set({ origin, destination, depart, ret, cabin, adults })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination, depart, ret, cabin, adults])

  useEffect(() => {
    let live = true
    setRows(null)
    setError(null)
    if (!from || !to || !date) { setError('Missing search details.'); return }
    searchFlights({ origin: from, destination: to, date, cabin, seats: adults })
      .then(({ data, error }) => {
        if (!live) return
        if (error) setError(error.message)
        else setRows(data ?? [])
      })
    return () => { live = false }
  }, [from, to, date, cabin, adults])

  function choose(f: FlightResult) {
    if (forOutbound) {
      set({ outbound: f })
      if (ret) setLeg('inbound')
      else navigate('/passengers')
    } else {
      set({ inbound: f })
      navigate('/passengers')
    }
  }

  const ready = draft.outbound && (!ret || draft.inbound)

  return (
    <FunnelPage title={forOutbound ? 'Choose your outbound flight' : 'Choose your return flight'}>
      <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <p style={{ fontSize: 'var(--text-lead)' }}>
          <strong>{from}</strong> → <strong>{to}</strong>
        </p>
        <p style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
          {longDate(date)} · {CABINS[cabin]?.longName ?? 'Economy'} · {adults}{' '}
          {adults === 1 ? 'passenger' : 'passengers'}
        </p>
        <Link to="/" className="kx-navlink ml-auto" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
          Change search
        </Link>
      </div>

      {ret && (
        <div className="mb-4 flex gap-2" role="tablist" aria-label="Trip legs">
          {(['outbound', 'inbound'] as Leg[]).map((l) => (
            <button
              key={l}
              role="tab"
              aria-selected={leg === l}
              onClick={() => setLeg(l)}
              className="font-mono uppercase"
              style={{
                fontSize: 'var(--text-micro)', letterSpacing: '0.14em',
                padding: '8px 12px', minHeight: 40, borderRadius: 'var(--radius-edge)',
                background: leg === l ? 'var(--color-paper-sunk)' : 'transparent',
                border: 'var(--rule)',
                color: 'var(--color-ink)',
              }}
            >
              {l === 'outbound' ? `Out ${shortDate(depart)}` : `Back ${shortDate(ret)}`}
              {(l === 'outbound' ? draft.outbound : draft.inbound) ? ' ✓' : ''}
            </button>
          ))}
        </div>
      )}

      {/* loading: skeletons at the real row height, so nothing jumps */}
      {rows === null && !error && (
        <ul aria-busy="true" style={{ borderTop: 'var(--rule)' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} style={{ height: 108, borderBottom: 'var(--rule)' }}>
              <div className="h-full w-full animate-pulse" style={{ background: 'var(--color-paper-sunk)', opacity: 0.5 }} />
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p style={{ color: 'var(--color-danger)', borderLeft: '2px solid var(--color-danger)', paddingLeft: 12 }}>
          {error}{' '}
          <button className="underline" onClick={() => location.reload()} style={{ minHeight: 44 }}>Try again</button>
        </p>
      )}

      {rows && rows.length > 0 && (
        <>
          <p className="sr-only" role="status">{rows.length} flights found</p>
          <p className="mb-2" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
            {rows.length} {rows.length === 1 ? 'flight' : 'flights'}, cheapest first.
          </p>
          <ul style={{ borderTop: '2px solid var(--color-ink)' }}>
            {rows.map((f) => (
              <FlightRow
                key={`${f.flight_id}-${f.direction}-${f.cabin_code}`}
                flight={f}
                selected={
                  forOutbound
                    ? draft.outbound?.flight_id === f.flight_id && draft.outbound?.direction === f.direction
                    : draft.inbound?.flight_id === f.flight_id && draft.inbound?.direction === f.direction
                }
                onSelect={choose}
                seatsLeft={f.seats_per_departure}
              />
            ))}
          </ul>
        </>
      )}

      {/* empty because the filter excluded everything: offer the nearest dates */}
      {rows && rows.length === 0 && (
        <div style={{ borderTop: '2px solid var(--color-ink)', paddingTop: 20 }}>
          <p style={{ fontSize: 'var(--text-lead)', marginBottom: 6 }}>
            No {CABINS[cabin]?.longName ?? ''} flights from {from} to {to} on {shortDate(date)}.
          </p>
          <p style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
            Karination does not fly this route every day. Try a nearby date:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[-2, -1, 1, 2, 3].map((d) => {
              const alt = addDays(date, d)
              const q = new URLSearchParams({
                from: origin, to: destination, depart: forOutbound ? alt : depart,
                cabin, adults: String(adults), ...(ret ? { return: forOutbound ? ret : alt } : {}),
              })
              return (
                <Link
                  key={d}
                  to={`/search?${q}`}
                  className="tnum font-mono"
                  style={{
                    fontSize: 'var(--text-small)', padding: '10px 12px', minHeight: 44,
                    border: 'var(--rule)', borderRadius: 'var(--radius-edge)',
                    display: 'inline-flex', alignItems: 'center',
                  }}
                >
                  {shortDate(alt)}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {ready && (
        <div className="mt-6">
          <button
            onClick={() => navigate('/passengers')}
            className="font-mono uppercase"
            style={{
              background: 'var(--color-ink)', color: 'var(--color-paper)',
              padding: '14px 22px', minHeight: 52, letterSpacing: '0.16em',
              fontSize: 'var(--text-small)', borderRadius: 'var(--radius-edge)',
            }}
          >
            Continue to passengers
          </button>
        </div>
      )}
    </FunnelPage>
  )
}
