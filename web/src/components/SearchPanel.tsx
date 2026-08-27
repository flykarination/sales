import { useEffect, useMemo, useRef, useState, useId } from 'react'
import { listAirports, type AirportRow } from '@/lib/queries'
import { CABIN_ORDER, CABINS, type CabinCode } from '@/lib/cabins'
import { addDays, toIsoDate } from '@/lib/format'

/** The five Vietnamese hubs, so the field is useful before the network loads. */
const HUBS: AirportRow[] = [
  { iata_code: 'SGN', city_name: 'Sài Gòn', airport_name: 'Tân Sơn Nhất', country_code: 'VN', utc_offset_minutes: 420, latitude: null, longitude: null },
  { iata_code: 'HAN', city_name: 'Hà Nội', airport_name: 'Nội Bài', country_code: 'VN', utc_offset_minutes: 420, latitude: null, longitude: null },
  { iata_code: 'DAD', city_name: 'Đà Nẵng', airport_name: 'Đà Nẵng', country_code: 'VN', utc_offset_minutes: 420, latitude: null, longitude: null },
  { iata_code: 'CXR', city_name: 'Nha Trang', airport_name: 'Cam Ranh', country_code: 'VN', utc_offset_minutes: 420, latitude: null, longitude: null },
  { iata_code: 'PQC', city_name: 'Phú Quốc', airport_name: 'Phú Quốc', country_code: 'VN', utc_offset_minutes: 420, latitude: null, longitude: null },
]

export interface SearchValues {
  origin: string
  destination: string
  depart: string
  ret: string | null
  cabin: CabinCode
  adults: number
}

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
  const [origin, setOrigin] = useState(initialOrigin?.toUpperCase() || 'SGN')
  const [destination, setDestination] = useState(initialDestination?.toUpperCase() || '')
  const today = toIsoDate(new Date())
  const [depart, setDepart] = useState(addDays(today, 7))
  const [ret, setRet] = useState(addDays(today, 14))
  const [isReturn, setIsReturn] = useState(true)
  const [cabin, setCabin] = useState<CabinCode>(initialCabin ?? 'ECONOMY')
  const [adults, setAdults] = useState(1)

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

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!origin || !destination) return
    onSearch?.({ origin, destination, depart, ret: isReturn ? ret : null, cabin, adults })
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
      <div className="flex gap-1 px-4 pt-4 sm:px-6" role="radiogroup" aria-label="Trip type">
        {[['Return', true], ['One way', false]].map(([label, value]) => (
          <button
            key={String(label)}
            type="button"
            role="radio"
            aria-checked={isReturn === value}
            onClick={() => setIsReturn(value as boolean)}
            className="font-mono uppercase transition-colors"
            style={{
              fontSize: 'var(--text-micro)',
              letterSpacing: '0.14em',
              padding: '8px 14px',
              minHeight: 36,
              borderRadius: 'var(--radius-edge)',
              background: isReturn === value ? 'var(--color-ink)' : 'transparent',
              color: isReturn === value ? 'var(--color-paper)' : 'var(--color-ink-mute)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-px p-4 sm:p-6 md:grid-cols-[1fr_1fr_auto]">
        <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
          <AirportField
            label="From" value={origin} onChange={setOrigin}
            airports={airports} exclude={destination}
          />
          <AirportField
            label="To" value={destination} onChange={setDestination}
            airports={airports} exclude={origin} placeholder="Where to?"
          />
          <DateField label="Depart" value={depart} min={today} onChange={setDepart} />
          {isReturn ? (
            <DateField label="Return" value={ret} min={depart} onChange={setRet} />
          ) : (
            <div className="hidden sm:block" aria-hidden />
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
              <select
                value={cabin}
                onChange={(e) => setCabin(e.target.value as CabinCode)}
                className="w-full bg-transparent"
                style={{ ...inputStyle, color: CABINS[cabin].ink, fontWeight: 600 }}
              >
                {CABIN_ORDER.map((c) => (
                  <option key={c} value={c}>{CABINS[c].longName}</option>
                ))}
              </select>
            </Field>
          </div>

          <button
            type="submit"
            disabled={!destination}
            className="group relative w-full overflow-hidden font-mono uppercase transition-all"
            style={{
              minHeight: 52,
              letterSpacing: '0.16em',
              fontSize: 'var(--text-small)',
              borderRadius: 'var(--radius-edge)',
              background: destination ? 'var(--color-ink)' : 'var(--color-paper-sunk)',
              color: destination ? 'var(--color-paper)' : 'var(--color-ink-faint)',
              cursor: destination ? 'pointer' : 'not-allowed',
            }}
          >
            {/* the spectrum only appears once the search is actually possible */}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 transition-transform duration-300"
              style={{
                height: 3,
                background: 'var(--paint-spectrum)',
                transform: destination ? 'scaleX(1)' : 'scaleX(0)',
                transformOrigin: 'left',
              }}
            />
            Search flights
          </button>
          {!destination && (
            <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)', marginTop: -8 }}>
              Choose where you're going.
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
