import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { guideByIata } from '@/data/destinations'
import photos from '@/data/destination-photos.json'
import { listRoutes, type RouteRow } from '@/lib/queries'
import { distanceKm, getAirport, regionOf } from '@/lib/geo'
import { REGION_STYLE } from '@/lib/cabins'
import { count, duration, price } from '@/lib/format'
import { assetUrl } from '@/lib/assets'

interface Photo {
  iata: string; city: string; file: string; thumb: string
  license: string | null; license_url: string | null; artist: string | null; source: string | null
}
const photoByIata = new Map((photos as Photo[]).map((p) => [p.iata, p]))

export default function DestinationGuide() {
  const { iata: raw } = useParams()
  const iata = (raw ?? '').toUpperCase()
  const guide = guideByIata.get(iata)
  const photo = photoByIata.get(iata)
  const [routes, setRoutes] = useState<RouteRow[]>([])
  const reduced = useReducedMotion()

  useEffect(() => {
    let live = true
    listRoutes(900).then(({ data }) => {
      if (live && data) setRoutes(data.filter((r) => r.destination_iata === iata))
    })
    return () => { live = false }
  }, [iata])

  if (!guide) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 md:px-8">
        <h1 className="font-display" style={{ fontSize: '2rem' }}>No guide for {iata} yet.</h1>
        <p className="mt-3" style={{ color: 'var(--color-ink-mute)' }}>
          We fly there, but we haven't written the guide. Meanwhile you can{' '}
          <Link to={`/timetable?from=SGN&to=${iata}`} className="underline">see the timetable</Link> or{' '}
          <Link to="/destinations" className="underline">browse every destination</Link>.
        </p>
      </div>
    )
  }

  const cheapest = routes.reduce<RouteRow | null>(
    (best, r) => (!best || (r.from_price_economy_usd ?? 9e9) < (best.from_price_economy_usd ?? 9e9) ? r : best), null)
  const region = regionOf(iata)
  const ap = getAirport(iata)

  return (
    <div>
      {/* ---- hero photo ---------------------------------------------- */}
      {/* The image settles from a slight zoom. Its transform is clipped by this
          section, because a scaled child otherwise widens the document and the
          whole page gains a horizontal scrollbar. */}
      <section
        className="on-ink relative"
        style={{ background: 'var(--color-ink)', overflow: 'hidden' }}
      >
        {photo && (
          <motion.img
            src={assetUrl(photo.file)}
            alt={`${guide.city}, ${guide.country}`}
            fetchPriority="high"
            initial={reduced ? false : { scale: 1.06, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.55 }}
            transition={{ duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{
              width: '100%', height: 'clamp(240px, 44vh, 460px)',
              objectFit: 'cover', display: 'block',
            }}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-8 md:px-8"
             style={{ background: 'linear-gradient(to top, var(--color-ink) 12%, transparent)' }}>
          <div className="mx-auto max-w-5xl">
            <p className="mb-2 flex items-center gap-2 font-mono uppercase"
               style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.22em', color: 'var(--color-aqua)' }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: REGION_STYLE[region].hue }} />
              {iata} · {guide.country}
            </p>
            <h1 className="font-display" style={{ fontSize: 'clamp(2.2rem,7vw,4.5rem)', lineHeight: 1, color: 'var(--color-paper)' }}>
              {guide.city}
            </h1>
            {guide.localName && guide.localName !== guide.city && (
              <p className="mt-1" style={{ color: '#B9B6D8', fontSize: 'var(--text-lead)' }}>{guide.localName}</p>
            )}
          </div>
        </div>
      </section>

      {/* ---- fares strip --------------------------------------------- */}
      <section className="px-5 py-6 md:px-8" style={{ background: 'var(--color-paper-sunk)' }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-3">
          {cheapest ? (
            <>
              <p>
                <span className="tnum font-mono" style={{ fontSize: '1.6rem', fontWeight: 500 }}>
                  {price(cheapest.from_price_economy_usd)}
                </span>
                <span style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}> one way from {cheapest.origin_iata}</span>
              </p>
              <p className="tnum font-mono" style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
                {duration(cheapest.fastest_minutes)} · {cheapest.days_served_per_week}× weekly
                {Number.isFinite(distanceKm(cheapest.origin_iata, iata))
                  ? ` · ${count(distanceKm(cheapest.origin_iata, iata))} km` : ''}
              </p>
              <Link to={`/timetable?from=${cheapest.origin_iata}&to=${iata}`} className="kx-cta ml-auto">
                See flights
              </Link>
            </>
          ) : (
            <p style={{ color: 'var(--color-ink-mute)' }}>Loading fares…</p>
          )}
        </div>
      </section>

      {/* ---- the guide ------------------------------------------------ */}
      <section className="px-5 py-14 md:px-8">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1fr_300px]">
          <div>
            <p style={{ fontSize: 'var(--text-lead)', lineHeight: 1.6, maxWidth: '58ch' }}>{guide.blurb}</p>

            <h2 className="font-display mt-10 mb-2" style={{ fontSize: '1.5rem' }}>When to go</h2>
            <p style={{ color: 'var(--color-ink-mute)', maxWidth: '58ch' }}>{guide.bestTime}</p>

            <h2 className="font-display mt-8 mb-2" style={{ fontSize: '1.5rem' }}>From the airport</h2>
            <p style={{ color: 'var(--color-ink-mute)', maxWidth: '58ch' }}>{guide.gettingIn}</p>

            <h2 className="font-display mt-8 mb-3" style={{ fontSize: '1.5rem' }}>Worth your time</h2>
            <ul style={{ borderTop: '2px solid var(--color-ink)' }}>
              {guide.highlights.map((h) => (
                <li key={h} className="py-2.5" style={{ borderBottom: 'var(--rule)' }}>{h}</li>
              ))}
            </ul>
          </div>

          <aside>
            <dl style={{ borderTop: '2px solid var(--color-ink)' }}>
              {[
                ['Airport', ap?.name ?? iata],
                ['Currency', guide.currency],
                ['Language', guide.language],
                ['Time zone', ap ? `UTC${ap.offset >= 0 ? '+' : ''}${(ap.offset / 60).toFixed(ap.offset % 60 ? 1 : 0)}` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="py-3" style={{ borderBottom: 'var(--rule)' }}>
                  <dt className="font-mono uppercase"
                      style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.14em', color: 'var(--color-ink-faint)' }}>
                    {k}
                  </dt>
                  <dd style={{ fontWeight: 500 }}>{v}</dd>
                </div>
              ))}
            </dl>

            {photo?.license && (
              <p className="mt-5" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)', lineHeight: 1.5 }}>
                Photo{photo.artist ? ` by ${photo.artist}` : ''} ·{' '}
                {photo.license_url
                  ? <a href={photo.license_url} target="_blank" rel="noreferrer noopener" className="underline">{photo.license}</a>
                  : photo.license}
                {photo.source && <> · <a href={photo.source} target="_blank" rel="noreferrer noopener" className="underline">Wikimedia Commons</a></>}
              </p>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}
