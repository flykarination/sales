-- =====================================================================
-- 13. Connecting itineraries
--
-- Karination is a hub network: SGN, DAD and HAN each carry 190-233
-- routes, and almost every other airport in the table is a spoke hanging
-- off one of them. So the overwhelming majority of city pairs we could
-- sell have no direct service -- ADL to AKL, say -- but are perfectly
-- flyable with one stop.
--
-- The arithmetic is easier here than it looks. departure_time and
-- arrival_time are both airport-LOCAL wall clock (proved out in
-- 04_views.sql from the game's own stopover timings), so at the
-- connecting airport both the inbound arrival and the outbound
-- departure are already on the same clock. Ground time is a plain
-- subtraction; no timezone shift is involved. The only thing to carry
-- is the date, because a leg can land the day after it left.
--
-- Ground times run long here on purpose. The hub banks are timed for
-- Vietnam, so an Arlanda arrival at 16:20 meets the Sydney departure at
-- 06:30 the next morning -- fourteen hours. That is still a connection
-- under anyone's fare rules (the line is 24 hours), so it is sold, and
-- the interface says plainly that it is an overnight.
--
-- Efficiency: the naive form of this query is every first leg crossed
-- with every second leg, and for a hub origin that is enormous -- Sài
-- Gòn alone has 233 routes out of it.
--
-- The prune that actually works runs the other way round. Before the
-- timetable is touched at all, the connecting airports are settled from
-- the route graph: airports the origin reaches that ALSO have a direct
-- into the destination. Because only a handful of airports fly into any
-- given city, that second condition is savagely restrictive -- SGN to
-- BKK collapses from 233 candidates to two (Hà Nội and Đà Nẵng) -- and
-- both leg scans are then bounded by that tiny set.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Ground time we are willing to sell.
--
-- 60 minutes is the floor the airline already uses: every stopover
-- itinerary in the schedule connects in exactly 60, so anything we sell
-- below that would contradict our own operation.
-- ---------------------------------------------------------------------
create or replace function public.kx_min_connect_minutes()
returns integer language sql immutable parallel safe as $$
    select 60;
$$;

comment on function public.kx_min_connect_minutes() is
    'Shortest ground time saleable as a connection. Matches the 60 minutes '
    'every scheduled stopover in the network already turns in.';


-- ---------------------------------------------------------------------
-- search_connections
--
-- Returns TWO rows per itinerary -- leg 1 and leg 2 -- sharing an
-- option_rank, rather than one wide row with every column doubled. The
-- client groups on option_rank and gets segments in the same shape
-- search_flights() already hands it, so FlightRow and the booking draft
-- need no second row type.
-- ---------------------------------------------------------------------
create or replace function public.search_connections(
    p_origin        text,
    p_destination   text,
    p_travel_date   date,
    p_cabin         text    default 'ECONOMY',
    p_seats         integer default 1,
    p_min_connect   integer default null,   -- null => kx_min_connect_minutes()
    p_max_connect   integer default 1440,   -- 24h: the fare-rule line between
                                            -- a connection and a stopover
    p_limit         integer default 8       -- itineraries, not rows
)
returns table (
    option_rank      integer,
    via_iata         text,
    connect_minutes  integer,
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
params as (
    select upper(p_origin)                              as o,
           upper(p_destination)                         as d,
           upper(coalesce(p_cabin, 'ECONOMY'))          as cab,
           greatest(coalesce(p_seats, 1), 1)            as seats,
           coalesce(p_min_connect, public.kx_min_connect_minutes()) as min_c,
           greatest(coalesce(p_max_connect, 1440), 1)   as max_c,
           greatest(coalesce(p_limit, 8), 1)            as lim
),

-- Which airports could join these two cities at all. Route graph only,
-- no dates, no schedule: two indexed lookups against the materialised
-- adjacency. Everything below is bounded by this.
--
-- Capped, and capped by traffic. Between two hubs the raw candidate set
-- is enormous -- almost every airport in the network touches both Sài
-- Gòn and Hà Nội -- and connecting a passenger through some spoke that
-- happens to sit on both route lists is not a product anyone would sell.
-- Ordering by how many routes an airport carries keeps the genuine
-- connecting points and drops the noise, and it needs no hard-coded list
-- of hubs to maintain.
airport_degree as (
    select o as iata, count(*)::int as deg
    from public.mv_route_adjacency
    group by o
),
vias as (
    select r1.d as via
    from public.mv_route_adjacency r1
    join public.mv_route_adjacency r2 on r2.o = r1.d
    join airport_degree g on g.iata = r1.d
    cross join params p
    where r1.o = p.o
      and r2.d = p.d
      and r1.d not in (p.o, p.d)
      and r2.o <> p.o
    group by r1.d, g.deg
    order by g.deg desc
    limit 12
),

-- Everything leaving the origin on the travel date, for a via that works.
legs1 as (
    select b.*,
           p_travel_date                                  as dep_date,
           p_travel_date + b.arrival_days_after_departure  as arr_date
    from public.v_bookable_departures b, params p
    where b.origin_iata = p.o
      and b.destination_iata in (select via from vias)
      and b.cabin_code = p.cab
      and b.is_sellable
      and b.seats_per_departure >= p.seats
      and b.departure_day_of_week = (extract(isodow from p_travel_date)::int - 1)
),

-- Onward legs into the destination. The date is not known in advance --
-- a first leg can land the same day or the next -- so three candidate
-- departure dates are considered and the day-of-week test is applied
-- per date. The via restriction is what keeps this cheap.
legs2 as (
    select b.*,
           dd.d2                                   as dep_date,
           dd.d2 + b.arrival_days_after_departure  as arr_date
    from public.v_bookable_departures b
    cross join params p
    cross join lateral (
        values (p_travel_date), (p_travel_date + 1), (p_travel_date + 2)
    ) as dd(d2)
    where b.destination_iata = p.d
      and b.origin_iata <> p.o
      and b.cabin_code = p.cab
      and b.is_sellable
      and b.seats_per_departure >= p.seats
      and b.departure_day_of_week = (extract(isodow from dd.d2)::int - 1)
      and b.origin_iata in (select via from vias)
),

-- Pair them at the connecting airport. Both clocks are local to that
-- airport, so the gap is (date difference in minutes) + (clock difference).
paired as (
    select
        l1.destination_iata as via_iata,
        (   (l2.dep_date - l1.arr_date) * 1440
          + (extract(epoch from (l2.departure_time - l1.arrival_time)) / 60)
        )::int as connect_minutes,
        l1, l2
    from legs1 l1
    join legs2 l2 on l2.origin_iata = l1.destination_iata
),

viable as (
    select
        p2.via_iata,
        p2.connect_minutes,
        ((p2.l1).duration_minutes + p2.connect_minutes + (p2.l2).duration_minutes)::int
            as total_minutes,
        ((p2.l1).price_usd + (p2.l2).price_usd)::int as total_price_usd,
        p2.l1, p2.l2
    from paired p2, params p
    where p2.connect_minutes >= p.min_c
      and p2.connect_minutes <= p.max_c
),

-- One itinerary per (via, first flight): if the same first leg can meet
-- three onward departures, the shortest wait is the one worth showing.
best_per_pairing as (
    select v.*,
           row_number() over (
               partition by v.via_iata, ((v.l1).flight_id), ((v.l1).direction)
               order by v.total_minutes, v.total_price_usd
           ) as rn_pairing
    from viable v
),

-- Then no more than two options through any single hub, so a big hub
-- cannot crowd out a genuinely different routing.
spread as (
    select b.*,
           row_number() over (
               partition by b.via_iata
               order by b.total_minutes, b.total_price_usd
           ) as rn_via
    from best_per_pairing b
    where b.rn_pairing = 1
),

ranked as (
    select s.*,
           row_number() over (order by s.total_minutes, s.total_price_usd)::int as option_rank
    from spread s, params p
    where s.rn_via <= 2
    order by s.total_minutes, s.total_price_usd
    limit (select lim from params)
)

-- Flatten each itinerary back out into its two segments.
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
      (1, (r.l1).flight_id, (r.l1).aircraft_id, (r.l1).direction,
          (r.l1).airline_code, (r.l1).airline_name, (r.l1).flight_designator,
          (r.l1).origin_iata, (r.l1).destination_iata,
          (r.l1).dep_date, (r.l1).departure_time, (r.l1).arr_date, (r.l1).arrival_time,
          (r.l1).duration_minutes, (r.l1).cabin_code, (r.l1).price_usd,
          (r.l1).seats_per_departure, (r.l1).aircraft_model, (r.l1).registration,
          (r.l1).tz_resolved),
      (2, (r.l2).flight_id, (r.l2).aircraft_id, (r.l2).direction,
          (r.l2).airline_code, (r.l2).airline_name, (r.l2).flight_designator,
          (r.l2).origin_iata, (r.l2).destination_iata,
          (r.l2).dep_date, (r.l2).departure_time, (r.l2).arr_date, (r.l2).arrival_time,
          (r.l2).duration_minutes, (r.l2).cabin_code, (r.l2).price_usd,
          (r.l2).seats_per_departure, (r.l2).aircraft_model, (r.l2).registration,
          (r.l2).tz_resolved)
) as x(leg_index, flight_id, aircraft_id, direction, airline_code, airline_name,
       flight_designator, origin_iata, destination_iata, departure_date,
       departure_time, arrival_date, arrival_time, duration_minutes, cabin_code,
       price_usd, seats_per_departure, aircraft_model, registration, tz_resolved)
order by r.option_rank, x.leg_index;
$function$;

comment on function public.search_connections(text, text, date, text, integer, integer, integer, integer) is
    'One-stop itineraries between two airports with no direct service. '
    'Two rows per itinerary sharing option_rank, ordered by total elapsed '
    'time. Ground time is a local-clock subtraction at the connecting '
    'airport -- both legs quote that airport''s own wall clock.';

grant execute on function public.search_connections(text, text, date, text, integer, integer, integer, integer) to anon, authenticated;
grant execute on function public.kx_min_connect_minutes() to anon, authenticated;


-- ---------------------------------------------------------------------
-- kx_connecting_points
--
-- Which airports could ever join these two cities, ignoring dates. Cheap
-- enough to call while the traveller is still choosing, and it answers
-- "is this pair reachable at all" without touching the schedule.
-- ---------------------------------------------------------------------
create or replace function public.kx_connecting_points(
    p_origin text, p_destination text
)
returns table (via_iata text, city_name text, country_code text)
language sql stable parallel safe as $function$
    select a.iata_code, a.city_name, a.country_code
    from public.airports a
    where a.iata_code in (
        select r1.d
        from public.mv_route_adjacency r1
        join public.mv_route_adjacency r2 on r2.o = r1.d
        where r1.o = upper(p_origin)
          and r2.d = upper(p_destination)
          and r1.d <> upper(p_destination)
          and r2.o <> upper(p_origin)
    )
    order by a.iata_code;
$function$;

grant execute on function public.kx_connecting_points(text, text) to anon, authenticated;

commit;
