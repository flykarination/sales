import { supabase } from '@/lib/supabase'

/* ------------------------------------------------------------------ */
/* Row shapes. Names match the database exactly -- see the             */
/* karination-booking-data skill for the contract.                     */
/* ------------------------------------------------------------------ */

export interface AirportRow {
  iata_code: string
  airport_name: string | null
  city_name: string | null
  country_code: string | null
  utc_offset_minutes: number | null
  latitude: number | null
  longitude: number | null
}

export interface FlightResult {
  flight_id: string
  aircraft_id: string
  direction: 'OUTBOUND' | 'INBOUND'
  airline_code: string | null
  airline_name: string | null
  flight_designator: string
  origin_iata: string
  destination_iata: string
  departure_date: string
  departure_time: string
  arrival_date: string
  arrival_time: string
  duration_minutes: number
  cabin_code: string
  price_usd: number
  seats_per_departure: number
  aircraft_model: string
  registration: string
  tz_resolved: boolean
}

export interface RouteRow {
  airline_uid: string
  airline_code: string | null
  airline_name: string | null
  origin_iata: string
  destination_iata: string
  flight_pairs: number
  fastest_minutes: number | null
  from_price_economy_usd: number | null
  from_price_business_usd: number | null
  days_served_per_week: number
  has_stopover_service: boolean
}

/* ------------------------------------------------------------------ */

/** Every airport in the network, for the search autocomplete. ~481 rows. */
export async function listAirports() {
  return supabase
    .from('airports')
    .select('iata_code,airport_name,city_name,country_code,utc_offset_minutes,latitude,longitude')
    .order('iata_code')
    .returns<AirportRow[]>()
}

/** Direct legs on one date for one cabin, cheapest first. */
export async function searchFlights(args: {
  origin: string
  destination: string
  date: string
  cabin?: string
  seats?: number
}) {
  const { data, error } = await supabase.rpc('search_flights', {
    p_origin: args.origin,
    p_destination: args.destination,
    p_travel_date: args.date,
    p_cabin: args.cabin ?? 'ECONOMY',
    p_seats: args.seats ?? 1,
  })
  return { data: (data ?? null) as FlightResult[] | null, error }
}

/** Live seats remaining on one departure, simulated demand included. */
export async function availableSeats(args: {
  flightId: string
  aircraftId: string
  direction: string
  date: string
  cabin: string
}) {
  return supabase.rpc('kx_available_seats', {
    p_flight_id: args.flightId,
    p_aircraft_id: args.aircraftId,
    p_direction: args.direction,
    p_date: args.date,
    p_cabin: args.cabin,
  })
}

/** Routes with lead-in fares. Used for the destinations rail. */
export async function listRoutes(limit = 200) {
  return supabase
    .from('v_routes')
    .select('*')
    .not('from_price_economy_usd', 'is', null)
    .order('from_price_economy_usd', { ascending: true })
    .limit(limit)
    .returns<RouteRow[]>()
}

/** Sell a reservation. Returns the PNR. */
export async function createBooking(args: {
  contactEmail: string
  contactName: string
  passengers: Array<{ given_name: string; family_name: string; passenger_type?: string }>
  segments: Array<{
    flight_id: string
    aircraft_id: string
    direction: string
    cabin_code: string
    travel_date: string
  }>
}) {
  return supabase.rpc('create_booking', {
    p_contact_email: args.contactEmail,
    p_contact_name: args.contactName,
    p_passengers: args.passengers,
    p_segments: args.segments,
  })
}

/** Retrieve a booking. Both halves required; a wrong pair returns no rows. */
export async function findBooking(pnr: string, email: string) {
  return supabase.rpc('find_booking', { p_pnr: pnr, p_email: email })
}

export interface FleetRow {
  aircraft_id: string
  registration: string
  aircraft_model: string
  manufacturer: string | null
  airline_code: string | null
  hub_airport_iata: string | null
  delivery_date: string | null
  first_product: string | null
  biz_product: string | null
  prem_eco_product: string | null
  eco_product: string | null
  first_pitch: number | null
  biz_pitch: number | null
  prem_eco_pitch: number | null
  eco_pitch: number | null
  eco_config_type: string | null
  flight_pairs_worked: number
  is_unassigned: boolean
}

