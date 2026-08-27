import { useEffect, useState } from 'react'
import { listCodeshares } from '@/lib/queries'
import { getAirport } from '@/lib/geo'
import { carrierName, count } from '@/lib/format'
import { assetUrl } from '@/lib/assets'

interface CodeshareRow {
  codeshare_id: string
  origin_iata: string
  destination_iata: string
  operating_airline_name: string | null
  operating_airline_code: string | null
  operating_designator: string
  marketing_airline_uid: string
  marketing_airline_name: string | null
  marketing_airline_code: string | null
}

export default function Partners() {
  const [rows, setRows] = useState<CodeshareRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    listCodeshares().then(({ data, error }) => {
      if (!live) return
      if (error || !data) setFailed(true)
      else setRows(data as CodeshareRow[])
    })
    return () => { live = false }
  }, [])

  const partners = new Map<string, CodeshareRow[]>()
  for (const r of rows ?? []) {
    if (!partners.has(r.marketing_airline_uid)) partners.set(r.marketing_airline_uid, [])
    partners.get(r.marketing_airline_uid)!.push(r)
  }

  return (
    <div>
      <section className="on-ink px-5 py-14 md:px-8 md:py-20" style={{ background: 'var(--color-ink)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center gap-4">
            <img src={assetUrl('/brand/echo-aegis.png')} alt="" style={{ height: 40, width: 'auto', borderRadius: 8 }} />
            <p
              className="font-mono uppercase"
              style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.24em', color: 'var(--color-aqua)' }}
            >
              Echo Aegis
            </p>
          </div>
          <h1
            className="font-display"
            style={{ fontSize: 'clamp(2rem,5.5vw,4rem)', lineHeight: 1.04, color: 'var(--color-paper)', maxWidth: '17ch' }}
          >
            Further than we fly alone.
          </h1>
          <p className="mt-5" style={{ color: '#B9B6D8', maxWidth: '54ch' }}>
            Karination is a member of the Echo Aegis alliance. On the routes below a
            partner sells the seat under their own flight number while we operate the
            aircraft — your ticket will say “operated by Karination”.
          </p>
        </div>
      </section>

      <section className="px-5 py-14 md:px-8">
        <div className="mx-auto max-w-5xl">
          {failed && (
            <p style={{ color: 'var(--color-danger)', borderLeft: '2px solid var(--color-danger)', paddingLeft: 12 }}>
              Partner routes are unavailable right now.{' '}
              <button className="underline" onClick={() => location.reload()} style={{ minHeight: 44 }}>
                Try again
              </button>
            </p>
          )}
          {!rows && !failed && <p style={{ color: 'var(--color-ink-mute)' }} aria-busy="true">Loading…</p>}

          {rows && (
            <>
              <p className="mb-10" style={{ color: 'var(--color-ink-mute)' }}>
                {count(rows.length)} codeshare agreements with {partners.size} partner
                {partners.size === 1 ? '' : 's'}, reaching{' '}
                {new Set(rows.map((r) => r.destination_iata)).size} destinations.
              </p>

              {[...partners.entries()].map(([uid, list], i) => (
                <section key={uid} className="mb-12">
                  <h2 className="mb-1" style={{ fontSize: 'var(--text-lead)', fontWeight: 600 }}>
                    {carrierName(list[0].marketing_airline_name, list[0].marketing_airline_code)}
                    <span
                      className="ml-3 font-mono"
                      style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)', letterSpacing: '0.12em' }}
                    >
                      PARTNER {String(i + 1).padStart(2, '0')} · {count(list.length)} ROUTES
                    </span>
                  </h2>
                  <p className="mb-3" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-faint)' }}>
                    Outside KarinationGroup, so our schedule carries only their identifier.
                  </p>
                  <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3" style={{ borderTop: '2px solid var(--color-ink)' }}>
                    {list.map((r) => (
                      <li key={r.codeshare_id} className="flex min-w-0 items-baseline gap-3 py-2.5" style={{ borderBottom: 'var(--rule)' }}>
                        <span className="tnum font-mono" style={{ color: 'var(--color-aqua-deep)', fontSize: 'var(--text-small)' }}>
                          {r.origin_iata}→{r.destination_iata}
                        </span>
                        <span className="min-w-0 truncate" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
                          {getAirport(r.destination_iata)?.city ?? ''}
                        </span>
                        <span className="tnum ml-auto font-mono" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
                          {r.operating_designator}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
