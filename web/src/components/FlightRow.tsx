import { cabin } from '@/lib/cabins'
import {
  carrierName, dayOffset, dayOffsetSpoken, duration, durationSpoken,
  price, time, timeSpoken,
} from '@/lib/format'
import type { FlightResult } from '@/lib/queries'
import { OperatedBy } from '@/components/OperatedBy'
import { operatedNoteFor } from '@/data/carriers'

/**
 * One result. A horizontal band, not a card: travellers scan a column of
 * departure times and a column of prices, and cards make the eye zigzag.
 *
 * The departure time is the largest thing in the row, per airline-ux-patterns.
 */
export function FlightRow({
  flight, selected, onSelect, seatsLeft,
}: {
  flight: FlightResult
  selected?: boolean
  onSelect?: (f: FlightResult) => void
  seatsLeft?: number | null
}) {
  const c = cabin(flight.cabin_code)
  const nights = (() => {
    if (!flight.departure_date || !flight.arrival_date) return 0
    const a = new Date(flight.departure_date).getTime()
    const b = new Date(flight.arrival_date).getTime()
    return Math.round((b - a) / 86400000)
  })()

  const label =
    `${flight.flight_designator}, departs ${timeSpoken(flight.departure_time)} ` +
    `from ${flight.origin_iata}, arrives ${timeSpoken(flight.arrival_time)} ` +
    `at ${flight.destination_iata}${dayOffsetSpoken(nights)}, ` +
    `${durationSpoken(flight.duration_minutes)}, ${c.longName}, ` +
    `${price(flight.price_usd)} per passenger` +
    (operatedNoteFor(flight.airline_code) ? `. ${operatedNoteFor(flight.airline_code)}` : '')

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect?.(flight)}
        aria-label={label}
        aria-pressed={selected}
        className="kx-row grid w-full items-center gap-x-5 gap-y-3 px-4 py-4 text-left md:px-5"
        style={{
          gridTemplateColumns: 'minmax(0,1fr) auto',
          borderBottom: 'var(--rule)',
          background: selected ? c.wash : 'transparent',
          borderLeft: `3px solid ${selected ? c.hue : 'transparent'}`,
        }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="tnum font-mono" style={{ fontSize: 'var(--text-time)', fontWeight: 500, lineHeight: 1.1 }}>
              {time(flight.departure_time)}
            </span>
            <span aria-hidden style={{ color: 'var(--color-ink-faint)' }}>—</span>
            <span className="tnum font-mono" style={{ fontSize: 'var(--text-time)', fontWeight: 500, lineHeight: 1.1 }}>
              {time(flight.arrival_time)}
              {nights !== 0 && (
                <sup
                  className="tnum"
                  style={{ fontSize: '0.5em', color: 'var(--color-spectrum-rose-ink)', marginLeft: 2 }}
                >
                  {dayOffset(nights)}
                </sup>
              )}
            </span>
          </div>

          <div
            className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono uppercase"
            style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.12em', color: 'var(--color-ink-mute)' }}
          >
            <span>{flight.origin_iata} → {flight.destination_iata}</span>
            <span className="tnum">{duration(flight.duration_minutes)}</span>
            <span>Direct</span>
            <span>{flight.flight_designator}</span>
            <span style={{ color: 'var(--color-ink-faint)' }}>{flight.aircraft_model}</span>
          </div>

          {operatedNoteFor(flight.airline_code) ? (
            <OperatedBy airlineCode={flight.airline_code} size="micro" />
          ) : (
            flight.airline_name && (
              <p className="mt-1" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
                Operated by {carrierName(flight.airline_name, flight.airline_code)}
              </p>
            )
          )}
        </div>

        <div className="text-right">
          <span
            className="mb-1 inline-flex items-center gap-1.5"
            style={{ fontSize: 'var(--text-micro)', color: c.ink, fontWeight: 600 }}
          >
            <span aria-hidden style={{ width: 8, height: 8, background: c.hue, borderRadius: 2 }} />
            {c.name}
          </span>
          <div className="tnum font-mono" style={{ fontSize: '1.4rem', fontWeight: 500 }}>
            {price(flight.price_usd)}
          </div>
          <div style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
            per passenger
          </div>
          {typeof seatsLeft === 'number' && seatsLeft > 0 && seatsLeft <= 9 && (
            <div className="tnum mt-1" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-warn)' }}>
              {seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} left
            </div>
          )}
        </div>
      </button>
    </li>
  )
}
