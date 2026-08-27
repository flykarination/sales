import { useId, useState } from 'react'
import { cabin } from '@/lib/cabins'
import {
  carrierName, dayOffset, dayOffsetSpoken, duration, durationSpoken,
  price, shortDate, time, timeSpoken,
} from '@/lib/format'
import { airportLabel } from '@/data/airports'
import type { Itinerary } from '@/lib/queries'
import { OperatedBy } from '@/components/OperatedBy'
import { operatedNoteFor } from '@/data/carriers'

/**
 * One connecting itinerary.
 *
 * The row reads the way a traveller scans: when it leaves, when it lands,
 * how long that takes end to end, and how many stops. The connection is the
 * part people actually worry about, so each wait is stated in hours and
 * minutes against the airport it happens at, and a wait long enough to
 * involve a night is called an overnight rather than left as "14h 10m" for
 * the reader to work out.
 *
 * Legs are collapsed by default -- the summary is what the choice is made
 * on -- and expand in place for anyone who wants flight numbers and metal.
 */
export function ItineraryOption({
  itinerary, selected, onSelect,
}: {
  itinerary: Itinerary
  selected?: boolean
  onSelect?: (it: Itinerary) => void
}) {
  const [open, setOpen] = useState(false)
  const detailId = useId()

  const first = itinerary.legs[0]
  const last = itinerary.legs[itinerary.legs.length - 1]
  const c = cabin(first.cabin_code)

  const nights = dayDiff(first.departure_date, last.arrival_date)

  /** Carriers on this itinerary that warrant a note, each named once. */
  const operators = [...new Set(
    itinerary.legs.map((l) => l.airline_code).filter((c): c is string => !!operatedNoteFor(c)),
  )]

  const stopsText =
    itinerary.stops === 1 ? `1 stop via ${itinerary.via[0]}` : `${itinerary.stops} stops via ${itinerary.via.join(' and ')}`

  const label =
    `Depart ${timeSpoken(first.departure_time)} from ${first.origin_iata}, ` +
    `arrive ${timeSpoken(last.arrival_time)} at ${last.destination_iata}${dayOffsetSpoken(nights)}. ` +
    `${durationSpoken(itinerary.totalMinutes)} in total, ${stopsText}, ` +
    itinerary.waits.map((w, i) => `${durationSpoken(w)} in ${itinerary.via[i]}`).join(', ') +
    `. ${c.longName}, ${price(itinerary.totalPriceUsd)} per passenger.` +
    operators.map((code) => ` ${operatedNoteFor(code)}`).join('')

  return (
    <li style={{ borderBottom: 'var(--rule)', borderLeft: `3px solid ${selected ? c.hue : 'transparent'}`, background: selected ? c.wash : 'transparent' }}>
      <button
        type="button"
        onClick={() => onSelect?.(itinerary)}
        aria-label={label}
        aria-pressed={selected}
        className="kx-row grid w-full items-center gap-x-5 gap-y-3 px-4 py-4 text-left md:px-5"
        style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="tnum font-mono" style={{ fontSize: 'var(--text-time)', fontWeight: 500, lineHeight: 1.1 }}>
              {time(first.departure_time)}
            </span>
            <span aria-hidden style={{ color: 'var(--color-ink-faint)' }}>—</span>
            <span className="tnum font-mono" style={{ fontSize: 'var(--text-time)', fontWeight: 500, lineHeight: 1.1 }}>
              {time(last.arrival_time)}
              {nights !== 0 && (
                <sup className="tnum" style={{ fontSize: '0.5em', color: 'var(--color-spectrum-rose-ink)', marginLeft: 2 }}>
                  {dayOffset(nights)}
                </sup>
              )}
            </span>
          </div>

          <div
            className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono uppercase"
            style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.12em', color: 'var(--color-ink-mute)' }}
          >
            <span>{first.origin_iata} → {last.destination_iata}</span>
            <span className="tnum">{duration(itinerary.totalMinutes)}</span>
            <span style={{ color: 'var(--color-spectrum-amber-ink)', fontWeight: 600 }}>{stopsText}</span>
          </div>

          {/* a connection can mix carriers, so name every one that is not
              Karination rather than only the first */}
          {operators.map((code) => (
            <OperatedBy key={code} airlineCode={code} size="micro" />
          ))}

          {/* the waits, said plainly */}
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {itinerary.waits.map((w, i) => (
              <li
                key={itinerary.via[i] + i}
                className="flex items-center gap-1.5"
                style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-mute)' }}
              >
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, background: waitHue(w), flex: 'none' }} />
                <span className="tnum">{duration(w)}</span>
                {/* keep the city whole; on a phone it was breaking mid-name */}
                <span style={{ whiteSpace: 'nowrap' }}>in {airportLabel(itinerary.via[i])}</span>
                {w >= 600 && (
                  <span style={{ color: 'var(--color-spectrum-rose-ink)', fontWeight: 600 }}>· overnight</span>
                )}
                {w < 90 && (
                  <span style={{ color: 'var(--color-spectrum-amber-ink)', fontWeight: 600 }}>· tight</span>
                )}
              </li>
            ))}
          </ul>
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
            {price(itinerary.totalPriceUsd)}
          </div>
          <div style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
            per passenger
          </div>
        </div>
      </button>

      <div className="px-4 pb-3 md:px-5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={detailId}
          className="font-mono uppercase"
          style={{
            fontSize: 'var(--text-micro)', letterSpacing: '0.14em',
            color: 'var(--color-ink-mute)', minHeight: 36, textDecoration: 'underline',
          }}
        >
          {open ? 'Hide flight details' : 'Flight details'}
        </button>

        {open && (
          <ol id={detailId} className="mt-2" style={{ borderLeft: '2px solid var(--color-paper-edge)', paddingLeft: 14 }}>
            {itinerary.legs.map((leg, i) => (
              <li key={`${leg.flight_id}-${leg.direction}`} className="pb-3">
                <div
                  className="flex flex-wrap items-baseline gap-x-3 font-mono"
                  style={{ fontSize: 'var(--text-small)' }}
                >
                  <span className="tnum" style={{ fontWeight: 500 }}>
                    {time(leg.departure_time)} {leg.origin_iata}
                  </span>
                  <span aria-hidden style={{ color: 'var(--color-ink-faint)' }}>→</span>
                  <span className="tnum" style={{ fontWeight: 500 }}>
                    {time(leg.arrival_time)} {leg.destination_iata}
                  </span>
                  <span className="tnum" style={{ color: 'var(--color-ink-faint)' }}>
                    {duration(leg.duration_minutes)}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-mute)' }}>
                  {leg.flight_designator} · {leg.aircraft_model} · {shortDate(leg.departure_date)}
                  {leg.airline_name ? ` · ${carrierName(leg.airline_name, leg.airline_code)}` : ''}
                </p>
                <OperatedBy airlineCode={leg.airline_code} size="micro" />

                {/* the wait sits between the legs it separates, where it belongs */}
                {i < itinerary.waits.length && (
                  <p
                    className="mt-2"
                    style={{
                      fontSize: 'var(--text-micro)', color: 'var(--color-ink-mute)',
                      borderTop: 'var(--rule)', borderBottom: 'var(--rule)',
                      padding: '6px 0', fontWeight: 600,
                    }}
                  >
                    <span className="tnum">{duration(itinerary.waits[i])}</span>{' '}
                    connection in {airportLabel(itinerary.via[i])}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </li>
  )
}

/** Green when comfortable, amber when tight, rose when it means a night. */
function waitHue(minutes: number): string {
  if (minutes < 90) return 'var(--color-spectrum-amber)'
  if (minutes >= 600) return 'var(--color-spectrum-rose)'
  return 'var(--color-spectrum-teal)'
}

function dayDiff(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)
}
