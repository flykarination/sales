import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { FunnelPage } from '@/components/Funnel'
import { FlightRow } from '@/components/FlightRow'
import { ItineraryOption } from '@/components/ItineraryOption'
import {
  groupItineraries, searchConnections, searchDoubleConnections, searchFlights,
  type FlightResult, type Itinerary,
} from '@/lib/queries'
import { useBooking } from '@/booking/BookingContext'
import { parseSearchQuery, seatsFor } from '@/booking/slices'
import { summarise } from '@/components/PassengerPicker'
import { airportLabel } from '@/data/airports'
import { CABINS } from '@/lib/cabins'
import { addDays, longDate, shortDate } from '@/lib/format'

/**
 * Choosing the flights.
 *
 * The page works one slice at a time -- a slice being one journey the
 * traveller asked for. A one-way has one, a return two, a multi-city as many
 * as they entered, and the same code runs all three.
 *
 * Two searches go out per slice: the direct flights, and the connections.
 * They are shown as separate lists because they are different products, and
 * because a traveller who has a direct almost never wants to read the
 * connections. When the direct search is empty the connections become the
 * answer, and if there is no single-stop routing either, a second, more
 * expensive two-stop search runs as a last resort.
 */
export default function Results() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { draft, set, setSliceFlights, complete } = useBooking()

  const query = useMemo(() => parseSearchQuery(params), [params])
  const [active, setActive] = useState(0)

  // Keep the draft aligned with the URL. If the journey being asked for has
  // changed at all, previous selections belong to a different search and are
  // dropped; if it is the same search, they survive a reload or a back-button.
  useEffect(() => {
    const sameJourney =
      draft.slices.length === query.slices.length &&
      draft.slices.every((s, i) =>
        s.from === query.slices[i].from && s.to === query.slices[i].to && s.date === query.slices[i].date)

    set({
      tripType: query.tripType,
      cabin: query.cabin,
      adults: query.adults,
      children: query.children,
      infants: query.infants,
      slices: sameJourney ? draft.slices : query.slices,
    })
    if (!sameJourney) setActive(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const slices = draft.slices.length ? draft.slices : query.slices
  const slice = slices[active]

  const [directs, setDirects] = useState<FlightResult[] | null>(null)
  const [connections, setConnections] = useState<Itinerary[] | null>(null)
  const [searchingDeeper, setSearchingDeeper] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slice) return
    let live = true
    setDirects(null)
    setConnections(null)
    setError(null)
    setSearchingDeeper(false)

    const args = {
      origin: slice.from, destination: slice.to, date: slice.date,
      // seats, not heads: an infant on a lap needs none
      cabin: query.cabin, seats: seatsFor(query),
    }

    // Both go out together: the connections are useful even when directs
    // exist, and waiting for one before starting the other doubles the wait.
    const directsFound = searchFlights(args).then(({ data, error }) => {
      if (!live) return null
      if (error) setError(error.message)
      else setDirects(data ?? [])
      return error ? null : (data ?? [])
    })

    searchConnections(args).then(async ({ data }) => {
      if (!live) return
      const found = groupItineraries(data)
      if (found.length > 0) { setConnections(found); return }

      // Nothing with one stop. Two stops reach far more of the network, but
      // the query costs several times as much, and a two-stop routing is no
      // answer to a route we fly nonstop -- so it only runs when there is no
      // direct flight either (or when the direct search failed outright).
      const direct = await directsFound
      if (!live) return
      if (!direct || direct.length > 0) { setConnections([]); return }

      setSearchingDeeper(true)
      const deeper = await searchDoubleConnections({ ...args, limit: 4 })
      if (!live) return
      setConnections(groupItineraries(deeper.data))
      setSearchingDeeper(false)
    })

    return () => { live = false }
  }, [slice?.from, slice?.to, slice?.date, query.cabin, query.adults, query.children, query.infants])

  function advance(index: number) {
    const next = slices.findIndex((s, i) => i !== index && !(s.flights?.length))
    if (next >= 0) setActive(next)
  }

  function chooseDirect(f: FlightResult) {
    setSliceFlights(active, [f])
    advance(active)
  }

  function chooseItinerary(it: Itinerary) {
    setSliceFlights(active, it.legs)
    advance(active)
  }

  if (!slice) {
    return (
      <FunnelPage title="Choose your flight">
        <p style={{ fontSize: 'var(--text-lead)' }}>That search is missing some details.</p>
        <p className="mt-2" style={{ color: 'var(--color-ink-mute)' }}>
          <Link to="/" className="underline">Start again</Link> and tell us where you're going.
        </p>
      </FunnelPage>
    )
  }

  const chosenKeys = new Set((slice.flights ?? []).map((f) => `${f.flight_id}:${f.direction}`))
  const chosenIsDirect = (slice.flights?.length ?? 0) === 1
  const title =
    slices.length === 1 ? 'Choose your flight'
      : query.tripType === 'return'
        ? (active === 0 ? 'Choose your outbound flight' : 'Choose your return flight')
        : `Choose flight ${active + 1} of ${slices.length}`

  return (
    <FunnelPage title={title}>
      <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <p style={{ fontSize: 'var(--text-lead)' }}>
          <strong>{slice.from}</strong> → <strong>{slice.to}</strong>
        </p>
        <p style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
          {longDate(slice.date)} · {CABINS[query.cabin]?.longName ?? 'Economy'} ·{' '}
          {summarise(query)}
        </p>
        <Link to="/" className="kx-navlink ml-auto" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
          Change search
        </Link>
      </div>

      {slices.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Journeys">
          {slices.map((s, i) => (
            <button
              key={`${s.from}-${s.to}-${s.date}`}
              role="tab"
              aria-selected={active === i}
              onClick={() => setActive(i)}
              className="font-mono uppercase"
              style={{
                fontSize: 'var(--text-micro)', letterSpacing: '0.14em',
                padding: '8px 12px', minHeight: 40, borderRadius: 'var(--radius-edge)',
                background: active === i ? 'var(--color-paper-sunk)' : 'transparent',
                border: 'var(--rule)', color: 'var(--color-ink)',
              }}
            >
              {s.from} → {s.to} {shortDate(s.date)}
              {s.flights?.length ? ' ✓' : ''}
            </button>
          ))}
        </div>
      )}

      {/* loading: skeletons at the real row height, so nothing jumps */}
      {directs === null && !error && (
        <ul aria-busy="true" style={{ borderTop: 'var(--rule)' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} style={{ height: 108, borderBottom: 'var(--rule)' }}>
              <div className="h-full w-full animate-pulse" style={{ background: 'var(--color-paper-sunk)', opacity: 0.5 }} />
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p style={{ color: 'var(--color-danger)', borderLeft: '2px solid var(--color-danger)', paddingLeft: 12 }}>
          {error}{' '}
          <button className="underline" onClick={() => location.reload()} style={{ minHeight: 44 }}>Try again</button>
        </p>
      )}

      {directs && directs.length > 0 && (
        <>
          <p className="sr-only" role="status">{directs.length} direct flights found</p>
          <h2
            className="mb-2 font-mono uppercase"
            style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.18em', color: 'var(--color-ink-mute)' }}
          >
            Direct · {directs.length} {directs.length === 1 ? 'flight' : 'flights'}
          </h2>
          <ul style={{ borderTop: '2px solid var(--color-ink)' }}>
            {directs.map((f) => (
              <FlightRow
                key={`${f.flight_id}-${f.direction}-${f.cabin_code}`}
                flight={f}
                selected={chosenIsDirect && chosenKeys.has(`${f.flight_id}:${f.direction}`)}
                onSelect={chooseDirect}
                seatsLeft={f.seats_per_departure}
              />
            ))}
          </ul>
        </>
      )}

      {/* No direct service: say so before the connections, so the list is
          understood as the answer rather than as an oddity. */}
      {directs && directs.length === 0 && (
        <div style={{ borderTop: '2px solid var(--color-ink)', paddingTop: 20 }}>
          <p style={{ fontSize: 'var(--text-lead)', marginBottom: 6 }}>
            We don't fly {airportLabel(slice.from)} to {airportLabel(slice.to)} direct
            {CABINS[query.cabin] ? ` in ${CABINS[query.cabin].longName}` : ''} on {shortDate(slice.date)}.
          </p>
          {connections === null && (
            <p style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }} aria-busy="true">
              {searchingDeeper ? 'Looking for a two-stop routing…' : 'Looking for connections…'}
            </p>
          )}
        </div>
      )}

      {connections !== null && connections.length > 0 && (
        <section className={directs && directs.length > 0 ? 'mt-10' : 'mt-6'}>
          <h2
            className="mb-1 font-mono uppercase"
            style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.18em', color: 'var(--color-ink-mute)' }}
          >
            {directs && directs.length > 0 ? 'Or connect' : 'Connecting flights'} ·{' '}
            {connections.length} {connections.length === 1 ? 'option' : 'options'}
          </h2>
          <p className="mb-2" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
            Booked as one reservation, shortest journey first. Times shown are local
            at each airport.
          </p>
          <ul style={{ borderTop: '2px solid var(--color-ink)' }}>
            {connections.map((it) => (
              <ItineraryOption
                key={it.key}
                itinerary={it}
                selected={
                  !chosenIsDirect &&
                  it.legs.every((l) => chosenKeys.has(`${l.flight_id}:${l.direction}`)) &&
                  it.legs.length === (slice.flights?.length ?? 0)
                }
                onSelect={chooseItinerary}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Nothing at all, direct or connecting: offer the nearest dates. */}
      {directs && directs.length === 0 && connections !== null && connections.length === 0 && (
        <div className="mt-4">
          <p style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
            We could not build a connection for this date either. Karination does not
            fly every route every day — try a nearby date:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[-2, -1, 1, 2, 3].map((d) => {
              const alt = addDays(slice.date, d)
              const next = new URLSearchParams(params)
              if (query.tripType === 'multi') {
                next.set('legs', slices.map((s, i) => `${s.from}-${s.to}-${i === active ? alt : s.date}`).join('_'))
              } else if (active === 0) {
                next.set('depart', alt)
              } else {
                next.set('return', alt)
              }
              return (
                <Link
                  key={d}
                  to={`/search?${next}`}
                  className="tnum font-mono"
                  style={{
                    fontSize: 'var(--text-small)', padding: '10px 12px', minHeight: 44,
                    border: 'var(--rule)', borderRadius: 'var(--radius-edge)',
                    display: 'inline-flex', alignItems: 'center',
                  }}
                >
                  {shortDate(alt)}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {complete && (
        <div className="mt-6">
          <button
            onClick={() => navigate('/passengers')}
            className="font-mono uppercase"
            style={{
              background: 'var(--color-ink)', color: 'var(--color-paper)',
              padding: '14px 22px', minHeight: 52, letterSpacing: '0.16em',
              fontSize: 'var(--text-small)', borderRadius: 'var(--radius-edge)',
            }}
          >
            Continue to passengers
          </button>
        </div>
      )}
    </FunnelPage>
  )
}
