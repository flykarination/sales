import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { departuresFrom } from '@/lib/queries'
import { airportLabel } from '@/data/airports'
import { time } from '@/lib/format'

interface Row {
  flight_designator: string
  destination_iata: string
  departure_time: string
  aircraft_model: string
}

/** Weekday (0 = Monday, as the schedule counts) and HH:MM, on a hub's own clock. */
function clockAt(zone: string): { dow: number; hhmm: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'))
  const h = Number(get('hour')) % 24
  const m = Number(get('minute'))
  return { dow, hhmm: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, minutes: h * 60 + m }
}

/**
 * The next scheduled departure from Sài Gòn, on Sài Gòn's clock -- the
 * counterpart of a race site's "next race": proof the network is alive.
 * Refreshes each minute while visible; disappears quietly if the schedule
 * cannot be reached, because a broken widget is worse than none.
 */
export function NextDeparture({ hub = 'SGN', zone = 'Asia/Ho_Chi_Minh' }: { hub?: string; zone?: string }) {
  const [row, setRow] = useState<Row | null>(null)
  const [mins, setMins] = useState<number | null>(null)

  useEffect(() => {
    let live = true
    const load = async () => {
      if (document.visibilityState === 'hidden') return
      const now = clockAt(zone)
      let { data } = await departuresFrom(hub, now.dow, now.hhmm, 1)
      let rolled = false
      if (!data?.length) {            // nothing left today: tomorrow's first
        ({ data } = await departuresFrom(hub, (now.dow + 1) % 7, undefined, 1))
        rolled = true
      }
      if (!live) return
      const r = (data?.[0] as Row | undefined) ?? null
      setRow(r)
      if (r) {
        const [h, m] = r.departure_time.split(':').map(Number)
        setMins(h * 60 + m - now.minutes + (rolled ? 1440 : 0))
      }
    }
    load()
    const t = window.setInterval(load, 60_000)
    return () => { live = false; window.clearInterval(t) }
  }, [hub, zone])

  if (!row) return null
  const soon = mins !== null && mins >= 0
    ? mins < 60 ? `in ${mins} min` : `in ${Math.floor(mins / 60)} h ${mins % 60} min`
    : ''

  return (
    <Link
      to={`/flight-status`}
      className="kx-glass inline-flex items-center gap-4 px-4 py-3"
      style={{ color: 'var(--color-starlight)', maxWidth: '100%' }}
      aria-label={`Next departure from ${airportLabel(hub)}: ${row.flight_designator} to ${airportLabel(row.destination_iata)} at ${time(row.departure_time)}, ${soon}. See flight status.`}
    >
      <span className="kx-live-dot flex-none" aria-hidden />
      <span className="min-w-0" aria-hidden>
        <span className="kx-eyebrow block" style={{ color: 'var(--color-starlight-mute)' }}>
          Next departure · {airportLabel(hub)}
        </span>
        <span className="mt-1 flex flex-wrap items-baseline gap-x-3">
          <span className="tnum font-mono" style={{ fontSize: '1.25rem', fontWeight: 600 }}>{time(row.departure_time)}</span>
          <span style={{ fontWeight: 600 }}>{airportLabel(row.destination_iata)}</span>
          <span className="tnum font-mono" style={{ fontSize: 'var(--text-small)', color: 'var(--color-starlight-mute)' }}>
            {row.flight_designator}{soon ? ` · ${soon}` : ''}
          </span>
        </span>
      </span>
    </Link>
  )
}
