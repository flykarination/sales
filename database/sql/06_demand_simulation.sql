-- =====================================================================
--  KarinationGroup reservations database -- simulated demand
--
--  Makes the world look inhabited: every future departure fills up on its
--  own, at its own pace, and stops at the aircraft's seat count. Real
--  bookings made through the site sit on top of the simulated ones and
--  count against the same cap.
--
--  Three moving parts:
--    seed_departure_inventory()  creates a row per future departure
--    simulate_bookings()         advances every row by real elapsed time
--    v_management_dashboard      what you watch while it ticks
--
--  Runs after 04_views.sql.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Inventory: one row per departure x cabin
-- ---------------------------------------------------------------------

create table if not exists public.departure_inventory (
    flight_id            uuid     not null,
    aircraft_id          uuid     not null,
    direction            text     not null check (direction in ('OUTBOUND', 'INBOUND')),
    travel_date          date     not null,
    cabin_code           text     not null references public.cabin_classes (cabin_code),

    capacity_seats       integer  not null check (capacity_seats >= 0),
    simulated_seats_sold integer  not null default 0 check (simulated_seats_sold >= 0),
    booked_seats         integer  not null default 0 check (booked_seats >= 0),

    -- seats per hour this particular departure sells at a neutral moment;
    -- fixed per departure so the curve is stable between ticks
    demand_rate_per_hour numeric(10,4) not null default 0 check (demand_rate_per_hour >= 0),
    price_usd            integer  not null default 0,

    seeded_at            timestamptz not null default now(),
    last_simulated_at    timestamptz not null default now(),
    sold_out_at          timestamptz,

    primary key (flight_id, aircraft_id, direction, travel_date, cabin_code),
    constraint departure_inventory_not_oversold
        check (simulated_seats_sold + booked_seats <= capacity_seats),
    foreign key (flight_id, aircraft_id)
        references public.flight_assignments (flight_id, aircraft_id) on delete cascade
);

comment on table public.departure_inventory is
    'Live seat state per departure. simulated_seats_sold is scenery; booked_seats comes from real reservations. Both count against capacity_seats.';

create index if not exists departure_inventory_date_idx on public.departure_inventory (travel_date);
create index if not exists departure_inventory_open_idx
    on public.departure_inventory (travel_date, last_simulated_at)
    where sold_out_at is null;

-- The tick takes the least-recently-touched open departures. Without an index
-- in exactly that order Postgres sequentially scans the whole table and sorts
-- it on every run -- about 28 MB of buffer traffic per tick at 100k rows, which
-- is more than a free-tier instance should be asked to do on a schedule.
-- Ordered index + LIMIT means it walks only the rows it is about to update.
create index if not exists departure_inventory_tick_idx
    on public.departure_inventory (last_simulated_at)
    where sold_out_at is null;

-- A short feed of what just sold, for a live ticker on the management view.
create table if not exists public.demand_events (
    event_id    bigserial primary key,
    occurred_at timestamptz not null default now(),
    flight_id   uuid not null,
    direction   text not null,
    travel_date date not null,
    cabin_code  text not null,
    origin_iata text,
    destination_iata text,
    seats_sold  integer not null,
    revenue_usd numeric(12,2) not null default 0
);

create index if not exists demand_events_recent_idx on public.demand_events (occurred_at desc);

comment on table public.demand_events is
    'Append-only feed written by simulate_bookings(). Trim it with prune_demand_events().';

-- ---------------------------------------------------------------------
-- The shape of demand
-- ---------------------------------------------------------------------

-- Stable pseudo-random number in [0,1) for any key. Same key, same value,
-- so a departure keeps its personality across ticks and restarts.
create or replace function public.kx_hash01(p_key text)
returns numeric language sql immutable parallel safe as $$
    select ((hashtext(p_key)::bigint + 2147483648) % 100000)::numeric / 100000.0;
$$;

