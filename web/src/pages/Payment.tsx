import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackLink, FunnelPage } from '@/components/Funnel'
import { useBooking } from '@/booking/BookingContext'
import { useAuth } from '@/auth/AuthContext'
import { attachBookingToAccount, createBooking, payWithMiles } from '@/lib/queries'
import { count } from '@/lib/format'
import { price } from '@/lib/format'

/**
 * Simulated payment.
 *
 * Karination is a fictional airline in a game world, so no money moves and no
 * card is charged. The card fields below are cosmetic: they are never read,
 * never stored, and never sent anywhere. The only thing this page actually
 * does on submit is call create_booking, which prices the trip from the
 * schedule and returns a PNR.
 */
export default function Payment() {
  const { draft, legs, total, set } = useBooking()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<'idle' | 'paying' | 'failed'>('idle')
  const [milesNotice, setMilesNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (legs.length === 0 || draft.passengers.length === 0) navigate('/', { replace: true })
  }, [legs.length, draft.passengers.length, navigate])

  /**
   * Put the new booking on the member's RainbowOne account, if they asked
   * for it on the passengers page.
   *
   * Never fatal. The booking exists either way and manage booking can add it
   * afterwards, so a failure here is a line on the confirmation rather than a
   * reason to tell someone their trip did not happen.
   */
  async function addToAccount(pnr: string) {
    if (!draft.addToAccount || !user) return
    const { data, error } = await attachBookingToAccount(pnr, draft.contactEmail)
    set({
      accountResult: data ?? {
        ok: false,
        message: error?.message ?? 'We could not add it to your account just now.',
      },
    })
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault()
    setState('paying')
    setError(null)

    const segments = legs.map((l) => ({
      flight_id: l.flight_id,
      aircraft_id: l.aircraft_id,
      direction: l.direction,
      cabin_code: l.cabin_code,
      travel_date: l.departure_date,
    }))

    const { data, error } = await createBooking({
      contactEmail: draft.contactEmail,
      contactName: draft.contactName,
      passengers: draft.passengers,
      segments,
    })

    if (error || !data) {
      setState('failed')
      setError(
        error?.message ??
          'The booking could not be completed. No payment has been taken — you can safely try again.',
      )
      return
    }

    await addToAccount(String(data))
    set({ pnr: String(data) })
    navigate('/confirmation')
  }

  /**
   * Pay the same booking in miles instead. The reservation is created exactly
   * as it would be for cash and then converted, so there is one selling flow
   * and one set of seat checks rather than a separate award path.
   */
  async function payMiles() {
    setState('paying')
    setError(null)
    setMilesNotice(null)

    const segments = legs.map((l) => ({
      flight_id: l.flight_id, aircraft_id: l.aircraft_id, direction: l.direction,
      cabin_code: l.cabin_code, travel_date: l.departure_date,
    }))
    const made = await createBooking({
      contactEmail: draft.contactEmail, contactName: draft.contactName,
      passengers: draft.passengers, segments,
    })
    if (made.error || !made.data) {
      setState('failed')
      setError(made.error?.message ?? 'The booking could not be completed.')
      return
    }
    const pnr = String(made.data)

    const paid = await payWithMiles(pnr, draft.contactEmail)
    if (paid.error || !paid.data?.ok) {
      // the seats are held under a cash booking; say so rather than stranding them
      setState('idle')
      setMilesNotice(
        (paid.data?.message ?? 'Miles payment failed.') +
          ` Your booking ${pnr} is held and can be paid by card instead — find it under manage booking.`,
      )
      return
    }

    await addToAccount(pnr)
    set({ pnr })
    navigate('/confirmation')
  }

  return (
    <FunnelPage title="Payment">
      <div
        className="mb-7"
        style={{
          borderLeft: '3px solid var(--color-spectrum-amber)',
          background: 'color-mix(in oklab, var(--color-spectrum-amber) 8%, transparent)',
          padding: '14px 16px',
          borderRadius: 'var(--radius-edge)',
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: 4 }}>This is a simulated payment</p>
        <p style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
          Karination is a fictional airline. No card is charged, and the card
          details below are never read, stored or sent anywhere — they are filled
          in for you. Pressing pay simply issues the booking.
        </p>
      </div>

      <form onSubmit={pay} noValidate>
        <fieldset disabled={state === 'paying'}>
          <legend
            className="mb-4 font-mono uppercase"
            style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.18em', color: 'var(--color-ink-mute)' }}
          >
            Card · demonstration only
          </legend>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="kx-label">Name on card</span>
              <input className="kx-input" defaultValue={draft.contactName || 'A Traveller'} autoComplete="off" />
            </label>
            <label className="block sm:col-span-2">
              <span className="kx-label">Card number</span>
              <input
                className="kx-input tnum font-mono"
                defaultValue="4242 4242 4242 4242"
                inputMode="numeric"
                autoComplete="off"
              />
              <span className="mt-1 block" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
                A well-known test number. Do not enter a real card.
              </span>
            </label>
            <label className="block">
              <span className="kx-label">Expiry</span>
              <input className="kx-input tnum font-mono" defaultValue="12/29" autoComplete="off" />
            </label>
            <label className="block">
              <span className="kx-label">Security code</span>
              <input className="kx-input tnum font-mono" defaultValue="123" autoComplete="off" />
            </label>
          </div>
        </fieldset>

        {state === 'failed' && error && (
          <p
            className="mt-6"
            role="alert"
            style={{ color: 'var(--color-danger)', borderLeft: '2px solid var(--color-danger)', paddingLeft: 12 }}
          >
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-5">
          <button
            type="submit"
            disabled={state === 'paying'}
            className="font-mono uppercase"
            style={{
              background: state === 'paying' ? 'var(--color-ink-mute)' : 'var(--color-ink)',
              color: 'var(--color-paper)',
              padding: '14px 26px',
              minWidth: 260,
              minHeight: 52,
              letterSpacing: '0.16em',
              fontSize: 'var(--text-small)',
              borderRadius: 'var(--radius-edge)',
              cursor: state === 'paying' ? 'wait' : 'pointer',
            }}
          >
            {state === 'paying' ? 'Issuing your booking…' : `Pay ${price(total)} and book`}
          </button>
          <button
            type="button"
            onClick={payMiles}
            disabled={state === 'paying'}
            className="font-mono uppercase"
            style={{
              border: '1px solid var(--color-spectrum-violet)',
              color: 'var(--color-spectrum-violet-ink)',
              padding: '14px 22px', minHeight: 52, letterSpacing: '0.16em',
              fontSize: 'var(--text-small)', borderRadius: 'var(--radius-edge)',
              fontWeight: 600,
            }}
          >
            Pay {count(Math.round(total * 100))} miles
          </button>
          {state !== 'paying' && <BackLink to="/passengers">Back to passengers</BackLink>}
        </div>

        {milesNotice && (
          <p
            className="mt-5"
            role="alert"
            style={{ color: 'var(--color-warn)', borderLeft: '2px solid var(--color-warn)', paddingLeft: 12 }}
          >
            {milesNotice}
          </p>
        )}

        <p className="mt-4" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
          RainbowOne members can pay in miles at 100 miles to the dollar. The
          booking must be made with your member email address.
        </p>
      </form>
    </FunnelPage>
  )
}
