-- =====================================================================
-- 25. Two-stop search, fast enough for the network it now searches
--
-- search_double_connections() took 5.1 seconds for Hai Phong to Miami once
-- FORZA's September growth took v_bookable_departures to ~105,000 rows.
-- Anonymous requests are cut off at 3 seconds, so the site got an HTTP 500
-- instead of an answer.
--
-- Timed separately, the parts cost well under a second: the routing shape
-- 160 ms, and each leg's scan 55-200 ms. The time was the planner folding
-- all three legs and their date fan-outs into one nested plan. Each leg is
-- now a single MATERIALIZED scan over every weekday its candidate dates fall
-- on, with the dates attached afterwards.
--
-- Checked against 14 on six city pairs: the same itineraries, except where
-- two options tied exactly on time and price. 14 broke those ties by
-- accident of the query plan; this version breaks them on purpose (see
-- `ranked`), so a search returns the same answer every time it is asked.
-- =====================================================================

begin;

create or replace function public.search_double_connections(
    p_origin        text,
    p_destination   text,
    p_travel_date   date,
    p_cabin         text    default 'ECONOMY',
    p_seats         integer default 1,
    p_min_connect   integer default null,
    p_max_connect   integer default 1440,
    p_limit         integer default 4
)
returns table (
    option_rank      integer,
    via_iata         text,          -- both stops, e.g. 'HAN,SGN'
    connect_minutes  integer,       -- total time on the ground
    total_minutes    integer,
    total_price_usd  integer,
    leg_index        integer,
    flight_id        uuid,
    aircraft_id      uuid,
    direction        text,
    airline_code     text,
    airline_name     text,
    flight_designator text,
    origin_iata      text,
    destination_iata text,
    departure_date   date,
    departure_time   time,
    arrival_date     date,
    arrival_time     time,
    duration_minutes integer,
    cabin_code       text,
    price_usd        integer,
    seats_per_departure integer,
    aircraft_model   text,
    registration     text,
    tz_resolved      boolean
)
language sql
stable
parallel safe
as $function$
with
params as materialized (
    select upper(p_origin)                     as o,
           upper(p_destination)                as d,
           upper(coalesce(p_cabin,'ECONOMY'))  as cab,
           greatest(coalesce(p_seats,1),1)     as seats,
           coalesce(p_min_connect, public.kx_min_connect_minutes()) as min_c,
           greatest(coalesce(p_max_connect,1440),1) as max_c,
           greatest(coalesce(p_limit,4),1)     as lim
),

-- Step 1: settle the shape of the routing from the route graph only.
airport_degree as materialized (
    select o as iata, count(*)::int as deg
    from public.mv_route_adjacency
    group by o
),
shape as materialized (
    select r1.d as m1, r2.o as m2
    from public.mv_route_adjacency r1
    join public.mv_route_adjacency rm on rm.o = r1.d
    join public.mv_route_adjacency r2 on r2.o = rm.d
    join airport_degree g1 on g1.iata = r1.d
    join airport_degree g2 on g2.iata = rm.d
    cross join params p
    where r1.o = p.o
      and r2.d = p.d
      and r1.d not in (p.o, p.d)
      and rm.d not in (p.o, p.d)
      and r1.d <> rm.d
    group by r1.d, r2.o, g1.deg, g2.deg
    -- keep the routings that go through airports the airline actually banks at
    order by (g1.deg + g2.deg) desc
    limit 24
),

-- Step 2: consult the timetable, already knowing which airports matter.
--
-- Each leg is ONE scan of v_bookable_departures, asking for every weekday
-- its candidate dates fall on at once, and is MATERIALIZED so the planner
-- cannot fold the three legs and their date fan-outs into one nested plan.
-- It did exactly that before, and with a view of ~105,000 rows the combined
-- plan took five seconds for work that costs under one when each leg is
-- planned on its own. Dates are then attached to the small result.
legs1 as materialized (
    select b.*, p_travel_date as dep_date,
           p_travel_date + b.arrival_days_after_departure as arr_date
    from public.v_bookable_departures b, params p
    where b.origin_iata = p.o
      and b.destination_iata in (select m1 from shape)
      and b.cabin_code = p.cab and b.is_sellable
      and b.seats_per_departure >= p.seats
      and b.departure_day_of_week = (extract(isodow from p_travel_date)::int - 1)
),
legs2_any_day as materialized (
    select b.*
    from public.v_bookable_departures b, params p
    where (b.origin_iata, b.destination_iata) in (select m1, m2 from shape)
      and b.cabin_code = p.cab and b.is_sellable
      and b.seats_per_departure >= p.seats
      and b.departure_day_of_week in (
            extract(isodow from p_travel_date)::int - 1,
            extract(isodow from p_travel_date + 1)::int - 1,
            extract(isodow from p_travel_date + 2)::int - 1)
),
legs2 as materialized (
    select r.*, dd.d2 as dep_date, dd.d2 + r.arrival_days_after_departure as arr_date
    from legs2_any_day r
    join (values (p_travel_date),(p_travel_date+1),(p_travel_date+2)) dd(d2)
      on r.departure_day_of_week = extract(isodow from dd.d2)::int - 1
),
legs3_any_day as materialized (
    select b.*
    from public.v_bookable_departures b, params p
    where b.destination_iata = p.d
      and b.origin_iata in (select m2 from shape)
      and b.cabin_code = p.cab and b.is_sellable
      and b.seats_per_departure >= p.seats
      and b.departure_day_of_week in (
            extract(isodow from p_travel_date)::int - 1,
            extract(isodow from p_travel_date + 1)::int - 1,
            extract(isodow from p_travel_date + 2)::int - 1,
            extract(isodow from p_travel_date + 3)::int - 1,
            extract(isodow from p_travel_date + 4)::int - 1)
),
legs3 as materialized (
    select r.*, dd.d3 as dep_date, dd.d3 + r.arrival_days_after_departure as arr_date
    from legs3_any_day r
    join (values (p_travel_date),(p_travel_date+1),(p_travel_date+2),
                 (p_travel_date+3),(p_travel_date+4)) dd(d3)
      on r.departure_day_of_week = extract(isodow from dd.d3)::int - 1
),