-- Seats per hour at a neutral moment. Slow departures take about four weeks
-- to fill, eager ones about four days.
create or replace function public.kx_demand_rate(
    p_key      text,
    p_capacity integer
) returns numeric language sql immutable parallel safe as $$
    select case
        when p_capacity <= 0 then 0
        else round(p_capacity::numeric / ((4 + 24 * public.kx_hash01(p_key)) * 24), 4)
    end;
$$;

-- Bookings accelerate as the date approaches, the way real ones do.
create or replace function public.kx_demand_curve(p_days_out integer)
returns numeric language sql immutable parallel safe as $$
    select case
        when p_days_out <  0 then 0      -- already departed
        when p_days_out <= 2 then 2.60
        when p_days_out <= 7 then 1.60
        when p_days_out <= 21 then 0.85
        else 0.40
    end;
$$;

-- ---------------------------------------------------------------------
-- Seeding
-- ---------------------------------------------------------------------

-- Creates inventory for every sellable departure in the next p_days days.
-- Safe to re-run: existing rows are left alone.
create or replace function public.seed_departure_inventory(
    p_days    integer default 14,
    p_from    date default current_date,
    p_airline uuid default null
) returns integer language plpgsql as $$
declare
    v_inserted integer;
begin
    insert into public.departure_inventory (
        flight_id, aircraft_id, direction, travel_date, cabin_code,
        capacity_seats, demand_rate_per_hour, price_usd, last_simulated_at
    )
    select
        d.flight_id,
        d.aircraft_id,
        d.direction,
        cal.day::date,
        d.cabin_code,
        d.seats_per_departure,
        public.kx_demand_rate(
            d.flight_id::text || d.direction || d.cabin_code || cal.day::text,
            d.seats_per_departure),
        d.price_usd,
        -- Backdate the clock so a departure arrives already part sold. Without
        -- this every seat count starts at zero and the first tick, seconds
        -- later, has no elapsed time to sell against -- the dashboard would sit
        -- at 0% for twenty minutes. The offset is hashed, so each departure
        -- opens at its own plausible load rather than all at the same one.
        now() - make_interval(mins => (2880 * public.kx_hash01(
            'seed' || d.flight_id::text || d.direction || d.cabin_code || cal.day::text))::int)
    from public.v_bookable_departures d
    join generate_series(p_from::timestamp, (p_from + (p_days - 1))::timestamp,
                         interval '1 day') as cal(day)
      on d.departure_day_of_week = (extract(isodow from cal.day)::int - 1)
    where d.is_sellable
      and (p_airline is null or d.airline_uid = p_airline)
    on conflict do nothing;

    get diagnostics v_inserted = row_count;
    return v_inserted;
end;
$$;

comment on function public.seed_departure_inventory(integer, date, uuid) is
    'Create inventory rows for the next N days of departures. Re-runnable; call it daily to roll the window forward.';

-- ---------------------------------------------------------------------
-- The tick
-- ---------------------------------------------------------------------

-- Advances every open departure by however long it has been since its last
-- tick. Seats accrue against ELAPSED WALL-CLOCK TIME, so cadence and pace are
-- independent: running this every 15 minutes fills the world at exactly the
-- same speed as running it every minute, for a fifteenth of the database load.
-- Rows are taken least-recently-touched first, so a batch smaller than the
-- table simply rotates through it and nothing is starved.
-- Returns the number of seats sold in this pass.
create or replace function public.simulate_bookings(
    p_max_rows integer default 2000
) returns table (rows_touched integer, seats_sold integer, revenue_usd numeric)
language plpgsql as $$
-- prefer column names over the OUT parameter names of the same spelling
#variable_conflict use_column
declare
    v_now timestamptz := now();
