---
name: karination-booking-data
description: The KarinationGroup Supabase backend contract - tables, views, RPCs, security model, and the non-obvious data semantics behind flight times, seat counts and stopovers. Use whenever building or debugging anything that reads or writes the airline's flights, fares, availability or bookings.
---

# KarinationGroup booking data

The backend is live on Supabase. This is what the front end may talk to and what
the values actually mean. Getting the semantics wrong produces a site that looks
right and lies about departure times, so read the **Semantics** section before
rendering any time or seat count.

Schema source of truth: `database/sql/*.sql`. Full prose: `database/README.md`.

## Connecting

| | |
|---|---|
| Project URL | `https://fqxiskkyvbkhrpejxtol.supabase.co` |
| Browser key | the **publishable** key (`sb_publishable_...`) |
| Never in the browser | the **secret** key (`sb_secret_...`) - it bypasses RLS entirely |
| Region | eu-west-1 |

RLS is on for every table. With the publishable key the catalog is readable and
the reservation tables are completely invisible; bookings are reached only
through the two RPCs below. Do not attempt `from('bookings').select()` - it is
denied by design, not misconfigured.

## The three entry points

```js
// 1. Search. Direct legs on a date, cheapest first.
const { data } = await supabase.rpc('search_flights', {
  p_origin: 'SGN', p_destination: 'KGD',
  p_travel_date: '2026-09-02', p_cabin: 'ECONOMY', p_seats: 2
})

// 2. Sell. Returns the PNR. Prices come from the schedule, never from the
//    caller - do not try to pass a price, it is ignored.
const { data: pnr } = await supabase.rpc('create_booking', {
  p_contact_email: 'traveller@example.com',
  p_contact_name: 'A Traveller',
  p_passengers: [{ given_name: 'Alex', family_name: 'Traveller', passenger_type: 'ADULT' }],
  p_segments: [{ flight_id, aircraft_id, direction: 'OUTBOUND',
                 cabin_code: 'ECONOMY', travel_date: '2026-09-02' }]
})

// 3. Retrieve. Both halves required; wrong pair returns zero rows, not an error.
const { data } = await supabase.rpc('find_booking', { p_pnr: '8VZ5JD', p_email: '...' })
```

`kx_available_seats(flight_id, aircraft_id, direction, date, cabin)` returns
live seats remaining, simulated demand included. Use it for "only N seats left",
not `flight_fares.seats_per_departure`, which is the static allotment.

## Readable views

| view | use it for |
|---|---|
| `v_bookable_departures` | the search surface: leg x weekday x cabin, seats, price |
| `v_flight_legs` | timetable pages; two rows per `flights` row |
| `v_stopover_itineraries` | one-stop journeys A->B->C |
| `v_routes` | route maps and "from $X" teasers |
| `v_codeshares` | the "operated by" line |
| `v_fleet` | aircraft/cabin product pages |
| `v_departure_load` | per-departure load - **100k+ rows, always filter** |
| `v_management_dashboard` | ops screens: one row per carrier per day |

Egress on the free tier is 5 GB/month. A management page must read
`v_management_dashboard`, never `v_departure_load` unfiltered.

## Semantics that are easy to get wrong

**Times are local to the departure airport.** `departure_time` on a leg is wall
clock at the origin; `arrival_time` is wall clock at the destination, already
shifted using `airports.utc_offset_minutes`. Never apply a timezone conversion
of your own on top - just print them. Show the date rollover with
`arrival_days_after_departure` (`+1` badge), which can be 0 or 1.

`tz_resolved` is true when both airports had offsets. All 481 currently do; if a
future carrier adds an airport without one, that row's arrival falls back to the
origin's clock and the flag goes false. Treat false as "do not display an
arrival time".

**Day of week is 0 = Monday .. 6 = Sunday**, not Postgres's 1-7 and not
JavaScript's 0 = Sunday. Convert with `(date.getDay() + 6) % 7`.

**A `flights` row is a round-trip pair, not a flight.** It carries two flight
numbers. The bookable unit is a leg: `(flight_id, aircraft_id, direction,
travel_date, cabin_code)`. That five-part key identifies a departure everywhere
in the system.

**Stopover legs share the parent's flight number.** DAD-KUT-IST is KX 73 the
whole way. Present it as one flight with one stop, not two flights. Flight
number alone is not unique - key on the leg.

**`seats_per_departure` is a full cabin**, derived as
`weekly_seats_for_sale / operating_days_per_week`. Occupancy in this world is
always full. Do not divide it again.

**Prices are whole US dollars**, integer, one way, per passenger, per cabin.

**Five airlines have no name.** External codeshare marketing partners exist as
`airlines` rows with `is_group_member = false` and a null `airline_name` and
`airline_code`. Always coalesce before rendering.

**FORZA and Sonder have no flights yet.** They exist in `airlines` and
`airline_stats` with empty fleets. A carrier switcher must handle zero results
without looking broken.

## Demand simulation

Departures fill on their own via `simulate_bookings()` on a 15-minute cron, so
availability genuinely changes between page loads. Real bookings decrement the
same pool and take precedence over simulated ones. Nothing in the front end
should call the simulation functions - they are revoked from `anon`.

## Cabins

`FIRST`, `BUSINESS`, `PREMIUM_ECONOMY`, `ECONOMY` - order them by
`cabin_classes.sort_order`, not alphabetically. Many aircraft sell zero first
class; filter on `is_sellable` rather than showing an empty cabin.

## Extension points

`fare_products` and `ancillaries` are deliberately empty tables with working
keys. If the brief calls for fare families or paid bags, populate them rather
than hard-coding options in the UI.