-- Both clocks at each stop belong to that stop, so each wait is a plain
-- subtraction, same as the single-connection case.
chained as (
    select
        l1.destination_iata || ',' || l2.destination_iata as via_iata,
        ((l2.dep_date - l1.arr_date) * 1440
          + extract(epoch from (l2.departure_time - l1.arrival_time))/60)::int as c1,
        ((l3.dep_date - l2.arr_date) * 1440
          + extract(epoch from (l3.departure_time - l2.arrival_time))/60)::int as c2,
        l1, l2, l3
    from legs1 l1
    join legs2 l2 on l2.origin_iata = l1.destination_iata
    join legs3 l3 on l3.origin_iata = l2.destination_iata
),

viable as (
    select c.via_iata, (c.c1 + c.c2) as connect_minutes,
           ((c.l1).duration_minutes + c.c1 + (c.l2).duration_minutes
             + c.c2 + (c.l3).duration_minutes)::int as total_minutes,
           ((c.l1).price_usd + (c.l2).price_usd + (c.l3).price_usd)::int as total_price_usd,
           greatest(c.c1, c.c2) as longest_wait,
           -- flight identity, as the last word, so equal options always
           -- come back in the same order
           (c.l1).flight_id::text || (c.l2).flight_id::text || (c.l3).flight_id::text as identity,
           c.l1, c.l2, c.l3
    from chained c, params p
    where c.c1 between p.min_c and p.max_c
      and c.c2 between p.min_c and p.max_c
),

-- One per routing shape, so the list shows different ways of getting
-- there rather than five departure times down the same corridor.
--
-- Ties are broken deliberately. Two itineraries can match on total time and
-- price and differ only in which middle flight they take -- the waits shift
-- to compensate -- and without a tiebreaker the choice between them fell to
-- the query plan, so the same search could return a different flight on a
-- reload. Among equals the one with the shorter longest wait wins: less time
-- stranded in any single airport. Flight identity settles the rest.
ranked as (
    select v.*, row_number() over (
               order by v.total_minutes, v.total_price_usd, v.longest_wait, v.identity)::int as option_rank
    from (
        select v.*, row_number() over (
                 partition by v.via_iata
                 order by v.total_minutes, v.total_price_usd, v.longest_wait, v.identity) as rn
        from viable v
    ) v
    where v.rn = 1
    order by v.total_minutes, v.total_price_usd, v.longest_wait, v.identity
    limit (select lim from params)
)

select r.option_rank, r.via_iata, r.connect_minutes, r.total_minutes,
       r.total_price_usd, x.leg_index,
       x.flight_id, x.aircraft_id, x.direction, x.airline_code, x.airline_name,
       x.flight_designator, x.origin_iata, x.destination_iata,
       x.departure_date, x.departure_time, x.arrival_date, x.arrival_time,
       x.duration_minutes, x.cabin_code, x.price_usd, x.seats_per_departure,
       x.aircraft_model, x.registration, x.tz_resolved
from ranked r
cross join lateral (
    values
      (1,(r.l1).flight_id,(r.l1).aircraft_id,(r.l1).direction,(r.l1).airline_code,
         (r.l1).airline_name,(r.l1).flight_designator,(r.l1).origin_iata,
         (r.l1).destination_iata,(r.l1).dep_date,(r.l1).departure_time,
         (r.l1).arr_date,(r.l1).arrival_time,(r.l1).duration_minutes,
         (r.l1).cabin_code,(r.l1).price_usd,(r.l1).seats_per_departure,
         (r.l1).aircraft_model,(r.l1).registration,(r.l1).tz_resolved),
      (2,(r.l2).flight_id,(r.l2).aircraft_id,(r.l2).direction,(r.l2).airline_code,
         (r.l2).airline_name,(r.l2).flight_designator,(r.l2).origin_iata,
         (r.l2).destination_iata,(r.l2).dep_date,(r.l2).departure_time,
         (r.l2).arr_date,(r.l2).arrival_time,(r.l2).duration_minutes,
         (r.l2).cabin_code,(r.l2).price_usd,(r.l2).seats_per_departure,
         (r.l2).aircraft_model,(r.l2).registration,(r.l2).tz_resolved),
      (3,(r.l3).flight_id,(r.l3).aircraft_id,(r.l3).direction,(r.l3).airline_code,
         (r.l3).airline_name,(r.l3).flight_designator,(r.l3).origin_iata,
         (r.l3).destination_iata,(r.l3).dep_date,(r.l3).departure_time,
         (r.l3).arr_date,(r.l3).arrival_time,(r.l3).duration_minutes,
         (r.l3).cabin_code,(r.l3).price_usd,(r.l3).seats_per_departure,
         (r.l3).aircraft_model,(r.l3).registration,(r.l3).tz_resolved)
) as x(leg_index, flight_id, aircraft_id, direction, airline_code, airline_name,
       flight_designator, origin_iata, destination_iata, departure_date,
       departure_time, arrival_date, arrival_time, duration_minutes, cabin_code,
       price_usd, seats_per_departure, aircraft_model, registration, tz_resolved)
order by r.option_rank, x.leg_index;
$function$;

grant execute on function public.search_double_connections(text, text, date, text, integer, integer, integer, integer) to anon, authenticated;

commit;