begin
    return query
    with due as (
        -- how many seats this departure earned since it was last ticked
        select
            di.flight_id, di.aircraft_id, di.direction, di.travel_date, di.cabin_code,
            least(
                floor(
                    di.demand_rate_per_hour
                    * extract(epoch from (v_now - di.last_simulated_at)) / 3600.0
                    * public.kx_demand_curve((di.travel_date - current_date)::int)
                    * (0.55 + random() * 0.9)          -- a little noise per tick
                )::int,
                di.capacity_seats - di.simulated_seats_sold - di.booked_seats
            ) as seats
        from public.departure_inventory di
        where di.sold_out_at is null
          and di.travel_date >= current_date
          and di.capacity_seats > di.simulated_seats_sold + di.booked_seats
        order by di.last_simulated_at
        limit greatest(p_max_rows, 1)
    ),
    bumped as (
        update public.departure_inventory di
           set simulated_seats_sold = di.simulated_seats_sold + due.seats,
               last_simulated_at    = v_now,
               sold_out_at = case
                   when di.simulated_seats_sold + due.seats + di.booked_seats
                        >= di.capacity_seats then v_now
                   else null
               end
          from due
         where di.flight_id   = due.flight_id
           and di.aircraft_id = due.aircraft_id
           and di.direction   = due.direction
           and di.travel_date = due.travel_date
           and di.cabin_code  = due.cabin_code
           and due.seats > 0
      returning di.flight_id, di.direction, di.travel_date, di.cabin_code,
                due.seats as seats, di.price_usd
    ),
    logged as (
        insert into public.demand_events (
            flight_id, direction, travel_date, cabin_code,
            origin_iata, destination_iata, seats_sold, revenue_usd)
        select b.flight_id, b.direction, b.travel_date, b.cabin_code,
               case when b.direction = 'OUTBOUND' then f.origin_iata else f.destination_iata end,
               case when b.direction = 'OUTBOUND' then f.destination_iata else f.origin_iata end,
               b.seats, b.seats * b.price_usd
        from bumped b
        join public.flights f on f.flight_id = b.flight_id
        returning demand_events.seats_sold, demand_events.revenue_usd
    )
    select coalesce(count(*), 0)::int,
           coalesce(sum(l.seats_sold), 0)::int,
           coalesce(sum(l.revenue_usd), 0)::numeric
    from logged l;

    -- rows that filled up while nobody was looking
    update public.departure_inventory
       set sold_out_at = v_now
     where sold_out_at is null
       and simulated_seats_sold + booked_seats >= capacity_seats;
end;
$$;

comment on function public.simulate_bookings(integer) is
    'One tick of simulated demand. Idempotent in pace: it sells against elapsed wall-clock time, so calling it more often does not sell faster.';

-- Housekeeping for the ticker feed and the past.
create or replace function public.prune_demand_events(p_keep_hours integer default 6)
returns integer language plpgsql as $$
declare v_deleted integer;
begin
    delete from public.demand_events
     where occurred_at < now() - make_interval(hours => p_keep_hours);
    get diagnostics v_deleted = row_count;
    return v_deleted;
end;
$$;

create or replace function public.prune_departed_inventory(p_keep_days integer default 3)
returns integer language plpgsql as $$
declare v_deleted integer;
begin
    delete from public.departure_inventory di
     where di.travel_date < current_date - p_keep_days
       and not exists (
           select 1 from public.booking_segments s
           where s.flight_id   = di.flight_id
             and s.aircraft_id = di.aircraft_id
             and s.direction   = di.direction
             and s.travel_date = di.travel_date
             and s.cabin_code  = di.cabin_code
       );
    get diagnostics v_deleted = row_count;
    return v_deleted;
end;
$$;

-- ---------------------------------------------------------------------
-- Real bookings push against the same cap
-- ---------------------------------------------------------------------

create or replace function public.kx_available_seats(
    p_flight_id   uuid,
    p_aircraft_id uuid,
    p_direction   text,
    p_date        date,
    p_cabin       text
) returns integer language sql stable as $$
    select coalesce(
        (select di.capacity_seats - di.simulated_seats_sold - di.booked_seats
           from public.departure_inventory di
          where di.flight_id = p_flight_id and di.aircraft_id = p_aircraft_id
            and di.direction = p_direction and di.travel_date = p_date
            and di.cabin_code = p_cabin),
        -- not seeded yet: fall back to the schedule's own allotment
        (select fr.seats_per_departure
           from public.flight_fares fr
          where fr.flight_id = p_flight_id and fr.aircraft_id = p_aircraft_id
            and fr.cabin_code = p_cabin),
        0);
