/**
 * What each aircraft type does on the Karination network.
 *
 * Every claim here is drawn from the schedule: the fleet count, the longest
 * sector each type actually operates, how many destinations it reaches, and
 * the cabin products fitted to it. Nothing is invented about the aeroplanes.
 *
 * `configuration` is left empty deliberately — seat counts and layouts are to
 * be filled in by hand later. The Fleet page renders it only when present.
 */
export interface FleetNote {
  /** Two or three words: what this type is for. */
  role: string
  /** The type's own paragraph. */
  description: string
  /** Longest sector actually flown, as origin–destination. */
  signature: { route: string; km: number; minutes: number }
  /** Seat layout, to be supplied by hand. */
  configuration?: string
}

export const FLEET_NOTES: Record<string, FleetNote> = {
  'Airbus A350-1000': {
    role: 'Ultra-long-haul flagship',
    description:
      'The furthest-reaching aircraft we own, and the only one that can hold a fifteen-hour sector without thinking about it. Twenty-six frames work a deliberately small list of twenty-one cities, almost all of them the ones nothing else in the fleet can reach. First is an enclosed apartment at 81 inches; the wide suites in Business are the widest seats we fly.',
    signature: { route: 'Phú Quốc – New Orleans', km: 15296, minutes: 1020 },
  },
  'Boeing 777-9': {
    role: 'Long-haul backbone',
    description:
      'Seventy-eight aircraft reaching eighty-six destinations — more of the world than any other type in the fleet, and the aeroplane most long-haul passengers will actually meet. Private suites up front on the newest frames, open suites on the rest, and the largest Economy cabin we operate at 414 seats.',
    signature: { route: 'TP Hồ Chí Minh – Ontario, California', km: 13181, minutes: 850 },
  },
  'Boeing 777-300ER': {
    role: 'Long-haul, high density',
    description:
      'The hardest-worked widebody we have: fifty frames spread across fifty-four cities, everything from a two-hour regional hop to a fifteen-hour crossing. Business is staggered and studio suites at 91 inches of pitch — the most generous business cabin in the fleet.',
    signature: { route: 'Hà Nội – Memphis', km: 13541, minutes: 910 },
  },
  'Airbus A350-900': {
    role: 'Long, thin routes',
    description:
      'Twenty-one aircraft on the routes that are long but never full enough for a 777 — the European and African cities we serve a few times a week rather than daily. Apartments and open suites in First, full suites in Business.',
    signature: { route: 'Phú Quốc – Basel', km: 9653, minutes: 705 },
  },
  'Airbus A330-300': {
    role: 'Long-haul, dense cabins',
    description:
      'A small fleet of twenty on nineteen long sectors, configured for volume rather than range. The densest widebody Economy we fly, and the aircraft most likely to be carrying you to Southern Africa.',
    signature: { route: 'TP Hồ Chí Minh – Johannesburg', km: 9404, minutes: 670 },
  },
  'Airbus A330-200': {
    role: 'Medium and long haul',
    description:
      'Thirty aircraft covering thirty-nine cities, sitting between the narrowbodies and the big twins. Open and premium suites in First at 79 inches, and the type that opened our Iberian and Southern African flying.',
    signature: { route: 'TP Hồ Chí Minh – Porto', km: 11240, minutes: 855 },
  },
  'Airbus A321XLR': {
    role: 'The long thin workhorse',
    description:
      'Our largest fleet at 201 aircraft, and the reason a narrowbody appears on a nine-hour sector. It reaches 110 destinations that could never fill a widebody — the smaller European and Central Asian cities most carriers only serve seasonally. Full-flat beds in Business on every frame.',
    signature: { route: 'TP Hồ Chí Minh – Thessaloniki', km: 8698, minutes: 630 },
  },
  'Airbus A321LR': {
    role: 'Medium haul',
    description:
      'A hundred aircraft across ninety-two cities, doing the six-to-nine hour flying that fills most of the timetable — the Middle East, Central Asia and the near edges of Europe. Full-flat Business on every one.',
    signature: { route: 'Đà Nẵng – Tabuk', km: 7396, minutes: 550 },
  },
  'Airbus A321neo': {
    role: 'The network connector',
    description:
      'A hundred and forty-five aircraft reaching 162 destinations — more cities than any other type we operate. If Karination serves somewhere small, this is almost certainly what flies there. Cabins vary across the fleet: some frames carry full-flat Business, others a regional recliner.',
    signature: { route: 'TP Hồ Chí Minh – Aktau', km: 6444, minutes: 480 },
  },
  'Airbus A320neo': {
    role: 'Regional',
    description:
      'Twenty-one aircraft on thirty-eight short and medium routes across Southeast Asia and southern China. Two hours is a long day for this type, and 160 seats is the whole aeroplane.',
    signature: { route: 'TP Hồ Chí Minh – Chabahar', km: 5123, minutes: 385 },
  },
  'Airbus A321-200': {
    role: 'Short haul',
    description:
      'Nineteen older frames kept for the dense short sectors around the region, where turnaround matters more than range. Average sector under two hours.',
    signature: { route: 'Đà Nẵng – Padang', km: 2064, minutes: 165 },
  },
  'De Havilland Canada Dash 8 Q100': {
    role: 'Domestic feeder',
    description:
      'One turboprop, thirty-five seats, six Vietnamese airports. It exists for the sectors where a jet makes no sense — Hải Phòng, Thanh Hóa, Vinh, Đồng Hới and Côn Đảo — and it is the smallest and slowest aircraft we own by a wide margin.',
    signature: { route: 'Hà Nội – Đà Nẵng', km: 628, minutes: 70 },
  },
  'Airbus A318-100': {
    role: 'Delivered, not yet flying',
    description:
      'Five aircraft delivered and awaiting a route. They carry no assignments in the current schedule and are based nowhere until one is given to them.',
    signature: { route: '—', km: 0, minutes: 0 },
  },
}
