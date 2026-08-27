-- =====================================================================
--  KarinationGroup reservations database -- row level security
--
--  Supabase exposes every table in "public" through PostgREST using the
--  anon key, so RLS is the only thing standing between the browser and
--  the data. The split here is:
--
--    catalog (schedule, fleet, fares, load factors)  -> world readable
--    reservations (who booked what, and their email) -> no direct access
--
--  Bookings are keyed by email rather than by an auth user, so there is
--  no auth.uid() to filter on. Reads and writes therefore go through two
--  SECURITY DEFINER functions that demand PNR + email, which is how an
--  account-less airline site normally works.
--
--  The service_role key bypasses RLS entirely -- keep it server side.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Catalog: readable by anyone, writable by no one but service_role
-- ---------------------------------------------------------------------

do $$
declare
    t text;
    catalog_tables text[] := array[
        'airports', 'airlines', 'airline_hubs', 'airline_stats',
        'aircraft_models', 'cabin_classes', 'aircraft', 'flights',
        'flight_assignments', 'flight_assignment_days', 'flight_fares',
        'codeshares', 'fare_products', 'ancillaries',
        'departure_inventory', 'demand_events'
    ];
begin
    foreach t in array catalog_tables loop
        execute format('alter table public.%I enable row level security', t);
        execute format('drop policy if exists %I on public.%I', t || '_public_read', t);
        execute format(
            'create policy %I on public.%I for select to anon, authenticated using (true)',
            t || '_public_read', t);
        execute format('grant select on public.%I to anon, authenticated', t);
        execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    end loop;
end $$;

-- ---------------------------------------------------------------------
-- Reservations: locked. No policy is created, so with RLS on, anon and
-- authenticated see and write nothing at all.
-- ---------------------------------------------------------------------

do $$
declare
    t text;
    private_tables text[] := array[
        'bookings', 'passengers', 'booking_segments', 'tickets', 'booking_ancillaries'
    ];
begin
    foreach t in array private_tables loop
        execute format('alter table public.%I enable row level security', t);
        -- deliberately NOT "force": the table owner must stay exempt, because
        -- find_booking() and create_booking() run as the owner and are the only
        -- sanctioned way in. Forcing RLS here would lock those out too.
        execute format('revoke all on public.%I from anon, authenticated', t);
    end loop;
end $$;

-- Views inherit the policies of their base tables (security_invoker = on),
-- so this one returns nothing to anon unless reached through find_booking().
revoke all on public.v_booking_details from anon, authenticated;

-- Read-only catalog views
grant select on
    public.v_flight_legs,
    public.v_bookable_departures,
    public.v_stopover_itineraries,
    public.v_routes,
    public.v_codeshares,
    public.v_fleet,
    public.v_departure_load,
    public.v_management_dashboard,
    public.v_recent_sales
to anon, authenticated;

-- ---------------------------------------------------------------------
-- The two doors into the reservation tables
-- ---------------------------------------------------------------------

-- Retrieve a booking. Requires both halves of the secret: the PNR printed
-- on the confirmation and the email it was sent to.
create or replace function public.find_booking(
    p_pnr   text,
    p_email text
)
returns setof public.v_booking_details
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select d.*
    from public.v_booking_details d
    where d.pnr = upper(trim(p_pnr))
      and lower(d.contact_email) = lower(trim(p_email));
$$;

comment on function public.find_booking(text, text) is
    'Manage-my-booking lookup. Returns nothing unless PNR and email both match.';

-- Sell a reservation in one call.
--
--   select public.create_booking(
--     'traveller@example.com', 'A Traveller',
--     '[{"given_name":"Alex","family_name":"Traveller","passenger_type":"ADULT"}]'::jsonb,
--     '[{"flight_id":"...","aircraft_id":"...","direction":"OUTBOUND",
--        "cabin_code":"ECONOMY","travel_date":"2026-09-03"}]'::jsonb);
--
-- Prices, carriers, times and flight numbers are read from the schedule
-- rather than taken from the caller, so the browser cannot set its own fare.
create or replace function public.create_booking(
    p_contact_email text,
    p_contact_name  text,
    p_passengers    jsonb,
    p_segments      jsonb
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_booking_id uuid;
    v_pnr        text;
    v_pax_count  integer;
    v_seg        jsonb;
    v_order      smallint := 0;
    v_pax        jsonb;
    v_seq        smallint := 0;
    v_dep        record;
    v_segment_id uuid;
begin
    if jsonb_typeof(p_passengers) <> 'array' or jsonb_array_length(p_passengers) = 0 then
        raise exception 'at least one passenger is required';
    end if;
    if jsonb_typeof(p_segments) <> 'array' or jsonb_array_length(p_segments) = 0 then
        raise exception 'at least one segment is required';
    end if;

    v_pax_count := jsonb_array_length(p_passengers);
    if v_pax_count > 9 then
        raise exception 'a single booking may carry at most 9 passengers';
    end if;

    insert into public.bookings (contact_email, contact_name, status)
    values (p_contact_email, p_contact_name, 'CONFIRMED')
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
            coalesce(v_pax ->> 'passenger_type', 'ADULT'),
            (v_pax ->> 'date_of_birth')::date);
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
               (v_seg ->> 'travel_date')::date, v_dep.cabin_code) < v_pax_count then
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

        -- one ticket per passenger on this segment
        insert into public.tickets (passenger_id, segment_id, fare_usd)
        select p.passenger_id, v_segment_id, v_dep.price_usd
        from public.passengers p
        where p.booking_id = v_booking_id;
    end loop;

    return v_pnr;
end;
$$;

comment on function public.create_booking(text, text, jsonb, jsonb) is
    'Sell a reservation and return its PNR. Fares and flight details come from the schedule, never from the caller.';

-- ---------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------

grant execute on function public.find_booking(text, text)               to anon, authenticated;
grant execute on function public.create_booking(text, text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.search_flights(text, text, date, text, integer) to anon, authenticated;
grant execute on function public.kx_available_seats(uuid, uuid, text, date, text) to anon, authenticated;

-- Simulation and housekeeping are operator tools, not public endpoints.
revoke all on function public.simulate_bookings(integer)                  from public, anon, authenticated;
revoke all on function public.seed_departure_inventory(integer, date, uuid) from public, anon, authenticated;
revoke all on function public.prune_demand_events(integer)                from public, anon, authenticated;
revoke all on function public.prune_departed_inventory(integer)           from public, anon, authenticated;

commit;

-- =====================================================================
--  A note on the Supabase keys
--
--    anon key           -> browse the schedule, create and retrieve a
--                          booking with PNR + email. Nothing else.
--    service_role key   -> everything, RLS included. Server side only;
--                          never ship it to the browser.
--
--  Sanity check after applying:
--
--    set role anon;
--    select count(*) from public.flights;   -- 1302
--    select count(*) from public.bookings;  -- 0, whatever exists
--    reset role;
-- =====================================================================
