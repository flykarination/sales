import { useEffect, useMemo, useRef, useState, useId } from 'react'
import { listAirports, type AirportRow } from '@/lib/queries'
import { CABIN_ORDER, CABINS, type CabinCode } from '@/lib/cabins'
import { addDays, toIsoDate } from '@/lib/format'
import type { Slice, TripType } from '@/booking/BookingContext'
import type { SearchQuery } from '@/booking/slices'

/** The five Vietnamese hubs, so the field is useful before the network loads. */
const HUBS: AirportRow[] = [
  { iata_code: 'SGN', city_name: 'Sài Gòn', airport_name: 'Tân Sơn Nhất', country_code: 'VN', utc_offset_minutes: 420, latitude: null, longitude: null },
  { iata_code: 'HAN', city_name: 'Hà Nội', airport_name: 'Nội Bài', country_code: 'VN', utc_offset_minutes: 420, latitude: null, longitude: null },
  { iata_code: 'DAD', city_name: 'Đà Nẵng', airport_name: 'Đà Nẵng', country_code: 'VN', utc_offset_minutes: 420, latitude: null, longitude: null },
  { iata_code: 'CXR', city_name: 'Nha Trang', airport_name: 'Cam Ranh', country_code: 'VN', utc_offset_minutes: 420, latitude: null, longitude: null },
  { iata_code: 'PQC', city_name: 'Phú Quốc', airport_name: 'Phú Quốc', country_code: 'VN', utc_offset_minutes: 420, latitude: null, longitude: null },
]

/** What the panel emits. The URL form of this lives in booking/slices.ts. */
export type SearchValues = SearchQuery

const MAX_LEGS = 5

