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
      'The furthest-reaching aircraft we own, and the fleet growing fastest: a hundred and sixty-one frames, up from twenty-six, across fifty-one cities. Most of the new flying is to the Americas — Mexico, Florida and Texas, Havana and the Caribbean, Bermuda — and it reaches Ushuaia at the southern tip of Argentina, the longest Karination flight by time in the air. First is an enclosed apartment at 81 inches on every frame; Business is a wide suite or a staggered suite, depending on the aircraft.',
    signature: { route: 'Hà Nội – Samaná', km: 15487, minutes: 1080 },
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

/**
 * The same, for FORZA.
 *
 * Kept separate rather than merged into FLEET_NOTES because five types are
 * flown by both carriers and they do quite different work at each. A
 * 777-300ER is Karination's hardest-worked widebody; at FORZA it is one of
 * nineteen frames opening Belfast and Dublin from the Mekong Delta.
 *
 * Every figure is from the schedule: frames in service, cities reached, and
 * the longest sector each type actually operates.
 */
export const FORZA_FLEET_NOTES: Record<string, FleetNote> = {
  'Airbus A330-900': {
    role: 'Long-haul, newest reach',
    description:
      'Twenty-four frames turning thirty-two cities from provincial bases that had no long-haul service at all a few years ago — including Cần Thơ to Tijuana, a sector longer than anything Karination flies out of Nha Trang.',
    signature: { route: 'Cần Thơ – Tijuana', km: 13461, minutes: 1020 },
  },
  'Airbus A350-900': {
    role: 'Long-haul backbone',
    description:
      'Ninety aircraft reaching ninety-five cities, and the type that carries the long-haul network from one end of its range to the other — from a two-hour regional turn to the fourteen-thousand-kilometre crossing between Hải Phòng and Florida.',
    signature: { route: 'Hải Phòng – Tampa', km: 14499, minutes: 1015 },
  },
  'Boeing 787-10 Dreamliner': {
    role: 'Long-haul, high capacity',
    description:
      'Sixteen frames on the denser long-haul runs, where the A330-900 would leave money on the table. Hải Phòng to Cape Town is the longest of them — a route no Vietnamese carrier flew before FORZA opened it.',
    signature: { route: 'Hải Phòng – Cape Town', km: 11116, minutes: 795 },
  },
  'Boeing 787-8 Dreamliner': {
    role: 'Long-haul, thin routes',
    description:
      'Only two aircraft, used where the traffic is real but not yet deep enough for a larger frame. Six cities, and the pair of them are what keeps Shannon and Dublin on the map from the Delta.',
    signature: { route: 'Cần Thơ – Shannon', km: 10706, minutes: 780 },
  },
  'Boeing 777-300ER': {
    role: 'Long-haul, high density',
    description:
      'Nineteen aircraft doing the heavy lifting on sixteen cities. At Karination this type is a workhorse across fifty-five destinations; here it is a specialist, opening the routes that need the most seats at once — Belfast among them.',
    signature: { route: 'Cần Thơ – Belfast', km: 10453, minutes: 760 },
  },
  'Airbus A350-1000': {
    role: 'Long-haul flagship',
    description:
      'A hundred and eighty-six aircraft, a hundred and seventy-one of them flying: FORZA’s largest fleet by far, across a hundred and fifty-three cities. Cần Thơ to the Turks and Caicos is its longest sector by distance, and Nha Trang to Ushuaia, at the southern tip of Argentina, keeps it in the air for most of a day.',
    signature: { route: 'Cần Thơ – Providenciales', km: 16466, minutes: 1140 },
  },
  'Airbus A350-1000ULR': {
    role: 'Ultra-long range',
    description:
      'Forty aircraft, new this season, and the longest-legged in the group: twenty-one cities, almost all of them in South America, flown nonstop from Nha Trang — São Paulo, Rio, Buenos Aires, Montevideo, Santiago, Medellín, Caracas and more. Nha Trang to Santiago is the longest flight in KarinationGroup by time in the air: more than twenty-three hours, in either direction.',
    signature: { route: 'Nha Trang – Medellín', km: 17931, minutes: 1255 },
  },
  'Airbus A321neo': {
    role: 'Long, thin, narrowbody',
    description:
      'Forty-two aircraft flying sectors a narrowbody has no business flying — Đà Lạt to Kamchatka is more than eight hours. This is how FORZA opens a route before it can justify a widebody, and several of its long-haul destinations started here.',
    signature: { route: 'Đà Lạt – Petropavlovsk-Kamchatsky', km: 6377, minutes: 495 },
  },
  'Airbus A220-100': {
    role: 'Regional, medium haul',
    description:
      'Five aircraft covering the gap between the E-jets and the narrowbodies: fifteen cities on sectors of up to two and a half hours, including the Borneo runs that are too long for an Embraer and too thin for an A321.',
    signature: { route: 'Balikpapan – Cần Thơ', km: 1768, minutes: 150 },
  },
  'Embraer E190-E2': {
    role: 'The provincial network',
    description:
      'Twenty aircraft, fifty-two cities and a hundred and fifty-eight city pairs — more of the map than any other type FORZA flies, and the reason a passenger in Côn Đảo or Điện Biên Phủ has a flight at all. Nothing else in the group serves these airports.',
    signature: { route: 'Côn Đảo – Điện Biên Phủ', km: 1461, minutes: 130 },
  },
  'Embraer E195': {
    role: 'The provincial network, larger',
    description:
      'The E190-E2\u2019s bigger sister, twenty frames across twenty-four cities on the same provincial web where the loads justify the extra rows. Between the two Embraer types FORZA touches every airport in the country that has a runway long enough.',
    signature: { route: 'Cà Mau – Điện Biên Phủ', km: 1378, minutes: 125 },
  },
  'De Havilland Canada Dash 8 Q100': {
    role: 'The shortest sectors',
    description:
      'Three turboprops on the hops nothing else can make pay — fifteen airports, none of them far apart. The smallest aircraft in the group, and the one doing the least glamorous and most necessary work.',
    signature: { route: 'Vân Đồn – Vinh', km: 321, minutes: 50 },
  },
}