/** Every airframe with its cabin products. 717 rows for Karination. */
export async function listFleet() {
  return supabase
    .from('v_fleet')
    .select('*')
    .order('aircraft_model')
    .order('registration')
    .returns<FleetRow[]>()
}

export interface AirlineRow {
  uid: string
  airline_code: string | null
  airline_name: string | null
  airline_country: string | null
  alliance: string | null
  is_group_member: boolean
}

export interface AirlineStatsRow {
  airline_uid: string
  num_aircraft: number
  num_routes: number
  num_flights: number
  flagship_aircraft_model: string | null
  major_hub_iata: string | null
}

/** The three carriers of KarinationGroup, with their headline counters. */
export async function listGroupCarriers() {
  const airlines = await supabase
    .from('airlines')
    .select('uid,airline_code,airline_name,airline_country,alliance,is_group_member')
    .eq('is_group_member', true)
    .returns<AirlineRow[]>()
  const stats = await supabase
    .from('airline_stats')
    .select('*')
    .returns<AirlineStatsRow[]>()
  return { airlines, stats }
}

export interface HubRow {
  airline_uid: string
  airport_iata: string
  is_major_hub: boolean
}

export async function listHubs() {
  return supabase.from('airline_hubs').select('*').returns<HubRow[]>()
}

/** Stopover services, presented as one flight with one stop. */
export async function listStopovers() {
  return supabase.from('v_stopover_itineraries').select('*').order('flight_number')
}

/** Codeshares, with both carriers resolved. */
export async function listCodeshares() {
  return supabase.from('v_codeshares').select('*').limit(200)
}

/* ---- operator only: refused without the token, absent in production ---- */

export async function opsSnapshot() {
  const { opsAvailable, opsToken } = await import('@/lib/supabase')
  if (!opsAvailable) throw new Error('Operator dashboard is unavailable in this build.')
  return supabase.rpc('ops_snapshot', { p_token: opsToken })
}

export async function opsRecentSales() {
  const { opsAvailable, opsToken } = await import('@/lib/supabase')
  if (!opsAvailable) throw new Error('Operator dashboard is unavailable in this build.')
  return supabase.rpc('ops_recent_sales', { p_token: opsToken })
}

/* ---- RainbowOne ------------------------------------------------------ */

export interface TierRow {
  tier_code: string
  tier_name: string
  tier_rank: number
  qualifying_miles_required: number
  earn_bonus_pct: number
  hue_token: string
  tagline: string | null
  perks: string[]
}

export interface AccountRow {
  member_id: string
  member_number: string
  email: string
  full_name: string | null
  balance_miles: number
  lifetime_miles: number
  qualifying_miles_ytd: number
  joined_at: string
  tier_code: string
  tier_name: string
  tier_rank: number
  hue_token: string
  tagline: string | null
  perks: string[]
  earn_bonus_pct: number
  next_tier_code: string | null
  next_tier_name: string | null
  miles_to_next_tier: number | null
}

export interface LedgerRow {
  txn_id: string
  txn_type: string
  miles: number
  qualifying_miles: number
  distance_km: number | null
  cabin_code: string | null
  multiplier: number | null
  description: string
  occurred_at: string
}

/** The four tiers, readable logged out for the marketing page. */
export async function listTiers() {
  return supabase.from('ff_tiers').select('*').order('tier_rank').returns<TierRow[]>()
}

export interface EarnRateRow {
  cabin_code: string
  multiplier: number
  qualifying_multiplier: number
  fare_product_id: string | null
}

export async function listEarnRates() {
  return supabase
    .from('ff_earn_rates')
    .select('cabin_code,multiplier,qualifying_multiplier,fare_product_id')
    .is('fare_product_id', null)
    .returns<EarnRateRow[]>()
}

/** The signed-in member's account. RLS returns nothing to anyone else. */
export async function myAccount() {
  return supabase.from('v_ff_account').select('*').maybeSingle()
}

