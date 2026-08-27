-- =====================================================================
-- 19. Load FORZA (Z4) alongside Karination
--
-- NOT 02_load_from_csv.sql. That one truncates every catalog table
-- before copying, which was right when the database was being built from
-- nothing and is wrong now: flights, aircraft and airports are all
-- referenced by live booking_segments and departure_inventory rows, so a
-- truncate would either be refused or take every reservation with it.
--
-- This stages each CSV into a temp table and inserts only what is
-- missing, keyed on the primary key. Karination's rows are matched and
-- skipped, FORZA's are added. Re-runnable: running it twice inserts
-- nothing the second time.
--
-- Run from the project root, because \copy resolves paths client-side:
--     psql "$KX_DB_URL" -f database/sql/19_load_forza.sql
-- =====================================================================

\set ON_ERROR_STOP on

begin;

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

-- ------------------------------------------------------------- reference
-- Airports arrive bare -- code only. 20_airports_forza.sql fills in the
-- real-world detail for the ones this adds.
insert into public.airports (iata_code, airport_name, city_name, country_code,
                             timezone, latitude, longitude)
select s.iata_code, nullif(s.airport_name,''), nullif(s.city_name,''),
       nullif(s.country_code,''), nullif(s.timezone,''), s.latitude, s.longitude
from stg_airports s
on conflict (iata_code) do nothing;

insert into public.airlines select * from stg_airlines
on conflict (uid) do nothing;

insert into public.aircraft_models select * from stg_models
on conflict (aircraft_model) do nothing;

insert into public.airline_hubs select * from stg_hubs
on conflict do nothing;

insert into public.airline_stats select * from stg_stats
on conflict (airline_uid) do nothing;

-- -------------------------------------------------------------- operation
insert into public.aircraft select * from stg_aircraft
on conflict (aircraft_id) do nothing;

insert into public.flights select * from stg_flights
on conflict (flight_id) do nothing;

insert into public.flight_assignments select * from stg_assignments
on conflict (flight_id, aircraft_id) do nothing;

insert into public.flight_assignment_days select * from stg_assignment_days
on conflict do nothing;

insert into public.flight_fares select * from stg_fares
on conflict (flight_id, aircraft_id, cabin_code) do nothing;

-- The four FORZA codeshares are marketed on an outside carrier's Incheon
-- departures, so their operating_flight_id is empty. 18_multi_carrier.sql
-- made that column nullable for exactly this.
insert into public.codeshares select * from stg_codeshares
on conflict (codeshare_id) do nothing;

commit;

-- The map's adjacency is derived from the schedule, so it has to be rebuilt
-- now that a second carrier's routes exist.
select public.kx_refresh_route_adjacency();
