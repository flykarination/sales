-- =====================================================================
-- 24. Stop small cabins from jamming the demand simulation
--
-- simulate_bookings() takes the departures that were ticked longest ago,
-- works out how many seats each has earned since, and sells them. It only
-- re-stamped a departure that earned at least one whole seat:
--
--     ... and due.seats > 0
--
-- The reason was sound -- re-stamping a departure that earned 0.4 of a seat
-- throws that 0.4 away, and a small cabin re-stamped every visit would never
-- accumulate enough to sell anything. The effect was not. A 3-seat Business
-- cabin earns a seat roughly every 160 hours, so it sat at the head of the
-- queue for a week, re-selected on every tick without selling. By
-- September 2026, 1,897 of the 2,000 rows a tick could take were such cabins.
-- The job ran every fifteen minutes and succeeded every time, while most of
-- the inventory went unvisited for up to eighteen days -- and new
-- departures, Sonder's among them, were never reached at all.
--
-- The fix keeps the fractional seat without holding the queue: stochastic
-- rounding. A departure that has earned 2.3 seats sells 2, plus a third with
-- probability 0.3. Its expected sales are exactly what they were, and every
-- visited departure is re-stamped, so the queue always moves. A full pass
-- over the inventory now takes about a day, as the schedule intended.
-- =====================================================================

begin;

create or replace function public.simulate_bookings(p_max_rows integer default 2000)
returns table(rows_touched integer, seats_sold integer, revenue_usd numeric)
language plpgsql
as $function$
-- prefer column names over the OUT parameter names of the same spelling
#variable_conflict use_column
declare
    v_now timestamptz := now();
begin
    return query
    with picked as materialized (
        -- what each departure has earned since it was last visited, as a
        -- real number; MATERIALIZED so the noise is drawn once per row
        select
            di.flight_id, di.aircraft_id, di.direction, di.travel_date, di.cabin_code,
            di.capacity_seats - di.simulated_seats_sold - di.booked_seats as remaining,
            di.demand_rate_per_hour
              * extract(epoch from (v_now - di.last_simulated_at)) / 3600.0
              * public.kx_demand_curve((di.travel_date - current_date)::int)
              * (0.55 + random() * 0.9)                    -- a little noise per tick
              as earned
        from public.departure_inventory di
        where di.sold_out_at is null
          and di.travel_date >= current_date
          and di.capacity_seats > di.simulated_seats_sold + di.booked_seats
        order by di.last_simulated_at
        limit greatest(p_max_rows, 1)
    ),
    due as materialized (
        -- stochastic rounding: keep the fraction as a probability, not a debt
        select p.*,
               least(
                   (floor(p.earned)
                    + case when random() < p.earned - floor(p.earned) then 1 else 0 end)::int,
                   p.remaining) as seats
        from picked p
    ),
    bumped as (
        -- every visited departure is re-stamped, sold or not
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
      returning di.flight_id, di.direction, di.travel_date, di.cabin_code,
                due.seats as seats, di.price_usd
    ),
    logged as (
        -- only an actual sale is an event
        insert into public.demand_events (
            flight_id, direction, travel_date, cabin_code,
            origin_iata, destination_iata, seats_sold, revenue_usd)
        select b.flight_id, b.direction, b.travel_date, b.cabin_code,
               case when b.direction = 'OUTBOUND' then f.origin_iata else f.destination_iata end,
               case when b.direction = 'OUTBOUND' then f.destination_iata else f.origin_iata end,
               b.seats, b.seats * b.price_usd
        from bumped b
        join public.flights f on f.flight_id = b.flight_id
        where b.seats > 0
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
$function$;

comment on function public.simulate_bookings(integer) is
    'One demand tick. Visits the departures ticked longest ago, sells what each '
    'has earned since -- rounding stochastically, so fractional demand is kept as '
    'a probability rather than as a claim on the queue -- and re-stamps every '
    'departure it visits.';

commit;
