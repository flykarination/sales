import { Link } from 'react-router-dom'
import { governingCarrier } from '@/data/carriers'
import { cabin } from '@/lib/cabins'
import type { CabinCode } from '@/lib/cabins'

/**
 * What you may bring, when it is not what you would expect.
 *
 * Shown only where the answer is FORZA's allowance: either because FORZA is
 * flying you, or because it is flying one leg of an itinerary and a bag has
 * to satisfy every carrier that touches it. A pure Karination journey gets
 * nothing here — the allowance is the one already published and repeating it
 * on every result is noise.
 */
export function BaggageNotice({
  airlineCodes, cabinCode,
}: {
  airlineCodes: Array<string | null | undefined>
  cabinCode: string
}) {
  const { carrier, mixed } = governingCarrier(airlineCodes)
  if (carrier.code !== 'Z4') return null

  const c = cabin(cabinCode)
  const allowance = carrier.baggage[(cabinCode.toUpperCase() as CabinCode)] ?? carrier.baggage.ECONOMY

  return (
    <p
      className="mt-2"
      style={{
        fontSize: 'var(--text-micro)',
        color: 'var(--color-ink-mute)',
        borderLeft: `3px solid ${carrier.accent}`,
        paddingLeft: 10,
      }}
    >
      <strong style={{ color: carrier.accentInk }}>
        {mixed ? 'FORZA baggage rules apply to this whole journey.' : 'FORZA baggage rules apply.'}
      </strong>{' '}
      {c.longName}: {allowance.checked} checked, {allowance.hand} in the cabin
      {mixed ? ' — tighter than Karination’s, because a bag has to satisfy every airline carrying it' : ''}.{' '}
      <Link to="/travel-info#baggage" className="underline">Full allowances</Link>
    </p>
  )
}