$$;

comment on function public.kx_available_seats(uuid, uuid, text, date, text) is
    'Seats a customer can still buy on one departure, simulated demand included.';

-- When a real segment is sold, take the seats out of inventory. Simulated
-- seats give way first so a real customer is never blocked by scenery.
create or replace function public.kx_segment_take_inventory()
returns trigger language plpgsql as $$
declare
    v_seats integer;
    v_give_back integer;
begin
    -- one seat per passenger on the booking, at least one
    select greatest(count(*), 1) into v_seats
    from public.passengers p
    where p.booking_id = new.booking_id;

    insert into public.departure_inventory (
        flight_id, aircraft_id, direction, travel_date, cabin_code,
        capacity_seats, demand_rate_per_hour, price_usd, booked_seats)
    select new.flight_id, new.aircraft_id, new.direction, new.travel_date, new.cabin_code,
           fr.seats_per_departure,
           public.kx_demand_rate(new.flight_id::text || new.direction || new.cabin_code
                                 || new.travel_date::text, fr.seats_per_departure),
           fr.price_usd,
           0
      from public.flight_fares fr
     where fr.flight_id = new.flight_id
       and fr.aircraft_id = new.aircraft_id
       and fr.cabin_code = new.cabin_code
    on conflict do nothing;

    -- free up simulated seats if the departure is otherwise full
    select greatest(0, v_seats - (capacity_seats - simulated_seats_sold - booked_seats))
      into v_give_back
      from public.departure_inventory
     where flight_id = new.flight_id and aircraft_id = new.aircraft_id
       and direction = new.direction and travel_date = new.travel_date
       and cabin_code = new.cabin_code;

    update public.departure_inventory
       set simulated_seats_sold = greatest(0, simulated_seats_sold - coalesce(v_give_back, 0)),
           booked_seats = booked_seats + v_seats,
           sold_out_at = case
               when simulated_seats_sold - coalesce(v_give_back, 0) + booked_seats + v_seats
                    >= capacity_seats then now() else null end
     where flight_id = new.flight_id and aircraft_id = new.aircraft_id
       and direction = new.direction and travel_date = new.travel_date
       and cabin_code = new.cabin_code;

    return new;
end;
$$;

drop trigger if exists booking_segments_take_inventory on public.booking_segments;
create trigger booking_segments_take_inventory
    after insert on public.booking_segments
    for each row execute function public.kx_segment_take_inventory();

-- ---------------------------------------------------------------------
-- The management view
-- ---------------------------------------------------------------------

create or replace view public.v_departure_load
with (security_invoker = on) as
select
    di.flight_id,
    di.aircraft_id,
    di.direction,
    di.travel_date,
    di.cabin_code,
    al.airline_code,
    al.airline_name,
    coalesce(al.airline_code, '??') || ' ' ||
        case when di.direction = 'OUTBOUND'
             then f.outbound_flight_number else f.inbound_flight_number end as flight_designator,
    case when di.direction = 'OUTBOUND' then f.origin_iata else f.destination_iata end as origin_iata,
    case when di.direction = 'OUTBOUND' then f.destination_iata else f.origin_iata end as destination_iata,
    di.capacity_seats,
    di.simulated_seats_sold,
    di.booked_seats,
    di.simulated_seats_sold + di.booked_seats as seats_sold,
    di.capacity_seats - di.simulated_seats_sold - di.booked_seats as seats_available,
    case when di.capacity_seats = 0 then 0
         else round(100.0 * (di.simulated_seats_sold + di.booked_seats)
                    / di.capacity_seats, 1) end as load_factor_pct,
    (di.sold_out_at is not null) as is_sold_out,
    (di.travel_date - current_date) as days_until_departure,
    di.price_usd,
    (di.simulated_seats_sold + di.booked_seats) * di.price_usd as revenue_usd,
    di.last_simulated_at
from public.departure_inventory di
join public.flights f  on f.flight_id = di.flight_id
join public.airlines al on al.uid = f.airline_uid;

comment on view public.v_departure_load is
    'Per-departure load factor. The row a management screen refreshes.';

