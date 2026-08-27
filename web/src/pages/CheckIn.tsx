import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { checkIn, type BoardingPassRow } from '@/lib/queries'
import { cabin } from '@/lib/cabins'
import { longDate, shortDate, time } from '@/lib/format'
import { assetUrl } from '@/lib/assets'

export default function CheckIn() {
  const [pnr, setPnr] = useState('')
  const [email, setEmail] = useState('')
  const [passes, setPasses] = useState<BoardingPassRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const reduced = useReducedMotion()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMessage(null)
    const { data, error } = await checkIn(pnr, email)
    setBusy(false)
    if (error) { setMessage('We could not reach check-in. Try again in a moment.'); return }
    const rows = data ?? []
    setPasses(rows)
    if (rows.length === 0) {
      setMessage('No booking matches that reference and email. Both must match the booking exactly.')
    } else if (rows.every((r) => !r.checkin_open)) {
      setMessage(null)
    }
  }

  const open = passes?.filter((p) => p.checkin_open) ?? []
  const notYet = passes?.filter((p) => !p.checkin_open) ?? []

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
      <h1 className="font-display" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.05 }}>
        Check in
      </h1>
      <p className="mt-3 mb-8" style={{ color: 'var(--color-ink-mute)', maxWidth: '46ch' }}>
        Check-in opens 48 hours before departure. You will need your booking
        reference and the email you booked with.
      </p>

      <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <label className="block">
          <span className="kx-label">Booking reference</span>
          <input className="kx-input tnum font-mono" value={pnr} maxLength={6} placeholder="ABC123"
                 onChange={(e) => setPnr(e.target.value.toUpperCase())}
                 style={{ letterSpacing: '0.18em', textTransform: 'uppercase' }} autoComplete="off" />
        </label>
        <label className="block">
          <span className="kx-label">Email</span>
          <input className="kx-input" type="email" value={email} autoComplete="email"
                 onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit" disabled={busy || pnr.length < 6 || !email} className="kx-cta"
                style={{ opacity: busy || pnr.length < 6 || !email ? 0.55 : 1 }}>
          {busy ? 'Checking in…' : 'Check in'}
        </button>
      </form>

      {message && (
        <p className="mt-6" role="status"
           style={{ color: 'var(--color-ink-mute)', borderLeft: '2px solid var(--color-warn)', paddingLeft: 12 }}>
          {message}
        </p>
      )}

      {notYet.length > 0 && (
        <div className="mt-8" style={{ borderLeft: '2px solid var(--color-warn)', paddingLeft: 14 }}>
          <p style={{ fontWeight: 600 }}>Check-in is not open yet.</p>
          {[...new Map(notYet.map((n) => [n.segment_order, n])).values()].map((n) => (
            <p key={n.segment_order} style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
              {n.airline_code} {n.flight_number} · {n.origin_iata} → {n.destination_iata} on{' '}
              {shortDate(n.travel_date)}. Come back 48 hours before departure.
            </p>
          ))}
        </div>
      )}

      {open.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-mono uppercase"
              style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.2em', color: 'var(--color-ink-mute)' }}>
            {open.length === 1 ? 'Your boarding pass' : `${open.length} boarding passes`}
          </h2>

          {open.map((p, i) => {
            const c = cabin(p.cabin_code)
            return (
              <motion.article
                key={`${p.segment_order}-${p.passenger_name}`}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: reduced ? 0 : Math.min(i, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className="mb-6"
                style={{
                  border: 'var(--rule)', borderTop: `4px solid ${c.hue}`,
                  borderRadius: 'var(--radius-soft)', overflow: 'hidden',
                  background: 'var(--color-paper)',
                }}
              >
                <div className="flex flex-wrap items-baseline gap-x-4 px-5 py-3"
                     style={{ background: 'var(--color-ink)', color: 'var(--color-paper)' }}>
                  <img src={assetUrl('/brand/wordmark-light.png')} alt="Karination" style={{ height: 15, width: 'auto' }} />
                  <span className="font-mono uppercase"
                        style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.18em', color: 'var(--color-aqua)' }}>
                    Boarding pass
                  </span>
                  <span className="tnum ml-auto font-mono" style={{ letterSpacing: '0.16em' }}>{p.pnr}</span>
                </div>

                {/* the route, biggest thing on the pass */}
                <div className="flex flex-wrap items-end gap-x-8 gap-y-3 px-5 pt-5">
                  <div>
                    <p className="tnum font-mono" style={{ fontSize: 'clamp(2rem,7vw,3rem)', lineHeight: 1, fontWeight: 500 }}>
                      {p.origin_iata}
                    </p>
                    <p className="tnum font-mono" style={{ fontSize: 'var(--text-lead)', color: 'var(--color-ink-mute)' }}>
                      {time(p.departure_time)}
                    </p>
                  </div>
                  <span aria-hidden style={{ color: 'var(--color-ink-faint)', fontSize: '1.5rem', paddingBottom: 12 }}>→</span>
                  <div>
                    <p className="tnum font-mono" style={{ fontSize: 'clamp(2rem,7vw,3rem)', lineHeight: 1, fontWeight: 500 }}>
                      {p.destination_iata}
                    </p>
                    <p className="tnum font-mono" style={{ fontSize: 'var(--text-lead)', color: 'var(--color-ink-mute)' }}>
                      {time(p.arrival_time)}
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-4">
                  {[
                    ['Passenger', p.passenger_name],
                    ['Flight', `${p.airline_code} ${p.flight_number}`],
                    ['Date', shortDate(p.travel_date)],
                    ['Cabin', p.cabin_name],
                    ['Seat', p.seat_number ?? '—'],
                    ['Gate', p.gate],
                    ['Boarding', time(p.boarding_time)],
                    ['Ticket', p.ticket_number ?? '—'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="font-mono uppercase"
                          style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.14em', color: 'var(--color-ink-faint)' }}>
                        {k}
                      </dt>
                      <dd className={k === 'Seat' ? 'tnum font-mono' : 'tnum'}
                          style={{ fontWeight: k === 'Seat' ? 600 : 500,
                                   fontSize: k === 'Seat' ? '1.35rem' : 'var(--text-body)',
                                   color: k === 'Seat' ? c.ink : 'var(--color-ink)' }}>
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>

                {/* the spectrum stands in for the barcode strip */}
                <div aria-hidden style={{ height: 6, background: 'var(--paint-spectrum)' }} />
              </motion.article>
            )
          })}

          <p style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
            Boarding closes 15 minutes before departure. All times are local to{' '}
            their own airport — {longDate(open[0].travel_date)} at {open[0].origin_iata}.
          </p>
        </section>
      )}
    </div>
  )
}
