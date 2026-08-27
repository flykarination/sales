import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { arrivalsAt, departuresFrom } from '@/lib/queries'
import { airportLabel } from '@/data/airports'
import { dayOffset, duration, time, toGameDow, DOW_LONG } from '@/lib/format'

const HUBS = [
  ['SGN', 'TP Hồ Chí Minh'], ['HAN', 'Hà Nội'], ['DAD', 'Đà Nẵng'],
  ['CXR', 'Nha Trang'], ['PQC', 'Phú Quốc'],
] as const

type Board = 'departures' | 'arrivals'

interface Row {
  flight_id: string
  flight_designator: string
  origin_iata: string
  destination_iata: string
  departure_time: string
  arrival_time: string
  arrival_days_after_departure: number
  duration_minutes: number
  aircraft_model: string
  departure_day_of_week: number
}

/**
 * A departures and arrivals board.
 *
 * Both boards are cut on the server from the current wall clock forward — the
 * hubs run over 400 movements a day, so fetching a fixed early slice and
 * filtering in the browser leaves the evening blank.
 */
export default function FlightStatus() {
  const [hub, setHub] = useState<string>('SGN')
  const [board, setBoard] = useState<Board>('departures')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [rolledOver, setRolledOver] = useState(false)
  const [failed, setFailed] = useState(false)

  const now = new Date()
  const dow = toGameDow(now)
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  useEffect(() => {
    let live = true
    setRows(null); setFailed(false); setRolledOver(false)

    const load = async () => {
      if (board === 'departures') {
        const { data, error } = await departuresFrom(hub, dow, clock, 60)
        if (error) return { error, list: [] as Row[], wrapped: false }
        let list = (data ?? []) as unknown as Row[]
        // nothing left today: roll the board over to tomorrow's first movements
        let wrapped = false
        if (list.length === 0) {
          const next = await departuresFrom(hub, (dow + 1) % 7, undefined, 40)
          if (next.error) return { error: next.error, list: [], wrapped: false }
          list = (next.data ?? []) as unknown as Row[]
          wrapped = true
        }
        return { error: null, list, wrapped }
      }

      const { data, error } = await arrivalsAt(hub, dow, clock, 60)
      if (error) return { error, list: [] as Row[], wrapped: false }
      // keep only those that actually land today
      const landing = ((data ?? []) as unknown as Row[]).filter(
        (r) => (r.departure_day_of_week + r.arrival_days_after_departure) % 7 === dow,
      )
      let wrapped = false
      let list = landing
      if (list.length === 0) {
        const next = await arrivalsAt(hub, (dow + 1) % 7, undefined, 40)
        if (next.error) return { error: next.error, list: [], wrapped: false }
        list = ((next.data ?? []) as unknown as Row[]).filter(
          (r) => (r.departure_day_of_week + r.arrival_days_after_departure) % 7 === (dow + 1) % 7,
        )
        wrapped = true
      }
      return { error: null, list, wrapped }
    }

    load().then(({ error, list, wrapped }) => {
      if (!live) return
      if (error) { setFailed(true); return }
      setRows(list.slice(0, 60))
      setRolledOver(wrapped)
    })

    return () => { live = false }
  }, [hub, dow, board, clock])

  const isDep = board === 'departures'
  const boardDow = rolledOver ? (dow + 1) % 7 : dow

  return (
    <div className="on-ink min-h-screen px-5 py-12 md:px-8" style={{ background: 'var(--color-ink)' }}>
      <div className="mx-auto max-w-5xl">
        <p
          className="mb-4 font-mono uppercase"
          style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.24em', color: 'var(--color-aqua)' }}
        >
          {isDep ? 'Departures' : 'Arrivals'} · {DOW_LONG[boardDow]}
          {rolledOver ? ' (tomorrow)' : ''}
        </p>
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display" style={{ fontSize: 'clamp(2rem,5.5vw,3.4rem)', color: 'var(--color-paper)', lineHeight: 1.05 }}>
            Flight status
          </h1>
          <p className="tnum font-mono" style={{ fontSize: '1.6rem', color: 'var(--color-aqua)' }}>{clock}</p>
        </div>

        {/* departures / arrivals */}
        <div
          className="mb-5 inline-flex gap-1 p-1"
          role="radiogroup"
          aria-label="Board"
          style={{ border: '1px solid rgba(255,255,255,.2)', borderRadius: 'var(--radius-edge)' }}
        >
          {(['departures', 'arrivals'] as Board[]).map((b) => (
            <button
              key={b}
              role="radio"
              aria-checked={board === b}
              onClick={() => setBoard(b)}
              className="font-mono uppercase"
              style={{
                fontSize: 'var(--text-micro)', letterSpacing: '0.16em',
                padding: '9px 16px', minHeight: 40, borderRadius: 'var(--radius-edge)',
                background: board === b ? 'var(--color-aqua)' : 'transparent',
                color: board === b ? 'var(--color-ink)' : '#B9B6D8',
                fontWeight: board === b ? 600 : 400,
              }}
            >
              {b}
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Choose a hub">
          {HUBS.map(([code, city]) => (
            <button
              key={code} onClick={() => setHub(code)} aria-pressed={hub === code}
              className="font-mono uppercase"
              style={{
                fontSize: 'var(--text-micro)', letterSpacing: '0.14em', padding: '9px 13px',
                minHeight: 42, borderRadius: 'var(--radius-edge)',
                border: `1px solid ${hub === code ? 'var(--color-aqua)' : 'rgba(255,255,255,.2)'}`,
                background: hub === code ? 'rgba(255,255,255,.08)' : 'transparent',
                color: hub === code ? 'var(--color-paper)' : '#B9B6D8',
              }}
            >
              {code} · {city}
            </button>
          ))}
        </div>

        {failed && (
          <p style={{ color: '#D7B8C8' }}>
            The board is unavailable right now.{' '}
            <button className="underline" onClick={() => location.reload()} style={{ color: 'var(--color-aqua)', minHeight: 44 }}>
              Try again
            </button>
          </p>
        )}

        {!rows && !failed && <p style={{ color: '#8F8CB4' }} aria-busy="true">Loading the board…</p>}

        {rows && rows.length === 0 && (
          <p style={{ color: '#B9B6D8' }}>
            No {isDep ? 'departures from' : 'arrivals into'} {hub} on a {DOW_LONG[dow]}.
          </p>
        )}

        {rows && rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="tnum w-full font-mono" style={{ minWidth: 620, borderCollapse: 'collapse' }}>
              <caption className="sr-only">
                Scheduled {board} for {hub} on {DOW_LONG[boardDow]}
              </caption>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.2)' }}>
                  {[isDep ? 'Departs' : 'Arrives', 'Flight', isDep ? 'To' : 'From',
                    isDep ? 'Arrives' : 'Departed', 'Aircraft', 'Status'].map((h) => (
                    <th key={h} scope="col" className="py-2 text-left uppercase"
                        style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.16em', color: '#8F8CB4', fontWeight: 400 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const headline = isDep ? r.departure_time : r.arrival_time
                  const secondary = isDep ? r.arrival_time : r.departure_time
                  const other = isDep ? r.destination_iata : r.origin_iata
                  return (
                    <tr key={`${r.flight_id}-${headline}-${other}`}
                        style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                      <td className="py-2.5" style={{ color: 'var(--color-paper)', fontSize: 'var(--text-lead)' }}>
                        {time(headline)}
                      </td>
                      <td style={{ color: 'var(--color-aqua)' }}>{r.flight_designator}</td>
                      <td style={{ color: 'var(--color-paper)' }}>
                        {other}
                        <span style={{ color: '#8F8CB4', fontSize: 'var(--text-micro)' }}>
                          {' '}{airportLabel(other)}
                        </span>
                      </td>
                      <td style={{ color: '#B9B6D8' }}>
                        {time(secondary)}
                        {r.arrival_days_after_departure !== 0 && (
                          <sup style={{ fontSize: '0.6em', color: 'var(--color-spectrum-rose)' }}>
                            {dayOffset(isDep ? r.arrival_days_after_departure : -r.arrival_days_after_departure)}
                          </sup>
                        )}
                        <span style={{ color: '#6B6790', fontSize: 'var(--text-micro)' }}> {duration(r.duration_minutes)}</span>
                      </td>
                      <td style={{ color: '#8F8CB4', fontSize: 'var(--text-small)' }}>{r.aircraft_model}</td>
                      <td className="uppercase"
                          style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.14em', color: 'var(--color-spectrum-lime)' }}>
                        {rolledOver ? 'Scheduled' : 'On time'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-5" style={{ color: '#6B6790', fontSize: 'var(--text-micro)' }}>
              {rolledOver
                ? `Nothing further today — showing tomorrow's first ${board}.`
                : `Next ${rows.length} ${board} from ${clock}.`}{' '}
              Times are local to {hub}.{' '}
              <Link to="/timetable" style={{ color: 'var(--color-aqua)' }}>Full timetable →</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
