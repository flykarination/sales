import { Link, useLocation } from 'react-router-dom'
import { useBooking } from '@/booking/BookingContext'
import { summarise } from '@/components/PassengerPicker'
import { OperatedBy } from '@/components/OperatedBy'
import { BaggageNotice } from '@/components/BaggageNotice'
import { sliceHeading } from '@/booking/slices'
import { cabin } from '@/lib/cabins'
import { dayDiff, dayOffset, duration, price, shortDate, time } from '@/lib/format'

const STEPS = [
  { path: '/search', label: 'Choose flights' },
  { path: '/passengers', label: 'Passengers' },
  { path: '/payment', label: 'Payment' },
  { path: '/confirmation', label: 'Confirmed' },
]

/**
 * Where the traveller is, and how far is left. Visible on every funnel page.
 *
 * v2: a progress line in four segments. Done and current segments carry the
 * fluoro, still -- the funnel's edge light, never moving behind the form.
 */
export function StepIndicator() {
  const { pathname } = useLocation()
  const current = Math.max(0, STEPS.findIndex((s) => s.path === pathname))

  return (
    <nav aria-label="Booking progress" className="mb-8">
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => {
          const done = i < current
          const here = i === current
          return (
            <li key={s.path} aria-current={here ? 'step' : undefined}>
              <span
                aria-hidden
                className="block"
                style={{
                  height: 4,
                  borderRadius: 4,
                  background: done || here ? 'var(--paint-fluoro)' : 'var(--color-paper-edge)',
                  backgroundSize: '400% 100%',
                  backgroundPosition: `${(i / (STEPS.length - 1)) * 100}% 0`,
                  opacity: here || done ? 1 : 0.9,
                }}
              />
              <span
                className="mt-2 block font-mono uppercase"
                style={{
                  fontSize: 'var(--text-micro)',
                  letterSpacing: '0.14em',
                  color: here ? 'var(--color-ink)' : done ? 'var(--color-ink-mute)' : 'var(--color-ink-faint)',
                  fontWeight: here ? 700 : 400,
                }}
              >
                {done ? '✓ ' : ''}{s.label}
                {here && <span className="sr-only"> (current step)</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * The itinerary stays visible through the whole funnel, so the traveller can
 * always see what they are buying and for how much.
 */
export function ItinerarySummary({ sticky = true }: { sticky?: boolean }) {
  const { draft, legs, total } = useBooking()
  if (legs.length === 0) return null
  const c = cabin(draft.cabin)

  return (
    <aside
      aria-label="Your itinerary"
      className={sticky ? 'lg:sticky lg:top-24' : ''}
      style={{
        border: 'var(--rule)',
        borderTop: `3px solid ${c.hue}`,
        borderRadius: 'var(--radius-soft)',
        background: 'var(--color-paper)',
        padding: '18px 20px',
      }}
    >
      <h2
        className="mb-4 font-mono uppercase"
        style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.18em', color: 'var(--color-ink-mute)' }}
      >
        Your trip
      </h2>

      {/* Grouped by slice, not flattened. "Outbound / Return" only describes a
          two-slice trip with one flight each; a connection or a multi-city
          needs the journey named and its flights listed beneath it. */}
      {draft.slices.map((slice, si) => (
        <div
          key={`${slice.from}-${slice.to}-${slice.date}`}
          className={si > 0 ? 'mt-4 pt-4' : ''}
          style={si > 0 ? { borderTop: 'var(--rule)' } : undefined}
        >
          <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
            {sliceHeading(draft.tripType, si, draft.slices.length)} · {shortDate(slice.date)}
          </p>

          {(slice.flights ?? []).map((leg, li) => (
            <div key={leg.flight_id + leg.direction} className={li > 0 ? 'mt-3' : ''}>
              {/* Days counted from the date in the heading: on a long
                  connection the second and third flights are often tomorrow's. */}
              <p className="tnum mt-1 font-mono" style={{ fontSize: 'var(--text-lead)' }}>
                {time(leg.departure_time)}<DayMark days={dayDiff(slice.date, leg.departure_date)} />
                {' — '}
                {time(leg.arrival_time)}<DayMark days={dayDiff(slice.date, leg.arrival_date)} />
              </p>
              <p style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
                {leg.origin_iata} → {leg.destination_iata} · {duration(leg.duration_minutes)} · {leg.flight_designator}
              </p>
              <OperatedBy airlineCode={leg.airline_code} size="micro" />
            </div>
          ))}

          {(slice.flights?.length ?? 0) > 1 && (
            <p className="mt-2" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
              Changing at {(slice.flights ?? []).slice(0, -1).map((l) => l.destination_iata).join(' and ')}
            </p>
          )}
        </div>
      ))}

      {/* The whole booking, not one slice: a bag checked at the start has to
          satisfy every airline that will carry it. */}
      <BaggageNotice airlineCodes={legs.map((l) => l.airline_code)} cabinCode={draft.cabin} />

      <dl className="mt-5 pt-4" style={{ borderTop: '1px solid var(--color-ink)' }}>
        <div className="flex items-baseline justify-between">
          <dt style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
            {c.longName} · {summarise(draft)}
          </dt>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <dt style={{ fontWeight: 600 }}>Total</dt>
          <dd className="tnum font-mono" style={{ fontSize: '1.5rem', fontWeight: 500 }}>{price(total)}</dd>
        </div>
      </dl>
      <p className="mt-2" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
        All taxes included. No add-ons, no fare classes.
      </p>
    </aside>
  )
}

/** Shared shell for every funnel page. */
export function FunnelPage({
  title, children, aside = true,
}: { title: string; children: React.ReactNode; aside?: boolean }) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
      <StepIndicator />
      <h1 className="font-display mb-7" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', lineHeight: 1.1 }}>
        {title}
      </h1>
      <div className={aside ? 'grid gap-10 lg:grid-cols-[1fr_320px]' : ''}>
        <div className="min-w-0">{children}</div>
        {aside && <ItinerarySummary />}
      </div>
    </div>
  )
}

export function BackLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="kx-navlink inline-flex items-center gap-2"
      style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)', minHeight: 44 }}
    >
      ← {children}
    </Link>
  )
}

/** `+1` beside a time on a later day than the journey's own date; nothing otherwise. */
function DayMark({ days }: { days: number }) {
  if (!days) return null
  return (
    <sup className="tnum" style={{ fontSize: '0.55em', color: 'var(--color-spectrum-rose-ink)', marginLeft: 2 }}>
      {dayOffset(days)}
    </sup>
  )
}
