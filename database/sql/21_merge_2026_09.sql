-- =====================================================================
-- 21. Merge the September 2026 exports into the live schedule
--
-- Karination retired its five A318s. FORZA added 114 aircraft and 368
-- flights, retired eight A321neos and rebased 95 frames. Sonder arrives with
-- 28 aircraft and 29 flights out of Incheon. No existing flight changed
-- aircraft: all 1,988 assignments already live are kept, and the 580 new
-- ones all belong to new flights.
--
-- 19_load_forza.sql only ever inserted. This merge also has to update and
-- remove, into tables that live reservations point at, so it is written
-- around what the foreign keys will and will not let it do:
--
--   booking_segments -> flight_assignments, flight_fares      NO cascade
--   departure_inventory -> flight_assignments                  ON DELETE CASCADE
--   flight_fares, flight_assignment_days -> flight_assignments ON DELETE CASCADE
--
-- The first line means an assignment a booking uses cannot be deleted: the
-- whole transaction would be refused. The second means one that only
-- inventory uses would take real booked-seat counts with it, silently. So
-- nothing here deletes a row a booking or a booked seat depends on.
--
-- A departure is only sold when its assignment has day rows
-- (v_bookable_departures joins flight_assignment_days). So an aircraft that
-- has been swapped off a flight but still carries a real booking keeps its
-- assignment and fares -- the booking stays intact -- and loses its days,
-- which is what stops it being sold.
--
-- Run from the project root. Rehearse first; nothing is kept:
--     psql "$KX_DB_URL" -v dry=1 -f database/sql/21_merge_2026_09.sql
-- Then for real:
--     psql "$KX_DB_URL" -f database/sql/21_merge_2026_09.sql
-- =====================================================================

\set ON_ERROR_STOP on
\if :{?dry}
\else
  \set dry 0
\endif

begin;
set constraints all deferred;

-- ---------------------------------------------------------------- staging
create temp table stg_airports (
    iata_code text, airport_name text, city_name text, country_code text,
    timezone text, latitude numeric, longitude numeric) on commit drop;
create temp table stg_airlines        (like public.airlines) on commit drop;
create temp table stg_models          (like public.aircraft_models) on commit drop;
create temp table stg_hubs            (like public.airline_hubs) on commit drop;
create temp table stg_stats           (like public.airline_stats) on commit drop;
create temp table stg_aircraft        (like public.aircraft) on commit drop;
create temp table stg_flights         (like public.flights) on commit drop;
create temp table stg_assignments     (like public.flight_assignments) on commit drop;
create temp table stg_assignment_days (like public.flight_assignment_days) on commit drop;
create temp table stg_fares           (like public.flight_fares) on commit drop;
create temp table stg_codeshares      (like public.codeshares) on commit drop;

\copy stg_airports        (iata_code, airport_name, city_name, country_code, timezone, latitude, longitude) from 'database/csv/airports.csv' with (format csv, header true)
\copy stg_airlines        from 'database/csv/airlines.csv'               with (format csv, header true)
\copy stg_models          from 'database/csv/aircraft_models.csv'        with (format csv, header true)
\copy stg_hubs            from 'database/csv/airline_hubs.csv'           with (format csv, header true)
\copy stg_stats           from 'database/csv/airline_stats.csv'          with (format csv, header true)
\copy stg_aircraft        from 'database/csv/aircraft.csv'               with (format csv, header true)
\copy stg_flights         from 'database/csv/flights.csv'                with (format csv, header true)
\copy stg_assignments     from 'database/csv/flight_assignments.csv'     with (format csv, header true)
\copy stg_assignment_days from 'database/csv/flight_assignment_days.csv' with (format csv, header true)
\copy stg_fares           from 'database/csv/flight_fares.csv'           with (format csv, header true)
\copy stg_codeshares      from 'database/csv/codeshares.csv'             with (format csv, header true)

create temp table merge_report (step int, what text, n bigint) on commit drop;

