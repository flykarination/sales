-- =====================================================================
--  KarinationGroup reservations database -- derived layer
--
--  The tables in 01_schema.sql stay faithful to the export: a row in
--  public.flights is a *pair* of legs sharing one rotation. A booking
--  portal sells single directional legs on single dates, so everything
--  it needs to search is derived here.
--
--  Requires PostgreSQL 15+ for "security_invoker" (Supabase default).
--  On older servers drop the WITH (...) clause; the views then run with
--  the owner's rights and bypass RLS.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Time helpers
--
-- Every daily timestamp in this database is seconds after midnight on the
-- LOCAL clock of the departure airport. Values >= 86400 mean "the next
-- day" and appear on stopover second legs, whose clock is anchored to the
-- day the parent leg departed.
-- ---------------------------------------------------------------------

-- Whole days contained in a second offset (floor, so negatives work too).
create or replace function public.kx_day_offset(total_seconds numeric)
returns integer language sql immutable parallel safe as $$
    select floor(total_seconds / 86400.0)::integer;
$$;

-- Wall-clock time of a second offset, wrapped into 00:00:00 - 23:59:59.
create or replace function public.kx_time_of_day(total_seconds numeric)
returns time language sql immutable parallel safe as $$
    select (make_interval(secs => ((total_seconds::bigint % 86400) + 86400) % 86400))::time;
$$;

-- Ground time between an arrival and the return departure.
--
-- turnaround_offset_minutes is 0 on 96% of the export, which would have the
-- return leg depart the instant the inbound arrives. Every stopover in the
-- data connects in exactly 60 minutes (Algiers is the lone 90), so 60 is used
-- as the floor. Change the constant here and every timetable follows.
create or replace function public.kx_ground_minutes(turnaround_offset numeric)
returns numeric language sql immutable parallel safe as $$
    select greatest(coalesce(turnaround_offset, 0), 60::numeric);
$$;

comment on function public.kx_ground_minutes(numeric) is
    'Minimum ground time in minutes before the return leg departs. Floor of 60 is inferred from stopover connection times in the export.';

-- ---------------------------------------------------------------------
-- v_flight_legs -- one row per directional leg (two per flight pair)
-- ---------------------------------------------------------------------
create or replace view public.v_flight_legs
with (security_invoker = on) as
with legs as (
    -- outbound: departs the origin at exactly the exported time
    select
        f.flight_id,
        'OUTBOUND'::text            as direction,
        f.airline_uid,
        f.outbound_flight_number    as flight_number,
        f.origin_iata,
        f.destination_iata,
        f.outbound_duration_minutes as duration_minutes,
        f.departure_daily_seconds::numeric as departure_seconds,
        f.is_stopover,
        f.child_stopover_flight_id,
        f.turnaround_offset_minutes
    from public.flights f

    union all

    -- inbound: departs the far end once the outbound has landed and turned
    -- around. That sum lands on the OUTBOUND origin's clock, so it is shifted
    -- onto the far end's own clock here.
    select
        f.flight_id,
        'INBOUND'::text,
        f.airline_uid,
        f.inbound_flight_number,
        f.destination_iata,
        f.origin_iata,
        f.inbound_duration_minutes,
        f.departure_daily_seconds
          + f.outbound_duration_minutes * 60
          + public.kx_ground_minutes(f.turnaround_offset_minutes) * 60
          + coalesce(far.utc_offset_minutes - home.utc_offset_minutes, 0) * 60,
        f.is_stopover,
        f.child_stopover_flight_id,
        f.turnaround_offset_minutes
    from public.flights f
    join public.airports home on home.iata_code = f.origin_iata
    join public.airports far  on far.iata_code  = f.destination_iata
)
select
    l.flight_id,
    l.direction,
    l.airline_uid,
    al.airline_code,
    al.airline_name,
    l.flight_number,
    coalesce(al.airline_code, '??') || ' ' || l.flight_number as flight_designator,
    l.origin_iata,
    l.destination_iata,
    l.duration_minutes,

    -- departure, on the local clock at l.origin_iata
    public.kx_day_offset(l.departure_seconds)  as departure_day_offset,
    public.kx_time_of_day(l.departure_seconds) as departure_time,

    -- arrival = departure + block time, shifted onto the destination's clock.
    -- With either offset unknown the shift is 0 and the arrival stays on the
    -- origin's clock -- tz_resolved says which you are looking at.
    public.kx_day_offset(l.departure_seconds + l.duration_minutes * 60
        + coalesce(dst.utc_offset_minutes - org.utc_offset_minutes, 0) * 60)
                                               as arrival_day_offset,
    public.kx_time_of_day(l.departure_seconds + l.duration_minutes * 60
        + coalesce(dst.utc_offset_minutes - org.utc_offset_minutes, 0) * 60)
                                               as arrival_time,
    (org.utc_offset_minutes is not null
     and dst.utc_offset_minutes is not null)   as tz_resolved,

    l.is_stopover,
    l.child_stopover_flight_id,
    parent.flight_id                           as parent_stopover_flight_id,
    (l.child_stopover_flight_id is not null)   as has_onward_leg,
    (parent.flight_id is not null)             as is_second_leg,
    l.departure_seconds                        as departure_seconds_raw,
    l.turnaround_offset_minutes
