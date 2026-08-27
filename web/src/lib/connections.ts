import { airportByCode } from '@/data/airports'

/**
 * What a connection actually asks of you on the ground.
 *
 * A wait of two hours means something very different depending on what
 * happens during it. Changing between two international flights at a hub is a
 * walk and a sign to follow. Changing between a domestic and an international
 * flight in Vietnam means leaving the secure area, crossing to another
 * terminal at the three big airports, and clearing immigration either way —
 * which is the difference between a comfortable connection and a missed one.
 *
 * So the interface says which of those it is, next to the time, rather than
 * leaving the traveller to work it out from the airport codes.
 */

/** The three airports where domestic and international are separate buildings. */
const SEPARATE_TERMINALS = new Set(['SGN', 'HAN', 'DAD'])

function isVietnam(iata: string | null | undefined): boolean {
  return !!iata && airportByCode(iata)?.country === 'VN'
}

/** A leg flown entirely inside Vietnam. */
function isDomesticLeg(origin: string, destination: string): boolean {
  return isVietnam(origin) && isVietnam(destination)
}

export interface ConnectionAdvice {
  /** The short label shown beside the connection time. */
  label: string
  /** True where the two flights use different terminals. */
  changesTerminal: boolean
}

/**
 * Advice for one connection, or null when there is nothing to warn about.
 *
 * Returns null for a connection between two domestic flights, between two
 * international flights, or anywhere outside Vietnam — in all of those the
 * passenger stays airside and follows the signs.
 */
export function connectionAdvice(
  inbound: { origin_iata: string; destination_iata: string },
  outbound: { origin_iata: string; destination_iata: string },
): ConnectionAdvice | null {
  const via = inbound.destination_iata
  if (!isVietnam(via)) return null

  const arrivingDomestic = isDomesticLeg(inbound.origin_iata, inbound.destination_iata)
  const departingDomestic = isDomesticLeg(outbound.origin_iata, outbound.destination_iata)

  // Same on both sides: airside the whole way, nothing to say.
  if (arrivingDomestic === departingDomestic) return null

  return SEPARATE_TERMINALS.has(via)
    ? { label: 'Change terminals and go through immigration', changesTerminal: true }
    : { label: 'Go through immigration', changesTerminal: false }
}