create or replace view public.v_management_dashboard
with (security_invoker = on) as
select
    l.airline_code,
    l.airline_name,
    l.travel_date,
    count(*)                              as departures,
    sum(l.capacity_seats)                 as seats_offered,
    sum(l.seats_sold)                     as seats_sold,
    sum(l.booked_seats)                   as seats_sold_to_real_customers,
    case when sum(l.capacity_seats) = 0 then 0
         else round(100.0 * sum(l.seats_sold) / sum(l.capacity_seats), 1) end as load_factor_pct,
    sum(l.revenue_usd)                    as revenue_usd,
    count(*) filter (where l.is_sold_out) as sold_out_departures
from public.v_departure_load l
group by l.airline_code, l.airline_name, l.travel_date
order by l.travel_date, l.airline_code;

comment on view public.v_management_dashboard is
    'Daily load and revenue per carrier. Poll it while simulate_bookings() runs.';

-- The live ticker: what sold in the last few minutes.
create or replace view public.v_recent_sales
with (security_invoker = on) as
select
    e.occurred_at,
    e.origin_iata,
    e.destination_iata,
    e.travel_date,
    e.cabin_code,
    e.seats_sold,
    e.revenue_usd
from public.demand_events e
order by e.occurred_at desc
limit 200;

-- ---------------------------------------------------------------------
-- Keeping an eye on the cost
-- ---------------------------------------------------------------------

create or replace function public.simulation_status()
returns table (
    metric text,
    value  text
) language sql stable as $$
    select 'database size', pg_size_pretty(pg_database_size(current_database()))
    union all
    select 'free tier budget', '500 MB'
    union all
    select 'departure_inventory', to_char(count(*), 'FM999,999,999') || ' rows, ' ||
           pg_size_pretty(pg_total_relation_size('public.departure_inventory'))
      from public.departure_inventory
    union all
    select 'demand_events', to_char(count(*), 'FM999,999,999') || ' rows, ' ||
           pg_size_pretty(pg_total_relation_size('public.demand_events'))
      from public.demand_events
    union all
    select 'open departures', to_char(count(*), 'FM999,999,999')
      from public.departure_inventory where sold_out_at is null
    union all
    select 'longest since a tick',
           coalesce(justify_interval(max(now() - last_simulated_at))::text, 'n/a')
      from public.departure_inventory where sold_out_at is null
    union all
    select 'oldest event kept',
           coalesce(justify_interval(max(now() - occurred_at))::text, 'none')
      from public.demand_events;
$$;

comment on function public.simulation_status() is
    'Size and freshness of the simulation, for checking it against the free tier budget.';

commit;

-- =====================================================================
--  Turning it on
--
--  1. Seed a window of departures (about 52k rows for 14 days of KX):
--         select public.seed_departure_inventory(14);
--
--  2. Tick it by hand to watch it move:
--         select * from public.simulate_bookings();
--         select * from public.v_management_dashboard;
--
--  3. Let it run on its own. In Supabase, enable pg_cron under
--     Database -> Extensions, then:
--
--       select cron.schedule('kx-demand', '*/15 * * * *',
--           $$select public.simulate_bookings(2000)$$);
--
--       select cron.schedule('kx-seed', '17 3 * * *',
--           $$select public.seed_departure_inventory(14)$$);
--
--       select cron.schedule('kx-prune', '42 * * * *',
--           $$select public.prune_demand_events(6), public.prune_departed_inventory(3)$$);
--
--     Stop it again with:  select cron.unschedule('kx-demand');
--
--  Why every 15 minutes and not every minute: seats accrue against elapsed
--  time, so the slower schedule fills the world at an identical pace while
--  doing a fifteenth of the writes. At 2000 rows a tick the whole inventory
--  rotates through in about half a day, and the free tier sees roughly
--  190k row updates and 30 MB of event rows per day -- comfortably inside
--  the 500 MB budget once prune_demand_events keeps only 6 hours.
--
--  Check the cost at any time with:  select * from public.simulation_status();
-- =====================================================================