from legs l
join public.airlines al  on al.uid = l.airline_uid
join public.airports org on org.iata_code = l.origin_iata
join public.airports dst on dst.iata_code = l.destination_iata
left join public.flights parent on parent.child_stopover_flight_id = l.flight_id;

comment on view public.v_flight_legs is
    'Directional legs. Two rows per flights row: OUTBOUND origin->destination and INBOUND back. Day offsets are relative to the day the rotation starts.';

-- ---------------------------------------------------------------------
-- v_bookable_departures -- the search surface
--
-- One row per leg x operating weekday x cabin. This is what a date/route
-- search hits: filter on origin, destination, departure_day_of_week and
-- cabin_code, then order by price.
-- ---------------------------------------------------------------------
create or replace view public.v_bookable_departures
with (security_invoker = on) as
select
    l.flight_id,
    fa.aircraft_id,
    l.direction,
    fr.cabin_code,

    l.airline_uid,
    l.airline_code,
    l.airline_name,
    l.flight_number,
    l.flight_designator,
    l.origin_iata,
    l.destination_iata,

    -- weekday the rotation starts on (the exported dowList value)
    fad.day_of_week as rotation_day_of_week,
    -- weekday this leg actually departs, once day rollover is applied
    ((fad.day_of_week + l.departure_day_offset) % 7 + 7) % 7 as departure_day_of_week,
    l.departure_time,
    l.arrival_time,
    (l.arrival_day_offset - l.departure_day_offset) as arrival_days_after_departure,
    l.duration_minutes,
    l.tz_resolved,

    fr.seats_per_departure,
    fr.price_usd,
    cc.cabin_name,
    cc.sort_order as cabin_sort_order,

    ac.registration,
    ac.aircraft_model,
    (fr.seats_per_departure > 0 and fr.price_usd > 0) as is_sellable,
    l.has_onward_leg,
    l.is_second_leg,
    l.child_stopover_flight_id
from public.v_flight_legs l
join public.flight_assignments   fa  on fa.flight_id = l.flight_id
join public.flight_assignment_days fad on fad.flight_id = fa.flight_id
                                      and fad.aircraft_id = fa.aircraft_id
join public.flight_fares         fr  on fr.flight_id = fa.flight_id
                                    and fr.aircraft_id = fa.aircraft_id
join public.cabin_classes        cc  on cc.cabin_code = fr.cabin_code
join public.aircraft             ac  on ac.aircraft_id = fa.aircraft_id;

comment on view public.v_bookable_departures is
    'Leg x weekday x cabin. departure_day_of_week is 0 = Monday. Filter on is_sellable to hide cabins the aircraft does not carry.';

