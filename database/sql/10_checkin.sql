-- =====================================================================
--  Online check-in and boarding passes
--
--  Every real airline site has this and ours did not. It reuses what is
--  already there: tickets.seat_number and tickets.status exist but were
--  never written to.
--
--  Like find_booking, check-in is reached through a SECURITY DEFINER
--  function that demands PNR plus email, because the reservation tables
--  are invisible to the publishable key.
--
--  Run after 09_frequent_flyer.sql.
-- =====================================================================

begin;

alter table public.booking_segments
    add column if not exists checked_in_at timestamptz;

-- Check-in opens 48 hours before departure, as most carriers do. The
-- schedule has no year-bound calendar, so this is measured against the
-- segment's travel_date at local midnight -- close enough for a world
-- where nobody misses a flight.
create or replace function public.kx_checkin_opens(p_travel_date date)
returns boolean language sql stable parallel safe as $$
    select p_travel_date - current_date <= 2 and p_travel_date >= current_date;
$$;

-- Deterministic seat from the ticket id, so a boarding pass reprints
-- identically and two passengers never collide on one segment.
create or replace function public.kx_seat_for(p_ticket_id uuid, p_cabin text, p_index integer)
returns text
language sql
immutable
parallel safe
as $$
    select case p_cabin
        when 'FIRST'           then 1 + (p_index / 4)
        when 'BUSINESS'        then 3 + (p_index / 4)
        when 'PREMIUM_ECONOMY' then 9 + (p_index / 6)
        else                       15 + (p_index / 6)
    end::text
    || case p_cabin
        when 'FIRST'    then (array['A','D','G','K'])[1 + (p_index % 4)]
        when 'BUSINESS' then (array['A','D','G','K'])[1 + (p_index % 4)]
        else                 (array['A','B','C','H','J','K'])[1 + (p_index % 6)]
       end;
$$;

comment on function public.kx_seat_for(uuid, text, integer) is
    'Seat label for a ticket. Front cabins are 4-abreast, the rest 6-abreast.';

/**
 * Check in a whole booking and return its boarding passes.
 *
 * Idempotent: calling it again returns the same seats rather than moving
 * anybody. Segments whose travel date is still far off are reported with
 * checkin_open = false and left alone.
 */
create or replace function public.check_in(p_pnr text, p_email text)
returns table (
    pnr               text,
    passenger_name    text,
    segment_order     smallint,
    flight_number     integer,
    airline_code      text,
    origin_iata       text,
    destination_iata  text,
    travel_date       date,
    departure_time    time,
    arrival_time      time,
    cabin_code        text,
    cabin_name        text,
    seat_number       text,
    ticket_number     text,
    boarding_time     time,
    gate              text,
    checkin_open      boolean,
    checked_in        boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_booking uuid;
begin
    select b.booking_id into v_booking
      from public.bookings b
     where b.pnr = upper(trim(p_pnr))
       and lower(b.contact_email) = lower(trim(p_email))
       and b.status <> 'CANCELLED';

    if v_booking is null then
        return;                                   -- no rows: wrong pnr/email
    end if;

    -- assign seats for any segment that is now within the check-in window
    with numbered as (
        select t.ticket_id, s.segment_id, s.cabin_code,
               (row_number() over (partition by s.segment_id order by p.passenger_seq))::int - 1 as idx
        from public.booking_segments s
        join public.tickets t on t.segment_id = s.segment_id
        join public.passengers p on p.passenger_id = t.passenger_id
        where s.booking_id = v_booking
          and t.seat_number is null
          and public.kx_checkin_opens(s.travel_date)
    )
    update public.tickets t
       set seat_number = public.kx_seat_for(n.ticket_id, n.cabin_code, n.idx),
           ticket_number = coalesce(t.ticket_number,
                                    '999' || lpad((abs(hashtext(t.ticket_id::text)) % 10000000)::text, 7, '0'))
      from numbered n
     where t.ticket_id = n.ticket_id;

    update public.booking_segments s
       set checked_in_at = coalesce(s.checked_in_at, now())
     where s.booking_id = v_booking
       and public.kx_checkin_opens(s.travel_date)
       and exists (select 1 from public.tickets t
                    where t.segment_id = s.segment_id and t.seat_number is not null);

    return query
    select b.pnr,
           (p.given_name || ' ' || p.family_name)::text,
           s.segment_order,
           s.flight_number,
           coalesce(al.airline_code, 'KX')::text,
           s.origin_iata,
           s.destination_iata,
           s.travel_date,
           s.departure_time,
           s.arrival_time,
           s.cabin_code,
           cc.cabin_name,
           t.seat_number,
           t.ticket_number,
           (s.departure_time - interval '40 minutes')::time,
           -- there is no gate data in this world; derive a stable one
           ('A' || (1 + (abs(hashtext(s.segment_id::text)) % 24))::text)::text,
           public.kx_checkin_opens(s.travel_date),
           (s.checked_in_at is not null)
      from public.booking_segments s
      join public.bookings b on b.booking_id = s.booking_id
      join public.tickets t on t.segment_id = s.segment_id
      join public.passengers p on p.passenger_id = t.passenger_id
      join public.cabin_classes cc on cc.cabin_code = s.cabin_code
      left join public.airlines al on al.uid = s.operating_airline_uid
     where s.booking_id = v_booking
     order by s.segment_order, p.passenger_seq;
end;
$$;

comment on function public.check_in(text, text) is
    'Online check-in. Requires PNR and email; idempotent, and reports segments that are not yet open rather than failing.';

grant execute on function public.check_in(text, text) to anon, authenticated;

commit;

-- =====================================================================
--  select * from public.check_in('QPGS2N', 'testflyer@karination.io');
-- =====================================================================