export function SearchPanel({
  onSearch, initialOrigin, initialDestination, initialCabin,
}: {
  onSearch?: (v: SearchValues) => void
  /** Prefilled when arriving from a route link, e.g. the route map. */
  initialOrigin?: string
  initialDestination?: string
  initialCabin?: CabinCode
}) {
  const [airports, setAirports] = useState<AirportRow[]>(HUBS)
  const [tripType, setTripType] = useState<TripType>('return')
  const [origin, setOrigin] = useState(initialOrigin?.toUpperCase() || 'SGN')
  const [destination, setDestination] = useState(initialDestination?.toUpperCase() || '')
  const today = toIsoDate(new Date())
  const [depart, setDepart] = useState(addDays(today, 7))
  const [ret, setRet] = useState(addDays(today, 14))
  const [cabin, setCabin] = useState<CabinCode>(initialCabin ?? 'ECONOMY')
  const [adults, setAdults] = useState(1)

  /**
   * Multi-city legs, held separately from the simple fields rather than
   * folded into one array. A return trip has a shape of its own — the second
   * leg is not free, it is the first one backwards — and collapsing both into
   * a generic list of legs makes the common case worse to use.
   */
  const [multi, setMulti] = useState<Slice[]>([])

  useEffect(() => {
    if (initialOrigin) setOrigin(initialOrigin.toUpperCase())
    if (initialDestination) setDestination(initialDestination.toUpperCase())
    if (initialCabin) setCabin(initialCabin)
  }, [initialOrigin, initialDestination, initialCabin])

  useEffect(() => {
    let live = true
    listAirports().then(({ data }) => {
      if (live && data && data.length) setAirports(data)
    })
    return () => { live = false }
  }, [])

  /** Switching to multi-city carries across whatever is already filled in. */
  function chooseTrip(next: TripType) {
    if (next === 'multi' && multi.length === 0) {
      setMulti([
        { from: origin, to: destination, date: depart },
        { from: destination, to: '', date: addDays(depart, 4) },
      ])
    }
    setTripType(next)
  }

  function patchLeg(i: number, patch: Partial<Slice>) {
    setMulti((legs) => legs.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  }

  function addLeg() {
    setMulti((legs) => {
      if (legs.length >= MAX_LEGS) return legs
      const last = legs[legs.length - 1]
      return [...legs, { from: last?.to ?? '', to: '', date: addDays(last?.date ?? depart, 4) }]
    })
  }

  function removeLeg(i: number) {
    setMulti((legs) => (legs.length <= 2 ? legs : legs.filter((_, j) => j !== i)))
  }

  const multiReady =
    multi.length >= 2 && multi.every((l) => l.from && l.to && l.date && l.from !== l.to)
  const simpleReady = Boolean(origin && destination && depart && (tripType !== 'return' || ret))
  const ready = tripType === 'multi' ? multiReady : simpleReady

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return
    if (tripType === 'multi') {
      onSearch?.({ tripType: 'multi', slices: multi, cabin, adults })
      return
    }
    const slices: Slice[] = [{ from: origin, to: destination, date: depart }]
    if (tripType === 'return') slices.push({ from: destination, to: origin, date: ret })
    onSearch?.({ tripType, slices, cabin, adults })
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Search flights"
      className="w-full"
      style={{
        background: 'var(--color-paper)',
        border: '1px solid var(--color-paper-edge)',
        borderTop: '3px solid var(--color-ink)',
        borderRadius: 'var(--radius-soft)',
        boxShadow: '0 1px 2px rgba(23,24,80,.04), 0 12px 32px -12px rgba(23,24,80,.18)',
      }}
    >
      {/* trip type */}
      <div className="flex flex-wrap gap-1 px-4 pt-4 sm:px-6" role="radiogroup" aria-label="Trip type">
        {([['Return', 'return'], ['One way', 'oneway'], ['Multi-city', 'multi']] as Array<[string, TripType]>)
          .map(([label, value]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={tripType === value}
              onClick={() => chooseTrip(value)}
              className="font-mono uppercase transition-colors"
              style={{
                fontSize: 'var(--text-micro)',
                letterSpacing: '0.14em',
                padding: '8px 14px',
                minHeight: 36,
                borderRadius: 'var(--radius-edge)',
                background: tripType === value ? 'var(--color-ink)' : 'transparent',
                color: tripType === value ? 'var(--color-paper)' : 'var(--color-ink-mute)',
              }}
            >
              {label}
            </button>
          ))}
      </div>

      <div className="grid gap-px p-4 sm:p-6 md:grid-cols-[1fr_1fr_auto]">
        <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
          {tripType === 'multi' ? (
            <div className="sm:col-span-2">
              <ol>
                {multi.map((leg, i) => (
                  <li
                    key={i}
                    className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]"
                    style={{
                      borderBottom: i < multi.length - 1 ? 'var(--rule)' : 'none',
                      paddingBottom: i < multi.length - 1 ? 16 : 0,
                      marginBottom: i < multi.length - 1 ? 16 : 0,
                    }}
                  >
                    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                      <AirportField
                        label={`Flight ${i + 1} — from`}
                        value={leg.from}
                        onChange={(v) => patchLeg(i, { from: v })}
                        airports={airports}
                        exclude={leg.to}
                      />
                      <AirportField
                        label="To"
                        value={leg.to}
                        onChange={(v) => {
                          patchLeg(i, { to: v })
                          // the next leg almost always starts where this one ended
                          setMulti((legs) => legs.map((l, j) => (j === i + 1 && !l.from ? { ...l, from: v } : l)))
                        }}
                        airports={airports}
                        exclude={leg.from}
                        placeholder="Where next?"
                      />
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <DateField
                          label="Date"
                          value={leg.date}
                          min={i === 0 ? today : multi[i - 1].date}
                          onChange={(v) => patchLeg(i, { date: v })}
                        />
                      </div>
                      {multi.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeLeg(i)}
                          aria-label={`Remove flight ${i + 1}`}
                          className="font-mono uppercase"
                          style={{
                            fontSize: 'var(--text-micro)', letterSpacing: '0.12em',
                            color: 'var(--color-ink-mute)', minHeight: 44, padding: '0 6px',
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>

              {multi.length < MAX_LEGS && (
                <button
                  type="button"
                  onClick={addLeg}
                  className="mt-3 font-mono uppercase"
                  style={{
                    fontSize: 'var(--text-micro)', letterSpacing: '0.14em',
                    minHeight: 44, padding: '0 2px',
                    color: 'var(--color-aqua-deep)', textDecoration: 'underline',
                  }}
                >
                  + Add another flight
                </button>
              )}
            </div>
          ) : (
            <>
              <AirportField
                label="From" value={origin} onChange={setOrigin}
                airports={airports} exclude={destination}
              />
              <AirportField
                label="To" value={destination} onChange={setDestination}
                airports={airports} exclude={origin} placeholder="Where to?"
              />
              <DateField label="Depart" value={depart} min={today} onChange={setDepart} />
              {tripType === 'return' ? (
                <DateField label="Return" value={ret} min={depart} onChange={setRet} />
              ) : (
                <div className="hidden sm:block" aria-hidden />
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-4 md:pl-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-1">
            <Field label="Passengers">
              <select
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className="w-full bg-transparent"
                style={inputStyle}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? 'adult' : 'adults'}</option>
                ))}
              </select>
            </Field>
            <Field label="Cabin">
              {/* The swatch carries the cabin colour reliably; option colours are
                  set too, but browsers style native options inconsistently, so
                  the swatch is what guarantees the colour reads. */}
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  style={{
                    width: 12, height: 12, flex: 'none', borderRadius: 3,
                    background: CABINS[cabin].hue,
                    transition: 'background 160ms ease-out',
                  }}
                />
                <select
                  value={cabin}
                  onChange={(e) => setCabin(e.target.value as CabinCode)}
                  className="w-full bg-transparent"
                  style={{ ...inputStyle, color: CABINS[cabin].ink, fontWeight: 600 }}
                >
                  {CABIN_ORDER.map((c) => (
                    <option key={c} value={c} style={{ color: CABINS[c].ink, fontWeight: 600 }}>
                      {CABINS[c].longName}
                    </option>
                  ))}
                </select>
              </span>
            </Field>
          </div>

          <button
            type="submit"
            disabled={!ready}
            className="group relative w-full overflow-hidden font-mono uppercase transition-all"
            style={{
              minHeight: 52,
              letterSpacing: '0.16em',
              fontSize: 'var(--text-small)',
              borderRadius: 'var(--radius-edge)',
              background: ready ? 'var(--color-ink)' : 'var(--color-paper-sunk)',
              color: ready ? 'var(--color-paper)' : 'var(--color-ink-faint)',
              cursor: ready ? 'pointer' : 'not-allowed',
            }}
          >
            {/* the spectrum only appears once the search is actually possible */}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 transition-transform duration-300"
              style={{
                height: 3,
                background: 'var(--paint-spectrum)',
                transform: ready ? 'scaleX(1)' : 'scaleX(0)',
                transformOrigin: 'left',
              }}
            />
            Search flights
          </button>
          {!ready && (
            <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)', marginTop: -8 }}>
              {tripType === 'multi' ? 'Fill in every flight to search.' : 'Choose where you are going.'}
            </p>
          )}
        </div>
      </div>
    </form>
  )
}

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-body)',
  color: 'var(--color-ink)',
  border: 'none',
  borderBottom: '1px solid var(--color-paper-edge)',
  padding: '8px 0',
  minHeight: 44,
  outline: 'none',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="mb-1 block font-mono uppercase"
        style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.16em', color: 'var(--color-ink-mute)' }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

function DateField({
  label, value, min, onChange,
}: { label: string; value: string; min: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <input
        type="date" value={value} min={min}
        onChange={(e) => onChange(e.target.value)}
        className="tnum w-full bg-transparent font-mono"
        style={inputStyle}
      />
    </Field>
  )
}

/**
 * Matches on IATA code AND city name AND airport name, because people type
 * "SGN" and people type "Saigon". Never submits an unmatched string.
 */
function AirportField({
  label, value, onChange, airports, exclude, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  airports: AirportRow[]
  exclude?: string
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = airports.find((a) => a.iata_code === value)
  const display = open ? query : selected ? `${selected.city_name ?? selected.iata_code} (${selected.iata_code})` : ''

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = airports.filter((a) => a.iata_code !== exclude)
    if (!q) return pool.slice(0, 8)
    const norm = (s: string | null) =>
      (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return pool
      .filter((a) =>
        a.iata_code.toLowerCase().startsWith(q) ||
        norm(a.city_name).includes(norm(q)) ||
        norm(a.airport_name).includes(norm(q)))
      .sort((a, b) => Number(b.iata_code.toLowerCase().startsWith(q)) - Number(a.iata_code.toLowerCase().startsWith(q)))
      .slice(0, 8)
  }, [query, airports, exclude])

  useEffect(() => {
    function away(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  function pick(a: AirportRow) {
    onChange(a.iata_code)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative">
      <Field label={label}>
        <input
          type="text"
          value={display}
          placeholder={placeholder ?? 'City or code'}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          onFocus={() => { setOpen(true); setQuery('') }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, matches.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
            else if (e.key === 'Enter' && open && matches[active]) { e.preventDefault(); pick(matches[active]) }
            else if (e.key === 'Escape') setOpen(false)
          }}
          className="w-full bg-transparent"
          style={inputStyle}
        />
      </Field>

      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto"
          style={{
            background: 'var(--color-paper)',
            border: '1px solid var(--color-paper-edge)',
            borderRadius: 'var(--radius-soft)',
            boxShadow: '0 16px 40px -16px rgba(23,24,80,.28)',
          }}
        >
          {matches.map((a, i) => (
            <li key={a.iata_code} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(a) }}
                onMouseEnter={() => setActive(i)}
                className="flex w-full items-baseline gap-3 px-4 text-left"
                style={{
                  minHeight: 44,
                  background: i === active ? 'var(--color-paper-sunk)' : 'transparent',
                }}
              >
                <span className="tnum font-mono" style={{ color: 'var(--color-aqua-deep)', fontSize: 'var(--text-small)' }}>
                  {a.iata_code}
                </span>
                <span style={{ fontWeight: 500 }}>{a.city_name ?? a.airport_name}</span>
                <span className="ml-auto" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
                  {a.country_code}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
