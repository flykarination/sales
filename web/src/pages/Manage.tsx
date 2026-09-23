import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  attachBookingToAccount, bookingHistory, cancelBooking, changeSegmentDate,
  findBooking, myBookings, redeemUpgrade,
  type BookingEvent,
} from '@/lib/queries'
import { useAuth } from '@/auth/AuthContext'
import { CABIN_ORDER, CABINS, cabin, type CabinCode } from '@/lib/cabins'
import { addDays, longDate, price, shortDate, time, toIsoDate } from '@/lib/format'
import { OperatedBy } from '@/components/OperatedBy'
import { sliceHeading } from '@/booking/slices'

interface BookingRow {
  segment_id: string
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
  segment_status: string
}

type Notice = { ok: boolean; text: string }

/**
 * What to call each flight on the card: which journey it starts, or that it
 * connects.
 *
 * A booking keeps its flights, not the shape of the trip they were bought as,
 * so the journeys are read back from the flights. One that leaves from where
 * the previous one landed, within a day and without doubling back, is a
 * connection; anything else starts a new journey. The segment's `direction`
 * cannot answer this -- it is the direction of the flight number's own
 * rotation, and says nothing about which way the traveller is going.
 */
function segmentLabels(rows: BookingRow[]): Map<string, string> {
  const journeys: BookingRow[][] = []
  for (const seg of [...rows].sort((a, b) => a.segment_order - b.segment_order)) {
    const current = journeys[journeys.length - 1]
    const prev = current?.[current.length - 1]
    const wait = prev
      ? (Date.parse(`${seg.travel_date}T${seg.departure_time}Z`)
         - Date.parse(`${prev.arrival_date ?? prev.travel_date}T${prev.arrival_time}Z`)) / 60000
      : NaN
    const connects = !!prev
      && seg.origin_iata === prev.destination_iata
      && wait >= 0 && wait <= 1440
      && !current.some((s) => s.origin_iata === seg.destination_iata)
    if (connects) current.push(seg)
    else journeys.push([seg])
  }

  const first = journeys[0]
  const last = journeys[journeys.length - 1]
  const isReturn = journeys.length === 2
    && last[last.length - 1].destination_iata === first[0].origin_iata
    && last[0].origin_iata === first[first.length - 1].destination_iata

  const labels = new Map<string, string>()
  journeys.forEach((journey, ji) =>
    journey.forEach((seg, si) =>
      labels.set(seg.segment_id, si > 0 ? 'Connecting'
        : sliceHeading(isReturn ? 'return' : 'multi', ji, journeys.length))))
  return labels
}

