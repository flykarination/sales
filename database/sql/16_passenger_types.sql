-- =====================================================================
-- 16. Passenger types: seats and fares
--
-- The booking form now asks for adults, children and infants separately,
-- so create_booking has to stop treating all three the same. It did two
-- things wrong the moment infants existed:
--
--   1. It checked availability against the total head count. An infant
--      travels on an adult's lap and occupies no seat, so a family of two
--      adults and an infant was being refused a departure with two seats
--      left.
--   2. It issued every ticket at the full fare, so a lap infant was
--      charged like an adult.
--
-- The numbers below follow what the site already tells passengers on the
-- Children and infants page: under 2 is an infant on a lap, 2 to 11 is a
-- child with a seat of its own, and 12 and over pays "adult fare" --
-- which only means anything if the younger fares are lower.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- What a passenger of each type pays, as a fraction of the adult fare.
-- ---------------------------------------------------------------------
create or replace function public.kx_pax_fare_factor(p_type text)
returns numeric language sql immutable parallel safe as $$
    select case upper(coalesce(p_type, 'ADULT'))
        when 'INFANT' then 0.10   -- on a lap, no seat of their own
        when 'CHILD'  then 0.75   -- own seat, reduced fare
        else 1.00                 -- ADULT, and anything unrecognised
    end;
$$;

comment on function public.kx_pax_fare_factor(text) is
    'Fare as a fraction of the adult fare, by passenger type. Unknown types '
    'pay the adult fare, so a booking can never be cheaper by mislabelling.';


-- ---------------------------------------------------------------------
-- How many SEATS a passenger list needs. Infants do not take one.
-- ---------------------------------------------------------------------
create or replace function public.kx_seat_count(p_passengers jsonb)
returns integer language sql immutable parallel safe as $$
    select count(*)::int
    from jsonb_array_elements(p_passengers) as pax
    where upper(coalesce(pax ->> 'passenger_type', 'ADULT')) <> 'INFANT';
$$;

comment on function public.kx_seat_count(jsonb) is
    'Seats a passenger list occupies. Infants travel on a lap and are not '
    'counted; everyone else is.';


-- ---------------------------------------------------------------------
-- create_booking, with those two corrections.
--
-- Everything else is unchanged from 07_rls_policies.sql. A booking that
-- sends no passenger_type still behaves exactly as before: the type
-- defaults to ADULT, which takes a seat and pays the full fare.
-- ---------------------------------------------------------------------
create or replace function public.create_booking(
    p_contact_email text,
    p_contact_name  text,
    p_passengers    jsonb,
    p_segments      jsonb
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
    v_booking_id uuid;
    v_pnr        text;
    v_pax        jsonb;
    v_seg        jsonb;
    v_dep        record;
    v_segment_id uuid;
    v_order      int := 0;
    v_pax_count  int;
    v_seats      int;
    v_seq        int := 0;
begin
    if p_contact_email is null or position('@' in p_contact_email) = 0 then
        raise exception 'a contact email is required';
    end if;

    if jsonb_typeof(p_passengers) <> 'array' or jsonb_array_length(p_passengers) = 0 then
        raise exception 'at least one passenger is required';
    end if;

    v_pax_count := jsonb_array_length(p_passengers);
    if v_pax_count > 9 then
        raise exception 'a single booking may carry at most 9 passengers';
    end if;

    -- Seats, not heads: an infant on a lap needs none.
    v_seats := public.kx_seat_count(p_passengers);
    if v_seats = 0 then
        raise exception 'a booking needs at least one passenger with a seat';
    end if;

    insert into public.bookings (contact_email, contact_name, status)
    values (lower(trim(p_contact_email)), p_contact_name, 'CONFIRMED')
    returning booking_id, pnr into v_booking_id, v_pnr;

    for v_pax in select * from jsonb_array_elements(p_passengers) loop
        v_seq := v_seq + 1;
        insert into public.passengers (
            booking_id, passenger_seq, given_name, family_name,
            passenger_type, date_of_birth)
        values (
            v_booking_id, v_seq,
            v_pax ->> 'given_name',
            v_pax ->> 'family_name',
            upper(coalesce(v_pax ->> 'passenger_type', 'ADULT')),
            nullif(v_pax ->> 'date_of_birth', '')::date);
    end loop;

    for v_seg in select * from jsonb_array_elements(p_segments) loop
        v_order := v_order + 1;

        -- the schedule is the authority on everything except the choice itself
        select d.* into v_dep
        from public.v_bookable_departures d
        where d.flight_id   = (v_seg ->> 'flight_id')::uuid
          and d.aircraft_id = (v_seg ->> 'aircraft_id')::uuid
          and d.direction   = upper(v_seg ->> 'direction')
          and d.cabin_code  = upper(v_seg ->> 'cabin_code')
          and d.departure_day_of_week =
              (extract(isodow from (v_seg ->> 'travel_date')::date)::int - 1)
        limit 1;

        if not found then
            raise exception 'no such departure: flight % % in % on %',
                v_seg ->> 'flight_id', v_seg ->> 'direction',
                v_seg ->> 'cabin_code', v_seg ->> 'travel_date';
        end if;

        if public.kx_available_seats(
               v_dep.flight_id, v_dep.aircraft_id, v_dep.direction,
               (v_seg ->> 'travel_date')::date, v_dep.cabin_code) < v_seats then
            raise exception 'only % seat(s) left in % on that departure',
                public.kx_available_seats(
                    v_dep.flight_id, v_dep.aircraft_id, v_dep.direction,
                    (v_seg ->> 'travel_date')::date, v_dep.cabin_code),
                v_dep.cabin_code;
        end if;

        insert into public.booking_segments (
            booking_id, segment_order, flight_id, aircraft_id, direction,
            cabin_code, travel_date, marketing_airline_uid, operating_airline_uid,
            flight_number, origin_iata, destination_iata,
            departure_time, arrival_time, arrival_date, price_usd)
        values (
            v_booking_id, v_order, v_dep.flight_id, v_dep.aircraft_id, v_dep.direction,
            v_dep.cabin_code, (v_seg ->> 'travel_date')::date,
            v_dep.airline_uid, v_dep.airline_uid,
            v_dep.flight_number, v_dep.origin_iata, v_dep.destination_iata,
            v_dep.departure_time, v_dep.arrival_time,
            (v_seg ->> 'travel_date')::date + v_dep.arrival_days_after_departure,
            v_dep.price_usd)
        returning segment_id into v_segment_id;

        -- one ticket per passenger on this segment, priced for their type
        insert into public.tickets (passenger_id, segment_id, fare_usd)
        select p.passenger_id, v_segment_id,
               round(v_dep.price_usd * public.kx_pax_fare_factor(p.passenger_type))
        from public.passengers p
        where p.booking_id = v_booking_id;
    end loop;

    return v_pnr;
end;
$function$;

grant execute on function public.kx_pax_fare_factor(text) to anon, authenticated;
grant execute on function public.kx_seat_count(jsonb) to anon, authenticated;
grant execute on function public.create_booking(text, text, jsonb, jsonb) to anon, authenticated;

commit;