-- ------------------------------------------------------------- reference
with ins as (
    insert into public.airports (iata_code, airport_name, city_name, country_code,
                                 timezone, latitude, longitude)
    select s.iata_code, nullif(s.airport_name,''), nullif(s.city_name,''),
           nullif(s.country_code,''), nullif(s.timezone,''), s.latitude, s.longitude
    from stg_airports s
    on conflict (iata_code) do nothing
    returning 1)
insert into merge_report select 1, 'airports added (detail follows in 22)', count(*) from ins;

insert into public.airlines select * from stg_airlines on conflict (uid) do nothing;

with ins as (
    insert into public.aircraft_models select * from stg_models
    on conflict (aircraft_model) do nothing returning 1)
insert into merge_report select 2, 'aircraft models added', count(*) from ins;

insert into public.airline_hubs select * from stg_hubs on conflict do nothing;
insert into public.airline_stats select * from stg_stats on conflict (airline_uid) do nothing;

-- -------------------------------------------------------------- aircraft
-- Upsert every airframe. Only rows that actually differ are rewritten.
with up as (
    insert into public.aircraft select * from stg_aircraft
    on conflict (aircraft_id) do update set
        airline_uid = excluded.airline_uid, aircraft_model = excluded.aircraft_model,
        registration = excluded.registration, delivery_date = excluded.delivery_date,
        hub_airport_iata = excluded.hub_airport_iata,
        eco_ratio = excluded.eco_ratio, prem_eco_ratio = excluded.prem_eco_ratio,
        biz_ratio = excluded.biz_ratio, first_ratio = excluded.first_ratio,
        eco_product = excluded.eco_product, prem_eco_product = excluded.prem_eco_product,
        biz_product = excluded.biz_product, first_product = excluded.first_product,
        eco_config_type = excluded.eco_config_type,
        eco_pitch = excluded.eco_pitch, prem_eco_pitch = excluded.prem_eco_pitch,
        biz_pitch = excluded.biz_pitch, first_pitch = excluded.first_pitch,
        engine_option = excluded.engine_option, winglet_option = excluded.winglet_option,
        eyemask_option = excluded.eyemask_option, livery_config_id = excluded.livery_config_id,
        background_image_index = excluded.background_image_index,
        weekly_flight_time = excluded.weekly_flight_time
    where row(aircraft.*) is distinct from row(excluded.*)
    returning (xmax = 0) as inserted)
insert into merge_report
select 3, 'aircraft added',   count(*) filter (where inserted) from up union all
select 3, 'aircraft updated', count(*) filter (where not inserted) from up;

-- --------------------------------------------------------------- flights
with up as (
    insert into public.flights select * from stg_flights
    on conflict (flight_id) do update set
        airline_uid = excluded.airline_uid,
        outbound_flight_number = excluded.outbound_flight_number,
        inbound_flight_number = excluded.inbound_flight_number,
        flight_string = excluded.flight_string,
        origin_iata = excluded.origin_iata, destination_iata = excluded.destination_iata,
        departure_daily_seconds = excluded.departure_daily_seconds,
        outbound_duration_minutes = excluded.outbound_duration_minutes,
        inbound_duration_minutes = excluded.inbound_duration_minutes,
        turnaround_offset_minutes = excluded.turnaround_offset_minutes,
        is_stopover = excluded.is_stopover,
        child_stopover_flight_id = excluded.child_stopover_flight_id
    where row(flights.*) is distinct from row(excluded.*)
    returning (xmax = 0) as inserted)
insert into merge_report
select 4, 'flights added',   count(*) filter (where inserted) from up union all
select 4, 'flights updated', count(*) filter (where not inserted) from up;

-- ------------------------------------------------------ who flies what, when
-- 5a. Days first. flight_assignment_days is unique on (flight_id, day_of_week),
--     so a day moving from one aircraft to another has to leave the old one
--     before it can arrive on the new one.
with del as (
    delete from public.flight_assignment_days d
    using stg_flights sf
    where d.flight_id = sf.flight_id
      and not exists (select 1 from stg_assignment_days s
                       where s.flight_id = d.flight_id and s.aircraft_id = d.aircraft_id
                         and s.day_of_week = d.day_of_week)
    returning 1)