-- ---------------------------------------------------------------------
-- v_stopover_itineraries -- through journeys A -> B -> C
--
-- Both legs keep the parent's flight number, so the portal should present
-- them as one flight with one stop.
-- ---------------------------------------------------------------------
create or replace view public.v_stopover_itineraries
with (security_invoker = on) as
select
    p.flight_id                as parent_flight_id,
    c.flight_id                as child_flight_id,
    p.airline_uid,
    al.airline_code,
    al.airline_name,
    p.outbound_flight_number   as flight_number,
    coalesce(al.airline_code, '??') || ' ' || p.outbound_flight_number as flight_designator,
    p.origin_iata              as origin_iata,
    p.destination_iata         as via_iata,
    c.destination_iata         as destination_iata,
    public.kx_time_of_day(p.departure_daily_seconds)          as departure_time,
    -- the second leg's clock is the stop's; shift it to the final destination
    public.kx_time_of_day(c.departure_daily_seconds
                          + c.outbound_duration_minutes * 60
                          + coalesce(vdst.utc_offset_minutes - vio.utc_offset_minutes, 0) * 60)
                                as arrival_time,
    public.kx_day_offset(c.departure_daily_seconds
                         + c.outbound_duration_minutes * 60
                         + coalesce(vdst.utc_offset_minutes - vio.utc_offset_minutes, 0) * 60)
                                as arrival_day_offset,
    p.outbound_duration_minutes as first_leg_minutes,
    c.outbound_duration_minutes as second_leg_minutes,
    -- Ground time at the stop. The first leg's arrival is on the origin's clock,
    -- so the origin-to-stop difference has to come OFF it to land on the stop's
    -- clock, where the second leg's departure is already expressed.
    (c.departure_daily_seconds
     - (p.departure_daily_seconds + p.outbound_duration_minutes * 60)
     - coalesce(vio.utc_offset_minutes - vor.utc_offset_minutes, 0) * 60) / 60
                                as connection_minutes
from public.flights p
join public.flights c    on c.flight_id = p.child_stopover_flight_id
join public.airlines al  on al.uid = p.airline_uid
join public.airports vor  on vor.iata_code  = p.origin_iata
join public.airports vio  on vio.iata_code  = p.destination_iata
join public.airports vdst on vdst.iata_code = c.destination_iata;

comment on view public.v_stopover_itineraries is
    'Through flights built from flights.child_stopover_flight_id. connection_minutes is only meaningful once both airports have utc_offset_minutes.';

-- ---------------------------------------------------------------------
-- v_routes -- distinct city pairs a carrier serves
-- ---------------------------------------------------------------------
create or replace view public.v_routes
with (security_invoker = on) as
select
    l.airline_uid,
    l.airline_code,
    l.airline_name,
    l.origin_iata,
    l.destination_iata,
    count(distinct l.flight_id)              as flight_pairs,
    min(l.duration_minutes)                  as fastest_minutes,
    max(l.duration_minutes)                  as slowest_minutes,
    min(d.price_usd) filter (where d.cabin_code = 'ECONOMY'  and d.is_sellable) as from_price_economy_usd,
    min(d.price_usd) filter (where d.cabin_code = 'BUSINESS' and d.is_sellable) as from_price_business_usd,
    count(distinct d.departure_day_of_week)  as days_served_per_week,
    bool_or(l.has_onward_leg)                as has_stopover_service
from public.v_flight_legs l
left join public.v_bookable_departures d
       on d.flight_id = l.flight_id and d.direction = l.direction
group by l.airline_uid, l.airline_code, l.airline_name, l.origin_iata, l.destination_iata;

comment on view public.v_routes is
    'One row per carrier + directional city pair, with lead-in fares. Several flight pairs may serve the same route.';

-- ---------------------------------------------------------------------
-- v_codeshares -- partner marketing, ready to display
-- ---------------------------------------------------------------------
create or replace view public.v_codeshares
with (security_invoker = on) as
select
    cs.codeshare_id,
    cs.operating_flight_id,
    cs.origin_iata,
    cs.destination_iata,
    op.uid                as operating_airline_uid,
    op.airline_code       as operating_airline_code,
    op.airline_name       as operating_airline_name,
    coalesce(op.airline_code, '??') || ' ' || f.outbound_flight_number as operating_designator,
    mk.uid                as marketing_airline_uid,
    mk.airline_code       as marketing_airline_code,
    mk.airline_name       as marketing_airline_name,
    cs.marketing_outbound_flight_number,
    cs.marketing_inbound_flight_number,
    -- what a booking page prints under the partner's own flight number
    'Operated by ' || coalesce(op.airline_name, 'partner carrier') as operated_by_label,
    cs.operating_carrier_profit,
    cs.marketing_carrier_profit
