import { useState } from 'react'
import { findBooking } from '@/lib/queries'
import { cabin } from '@/lib/cabins'
import { longDate, price, time } from '@/lib/format'

interface BookingRow {
  pnr: string
  contact_email: string
  contact_name: string | null
  booking_status: string
  total_amount_usd: number
  segment_order: number
  travel_date: string
  direction: string
  flight_number: number
  operating_airline_code: string | null
  operating_airline_name: string | null
  origin_iata: string
  destination_iata: string
  departure_time: string
  arrival_time: string
  arrival_date: string | null
  cabin_code: string
  cabin_name: string
  segment_price_usd: number
  aircraft_model: string | null
  passenger_count: number
}

export default function Manage() {
  const [pnr, setPnr] = useState('')
  const [email, setEmail] = useState('')
  const [rows, setRows] = useState<BookingRow[] | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    setMessage(null)
    const { data, error } = await findBooking(pnr.trim().toUpperCase(), email.trim())
    if (error) {
      setState('error')
      setMessage('We could not reach the booking system. Try again in a moment.')
      return
    }
    const list = (data ?? []) as BookingRow[]
    setRows(list)
    setState('done')
    if (list.length === 0) {
      setMessage(
        'No booking matches that reference and email. Check both — the reference is six characters, and the email must be the one the booking was made with.',
      )
    }
  }

  const b = rows?.[0]

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
      <h1 className="font-display" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.05 }}>
        Manage your booking
      </h1>
      <p className="mt-3 mb-8" style={{ color: 'var(--color-ink-mute)', maxWidth: '46ch' }}>
        Enter the six-character reference from your confirmation and the email
        address you booked with. You need both.
      </p>

      <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <label className="block">
          <span className="kx-label">Booking reference</span>
          <input
            className="kx-input tnum font-mono"
            value={pnr}
            onChange={(e) => setPnr(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="ABC123"
            style={{ letterSpacing: '0.18em', textTransform: 'uppercase' }}
            autoComplete="off"
          />
        </label>
        <label className="block">
          <span className="kx-label">Email</span>
          <input
            className="kx-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <button
          type="submit"
          disabled={state === 'loading' || pnr.length < 6 || !email}
          className="font-mono uppercase"
          style={{
            background: pnr.length >= 6 && email ? 'var(--color-ink)' : 'var(--color-paper-sunk)',
            color: pnr.length >= 6 && email ? 'var(--color-paper)' : 'var(--color-ink-faint)',
            padding: '0 20px', minHeight: 52, letterSpacing: '0.16em',
            fontSize: 'var(--text-small)', borderRadius: 'var(--radius-edge)',
          }}
        >
          {state === 'loading' ? 'Looking…' : 'Find booking'}
        </button>
      </form>

      {message && (
        <p
          className="mt-6"
          role="status"
          style={{ color: 'var(--color-ink-mute)', borderLeft: '2px solid var(--color-warn)', paddingLeft: 12 }}
        >
          {message}
        </p>
      )}

      {b && rows && rows.length > 0 && (
        <div
          className="mt-10"
          style={{
            border: 'var(--rule)',
            borderTop: `4px solid ${cabin(b.cabin_code).hue}`,
            borderRadius: 'var(--radius-soft)',
            padding: '24px',
          }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="tnum font-mono" style={{ fontSize: '1.8rem', letterSpacing: '0.16em', fontWeight: 500 }}>
              {b.pnr}
            </p>
            <span
              className="font-mono uppercase"
              style={{
                fontSize: 'var(--text-micro)', letterSpacing: '0.16em',
                color: b.booking_status === 'CONFIRMED' ? 'var(--color-ok)' : 'var(--color-ink-mute)',
              }}
            >
              {b.booking_status}
            </span>
          </div>
          <p style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
            {b.contact_name} · {b.passenger_count} {b.passenger_count === 1 ? 'passenger' : 'passengers'}
          </p>

          {rows.map((seg) => (
            <div key={seg.segment_order} className="mt-6 pt-5" style={{ borderTop: 'var(--rule)' }}>
              <p
                className="font-mono uppercase"
                style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.16em', color: 'var(--color-ink-faint)' }}
              >
                {seg.direction === 'OUTBOUND' ? 'Outbound' : 'Return'} ·{' '}
                {seg.operating_airline_code ?? 'KX'} {seg.flight_number} · {seg.cabin_name}
              </p>
              <p className="mt-1" style={{ fontWeight: 600 }}>{longDate(seg.travel_date)}</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4">
                <span className="tnum font-mono" style={{ fontSize: 'var(--text-time)', fontWeight: 500 }}>
                  {time(seg.departure_time)}
                </span>
                <span style={{ color: 'var(--color-ink-faint)' }}>—</span>
                <span className="tnum font-mono" style={{ fontSize: 'var(--text-time)', fontWeight: 500 }}>
                  {time(seg.arrival_time)}
                </span>
              </div>
              <p style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
                {seg.origin_iata} → {seg.destination_iata}
                {seg.aircraft_model ? ` · ${seg.aircraft_model}` : ''}
              </p>
            </div>
          ))}

          <div className="mt-6 flex items-baseline justify-between pt-4" style={{ borderTop: '1px solid var(--color-ink)' }}>
            <span style={{ fontWeight: 600 }}>Total paid</span>
            <span className="tnum font-mono" style={{ fontSize: '1.4rem', fontWeight: 500 }}>
              {price(b.total_amount_usd)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