/**
 * The same, for Sonder. Two types, both out of Incheon; figures from the
 * schedule as above.
 */
export const SONDER_FLEET_NOTES: Record<string, FleetNote> = {
  'Airbus A350-1000': {
    role: 'Long-haul flagship',
    description:
      'Sixty-five aircraft across twenty-nine cities, and most of what Sonder is: Incheon to Boston and three Californian cities, to Paris, Nantes, Geneva and the south of France, Malta and Sicily, Ashgabat, Tokyo, Melbourne and Port Moresby — and now to the Caribbean and the north of South America, from Caracas and Bogotá to Cayenne, the longest of them at nearly eighteen hours.',
    signature: { route: 'Seoul – Cayenne', km: 15311, minutes: 1075 },
  },
  'Airbus A350-1000ULR': {
    role: 'Ultra-long range',
    description:
      'Twenty-two aircraft for the longest flying Sonder does: Incheon nonstop to ten cities, nine of them in South America — Lima, Brasília, Belo Horizonte, Salvador, Recife, Fortaleza, Santa Cruz, Cochabamba and Ushuaia — and Tokyo. Santa Cruz is the longest Sonder flight by time in the air, almost twenty-two hours on the way back to Seoul.',
    signature: { route: 'Seoul – Belo Horizonte', km: 17825, minutes: 1275 },
  },
  'Boeing 787-8 Dreamliner': {
    role: 'Long-haul, thin routes',
    description:
      'Eight aircraft across seven cities, on the routes where an A350-1000 would be too much aeroplane. It alone flies Khartoum, its longest sector, and shares Paris, Nantes, Geneva, Malta, Sicily and Sacramento with the bigger jet.',
    signature: { route: 'Seoul – Khartoum', km: 9296, minutes: 680 },
  },
}
