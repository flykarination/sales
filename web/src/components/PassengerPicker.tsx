import { useEffect, useId, useRef, useState } from 'react'

/**
 * How many people are travelling, split the way the fare is.
 *
 * The three categories are not a preference — they change what is sold. A
 * child holds a seat and a reduced fare; an infant holds neither, travelling
 * on a lap, so a party of two adults and an infant needs two seats and not
 * three. The limits below are the ones the travel information page already
 * states: one infant per adult, and nine passengers on a booking.
 */

export interface PartySize {
  adults: number
  children: number
  infants: number
}

interface Row {
  key: keyof PartySize
  label: string
  note: string
  min: number
}

const ROWS: Row[] = [
  { key: 'adults', label: 'Adults', note: '12 and over', min: 1 },
  { key: 'children', label: 'Children', note: '2 to 11, own seat', min: 0 },
  { key: 'infants', label: 'Infants', note: 'Under 2, on a lap', min: 0 },
]

const MAX_PARTY = 9

export function PassengerPicker({
  value, onChange,
}: {
  value: PartySize
  onChange: (next: PartySize) => void
}) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    function away(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus() }
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const total = value.adults + value.children + value.infants

  /** What each row can be, given the others and the rules. */
  function limits(key: keyof PartySize): { min: number; max: number } {
    const row = ROWS.find((r) => r.key === key)!
    const others = total - value[key]
    const room = MAX_PARTY - others
    if (key === 'infants') return { min: 0, max: Math.min(room, value.adults) }
    if (key === 'adults') {
      // an adult cannot be removed out from under an infant
      return { min: Math.max(row.min, value.infants), max: room }
    }
    return { min: row.min, max: room }
  }

  function step(key: keyof PartySize, by: number) {
    const { min, max } = limits(key)
    const next = Math.min(Math.max(value[key] + by, min), max)
    if (next === value[key]) return
    const party = { ...value, [key]: next }
    // dropping adults must drop any infant that no longer has a lap
    if (key === 'adults') party.infants = Math.min(party.infants, next)
    onChange(party)
  }

  return (
    <div ref={boxRef} className="relative">
      <span className="kx-field-label">Passengers</span>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="kx-datefield"
      >
        <span>{summarise(value)}</span>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden focusable="false" style={{ flex: 'none' }}>
          <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div id={panelId} className="kx-popover" role="group" aria-label="Passengers">
          <ul>
            {ROWS.map((row) => {
              const { min, max } = limits(row.key)
              const n = value[row.key]
              return (
                <li key={row.key} className="kx-stepper-row">
                  <div className="min-w-0">
                    <p style={{ fontWeight: 500 }}>{row.label}</p>
                    <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
                      {row.note}
                    </p>
                  </div>
                  <div className="kx-stepper">
                    <button
                      type="button"
                      className="kx-step"
                      onClick={() => step(row.key, -1)}
                      disabled={n <= min}
                      aria-label={`One fewer ${row.label.toLowerCase().replace(/s$/, '')}`}
                    >
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden focusable="false">
                        <path d="M3.5 8h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                    <output className="tnum font-mono" aria-live="polite">
                      {n}
                    </output>
                    <button
                      type="button"
                      className="kx-step"
                      onClick={() => step(row.key, 1)}
                      disabled={n >= max}
                      aria-label={`One more ${row.label.toLowerCase().replace(/s$/, '')}`}
                    >
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden focusable="false">
                        <path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          <p className="kx-popover-note">
            {value.infants > 0
              ? 'One infant per adult. Infants travel on a lap and pay a reduced fare.'
              : `Up to ${MAX_PARTY} passengers on one booking.`}
          </p>

          <div className="kx-calendar-foot">
            <span />
            <button
              type="button"
              className="kx-calendar-action"
              onClick={() => { setOpen(false); buttonRef.current?.focus() }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** "2 adults, 1 child" — the parts that are actually there. */
export function summarise(v: PartySize): string {
  const parts: string[] = [`${v.adults} ${v.adults === 1 ? 'adult' : 'adults'}`]
  if (v.children > 0) parts.push(`${v.children} ${v.children === 1 ? 'child' : 'children'}`)
  if (v.infants > 0) parts.push(`${v.infants} ${v.infants === 1 ? 'infant' : 'infants'}`)
  return parts.join(', ')
}
