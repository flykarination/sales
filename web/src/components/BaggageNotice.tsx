import { Link } from 'react-router-dom'
import { governingCarrier, isTighterThanDefault } from '@/data/carriers'
import { cabin } from '@/lib/cabins'
import type { CabinCode } from '@/lib/cabins'

/**
 * What you may bring, when it is not what you would expect.
 *
 * Shown only where the answer is a smaller allowance than Karination's --
 * today, FORZA's: either because FORZA is flying you, or because it is flying
 * one leg of an itinerary and a bag has to satisfy every carrier that touches
 * it. A journey on Karination, or on a carrier as generous (Sonder), gets
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
  // Nothing to say when the allowance is the published default.
  if (!isTighterThanDefault(carrier)) return null

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
        {mixed ? `${carrier.name} baggage rules apply to this whole journey.` : `${carrier.name} baggage rules apply.`}
      </strong>{' '}
      {c.longName}: {allowance.checked} checked, {allowance.hand} in the cabin
      {mixed ? ' — tighter than Karination’s, because a bag has to satisfy every airline carrying it' : ''}.{' '}
      <Link to="/travel-info#baggage" className="underline">Full allowances</Link>
    </p>
  )
}
