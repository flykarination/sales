import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { departuresFrom } from '@/lib/queries'
import { getAirport } from '@/lib/geo'
import { dayOffset, duration, time, toGameDow, DOW_LONG } from '@/lib/format'

const HUBS = [
  ['SGN', 'Sài Gòn'], ['HAN', 'Hà Nội'], ['DAD', 'Đà Nẵng'],
  ['CXR', 'Nha Trang'], ['PQC', 'Phú Quốc'],
] as const

interface Row {
  flight_id: string
  flight_designator: string
  destination_iata: string
  departure_time: string
  arrival_time: string
  arrival_days_after_departure: number
  duration_minutes: number
  aircraft_model: string
}

/**
 * A departures board. Real airline sites all have one; ours is honest about
 * what it is — a scheduled board, since this world has no live movements.
 */
export default function FlightStatus() {
  const [hub, setHub] = useState<string>('SGN')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)
  const now = new Date()
  const dow = toGameDow(now)
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  useEffect(() => {
    let live = true
    setRows(null); setFailed(false)
    departuresFrom(hub, dow).then(({ data, error }) => {
      if (!live) return
      if (error || !data) setFailed(true)
      else setRows(data as Row[])
    })
    return () => { live = false }
  }, [hub, dow])

  // scheduled departures still to come today, then the rest
  const upcoming = (rows ?? []).filter((r) => r.departure_time.slice(0, 5) >= clock)
  const earlier = (rows ?? []).filter((r) => r.departure_time.slice(0, 5) < clock)
  const ordered = [...upcoming, ...earlier]

  return (
    <div className="on-ink min-h-screen px-5 py-12 md:px-8" style={{ background: 'var(--color-ink)' }}>
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 font-mono uppercase"
           style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.24em', color: 'var(--color-aqua)' }}>
          Departures · {DOW_LONG[dow]}
        </p>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display" style={{ fontSize: 'clamp(2rem,5.5vw,3.4rem)', color: 'var(--color-paper)', lineHeight: 1.05 }}>
            Flight status
          </h1>
          <p className="tnum font-mono" style={{ fontSize: '1.6rem', color: 'var(--color-aqua)' }}>{clock}</p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Choose a hub">
          {HUBS.map(([code, city]) => (
            <button key={code} onClick={() => setHub(code)} aria-pressed={hub === code}
              className="font-mono uppercase"
              style={{
                fontSize: 'var(--text-micro)', letterSpacing: '0.14em', padding: '9px 13px',
                minHeight: 42, borderRadius: 'var(--radius-edge)',
                border: `1px solid ${hub === code ? 'var(--color-aqua)' : 'rgba(255,255,255,.2)'}`,
                background: hub === code ? 'rgba(255,255,255,.08)' : 'transparent',
                color: hub === code ? 'var(--color-paper)' : '#B9B6D8',
              }}>
              {code} · {city}
            </button>
          ))}
        </div>

        {failed && <p style={{ color: '#D7B8C8' }}>The board is unavailable right now.{' '}
          <button className="underline" onClick={() => location.reload()} style={{ color: 'var(--color-aqua)', minHeight: 44 }}>Try again</button></p>}

        {!rows && !failed && <p style={{ color: '#8F8CB4' }} aria-busy="true">Loading the board…</p>}

        {rows && ordered.length === 0 && (
          <p style={{ color: '#B9B6D8' }}>No departures from {hub} on a {DOW_LONG[dow]}.</p>
        )}

        {ordered.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="tnum w-full font-mono" style={{ minWidth: 620, borderCollapse: 'collapse' }}>
              <caption className="sr-only">Scheduled departures from {hub} on {DOW_LONG[dow]}</caption>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.2)' }}>
                  {['Time', 'Flight', 'To', 'Arrives', 'Aircraft', 'Status'].map((h) => (
                    <th key={h} scope="col" className="py-2 text-left uppercase"
                        style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.16em', color: '#8F8CB4', fontWeight: 400 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordered.slice(0, 60).map((r) => {
                  const departed = r.departure_time.slice(0, 5) < clock
                  return (
                    <tr key={r.flight_id + r.departure_time}
                        style={{ borderBottom: '1px solid rgba(255,255,255,.08)', opacity: departed ? 0.45 : 1 }}>
                      <td className="py-2.5" style={{ color: 'var(--color-paper)', fontSize: 'var(--text-lead)' }}>
                        {time(r.departure_time)}
                      </td>
                      <td style={{ color: 'var(--color-aqua)' }}>{r.flight_designator}</td>
                      <td style={{ color: 'var(--color-paper)' }}>
                        {r.destination_iata}
                        <span style={{ color: '#8F8CB4', fontSize: 'var(--text-micro)' }}>
                          {' '}{getAirport(r.destination_iata)?.city ?? ''}
                        </span>
                      </td>
                      <td style={{ color: '#B9B6D8' }}>
                        {time(r.arrival_time)}
                        {r.arrival_days_after_departure !== 0 && (
                          <sup style={{ fontSize: '0.6em', color: 'var(--color-spectrum-rose)' }}>
                            {dayOffset(r.arrival_days_after_departure)}
                          </sup>
                        )}
                        <span style={{ color: '#6B6790', fontSize: 'var(--text-micro)' }}> {duration(r.duration_minutes)}</span>
                      </td>
                      <td style={{ color: '#8F8CB4', fontSize: 'var(--text-small)' }}>{r.aircraft_model}</td>
                      <td className="uppercase" style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.14em',
                            color: departed ? '#6B6790' : 'var(--color-spectrum-lime)' }}>
                        {departed ? 'Departed' : 'On time'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-5" style={{ color: '#6B6790', fontSize: 'var(--text-micro)' }}>
              Scheduled times, local to {hub}. Showing {Math.min(ordered.length, 60)} of {ordered.length} departures
              today. <Link to="/timetable" style={{ color: 'var(--color-aqua)' }}>Full timetable →</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
