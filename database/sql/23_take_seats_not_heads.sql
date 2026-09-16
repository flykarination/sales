-- =====================================================================
-- 23. Take seats, not heads
--
-- The third and last place the head-count mistake lived.
--
--   16_passenger_types.sql  create_booking     checks seats, not heads
--   17_release_seats...sql  kx_release_segment gives back seats, not heads
--   this file               kx_segment_take_inventory
--
-- The trigger that removes seats from inventory when a segment is sold still
-- counted every passenger on the booking, infants included. An infant
-- travels on a lap and takes no seat, so every booking with an infant took
-- one seat too many per segment -- and since 17 releases only the seats that
-- were really taken, cancelling it never gave that seat back. The loss was
-- permanent, one seat per infant per segment, on every such departure.
--
-- After redefining the trigger, booked_seats is recomputed for every
-- departure from the bookings themselves, so any seat already lost this way
-- is returned. Simulated demand is left exactly as it is.
-- =====================================================================

begin;

create or replace function public.kx_segment_take_inventory()
returns trigger language plpgsql as $$
declare
    v_seats integer;
    v_give_back integer;
begin
    -- seats, not heads: an infant travels on a lap and takes none
    select greatest(count(*), 1) into v_seats
    from public.passengers p
    where p.booking_id = new.booking_id
      and upper(coalesce(p.passenger_type, 'ADULT')) <> 'INFANT';

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

-- ---------------------------------------------------------------------
-- Give back anything already lost. booked_seats should equal the seats
-- held by confirmed bookings on that departure; recount it from them.
-- ---------------------------------------------------------------------
with truth as (
    select bs.flight_id, bs.aircraft_id, bs.direction, bs.travel_date, bs.cabin_code,
           count(*) as seats
    from public.booking_segments bs
    join public.bookings b   on b.booking_id = bs.booking_id and b.status = 'CONFIRMED'
    join public.passengers p on p.booking_id = b.booking_id
                            and upper(coalesce(p.passenger_type, 'ADULT')) <> 'INFANT'
    group by 1, 2, 3, 4, 5
),
fixed as (
    update public.departure_inventory di
       set booked_seats = coalesce(t.seats, 0),
           sold_out_at = case
               when di.simulated_seats_sold + coalesce(t.seats, 0) >= di.capacity_seats
               then coalesce(di.sold_out_at, now()) else null end
      from public.departure_inventory d2
      left join truth t
             on t.flight_id = d2.flight_id and t.aircraft_id = d2.aircraft_id
            and t.direction = d2.direction and t.travel_date = d2.travel_date
            and t.cabin_code = d2.cabin_code
     where di.flight_id = d2.flight_id and di.aircraft_id = d2.aircraft_id
       and di.direction = d2.direction and di.travel_date = d2.travel_date
       and di.cabin_code = d2.cabin_code
       and di.booked_seats <> coalesce(t.seats, 0)
    returning di.booked_seats
)
select count(*) as departures_corrected from fixed;

commit;
