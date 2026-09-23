import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StepIndicator } from '@/components/Funnel'
import { OperatedBy } from '@/components/OperatedBy'
import { useBooking } from '@/booking/BookingContext'
import { sliceHeading } from '@/booking/slices'
import { airportLabel } from '@/data/airports'
import { cabin } from '@/lib/cabins'
import { duration, longDate, price, time } from '@/lib/format'

export default function Confirmation() {
  const { draft, legs, total, reset } = useBooking()
  const navigate = useNavigate()

  useEffect(() => {
    if (!draft.pnr) navigate('/', { replace: true })
  }, [draft.pnr, navigate])

  useEffect(() => {
    document.getElementById('confirmed-heading')?.focus()
  }, [])

  if (!draft.pnr) return null
  /**
   * Where they are actually going.
   *
   * Not legs[0].destination — on a connecting itinerary that is the airport
   * they change at, so a Sài Gòn connection on the way to Auckland read
   * "You're going to SGN". The slice is what carries the intent: its `to` is
   * the city they asked for, whatever route gets them there. A multi-city
   * trip names each stop, dropping a final leg that only brings them home.
   */
  const destinationLine = (() => {
    const slices = draft.slices
    if (slices.length === 0) return airportLabel(legs[legs.length - 1]?.destination_iata ?? '')
    const stops = slices.map((s) => s.to)
    if (stops.length > 1 && stops[stops.length - 1] === slices[0].from) stops.pop()
    // the city, not the code: "You're going to Sacramento", not "SMF"
    const named = [...new Set(stops)].map((code) => airportLabel(code))
    if (named.length <= 1) return named[0] ?? ''
    return `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`
  })()


  const c = cabin(draft.cabin)

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-8">
      <StepIndicator />

      <h1
        id="confirmed-heading"
        tabIndex={-1}
        className="font-display"
        style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.05, outline: 'none' }}
      >
        You're going to {destinationLine}.
      </h1>
      <p className="mt-3" style={{ color: 'var(--color-ink-mute)', maxWidth: '48ch' }}>
        Your booking is confirmed. We've sent the details to{' '}
        <strong style={{ color: 'var(--color-ink)' }}>{draft.contactEmail}</strong>.
      </p>

      {/* the one thing they will screenshot */}
      <div
        className="mt-8"
        style={{
          border: 'var(--rule)',
          borderTop: `4px solid ${c.hue}`,
          borderRadius: 'var(--radius-soft)',
          overflow: 'hidden',
        }}
      >
        <div className="px-6 py-7 text-center" style={{ background: 'var(--color-paper-sunk)' }}>
          <p
            className="font-mono uppercase"
            style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.24em', color: 'var(--color-ink-mute)' }}
          >
            Booking reference
          </p>
          <p
            className="tnum font-mono"
            style={{ fontSize: 'clamp(2.4rem, 9vw, 3.6rem)', letterSpacing: '0.22em', fontWeight: 500, lineHeight: 1.2 }}
          >
            {draft.pnr}
          </p>
          <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
            Keep this. You'll need it and your email to manage the booking.
          </p>

          {/* Whether it reached the member's account. Said either way: a
              booking that quietly did not arrive there is worse than one
              that says so and offers the way to fix it. */}
          {draft.accountResult && (
            <p
              className="mt-3"
              style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}
            >
              {draft.accountResult.ok ? (
                <>
                  {draft.accountResult.message}{' '}
                  <Link to="/account" className="underline">Your trips</Link>
                </>
              ) : (
                <>
                  {draft.accountResult.message} You can add it from{' '}
                  <Link to="/manage" className="underline">manage booking</Link>.
                </>
              )}
            </p>
          )}
        </div>

        <div className="px-6 py-6">
          {/* By journey, as it was bought. Numbering the flights "Outbound,
              Return, Return" was only ever right for a nonstop return trip. */}
          {draft.slices.map((slice, si) => (
            <div
              key={`${slice.from}-${slice.to}-${slice.date}`}
              className={si > 0 ? 'mt-6 pt-6' : ''}
              style={si > 0 ? { borderTop: 'var(--rule)' } : undefined}
            >
              {(slice.flights ?? []).map((leg, li) => (
                <div key={leg.flight_id + leg.direction} className={li > 0 ? 'mt-5' : ''}>
                  <p
                    className="font-mono uppercase"
                    style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.16em', color: 'var(--color-ink-faint)' }}
                  >
                    {li === 0 ? sliceHeading(draft.tripType, si, draft.slices.length) : 'Connecting'} · {leg.flight_designator}
                  </p>
                  <p className="mt-1" style={{ fontWeight: 600 }}>{longDate(leg.departure_date)}</p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-4">
                    <span className="tnum font-mono" style={{ fontSize: 'var(--text-time)', fontWeight: 500 }}>
                      {time(leg.departure_time)}
                    </span>
                    <span style={{ color: 'var(--color-ink-faint)' }}>—</span>
                    <span className="tnum font-mono" style={{ fontSize: 'var(--text-time)', fontWeight: 500 }}>
                      {time(leg.arrival_time)}
                    </span>
                    <span className="tnum font-mono" style={{ color: 'var(--color-ink-mute)' }}>
                      {duration(leg.duration_minutes)}
                    </span>
                  </div>
                  <p style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
                    {leg.origin_iata} → {leg.destination_iata} · {leg.aircraft_model}
                  </p>
                  <OperatedBy airlineCode={leg.airline_code} />
                </div>
              ))}
            </div>
          ))}

          <ul className="mt-6 pt-5" style={{ borderTop: 'var(--rule)' }}>
            {draft.passengers.map((p, i) => (
              <li key={i} className="flex items-baseline justify-between py-1">
                <span>{p.given_name} {p.family_name}</span>
                <span style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
                  {p.passenger_type.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-baseline justify-between pt-4" style={{ borderTop: '1px solid var(--color-ink)' }}>
            <span style={{ fontWeight: 600 }}>Paid · {c.longName}</span>
            <span className="tnum font-mono" style={{ fontSize: '1.5rem', fontWeight: 500 }}>{price(total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          to="/manage"
          className="font-mono uppercase"
          style={{
            background: 'var(--color-ink)', color: 'var(--color-paper)',
            padding: '14px 22px', minHeight: 52, letterSpacing: '0.16em',
            fontSize: 'var(--text-small)', borderRadius: 'var(--radius-edge)',
            display: 'inline-flex', alignItems: 'center',
          }}
        >
          Manage this booking
        </Link>
        <Link
          to="/"
          onClick={reset}
          className="font-mono uppercase"
          style={{
            border: 'var(--rule)', padding: '14px 22px', minHeight: 52,
            letterSpacing: '0.16em', fontSize: 'var(--text-small)',
            borderRadius: 'var(--radius-edge)', display: 'inline-flex', alignItems: 'center',
          }}
        >
          Book another trip
        </Link>
      </div>
    </div>
  )
}