insert into merge_report select 5, 'operating days withdrawn', count(*) from del;

with up as (
    insert into public.flight_assignments select * from stg_assignments
    on conflict (flight_id, aircraft_id) do update set
        operating_days_per_week = excluded.operating_days_per_week,
        flight_profit = excluded.flight_profit
    where row(flight_assignments.*) is distinct from row(excluded.*)
    returning (xmax = 0) as inserted)
insert into merge_report
select 5, 'assignments added',   count(*) filter (where inserted) from up union all
select 5, 'assignments updated', count(*) filter (where not inserted) from up;

with ins as (
    insert into public.flight_assignment_days select * from stg_assignment_days
    on conflict do nothing returning 1)
insert into merge_report select 5, 'operating days added', count(*) from ins;

-- 5b. Fares, then bring future inventory into line with any change in the
--     seats or price a departure is sold at.
with up as (
    insert into public.flight_fares select * from stg_fares
    on conflict (flight_id, aircraft_id, cabin_code) do update set
        weekly_seats_for_sale = excluded.weekly_seats_for_sale,
        seats_per_departure = excluded.seats_per_departure,
        price_usd = excluded.price_usd
    where row(flight_fares.*) is distinct from row(excluded.*)
    returning (xmax = 0) as inserted)
insert into merge_report
select 6, 'fares added',   count(*) filter (where inserted) from up union all
select 6, 'fares updated', count(*) filter (where not inserted) from up;

with up as (
    update public.departure_inventory di
       set capacity_seats       = greatest(f.seats_per_departure, di.booked_seats),
           simulated_seats_sold = least(di.simulated_seats_sold,
                                        greatest(f.seats_per_departure - di.booked_seats, 0)),
           price_usd            = f.price_usd,
           sold_out_at = case
               when least(di.simulated_seats_sold, greatest(f.seats_per_departure - di.booked_seats, 0))
                    + di.booked_seats >= greatest(f.seats_per_departure, di.booked_seats)
               then coalesce(di.sold_out_at, now()) else null end
      from public.flight_fares f
     where f.flight_id = di.flight_id and f.aircraft_id = di.aircraft_id
       and f.cabin_code = di.cabin_code
       and di.travel_date >= current_date
       and (di.capacity_seats <> greatest(f.seats_per_departure, di.booked_seats)
            or di.price_usd <> f.price_usd)
    returning 1)
insert into merge_report select 6, 'future inventory rows re-priced or re-sized', count(*) from up;

-- 5c. A cabin that no longer exists on an aircraft that is still assigned.
--     Kept if anyone has bought it.
with del as (
    delete from public.flight_fares fr
    using stg_assignments sa
    where sa.flight_id = fr.flight_id and sa.aircraft_id = fr.aircraft_id
      and not exists (select 1 from stg_fares s
                       where s.flight_id = fr.flight_id and s.aircraft_id = fr.aircraft_id
                         and s.cabin_code = fr.cabin_code)
      and not exists (select 1 from public.booking_segments bs
                       where bs.flight_id = fr.flight_id and bs.aircraft_id = fr.aircraft_id
                         and bs.cabin_code = fr.cabin_code)
    returning 1)
insert into merge_report select 6, 'fares withdrawn (cabin no longer fitted)', count(*) from del;

-- 5d. Aircraft swapped off a flight. Deleted when nothing real depends on
--     them; the cascade takes their days, fares and simulated inventory.
with del as (
    delete from public.flight_assignments fa
    using stg_flights sf
    where fa.flight_id = sf.flight_id
      and not exists (select 1 from stg_assignments s
                       where s.flight_id = fa.flight_id and s.aircraft_id = fa.aircraft_id)
      and not exists (select 1 from public.booking_segments bs
                       where bs.flight_id = fa.flight_id and bs.aircraft_id = fa.aircraft_id)
      and not exists (select 1 from public.departure_inventory di
                       where di.flight_id = fa.flight_id and di.aircraft_id = fa.aircraft_id
                         and di.booked_seats > 0)
    returning 1)
insert into merge_report select 7, 'assignments withdrawn', count(*) from del;

