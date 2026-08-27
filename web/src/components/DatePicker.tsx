import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { DOW_LONG, addDays, longDate, toIsoDate } from '@/lib/format'

/**
 * The date field, with a calendar of our own.
 *
 * `<input type="date">` was doing the job but drew the operating system's
 * picker: a narrow panel in the system font and the system blue, floating
 * under a field it did not match. Nothing about it can be styled — no part of
 * that popup is reachable from CSS — so the only way to make the calendar
 * belong to the page is to draw it.
 *
 * The week starts on Monday, as it does everywhere else on the site and in
 * Vietnam. Keyboard handling follows the usual grid pattern: arrows by day
 * and week, PageUp/PageDown by month, Home/End to the ends of the week,
 * Enter to choose, Escape to dismiss.
 */

const DOW_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function DatePicker({
  label, value, min, max, onChange,
}: {
  label: string
  /** ISO yyyy-mm-dd. */
  value: string
  min?: string
  max?: string
  onChange: (iso: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(value)
  const boxRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dialogId = useId()

  // The month on show follows the chosen date while closed, so reopening
  // always lands where the traveller left off.
  useEffect(() => { if (!open) setCursor(value) }, [value, open])

  useEffect(() => {
    if (!open) return
    function away(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  // Move focus into the grid on open so the keyboard works immediately.
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      gridRef.current?.querySelector<HTMLElement>('[data-focus="true"]')?.focus()
    }, 0)
    return () => window.clearTimeout(t)
  }, [open])

  const weeks = useMemo(() => buildMonth(cursor), [cursor])
  const shownMonth = monthOf(cursor)

  function choose(iso: string) {
    onChange(iso)
    setOpen(false)
    buttonRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const step: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
    }
    if (e.key in step) {
      e.preventDefault()
      setCursor((c) => clamp(addDays(c, step[e.key]), min, max))
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      setCursor((c) => clamp(addMonths(c, e.key === 'PageUp' ? -1 : 1), min, max))
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setCursor((c) => {
        const dow = (new Date(`${c}T00:00:00Z`).getUTCDay() + 6) % 7 // Monday = 0
        return clamp(addDays(c, e.key === 'Home' ? -dow : 6 - dow), min, max)
      })
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!isBlocked(cursor, min, max)) choose(cursor)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <span className="kx-field-label">{label}</span>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? dialogId : undefined}
        className="kx-datefield tnum font-mono"
      >
        <span>{value ? longDate(value) : 'Choose a date'}</span>
        <CalendarMark />
      </button>

      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-modal="false"
          aria-label={`${label}: choose a date`}
          className="kx-calendar"
          onKeyDown={onKeyDown}
        >
          <div className="kx-calendar-head">
            <MonthStep
              label="Previous month"
              disabled={min ? monthOf(addMonths(cursor, -1)) < monthOf(min) : false}
              onClick={() => setCursor((c) => clamp(addMonths(c, -1), min, max))}
              d="M10 3 5 8l5 5"
            />
            <p aria-live="polite" className="kx-calendar-month">
              {new Date(`${cursor}T00:00:00Z`).toLocaleDateString('en-GB', {
                month: 'long', year: 'numeric', timeZone: 'UTC',
              })}
            </p>
            <MonthStep
              label="Next month"
              disabled={max ? monthOf(addMonths(cursor, 1)) > monthOf(max) : false}
              onClick={() => setCursor((c) => clamp(addMonths(c, 1), min, max))}
              d="M6 3l5 5-5 5"
            />
          </div>

          <div className="kx-calendar-dow" aria-hidden>
            {DOW_INITIALS.map((d, i) => <span key={i}>{d}</span>)}
          </div>

          <div ref={gridRef} className="kx-calendar-grid" role="grid" aria-label="Calendar">
            {weeks.map((iso) => {
              const inMonth = monthOf(iso) === shownMonth
              const blocked = isBlocked(iso, min, max)
              const selected = iso === value
              return (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  tabIndex={iso === cursor ? 0 : -1}
                  data-focus={iso === cursor ? 'true' : undefined}
                  data-selected={selected ? 'true' : undefined}
                  data-outside={inMonth ? undefined : 'true'}
                  disabled={blocked}
                  aria-selected={selected}
                  aria-label={`${DOW_LONG[(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7]} ${longDate(iso)}`}
                  onClick={() => choose(iso)}
                  className="kx-day tnum font-mono"
                >
                  {Number(iso.slice(8, 10))}
                </button>
              )
            })}
          </div>

          <div className="kx-calendar-foot">
            <button
              type="button"
              className="kx-calendar-action"
              onClick={() => setCursor(clamp(toIsoDate(new Date()), min, max))}
            >
              Today
            </button>
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

/* ------------------------------------------------------------------ */

function MonthStep({
  label, onClick, disabled, d,
}: { label: string; onClick: () => void; disabled?: boolean; d: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="kx-calendar-step"
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function CalendarMark() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden focusable="false" style={{ flex: 'none' }}>
      <rect x="1.5" y="3" width="13" height="11.5" rx="1.5"
            fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" fill="none" stroke="currentColor"
            strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Dates. All UTC, so a timezone can never shift which day it is.      */

function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

function addMonths(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  // clamp to the end of the target month: 31 January + 1 month is 28 February
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d.toISOString().slice(0, 10)
}

function isBlocked(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) return true
  if (max && iso > max) return true
  return false
}

function clamp(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min
  if (max && iso > max) return max
  return iso
}

/** Six weeks from the Monday on or before the 1st, so the grid never jumps. */
function buildMonth(iso: string): string[] {
  const first = `${iso.slice(0, 7)}-01`
  const dow = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
  const start = addDays(first, -dow)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}
