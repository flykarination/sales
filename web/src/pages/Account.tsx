import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import {
  attachBookingToAccount, myAccount, myBookings, myLedger,
  type AccountBookingRow, type AccountRow, type LedgerRow,
} from '@/lib/queries'
import { cabin } from '@/lib/cabins'
import { airportLabel } from '@/data/airports'
import { count, price, shortDate } from '@/lib/format'

export default function Account() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [acct, setAcct] = useState<AccountRow | null>(null)
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [trips, setTrips] = useState<AccountBookingRow[] | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [tripNotice, setTripNotice] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')

  useEffect(() => {
    if (!loading && !user) navigate('/signin', { replace: true })
  }, [loading, user, navigate])

  useEffect(() => {
    if (!user) return
    let live = true
    Promise.all([myAccount(), myLedger(50), myBookings()]).then(([a, l, b]) => {
      if (!live) return
      if (a.error) { setState('error'); return }
      if (!a.data) { setState('missing'); return }
      setAcct(a.data as AccountRow)
      setLedger((l.data ?? []) as LedgerRow[])
      setTrips(b.data ?? [])
      setState('ready')
    })
    return () => { live = false }
  }, [user])

  /**
   * Add a booking the member has but never attached -- one made with their
   * membership address before they signed in. Miles can land with it, so the
   * card and the ledger are re-read rather than patched.
   */
  async function addTrip(trip: AccountBookingRow) {
    setAdding(trip.pnr)
    setTripNotice(null)
    const { data, error } = await attachBookingToAccount(trip.pnr, trip.contact_email)
    setAdding(null)
    setTripNotice(data?.message ?? error?.message ?? 'We could not add that booking.')
    if (!data?.ok) return
    const [a, l, b] = await Promise.all([myAccount(), myLedger(50), myBookings()])
    if (a.data) setAcct(a.data as AccountRow)
    setLedger((l.data ?? []) as LedgerRow[])
    setTrips(b.data ?? [])
  }

  if (loading || state === 'loading') {
    return <div className="mx-auto max-w-4xl px-5 py-16 md:px-8" aria-busy="true">
      <div className="animate-pulse" style={{ height: 200, background: 'var(--color-paper-sunk)' }} />
    </div>
  }

  if (state === 'missing') {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 md:px-8">
        <h1 className="font-display" style={{ fontSize: '2rem' }}>Your membership is still being created.</h1>
        <p className="mt-3" style={{ color: 'var(--color-ink-mute)' }}>
          This usually resolves in a second or two. Reload the page — if it keeps
          happening, the sign-up trigger may not be installed on this project.
        </p>
        <button className="kx-cta mt-6" onClick={() => location.reload()}>Reload</button>
      </div>
    )
  }

  if (state === 'error' || !acct) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 md:px-8">
        <h1 className="font-display" style={{ fontSize: '2rem' }}>We could not load your account.</h1>
        <button className="kx-cta mt-6" onClick={() => location.reload()}>Try again</button>
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const pct = acct.next_tier_code && acct.miles_to_next_tier != null
    ? Math.min(100, Math.round(
        (acct.qualifying_miles_ytd / (acct.qualifying_miles_ytd + acct.miles_to_next_tier)) * 100))
    : 100

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 md:px-8">
      {/* membership card */}
      <div
        style={{
          border: 'var(--rule)',
          borderTop: `4px solid var(${acct.hue_token})`,
          borderRadius: 'var(--radius-soft)',
          overflow: 'hidden',
        }}
      >
        <div className="px-6 py-7" style={{ background: 'var(--color-ink)' }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono uppercase" style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.24em', color: 'var(--color-aqua)' }}>
                RainbowOne · {acct.tier_name}
              </p>
              <h1 className="font-display mt-2" style={{ fontSize: 'clamp(1.7rem, 4vw, 2.4rem)', color: 'var(--color-paper)' }}>
                {acct.full_name ?? acct.email}
              </h1>
              <p className="tnum mt-1 font-mono" style={{ color: '#B9B6D8', letterSpacing: '0.14em' }}>
                {acct.member_number}
              </p>
            </div>
            <div className="text-right">
              <p className="tnum font-mono" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.6rem)', color: `var(${acct.hue_token})`, fontWeight: 500, lineHeight: 1 }}>
                {count(acct.balance_miles)}
              </p>
              <p className="font-mono uppercase" style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.16em', color: '#8F8CB4' }}>
                miles available
              </p>
            </div>
          </div>

          {acct.tagline && (
            <p className="mt-5" style={{ color: '#B9B6D8', fontStyle: 'italic', fontSize: 'var(--text-small)' }}>
              {acct.tagline}
            </p>
          )}
        </div>

        {/* tier progress */}
        <div className="px-6 py-6">
          {acct.next_tier_name ? (
            <>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span style={{ fontWeight: 600 }}>
                  {count(acct.miles_to_next_tier ?? 0)} qualifying miles to {acct.next_tier_name}
                </span>
                <span className="tnum font-mono" style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
                  {count(acct.qualifying_miles_ytd)} this year
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                aria-label={`Progress to ${acct.next_tier_name}`}
                style={{ height: 8, background: 'var(--color-paper-sunk)', borderRadius: 4, overflow: 'hidden' }}
              >
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--paint-spectrum)' }} />
              </div>
            </>
          ) : (
            <p style={{ fontWeight: 600 }}>
              You are at Ruby, our highest tier. Everything earns double.
            </p>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              ['Lifetime miles', count(acct.lifetime_miles)],
              ['Qualifying (year)', count(acct.qualifying_miles_ytd)],
              ['Tier bonus', `+${Number(acct.earn_bonus_pct)}%`],
              ['Member since', shortDate(acct.joined_at.slice(0, 10))],
            ].map(([l, v]) => (
              <div key={l}>
                <dd className="tnum font-mono" style={{ fontSize: '1.15rem', fontWeight: 500 }}>{v}</dd>
                <dt className="font-mono uppercase" style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.14em', color: 'var(--color-ink-faint)' }}>
                  {l}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* perks */}
      {acct.perks?.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-mono uppercase" style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.2em', color: 'var(--color-ink-mute)' }}>
            Your {acct.tier_name} benefits
          </h2>
          <ul>
            {acct.perks.map((p) => (
              <li key={p} className="flex items-baseline gap-3 py-2.5" style={{ borderTop: 'var(--rule)' }}>
                <span aria-hidden style={{ width: 8, height: 8, background: `var(${acct.hue_token})`, borderRadius: 2 }} />
                {p}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* trips */}
      <section className="mt-10">
        <h2 className="mb-3 font-mono uppercase" style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.2em', color: 'var(--color-ink-mute)' }}>
          Your trips
        </h2>

        {tripNotice && (
          <p role="status" className="mb-3"
             style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)', borderLeft: '2px solid var(--color-aqua-deep)', paddingLeft: 12 }}>
            {tripNotice}
          </p>
        )}

        {trips === null ? (
          <p aria-busy="true" style={{ color: 'var(--color-ink-mute)' }}>Looking for your bookings…</p>
        ) : trips.length === 0 ? (
          <div style={{ borderTop: '2px solid var(--color-ink)', paddingTop: 20 }}>
            <p style={{ fontSize: 'var(--text-lead)' }}>Nothing booked yet.</p>
            <p className="mt-2" style={{ color: 'var(--color-ink-mute)', maxWidth: '48ch' }}>
              Bookings you add to your account appear here, and you can change or
              cancel them without hunting for the reference.
            </p>
            <Link to="/" className="kx-cta mt-5">Find a flight</Link>
          </div>
        ) : (
          <ul style={{ borderTop: '2px solid var(--color-ink)' }}>
            {trips.map((t) => {
              const cancelled = t.status === 'CANCELLED'
              const flown = Boolean(t.last_travel_date) && t.last_travel_date! < today
              return (
                <li
                  key={t.pnr}
                  className="flex flex-wrap items-baseline gap-x-5 gap-y-2 py-4"
                  style={{ borderBottom: 'var(--rule)', opacity: cancelled ? 0.6 : 1 }}
                >
                  <span className="min-w-0" style={{ flex: '1 1 16rem' }}>
                    <span style={{ fontWeight: 600 }}>
                      {airportLabel(t.origin_iata ?? '')}
                      {t.destination_iata && t.destination_iata !== t.origin_iata
                        ? ` → ${airportLabel(t.destination_iata)}` : ''}
                    </span>
                    <span className="mt-0.5 block" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
                      {t.first_travel_date ? shortDate(t.first_travel_date) : '—'}
                      {t.last_travel_date && t.last_travel_date !== t.first_travel_date
                        ? ` – ${shortDate(t.last_travel_date)}` : ''}
                      {' · '}
                      {t.passenger_count} {t.passenger_count === 1 ? 'passenger' : 'passengers'}
                      {' · '}
                      {t.segment_count} {t.segment_count === 1 ? 'flight' : 'flights'}
                      {cancelled ? ' · cancelled' : flown ? ' · flown' : ''}
                    </span>
                  </span>

                  <span className="tnum font-mono" style={{ letterSpacing: '0.16em' }}>{t.pnr}</span>
                  <span className="tnum font-mono" style={{ color: 'var(--color-ink-mute)' }}>
                    {price(t.total_amount_usd)}
                  </span>

                  {t.on_account ? (
                    <Link to={`/manage?pnr=${t.pnr}`} className="underline" style={{ fontSize: 'var(--text-small)' }}>
                      Manage
                    </Link>
                  ) : (
                    <button
                      onClick={() => addTrip(t)}
                      disabled={adding === t.pnr}
                      className="font-mono uppercase"
                      style={{
                        border: 'var(--rule)', borderRadius: 'var(--radius-edge)',
                        padding: '8px 12px', minHeight: 40, fontSize: 'var(--text-micro)',
                        letterSpacing: '0.14em',
                      }}
                      title="Booked with your membership address, but not on your account yet"
                    >
                      {adding === t.pnr ? 'Adding…' : 'Add to account'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ledger */}
      <section className="mt-10">
        <h2 className="mb-3 font-mono uppercase" style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.2em', color: 'var(--color-ink-mute)' }}>
          Miles activity
        </h2>

        {ledger.length === 0 ? (
          <div style={{ borderTop: '2px solid var(--color-ink)', paddingTop: 20 }}>
            <p style={{ fontSize: 'var(--text-lead)' }}>No miles yet.</p>
            <p className="mt-2" style={{ color: 'var(--color-ink-mute)', maxWidth: '46ch' }}>
              Book a flight using <strong>{acct.email}</strong> and the miles land here
              automatically — no membership number to remember at checkout.
            </p>
            <Link to="/" className="kx-cta mt-5">Find a flight</Link>
          </div>
        ) : (
          <ul style={{ borderTop: '2px solid var(--color-ink)' }}>
            {ledger.map((t) => {
              const c = t.cabin_code ? cabin(t.cabin_code) : null
              return (
                <li key={t.txn_id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3" style={{ borderBottom: 'var(--rule)' }}>
                  {c && <span aria-hidden style={{ width: 8, height: 8, background: c.hue, borderRadius: 2, flex: 'none' }} />}
                  <span style={{ fontWeight: 500 }}>{t.description}</span>
                  {t.distance_km && (
                    <span className="tnum font-mono" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
                      {count(t.distance_km)} km × {Number(t.multiplier)}
                    </span>
                  )}
                  <span className="tnum ml-auto font-mono" style={{ fontSize: 'var(--text-lead)', color: t.miles >= 0 ? 'var(--color-ok)' : 'var(--color-danger)' }}>
                    {t.miles >= 0 ? '+' : ''}{count(t.miles)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="mt-10 flex flex-wrap gap-4">
        <Link to="/rainbowone" className="kx-cta">About RainbowOne</Link>
        <button
          onClick={async () => { await signOut(); navigate('/') }}
          style={{
            border: 'var(--rule)', padding: '14px 22px', minHeight: 52,
            borderRadius: 'var(--radius-edge)', fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-small)', letterSpacing: '0.16em', textTransform: 'uppercase',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
