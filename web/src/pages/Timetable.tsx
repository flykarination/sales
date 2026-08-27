import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getTimetable, type DepartureRow } from '@/lib/queries'
import { getAirport, distanceKm } from '@/lib/geo'
import { count, dayOffset, duration, price, time, DOW_SHORT } from '@/lib/format'

/**
 * A printed timetable, in the airline heritage sense: every departure on a
 * city pair, by weekday, in one table you can read down.
 */
export default function Timetable() {
  const [params, setParams] = useSearchParams()
  const from = (params.get('from') ?? 'SGN').toUpperCase()
  const to = (params.get('to') ?? '').toUpperCase()
  const [rows, setRows] = useState<DepartureRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!to) { setRows([]); return }
    let live = true
    setRows(null); setFailed(false)
    getTimetable(from, to).then(({ data, error }) => {
      if (!live) return
      if (error) setFailed(true)
      else setRows((data ?? []).filter((r) => r.is_sellable))
    })
    return () => { live = false }
  }, [from, to])

  const km = to ? distanceKm(from, to) : NaN
  const originName = getAirport(from)?.city ?? from
  const destName = getAirport(to)?.city ?? to

  // one row per flight, with the weekdays it operates collapsed into a strip
  const flights = new Map<string, { r: DepartureRow; days: Set<number> }>()
  for (const r of rows ?? []) {
    const key = `${r.flight_id}-${r.direction}`
    if (!flights.has(key)) flights.set(key, { r, days: new Set() })
    flights.get(key)!.days.add(r.departure_day_of_week)
  }
  const list = [...flights.values()].sort((a, b) => a.r.departure_time.localeCompare(b.r.departure_time))

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 md:px-8">
      <h1 className="font-display" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.05 }}>
        Timetable
      </h1>

      <form
        className="mt-6 flex flex-wrap items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          const f = new FormData(e.currentTarget)
          setParams({ from: String(f.get('from') ?? '').toUpperCase(), to: String(f.get('to') ?? '').toUpperCase() })
        }}
      >
        <label className="block" style={{ width: 130 }}>
          <span className="kx-label">From</span>
          <input name="from" className="kx-input tnum font-mono" defaultValue={from} maxLength={3}
                 style={{ textTransform: 'uppercase' }} />
        </label>
        <label className="block" style={{ width: 130 }}>
          <span className="kx-label">To</span>
          <input name="to" className="kx-input tnum font-mono" defaultValue={to} maxLength={3}
                 placeholder="KGD" style={{ textTransform: 'uppercase' }} />
        </label>
        <button type="submit" className="kx-cta">Show</button>
        <Link to="/destinations" className="kx-navlink" style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
          Browse destinations
        </Link>
      </form>

      {to && (
        <p className="mt-7" style={{ fontSize: 'var(--text-lead)' }}>
          <strong>{originName}</strong> ({from}) to <strong>{destName}</strong> ({to})
          {Number.isFinite(km) && (
            <span className="tnum font-mono" style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
              {' '}· {count(km)} km
            </span>
          )}
        </p>
      )}

      {failed && (
        <p className="mt-6" style={{ color: 'var(--color-danger)', borderLeft: '2px solid var(--color-danger)', paddingLeft: 12 }}>
          The timetable is unavailable right now.{' '}
          <button className="underline" onClick={() => location.reload()} style={{ minHeight: 44 }}>Try again</button>
        </p>
      )}

      {!to && (
        <p className="mt-8" style={{ color: 'var(--color-ink-mute)' }}>
          Enter a destination code, or pick one from{' '}
          <Link to="/destinations" className="underline">our destinations</Link>.
        </p>
      )}

      {to && rows === null && !failed && (
        <p className="mt-8" style={{ color: 'var(--color-ink-mute)' }} aria-busy="true">Loading…</p>
      )}

      {to && rows && list.length === 0 && !failed && (
        <div className="mt-8" style={{ borderTop: '2px solid var(--color-ink)', paddingTop: 18 }}>
          <p style={{ fontSize: 'var(--text-lead)' }}>Karination does not fly {from} to {to}.</p>
          <p className="mt-2" style={{ color: 'var(--color-ink-mute)' }}>
            Try one of our hubs as the origin — SGN, HAN, DAD, CXR or PQC — or{' '}
            <Link to="/destinations" className="underline">browse where we fly</Link>.
          </p>
        </div>
      )}

      {list.length > 0 && (
        <div className="mt-7" style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ minWidth: 620, borderCollapse: 'collapse' }}>
            <caption className="sr-only">
              Weekly timetable, {from} to {to}. Times are local to each airport.
            </caption>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-ink)' }}>
                {['Flight', 'Departs', 'Arrives', 'Duration', 'Operates', 'Aircraft', 'From'].map((h) => (
                  <th key={h} scope="col" className="py-2 text-left font-mono uppercase"
                      style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.14em', color: 'var(--color-ink-mute)', fontWeight: 400 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(({ r, days }) => (
                <tr key={`${r.flight_id}-${r.direction}`} style={{ borderBottom: 'var(--rule)' }}>
                  <td className="tnum py-3 font-mono" style={{ fontWeight: 500 }}>{r.flight_designator}</td>
                  <td className="tnum py-3 font-mono" style={{ fontSize: 'var(--text-lead)' }}>{time(r.departure_time)}</td>
                  <td className="tnum py-3 font-mono" style={{ fontSize: 'var(--text-lead)' }}>
                    {time(r.arrival_time)}
                    {r.arrival_days_after_departure !== 0 && (
                      <sup style={{ fontSize: '0.55em', color: 'var(--color-spectrum-rose-ink)', marginLeft: 2 }}>
                        {dayOffset(r.arrival_days_after_departure)}
                      </sup>
                    )}
                  </td>
                  <td className="tnum py-3 font-mono" style={{ color: 'var(--color-ink-mute)' }}>{duration(r.duration_minutes)}</td>
                  <td className="py-3">
                    <span className="flex gap-1" aria-label={[...days].sort().map((d) => DOW_SHORT[d]).join(', ')}>
                      {DOW_SHORT.map((d, i) => (
                        <span key={d} aria-hidden className="font-mono"
                              style={{
                                fontSize: 'var(--text-micro)', width: 22, textAlign: 'center',
                                padding: '2px 0', borderRadius: 2,
                                background: days.has(i) ? 'var(--color-ink)' : 'transparent',
                                color: days.has(i) ? 'var(--color-paper)' : 'var(--color-ink-faint)',
                              }}>
                          {d[0]}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-3" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>{r.aircraft_model}</td>
                  <td className="tnum py-3 font-mono" style={{ fontWeight: 500 }}>{price(r.price_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
            All times are local to their own airport. Fares are the lowest Economy
            price on that departure.
          </p>
        </div>
      )}
    </div>
  )
}