-- ...and the ones kept because a passenger holds a ticket on them. Their
-- days are already gone, so they are no longer sold.
insert into merge_report
select 7, 'assignments kept for existing bookings (no longer sold)', count(*)
from public.flight_assignments fa
join stg_flights sf on sf.flight_id = fa.flight_id
where not exists (select 1 from stg_assignments s
                   where s.flight_id = fa.flight_id and s.aircraft_id = fa.aircraft_id);

-- Simulated inventory for a cabin that is no longer sold.
with del as (
    delete from public.departure_inventory di
    where di.booked_seats = 0
      and not exists (select 1 from public.flight_fares f
                       where f.flight_id = di.flight_id and f.aircraft_id = di.aircraft_id
                         and f.cabin_code = di.cabin_code)
    returning 1)
insert into merge_report select 7, 'orphaned simulated inventory removed', count(*) from del;

-- ----------------------------------------------------- retired airframes
-- Only for carriers this export carries a fleet for, and never an airframe
-- a booking or a booked seat still names.
with del as (
    delete from public.aircraft a
    where a.airline_uid in (select distinct airline_uid from stg_aircraft)
      and not exists (select 1 from stg_aircraft s where s.aircraft_id = a.aircraft_id)
      and not exists (select 1 from public.booking_segments bs where bs.aircraft_id = a.aircraft_id)
      and not exists (select 1 from public.departure_inventory di
                       where di.aircraft_id = a.aircraft_id and di.booked_seats > 0)
    returning 1)
insert into merge_report select 8, 'aircraft retired', count(*) from del;

insert into merge_report
select 8, 'retired aircraft kept for existing bookings', count(*)
from public.aircraft a
where a.airline_uid in (select distinct airline_uid from stg_aircraft)
  and not exists (select 1 from stg_aircraft s where s.aircraft_id = a.aircraft_id);

-- ------------------------------------------------------------- codeshares
with ins as (
    insert into public.codeshares select * from stg_codeshares
    on conflict (codeshare_id) do nothing returning 1)
insert into merge_report select 9, 'codeshares added', count(*) from ins;

-- ------------------------------------------------------------------ stats
-- kxgroup_stats.json was not re-exported with the fleets, so FORZA's row
-- still says 275 aircraft against 381 in the data. Where the stats file
-- disagrees with what was actually loaded on aircraft or flights, the loaded
-- data wins, counted the same way the build report counts it. A carrier
-- whose stats agree -- Karination, Sonder -- keeps the game's own figures,
-- route definition included.
with live as (
    select a.uid,
           (select count(*) from public.aircraft x where x.airline_uid = a.uid) as num_aircraft,
           (select count(*) from public.flights  x where x.airline_uid = a.uid) as num_flights,
           (select count(distinct (x.origin_iata, x.destination_iata))
              from public.flights x where x.airline_uid = a.uid)               as num_routes
    from public.airlines a
    where a.is_group_member),
up as (
    update public.airline_stats s
       set num_aircraft = l.num_aircraft, num_flights = l.num_flights, num_routes = l.num_routes
      from live l
     where l.uid = s.airline_uid
       and (s.num_aircraft <> l.num_aircraft or s.num_flights <> l.num_flights)
    returning s.airline_uid)
insert into merge_report select 10, 'stale airline_stats rows corrected from the data', count(*) from up;

-- ----------------------------------------------------------------- report
select step, what, n from merge_report order by step, what;

select a.airline_code as carrier,
       (select count(*) from public.aircraft x where x.airline_uid = a.uid) as aircraft,
       (select count(*) from public.flights  x where x.airline_uid = a.uid) as flights,
       (select count(*) from public.v_bookable_departures d
         where d.airline_uid = a.uid and d.is_sellable) as sellable_departure_rows
from public.airlines a where a.is_group_member order by 1;

\if :dry
  \echo '*** DRY RUN: rolling back, nothing kept ***'
  rollback;
\else
  commit;
  -- The adjacency behind connection search is derived from the schedule.
  select public.kx_refresh_route_adjacency();
\endif
