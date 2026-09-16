import { Link } from 'react-router-dom'
import { governingCarrier, isTighterThanDefault } from '@/data/carriers'
import { cabin } from '@/lib/cabins'
import type { CabinCode } from '@/lib/cabins'

/**
 * What you may bring, when it is not what you would expect.
 *
 * Shown only where the answer is a smaller allowance than Karination's --
 * FORZA's or Sonder's: either because that airline is flying you, or because
 * it is flying one leg of an itinerary and a bag has to satisfy every carrier
 * that touches it. A journey entirely on Karination gets nothing here — the
 * allowance is the one already published and repeating it on every result is
 * noise.
 *
 * A carrier's cabin extra (Sonder's fan bag) is not part of the governing
 * allowance. It is carried in the cabin, so it belongs to that carrier's own
 * flights and is stated separately when the journey mixes airlines.
 */
export function BaggageNotice({
  airlineCodes, cabinCode,
}: {
  airlineCodes: Array<string | null | undefined>
  cabinCode: string
}) {
  const { carrier, mixed, instead, present } = governingCarrier(airlineCodes)
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
      {!mixed && carrier.cabinExtra ? `, plus ${carrier.cabinExtra}` : ''}
      {instead ? ` — tighter than ${instead.name}’s, because a bag has to satisfy every airline carrying it` : ''}.{' '}
      {present
        .filter((k) => k.cabinExtra && (mixed || k.code !== carrier.code))
        .map((k) => `${k.name}’s own flights add ${k.cabinExtra}. `)
        .join('')}
      <Link to="/travel-info#baggage" className="underline">Full allowances</Link>
    </p>
  )
}
