-- =====================================================================
--  KarinationGroup reservations database -- data load
--
--  Loads database/csv/*.csv, produced by
--      python database/scripts/build_database.py
--
--  Run with psql from the project folder, so the relative paths resolve:
--      psql "$SUPABASE_DB_URL" -f database/sql/02_load_from_csv.sql
--
--  \copy runs client-side, so it needs no superuser and works against a
--  hosted Supabase instance. To load from the Supabase dashboard instead,
--  import the files through Table Editor -> Import data in exactly the
--  order below; the foreign keys depend on it.
--
--  Re-runnable: every table is truncated first.
-- =====================================================================

begin;

-- Deferred so flights.child_stopover_flight_id may point at a row that
-- appears later in the same file.
set constraints all deferred;

truncate table
    public.flight_fares,
    public.flight_assignment_days,
    public.flight_assignments,
    public.codeshares,
    public.flights,
    public.aircraft,
    public.airline_stats,
    public.airline_hubs,
    public.aircraft_models,
    public.cabin_classes,
    public.airlines,
    public.airports
restart identity cascade;

\copy public.airports              (iata_code, airport_name, city_name, country_code, timezone, latitude, longitude) from 'database/csv/airports.csv'              with (format csv, header true)
\copy public.airlines              from 'database/csv/airlines.csv'              with (format csv, header true)
\copy public.aircraft_models       from 'database/csv/aircraft_models.csv'       with (format csv, header true)
\copy public.cabin_classes         from 'database/csv/cabin_classes.csv'         with (format csv, header true)
\copy public.airline_hubs          from 'database/csv/airline_hubs.csv'          with (format csv, header true)
\copy public.airline_stats         from 'database/csv/airline_stats.csv'         with (format csv, header true)
\copy public.aircraft              from 'database/csv/aircraft.csv'              with (format csv, header true)
\copy public.flights               from 'database/csv/flights.csv'               with (format csv, header true)
\copy public.flight_assignments    from 'database/csv/flight_assignments.csv'    with (format csv, header true)
\copy public.flight_assignment_days from 'database/csv/flight_assignment_days.csv' with (format csv, header true)
\copy public.flight_fares          from 'database/csv/flight_fares.csv'          with (format csv, header true)
\copy public.codeshares            from 'database/csv/codeshares.csv'            with (format csv, header true)

commit;

-- Expected after a Karination-only load:
--   airports 481 | airlines 8 | aircraft_models 13 | cabin_classes 4
--   airline_hubs 19 | airline_stats 3 | aircraft 717 | flights 1302
--   flight_assignments 1395 | flight_assignment_days 8795
--   flight_fares 5580 | codeshares 63
select 'airports' as table_name, count(*) from public.airports
union all select 'airlines',               count(*) from public.airlines
union all select 'aircraft_models',        count(*) from public.aircraft_models
union all select 'cabin_classes',          count(*) from public.cabin_classes
union all select 'airline_hubs',           count(*) from public.airline_hubs
union all select 'airline_stats',          count(*) from public.airline_stats
union all select 'aircraft',               count(*) from public.aircraft
union all select 'flights',                count(*) from public.flights
union all select 'flight_assignments',     count(*) from public.flight_assignments
union all select 'flight_assignment_days', count(*) from public.flight_assignment_days
union all select 'flight_fares',           count(*) from public.flight_fares
union all select 'codeshares',             count(*) from public.codeshares
order by 1;