export default function Manage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  // Seeded from ?pnr= so a link from the account arrives filled in. The
  // reference alone opens nothing -- the email is still required -- so it is
  // safe in a link, which is why the address is not in one.
  const [pnr, setPnr] = useState(() => params.get('pnr')?.trim().toUpperCase() ?? '')
  const [email, setEmail] = useState('')
  /** Whether the booking on screen is on the signed-in member's account. */
  const [onAccount, setOnAccount] = useState<boolean | null>(null)
  const [rows, setRows] = useState<BookingRow[] | null>(null)
  const [events, setEvents] = useState<BookingEvent[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const [acting, setActing] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [changing, setChanging] = useState<string | null>(null)
  const [newDate, setNewDate] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)

  /** Re-read the booking after anything changes it, so the card never lies. */
  const load = useCallback(async (quiet = false, creds?: { pnr: string; email: string }) => {
    const usePnr = creds?.pnr ?? pnr
    const useEmail = creds?.email ?? email
    if (!quiet) setState('loading')
    setMessage(null)
    const { data, error } = await findBooking(usePnr, useEmail)
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
      setEvents([])
      return
    }
    const { data: h } = await bookingHistory(usePnr, useEmail)
    setEvents(h ?? [])

    // Is it on the member's account? Only they can be told, and only about
    // their own bookings, so this asks their account rather than the booking.
    if (user) {
      const { data: mine } = await myBookings()
      const row = (mine ?? []).find((b) => b.pnr === usePnr.trim().toUpperCase())
      setOnAccount(row ? row.on_account : false)
    } else {
      setOnAccount(null)
    }
  }, [pnr, email, user])

  /**
   * Opened from the account with ?pnr=. The email is looked up from the
   * member's own bookings rather than carried in the address bar, which is no
   * place for someone's contact details.
   */
  useEffect(() => {
    const wanted = params.get('pnr')?.trim().toUpperCase()
    if (!wanted || !user || rows || state === 'loading') return
    let live = true
    myBookings().then(({ data }) => {
      const row = (data ?? []).find((b) => b.pnr === wanted)
      if (!live || !row) return
      setPnr(row.pnr)
      setEmail(row.contact_email)
      load(false, { pnr: row.pnr, email: row.contact_email })
    })
    return () => { live = false }
  }, [params, user, rows, state, load])

  async function act(key: string, run: () => Promise<Notice>) {
    setActing(key)
    setNotice(null)
    const result = await run()
    setActing(null)
    setNotice(result)
    if (result.ok) await load(true)
  }

  const b = rows?.[0]
  const today = toIsoDate(new Date())
  const cancelled = b?.booking_status === 'CANCELLED'
  const labels = segmentLabels(rows ?? [])

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
      <h1 className="font-display" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.05 }}>
        Manage your booking
      </h1>
      <p className="mt-3 mb-8" style={{ color: 'var(--color-ink-mute)', maxWidth: '46ch' }}>
        Enter the six-character reference from your confirmation and the email
        address you booked with. You need both.
      </p>

      <form
        onSubmit={(e) => { e.preventDefault(); load() }}
        noValidate
        className="grid gap-5 sm:grid-cols-[180px_1fr_auto] sm:items-end"
      >
        <label className="block">
          <span className="kx-label">Booking reference</span>
          <input
            className="kx-input tnum font-mono" value={pnr} maxLength={6} placeholder="ABC123"
            onChange={(e) => setPnr(e.target.value.toUpperCase())}
            style={{ letterSpacing: '0.18em', textTransform: 'uppercase' }} autoComplete="off"
          />
        </label>
        <label className="block">
          <span className="kx-label">Email</span>
          <input
            className="kx-input" type="email" value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
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
        <p className="mt-6" role="status"
           style={{ color: 'var(--color-ink-mute)', borderLeft: '2px solid var(--color-warn)', paddingLeft: 12 }}>
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
            opacity: cancelled ? 0.75 : 1,
          }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="tnum font-mono" style={{ fontSize: '1.8rem', letterSpacing: '0.16em', fontWeight: 500 }}>
              {b.pnr}
            </p>
            <span className="font-mono uppercase"
                  style={{
                    fontSize: 'var(--text-micro)', letterSpacing: '0.16em',
                    color: cancelled ? 'var(--color-danger)' : 'var(--color-ok)',
                  }}>
              {b.booking_status}
            </span>
          </div>
          <p style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
            {b.contact_name} · {b.passenger_count} {b.passenger_count === 1 ? 'passenger' : 'passengers'}
          </p>

          {/* RainbowOne. Shown only to a signed-in member: to anyone else it
              would be an advert in the middle of their booking. */}
          {user && onAccount === true && (
            <p className="mt-2" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
              On your RainbowOne account ·{' '}
              <Link to="/account" className="underline">your trips</Link>
            </p>
          )}
          {user && onAccount === false && !cancelled && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                className="kx-cta"
                disabled={acting === 'attach'}
                onClick={() => act('attach', async () => {
                  const { data, error } = await attachBookingToAccount(pnr, email)
                  if (data?.ok) setOnAccount(true)
                  return {
                    ok: Boolean(data?.ok),
                    text: data?.message ?? error?.message ?? 'We could not add that booking.',
                  }
                })}
              >
                {acting === 'attach' ? 'Adding…' : 'Add to my RainbowOne account'}
              </button>
              <span style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
                It joins your trips, and earns any miles it has not already.
              </span>
            </div>
          )}

          {rows.map((seg) => (
            <div key={seg.segment_id} className="mt-6 pt-5" style={{ borderTop: 'var(--rule)' }}>
              <p className="font-mono uppercase"
                 style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.16em', color: 'var(--color-ink-faint)' }}>
                {labels.get(seg.segment_id)} ·{' '}
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
              <OperatedBy airlineCode={seg.operating_airline_code} />

              {!cancelled && (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  {changing === seg.segment_id ? (
                    <>
                      <label className="block" style={{ width: 190 }}>
                        <span className="kx-label">New date</span>
                        <input
                          type="date" className="kx-input tnum font-mono" value={newDate}
                          min={today} max={addDays(today, 360)}
                          onChange={(e) => setNewDate(e.target.value)}
                        />
                      </label>
                      <button
                        className="kx-cta"
                        disabled={!newDate || acting === seg.segment_id}
                        onClick={() => act(seg.segment_id, async () => {
                          const { data, error } = await changeSegmentDate(pnr, email, seg.segment_id, newDate)
                          if (error || !data) return { ok: false, text: 'Could not reach the booking system.' }
                          if (data.ok) { setChanging(null); setNewDate('') }
                          return { ok: data.ok, text: data.message }
                        })}
                      >
                        {acting === seg.segment_id ? 'Moving…' : 'Move flight'}
                      </button>
                      <button
                        onClick={() => { setChanging(null); setNotice(null) }}
                        style={{ minHeight: 44, color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}
                      >
                        Keep the original
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setChanging(seg.segment_id)
                          setNewDate(addDays(seg.travel_date, 7))
                          setNotice(null)
                        }}
                        style={{
                          border: 'var(--rule)', borderRadius: 'var(--radius-edge)',
                          padding: '10px 14px', minHeight: 44, fontSize: 'var(--text-small)',
                        }}
                      >
                        Change date
                      </button>

                      {CABIN_ORDER.filter(
                        (c) => CABINS[c].order < (CABINS[seg.cabin_code as CabinCode]?.order ?? 9),
                      ).map((c) => (
                        <button
                          key={c}
                          disabled={acting === seg.segment_id + c}
                          onClick={() => act(seg.segment_id + c, async () => {
                            const { data, error } = await redeemUpgrade(pnr, email, seg.segment_id, c)
                            if (error || !data) return { ok: false, text: 'Could not reach RainbowOne.' }
                            return { ok: data.ok, text: data.message }
                          })}
                          style={{
                            border: `1px solid ${CABINS[c].hue}`, borderRadius: 'var(--radius-edge)',
                            padding: '10px 14px', minHeight: 44, fontSize: 'var(--text-small)',
                            color: CABINS[c].ink, fontWeight: 600,
                          }}
                        >
                          {acting === seg.segment_id + c
                            ? 'Upgrading…'
                            : `Upgrade to ${CABINS[c].name} with miles`}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          <div className="mt-6 flex items-baseline justify-between pt-4" style={{ borderTop: '1px solid var(--color-ink)' }}>
            <span style={{ fontWeight: 600 }}>{cancelled ? 'Refunded' : 'Total paid'}</span>
            <span className="tnum font-mono" style={{ fontSize: '1.4rem', fontWeight: 500 }}>
              {price(b.total_amount_usd)}
            </span>
          </div>

          {notice && (
            <p className="mt-5" role="status"
               style={{
                 color: notice.ok ? 'var(--color-ok)' : 'var(--color-danger)',
                 borderLeft: `2px solid ${notice.ok ? 'var(--color-ok)' : 'var(--color-danger)'}`,
                 paddingLeft: 12, fontSize: 'var(--text-small)',
               }}>
              {notice.text}
            </p>
          )}

          {cancelled ? (
            <p className="mt-5" style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
              This booking is cancelled and the seats have been released. Any miles
              it earned have been reversed.
            </p>
          ) : (
            <div className="mt-6 pt-4" style={{ borderTop: 'var(--rule)' }}>
              {confirmCancel ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span style={{ fontSize: 'var(--text-small)' }}>
                    Cancel the whole booking? The seats go back and any miles earned are reversed.
                  </span>
                  <button
                    onClick={() => act('cancel', async () => {
                      const { data, error } = await cancelBooking(pnr, email)
                      setConfirmCancel(false)
                      if (error || !data) return { ok: false, text: 'Could not cancel. Nothing has changed.' }
                      return {
                        ok: true,
                        text: `Cancelled. ${price(data.refunded_usd)} refunded and ${data.seats_released} seat(s) released.`,
                      }
                    })}
                    style={{
                      background: 'var(--color-danger)', color: 'var(--color-paper)',
                      borderRadius: 'var(--radius-edge)', padding: '10px 16px', minHeight: 44,
                      fontSize: 'var(--text-small)', fontWeight: 600,
                    }}
                  >
                    {acting === 'cancel' ? 'Cancelling…' : 'Yes, cancel it'}
                  </button>
                  <button onClick={() => setConfirmCancel(false)}
                          style={{ minHeight: 44, color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
                    Keep the booking
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmCancel(true)}
                        style={{ color: 'var(--color-danger)', fontSize: 'var(--text-small)', minHeight: 44 }}>
                  Cancel this booking
                </button>
              )}
            </div>
          )}

          {events.length > 0 && (
            <div className="mt-6 pt-4" style={{ borderTop: 'var(--rule)' }}>
              <h2 className="mb-2 font-mono uppercase"
                  style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.2em', color: 'var(--color-ink-mute)' }}>
                History
              </h2>
              <ul>
                {events.map((e) => (
                  <li key={e.event_id} className="py-1"
                      style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
                    <span className="tnum font-mono" style={{ color: 'var(--color-ink-faint)' }}>
                      {shortDate(e.occurred_at.slice(0, 10))}
                    </span>{' '}
                    {e.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
