/**
 * Formatting for a timetable.
 *
 * Two rules run through all of this:
 *
 * 1. Times arrive from the database already local to their own airport, and
 *    already shifted onto the destination's clock for arrivals. They are
 *    printed bare. Never construct a Date from them and never convert — that
 *    would silently re-apply the viewer's timezone and make the timetable
 *    wrong.
 * 2. Anything that is a fact gets tabular figures, so columns lock down the
 *    page and digits do not jitter as availability ticks.
 */

/** `'16:15:00'` → `'16:15'`. 24-hour, always two digits, never am/pm. */
export function time(value: string | null | undefined): string {
  if (!value) return '--:--'
  const [h, m] = value.split(':')
  if (h === undefined || m === undefined) return '--:--'
  return `${h.padStart(2, '0')}:${m}`
}

/**
 * Spoken form for screen readers: `'16:15:00'` → `'4:15 PM'`.
 * The visible text stays 24-hour; this is only ever an aria-label.
 */
export function timeSpoken(value: string | null | undefined): string {
  if (!value) return 'time unavailable'
  const [hs, ms] = value.split(':')
  const h = Number(hs)
  if (Number.isNaN(h)) return 'time unavailable'
  const suffix = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${ms} ${suffix}`
}

/** `765` → `'12h 45m'`. Never decimal hours, never raw minutes. */
export function duration(minutes: number | null | undefined): string {
  if (minutes == null || minutes < 0) return '--'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** `765` → `'12 hours 45 minutes'`, for aria-labels. */
export function durationSpoken(minutes: number | null | undefined): string {
  if (minutes == null || minutes < 0) return 'duration unavailable'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`)
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`)
  return parts.join(' ') || '0 minutes'
}

/** Whole dollars. Prices in this world have no cents. */
export function price(usd: number | null | undefined): string {
  if (usd == null) return '--'
  return `$${Math.round(usd).toLocaleString('en-US')}`
}

/** `1302` → `'1,302'` */
export function count(n: number | null | undefined): string {
  return n == null ? '--' : n.toLocaleString('en-US')
}

/**
 * The `+1` that goes beside an arrival time when it lands on a later day.
 * Returns an empty string for same-day arrivals so callers can render it
 * unconditionally.
 */
export function dayOffset(days: number | null | undefined): string {
  if (!days) return ''
  return days > 0 ? `+${days}` : `${days}`
}

export function dayOffsetSpoken(days: number | null | undefined): string {
  if (!days) return ''
  if (days === 1) return ', arrives the next day'
  if (days > 1) return `, arrives ${days} days later`
  return `, arrives the previous day`
}

/**
 * The game's weekday numbering is 0 = Monday .. 6 = Sunday.
 * JavaScript's `getDay()` is 0 = Sunday. This is the only correct bridge
 * between them, and getting it wrong shifts every timetable by a day.
 */
export function toGameDow(date: Date): number {
  return (date.getDay() + 6) % 7
}

export const DOW_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const DOW_LONG = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const

/** `'2026-09-02'` → `'Wed 2 Sep'`. Parsed as a plain date, never as UTC. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '--'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return '--'
  const date = new Date(y, m - 1, d)
  const month = date.toLocaleString('en-GB', { month: 'short' })
  return `${DOW_SHORT[toGameDow(date)]} ${d} ${month}`
}

/** `'2026-09-02'` → `'Wednesday 2 September 2026'` */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return 'date unavailable'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return 'date unavailable'
  const date = new Date(y, m - 1, d)
  const month = date.toLocaleString('en-GB', { month: 'long' })
  return `${DOW_LONG[toGameDow(date)]} ${d} ${month} ${y}`
}

/** `Date` → `'2026-09-02'`, using local parts so the day never shifts. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

/** `'Direct'` or `'1 stop · SLL'`. Never `'0 stops'`. */
export function stopsLabel(via?: string | null): string {
  return via ? `1 stop · ${via}` : 'Direct'
}

/**
 * The five external codeshare partners have no name in the export, so every
 * carrier name has to survive being null.
 */
export function carrierName(name: string | null | undefined, code?: string | null): string {
  if (name) return name
  if (code) return `Carrier ${code}`
  return 'Partner carrier'
}

/** `'KX'`, `467` → `'KX 467'` */
export function designator(code: string | null | undefined, number: number | null | undefined): string {
  return `${code ?? '??'} ${number ?? '---'}`
}