export async function myLedger(limit = 50) {
  return supabase
    .from('ff_transactions')
    .select('txn_id,txn_type,miles,qualifying_miles,distance_km,cabin_code,multiplier,description,occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(limit)
    .returns<LedgerRow[]>()
}

export interface DepartureRow {
  flight_id: string
  aircraft_id: string
  direction: 'OUTBOUND' | 'INBOUND'
  flight_designator: string
  origin_iata: string
  destination_iata: string
  departure_day_of_week: number
  departure_time: string
  arrival_time: string
  arrival_days_after_departure: number
  duration_minutes: number
  cabin_code: string
  price_usd: number
  seats_per_departure: number
  aircraft_model: string
  is_sellable: boolean
}

/** Every departure on a city pair, for the printed-timetable view. */
export async function getTimetable(origin: string, destination: string) {
  return supabase
    .from('v_bookable_departures')
    .select('flight_id,aircraft_id,direction,flight_designator,origin_iata,destination_iata,departure_day_of_week,departure_time,arrival_time,arrival_days_after_departure,duration_minutes,cabin_code,price_usd,seats_per_departure,aircraft_model,is_sellable')
    .eq('origin_iata', origin.toUpperCase())
    .eq('destination_iata', destination.toUpperCase())
    .eq('cabin_code', 'ECONOMY')
    .order('departure_time')
    .returns<DepartureRow[]>()
}

/* ---- check-in --------------------------------------------------------- */

export interface BoardingPassRow {
  pnr: string
  passenger_name: string
  segment_order: number
  flight_number: number
  airline_code: string
  origin_iata: string
  destination_iata: string
  travel_date: string
  departure_time: string
  arrival_time: string
  cabin_code: string
  cabin_name: string
  seat_number: string | null
  ticket_number: string | null
  boarding_time: string
  gate: string
  checkin_open: boolean
  checked_in: boolean
}

/** Check in a booking. Idempotent; returns a boarding pass per passenger per leg. */
export async function checkIn(pnr: string, email: string) {
  const { data, error } = await supabase.rpc('check_in', {
    p_pnr: pnr.trim().toUpperCase(),
    p_email: email.trim(),
  })
  return { data: (data ?? null) as BoardingPassRow[] | null, error }
}

const BOARD_COLUMNS =
  'flight_id,flight_designator,origin_iata,destination_iata,departure_time,arrival_time,' +
  'arrival_days_after_departure,duration_minutes,aircraft_model,departure_day_of_week,cabin_code'

/**
 * Departures from one airport on one weekday, starting at a wall-clock time.
 *
 * The cut has to happen on the server. SGN and DAD each run just over 400
 * Economy departures a day, so a blind `limit(300)` ordered by time silently
 * dropped everything after 18:15 and 17:00 respectively — the board then had
 * no upcoming flights left to show for the rest of the evening.
 */
export async function departuresFrom(
  origin: string, dow: number, fromTime?: string, limit = 60,
) {
  let q = supabase
    .from('v_bookable_departures')
    .select(BOARD_COLUMNS)
    .eq('origin_iata', origin.toUpperCase())
    .eq('cabin_code', 'ECONOMY')
    .eq('departure_day_of_week', dow)
  if (fromTime) q = q.gte('departure_time', fromTime)
  return q.order('departure_time').limit(limit)
}

/**
 * Arrivals into one airport on one weekday.
 *
 * A flight arriving today may have left yesterday, so both weekdays are asked
 * for and the arrival day is worked out from arrival_days_after_departure. The
 * over-fetch covers what that filter discards.
 */
export async function arrivalsAt(
  destination: string, dow: number, fromTime?: string, limit = 60,
) {
  const previous = (dow + 6) % 7
  let q = supabase
    .from('v_bookable_departures')
    .select(BOARD_COLUMNS)
    .eq('destination_iata', destination.toUpperCase())
    .eq('cabin_code', 'ECONOMY')
    .in('departure_day_of_week', [dow, previous])
  if (fromTime) q = q.gte('arrival_time', fromTime)
  return q.order('arrival_time').limit(limit * 3)
}
