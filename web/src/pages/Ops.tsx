import { useCallback, useEffect, useState } from 'react'
import { opsRecentSales, opsSnapshot } from '@/lib/queries'
import { count, price, shortDate } from '@/lib/format'

/**
 * Operator dashboard. Compiled out of production builds entirely — the route is
 * behind `import.meta.env.DEV` in App.tsx, so Rollup drops this chunk. The data
 * behind it is also revoked from the publishable key, so even the API refuses
 * it without the ops token.
 */
interface DashRow {
  airline_code: string | null
  travel_date: string
  departures: number
  seats_offered: number
  seats_sold: number
  seats_sold_to_real_customers: number
  load_factor_pct: number
  revenue_usd: number
  sold_out_departures: number
}

interface SaleRow {
  occurred_at: string
  origin_iata: string | null
  destination_iata: string | null
  travel_date: string
  cabin_code: string
  seats_sold: number
  revenue_usd: number
}

export default function Ops() {
  const [rows, setRows] = useState<DashRow[]>([])
  const [sales, setSales] = useState<SaleRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [at, setAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      const [snap, feed] = await Promise.all([opsSnapshot(), opsRecentSales()])
      if (snap.error) throw new Error(snap.error.message)
      setRows((snap.data ?? []) as DashRow[])
      setSales(((feed.data ?? []) as SaleRow[]).slice(0, 14))
      setAt(new Date())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load operations data.')
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  const totals = rows.reduce(
    (acc, r) => ({
      offered: acc.offered + Number(r.seats_offered ?? 0),
      sold: acc.sold + Number(r.seats_sold ?? 0),
      real: acc.real + Number(r.seats_sold_to_real_customers ?? 0),
      revenue: acc.revenue + Number(r.revenue_usd ?? 0),
      soldOut: acc.soldOut + Number(r.sold_out_departures ?? 0),
    }),
    { offered: 0, sold: 0, real: 0, revenue: 0, soldOut: 0 },
  )
  const lf = totals.offered ? (100 * totals.sold) / totals.offered : 0

  return (
    <div className="on-ink min-h-screen px-5 py-10 md:px-8" style={{ background: 'var(--color-ink)' }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-baseline gap-4">
          <h1 className="font-mono uppercase" style={{ letterSpacing: '0.2em', color: 'var(--color-aqua)', fontSize: 'var(--text-small)' }}>
            Operations · dev only
          </h1>
          <span style={{ color: '#6B6790', fontSize: 'var(--text-micro)' }}>
            {at ? `updated ${at.toLocaleTimeString()}` : 'loading…'} · refreshes every 30s
          </span>
          <button onClick={load} className="ml-auto" style={{ color: 'var(--color-aqua)', fontSize: 'var(--text-small)', minHeight: 44 }}>
            Refresh now
          </button>
        </div>

        {error && (
          <p role="alert" style={{ color: '#F080A0', borderLeft: '2px solid #F080A0', paddingLeft: 12 }}>
            {error}
          </p>
        )}

        <dl className="mb-10 grid grid-cols-2 gap-6 md:grid-cols-5">
          {[
            ['Seats offered', count(totals.offered), 'var(--color-spectrum-teal)'],
            ['Seats sold', count(totals.sold), 'var(--color-spectrum-lime)'],
            ['Load factor', `${lf.toFixed(1)}%`, 'var(--color-spectrum-amber)'],
            ['Revenue', price(totals.revenue), 'var(--color-spectrum-rose)'],
            ['Sold out', count(totals.soldOut), 'var(--color-spectrum-magenta)'],
          ].map(([label, value, hue]) => (
            <div key={label}>
              <span aria-hidden className="mb-2 block" style={{ width: 24, height: 2, background: hue }} />
              <dd className="tnum font-mono" style={{ color: 'var(--color-paper)', fontSize: 'clamp(1.2rem, 2.6vw, 1.7rem)', fontWeight: 500 }}>
                {value}
              </dd>
              <dt className="font-mono uppercase" style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.14em', color: '#6B6790' }}>
                {label}
              </dt>
            </div>
          ))}
        </dl>

        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div style={{ overflowX: 'auto' }}>
            <table className="tnum w-full font-mono" style={{ fontSize: 'var(--text-small)', minWidth: 520 }}>
              <caption className="sr-only">Load factor by carrier and date</caption>
              <thead>
                <tr style={{ color: '#6B6790' }}>
                  {['Date', 'Deps', 'Offered', 'Sold', 'Real', 'LF', 'Revenue'].map((h) => (
                    <th key={h} scope="col" className="py-2 text-left font-normal uppercase" style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.12em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.airline_code}-${r.travel_date}`} style={{ borderTop: '1px solid rgba(255,255,255,.08)', color: 'var(--color-paper)' }}>
                    <td className="py-2">{shortDate(r.travel_date)}</td>
                    <td>{count(r.departures)}</td>
                    <td>{count(r.seats_offered)}</td>
                    <td>{count(r.seats_sold)}</td>
                    <td style={{ color: r.seats_sold_to_real_customers > 0 ? 'var(--color-aqua)' : '#6B6790' }}>
                      {count(r.seats_sold_to_real_customers)}
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span aria-hidden style={{ width: 40, height: 4, background: 'rgba(255,255,255,.12)', borderRadius: 2, overflow: 'hidden', display: 'inline-block' }}>
                          <span style={{ display: 'block', height: '100%', width: `${Math.min(Number(r.load_factor_pct), 100)}%`, background: 'var(--paint-spectrum)' }} />
                        </span>
                        {Number(r.load_factor_pct).toFixed(1)}%
                      </span>
                    </td>
                    <td>{price(r.revenue_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside>
            <h2 className="mb-3 font-mono uppercase" style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.18em', color: '#6B6790' }}>
              Just sold
            </h2>
            <ul>
              {sales.map((s, i) => (
                <li key={i} className="flex items-baseline gap-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                  <span className="tnum font-mono" style={{ color: 'var(--color-aqua)', fontSize: 'var(--text-micro)' }}>
                    {s.origin_iata}→{s.destination_iata}
                  </span>
                  <span className="tnum font-mono" style={{ color: 'var(--color-paper)', fontSize: 'var(--text-micro)' }}>
                    ×{s.seats_sold}
                  </span>
                  <span className="tnum ml-auto font-mono" style={{ color: '#8F8CB4', fontSize: 'var(--text-micro)' }}>
                    {price(s.revenue_usd)}
                  </span>
                </li>
              ))}
              {sales.length === 0 && !error && (
                <li style={{ color: '#6B6790', fontSize: 'var(--text-small)' }}>
                  Nothing in the last few hours. Run <code>select public.simulate_bookings();</code>
                </li>
              )}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  )
}