from public.codeshares cs
join public.flights  f  on f.flight_id = cs.operating_flight_id
join public.airlines op on op.uid = cs.operating_airline_uid
join public.airlines mk on mk.uid = cs.marketing_airline_uid;

comment on view public.v_codeshares is
    'Codeshares with both carriers resolved. Marketing partners sit outside KarinationGroup, so their name and code are NULL until supplied.';

-- ---------------------------------------------------------------------
-- v_fleet -- fleet list with cabin layout per airframe
-- ---------------------------------------------------------------------
create or replace view public.v_fleet
with (security_invoker = on) as
select
    ac.aircraft_id,
    ac.registration,
    ac.aircraft_model,
    am.manufacturer,
    ac.airline_uid,
    al.airline_code,
    al.airline_name,
    ac.hub_airport_iata,
    ac.delivery_date,
    ac.first_product, ac.biz_product, ac.prem_eco_product, ac.eco_product,
    ac.first_pitch,   ac.biz_pitch,   ac.prem_eco_pitch,   ac.eco_pitch,
    ac.eco_config_type,
    count(distinct fa.flight_id)                      as flight_pairs_worked,
    (count(fa.flight_id) = 0)                         as is_unassigned
from public.aircraft ac
join public.aircraft_models am on am.aircraft_model = ac.aircraft_model
join public.airlines al        on al.uid = ac.airline_uid
left join public.flight_assignments fa on fa.aircraft_id = ac.aircraft_id
group by ac.aircraft_id, am.manufacturer, al.airline_code, al.airline_name;

comment on view public.v_fleet is
    'Fleet with its cabin products and how much of the schedule each airframe works.';

-- ---------------------------------------------------------------------
-- search_flights() -- the portal's main query
--
--   select * from public.search_flights('SGN', 'KGD', date '2026-09-03',
--                                       'ECONOMY', 2);
--
-- Returns direct legs only. Through journeys with one stop are in
-- v_stopover_itineraries.
-- ---------------------------------------------------------------------
create or replace function public.search_flights(
    p_origin      text,
    p_destination text,
    p_travel_date date,
    p_cabin       text default 'ECONOMY',
    p_seats       integer default 1
)
returns table (
    flight_id          uuid,
    aircraft_id        uuid,
    direction          text,
    airline_code       text,
    airline_name       text,
    flight_designator  text,
    origin_iata        text,
    destination_iata   text,
    departure_date     date,
    departure_time     time,
    arrival_date       date,
    arrival_time       time,
    duration_minutes   integer,
    cabin_code         text,
    price_usd          integer,
    seats_per_departure integer,
    aircraft_model     text,
    registration       text,
    tz_resolved        boolean
)
language sql stable parallel safe as $$
    select
        d.flight_id,
        d.aircraft_id,
        d.direction,
        d.airline_code,
        d.airline_name,
        d.flight_designator,
        d.origin_iata,
        d.destination_iata,
        p_travel_date as departure_date,
        d.departure_time,
        p_travel_date + d.arrival_days_after_departure as arrival_date,
        d.arrival_time,
        d.duration_minutes,
        d.cabin_code,
        d.price_usd,
        d.seats_per_departure,
        d.aircraft_model,
        d.registration,
        d.tz_resolved
    from public.v_bookable_departures d
    where d.origin_iata      = upper(p_origin)
      and d.destination_iata = upper(p_destination)
      and d.cabin_code       = upper(p_cabin)
      and d.is_sellable
      and d.seats_per_departure >= greatest(p_seats, 1)
      -- Postgres isodow is 1 = Monday; the game's dowList is 0 = Monday
      and d.departure_day_of_week = (extract(isodow from p_travel_date)::int - 1)
    order by d.price_usd, d.departure_time;
$$;

comment on function public.search_flights(text, text, date, text, integer) is
    'Direct legs on a date for a cabin, cheapest first. Seat counts are the exported allotment, not live availability.';

commit;
