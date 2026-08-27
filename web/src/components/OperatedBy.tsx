import { carrierByCode, operatedNoteFor } from '@/data/carriers'

/**
 * Who is actually flying this.
 *
 * Karination sells FORZA's flights under its own booking engine, so a
 * traveller can buy a KarinationGroup ticket and board an aeroplane in
 * someone else's livery. That has to be said before they pay, not discovered
 * at the gate, and it is said in the carrier's own accent colour so it reads
 * as information rather than a warning.
 */
export function OperatedBy({
  airlineCode, size = 'small',
}: {
  airlineCode: string | null | undefined
  size?: 'small' | 'micro'
}) {
  const note = operatedNoteFor(airlineCode)
  if (!note) return null
  const carrier = carrierByCode(airlineCode)

  return (
    <p
      className="mt-1 flex items-baseline gap-2"
      style={{
        fontSize: size === 'micro' ? 'var(--text-micro)' : 'var(--text-small)',
        color: 'var(--color-ink-mute)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8, height: 8, flex: 'none', borderRadius: 2,
          background: carrier?.accent ?? 'var(--color-ink-faint)',
          transform: 'translateY(1px)',
        }}
      />
      <span>{note}</span>
    </p>
  )
}
