-- network-stats.sql
--
-- Regenerates src/data/network-stats.json. Every number on the About page comes
-- out of this one query; nothing here is estimated or rounded up for effect.
--
-- Run it with:
--
--   psql "$SUPABASE_DIRECT_URL" -At -f src/data/network-stats.sql \
--     | tr -d '\r' > src/data/network-stats.json
--
-- The `tr` is not optional on Windows: psql there terminates lines with CRLF and
-- the rest of src/ is LF.
--
-- Notes on the semantics, because several of these are easy to get wrong:
--
--   * A `flights` row is a round-trip PAIR, not a flight. It carries an outbound
--     and an inbound flight number and a duration for each. `flightPairs` counts
--     those rows; `routes` counts the unordered airport pairs they connect.
--   * Stopover services are stored as two `flights` rows - a parent leg and a
--     child leg linked by `child_stopover_flight_id`. Both are real legs with
--     their own aircraft assignment, so both are counted. That means a one-stop
--     service contributes two routes and two departures, which is correct: an
--     aircraft really does depart twice.
--   * Weekly departures are derived from `flight_assignments.operating_days_per_week`,
--     which is verified equal to the row count in `flight_assignment_days`. Each
--     assignment generates one departure from the origin AND one from the
--     destination per operating day, because the pair flies out and back.
--   * Distances are great-circle km on a sphere of radius 6371 km, computed from
--     `airports.latitude/longitude`. This is the same formula as `distanceKm()`
--     in src/lib/geo.ts (d3-geo's geoDistance x 6371), so the map and the About
--     page never disagree.
--   * Seats come from `flight_fares.seats_per_departure`, which is ALREADY
--     per-departure per-cabin. Summing the cabins gives the aircraft's sellable
--     seat count on that leg. Never divide it by the operating days again.

with reachable as (
  -- Every airport the network touches: both endpoints of every flight, plus
  -- declared hubs (CAH is a FORZA hub with no flights yet, so it only appears here).
  select origin_iata as iata from public.flights
  union
  select destination_iata as iata from public.flights
  union
  select airport_iata as iata from public.airline_hubs
),
served as (
  -- Airports with actual scheduled service, which is what "destinations" means.
  select origin_iata as iata from public.flights
  union
  select destination_iata as iata from public.flights
),
weekly as (
  select fa.flight_id, sum(fa.operating_days_per_week)::int as days_per_week
  from public.flight_assignments fa
  group by fa.flight_id
),
legs as (
  select
    f.flight_id,
    f.origin_iata,
    f.destination_iata,
    f.outbound_duration_minutes,
    coalesce(w.days_per_week, 0) as days_per_week,
    round(
      (
        6371 * 2 * asin(least(
          1.0,
          sqrt(
            sin(radians(d.latitude - o.latitude) / 2) ^ 2
            + cos(radians(o.latitude)) * cos(radians(d.latitude))
              * sin(radians(d.longitude - o.longitude) / 2) ^ 2
          )
        ))
      )::numeric
    )::int as distance_km
  from public.flights f
  join public.airports o on o.iata_code = f.origin_iata
  join public.airports d on d.iata_code = f.destination_iata
  left join weekly w on w.flight_id = f.flight_id
),
route_extremes as (
  -- One row per directional airport pair; distance is symmetric so the extremes
  -- of this set are the extremes of the network.
  select
    origin_iata,
    destination_iata,
    distance_km,
    min(outbound_duration_minutes) as fastest_minutes,
    count(*) as flight_pairs
  from legs
  group by origin_iata, destination_iata, distance_km
),
departures as (
  -- A round trip departs from both ends, once per operating day.
  select origin_iata as iata, days_per_week as n from legs
  union all
  select destination_iata as iata, days_per_week as n from legs
),
departures_by_airport as (
  select iata, sum(n)::int as weekly_departures
  from departures
  group by iata
),
seats_per_leg as (
  select ff.flight_id, ff.aircraft_id, sum(ff.seats_per_departure)::int as seats
  from public.flight_fares ff
  group by ff.flight_id, ff.aircraft_id
),
fleet_by_model as (
  select
    ac.aircraft_model,
    count(*)::int as aircraft_count,
    count(*) filter (where asg.aircraft_id is not null)::int as assigned_count
  from public.aircraft ac
  left join (select distinct aircraft_id from public.flight_assignments) asg
    on asg.aircraft_id = ac.aircraft_id
  group by ac.aircraft_model
),
seats_by_model as (
  select ac.aircraft_model, round(avg(s.seats))::int as avg_seats
  from seats_per_leg s
  join public.aircraft ac on ac.aircraft_id = s.aircraft_id
  group by ac.aircraft_model
)
select jsonb_pretty(jsonb_build_object(

  'generatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'source', 'KarinationGroup Supabase (project fqxiskkyvbkhrpejxtol, eu-west-1). '
            || 'Every figure is a live count from public.flights, public.airports, '
            || 'public.aircraft, public.flight_fares, public.flight_assignments, '
            || 'public.airline_hubs and public.codeshares. Distances are great-circle '
            || 'km (R = 6371) from stored airport coordinates. Departure counts are per '
            || 'week and count both ends of each round-trip pair. Regenerate with '
            || 'src/data/network-stats.sql.',
  'notes', jsonb_build_array(
    'destinationsServed counts airports with scheduled service. airportsInDataset '
      || 'is one higher because CAH is a declared FORZA hub with no flights yet.',
    'routes counts unordered airport pairs; directionalRoutes counts ordered ones. '
      || 'They differ by one because exactly one pair is filed in both directions.',
    'A flights row is a round-trip pair, so flightPairs is not a departure count. '
      || 'weeklyDepartures is, and it counts both ends of every pair.',
    'aircraftByModel.manufacturer is printed exactly as stored. The Dash 8 row '
      || 'really does say "De" in aircraft_models.manufacturer - do not silently '
      || 'expand it, and do not display it without checking that first.',
    'FORZA (Z4) and Sonder (SD) have hubs but no flights. Their hub departure '
      || 'counts are network-wide traffic at those airports, all of it flown by KX.'
  ),

  'destinationsServed', (select count(*) from served),
  'airportsInDataset', (select count(*) from reachable),
  'countriesServed', (
    select count(distinct a.country_code)
    from served s join public.airports a on a.iata_code = s.iata
  ),
  'routes', (
    select count(*) from (
      select distinct least(origin_iata, destination_iata), greatest(origin_iata, destination_iata)
      from public.flights
    ) x
  ),
  'directionalRoutes', (
    select count(*) from (select distinct origin_iata, destination_iata from public.flights) y
  ),
  'flightPairs', (select count(*) from public.flights),
  'stopoverServices', (select count(*) from public.flights where child_stopover_flight_id is not null),
  'weeklyDepartures', (select sum(weekly_departures) from departures_by_airport),
  'fleetSize', (select count(*) from public.aircraft),
  'aircraftInService', (select count(distinct aircraft_id) from public.flight_assignments),
  'aircraftTypes', (select count(distinct aircraft_model) from public.aircraft),
  'airlines', (select count(*) from public.airlines where is_group_member),

  'longestRoute', (
    select jsonb_build_object(
      'origin', r.origin_iata,
      'originCity', o.city_name,
      'originCountry', o.country_code,
      'destination', r.destination_iata,
      'destinationCity', d.city_name,
      'destinationCountry', d.country_code,
      'durationMinutes', r.fastest_minutes,
      'distanceKm', r.distance_km
    )
    from route_extremes r
    join public.airports o on o.iata_code = r.origin_iata
    join public.airports d on d.iata_code = r.destination_iata
    order by r.distance_km desc, r.origin_iata, r.destination_iata
    limit 1
  ),
  'shortestRoute', (
    select jsonb_build_object(
      'origin', r.origin_iata,
      'originCity', o.city_name,
      'originCountry', o.country_code,
      'destination', r.destination_iata,
      'destinationCity', d.city_name,
      'destinationCountry', d.country_code,
      'durationMinutes', r.fastest_minutes,
      'distanceKm', r.distance_km
    )
    from route_extremes r
    join public.airports o on o.iata_code = r.origin_iata
    join public.airports d on d.iata_code = r.destination_iata
    order by r.distance_km asc, r.origin_iata, r.destination_iata
    limit 1
  ),

  'busiestAirport', (
    select jsonb_build_object(
      'iata', b.iata,
      'city', a.city_name,
      'country', a.country_code,
      'weeklyDepartures', b.weekly_departures
    )
    from departures_by_airport b
    join public.airports a on a.iata_code = b.iata
    order by b.weekly_departures desc, b.iata
    limit 1
  ),

  'aircraftByModel', (
    select jsonb_agg(row order by row->>'model')
    from (
      select jsonb_build_object(
        'model', f.aircraft_model,
        'manufacturer', coalesce(m.manufacturer, ''),
        'count', f.aircraft_count,
        'assigned', f.assigned_count,
        -- null, not 0, when the type has no scheduled departures at all: the
        -- Airbus A318-100 fleet is delivered but unassigned, so it has no
        -- per-departure seat count to average.
        'avgSeatsPerDeparture', s.avg_seats
      ) as row
      from fleet_by_model f
      left join seats_by_model s on s.aircraft_model = f.aircraft_model
      left join public.aircraft_models m on m.aircraft_model = f.aircraft_model
    ) z
  ),

  'hubs', (
    select jsonb_agg(row order by row->>'airline', (row->>'isMajor')::boolean desc, row->>'iata')
    from (
      select jsonb_build_object(
        'iata', h.airport_iata,
        'city', a.city_name,
        'country', a.country_code,
        'airline', coalesce(al.airline_code, ''),
        'airlineName', coalesce(al.airline_name, ''),
        'isMajor', h.is_major_hub,
        'weeklyDepartures', coalesce(dba.weekly_departures, 0)
      ) as row
      from public.airline_hubs h
      join public.airports a on a.iata_code = h.airport_iata
      join public.airlines al on al.uid = h.airline_uid
      left join departures_by_airport dba on dba.iata = h.airport_iata
    ) z
  ),

  'topAirports', (
    select jsonb_agg(row order by (row->>'weeklyDepartures')::int desc, row->>'iata')
    from (
      select jsonb_build_object(
        'iata', b.iata,
        'city', a.city_name,
        'country', a.country_code,
        'weeklyDepartures', b.weekly_departures
      ) as row
      from departures_by_airport b
      join public.airports a on a.iata_code = b.iata
      order by b.weekly_departures desc, b.iata
      limit 10
    ) z
  ),

  'codeshares', jsonb_build_object(
    'agreements', (select count(*) from public.codeshares),
    'partners', (select count(distinct marketing_airline_uid) from public.codeshares),
    'routes', (
      select count(*) from (
        select distinct least(origin_iata, destination_iata), greatest(origin_iata, destination_iata)
        from public.codeshares
      ) c
    )
  )

));
