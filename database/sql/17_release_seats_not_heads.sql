-- =====================================================================
-- 17. Release seats, not heads
--
-- kx_release_segment counted every passenger on the booking, so a
-- cancellation gave back one seat per infant that was never taken. The
-- error is silent and one-directional: inventory drifts upward every
-- time a family with a lap infant cancels, and the departure appears to
-- have seats it does not.
--
-- The same reasoning as 16_passenger_types.sql, applied to the other
-- end of the booking's life.
-- =====================================================================

begin;

create or replace function public.kx_release_segment(p_segment_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
    seg     record;
    v_seats integer;
begin
    select s.*,
           -- seats, not heads: an infant travelled on a lap and took none
           (select count(*)
              from public.passengers p
             where p.booking_id = s.booking_id
               and upper(coalesce(p.passenger_type, 'ADULT')) <> 'INFANT') as pax
      into seg
      from public.booking_segments s
     where s.segment_id = p_segment_id;
    if not found then return 0; end if;

    v_seats := greatest(seg.pax, 1);

    update public.departure_inventory
       set booked_seats = greatest(0, booked_seats - v_seats),
           sold_out_at = case
               when simulated_seats_sold + greatest(0, booked_seats - v_seats) < capacity_seats
               then null else sold_out_at end
     where flight_id = seg.flight_id and aircraft_id = seg.aircraft_id
       and direction = seg.direction and travel_date = seg.travel_date
       and cabin_code = seg.cabin_code;

    return v_seats;
end;
$function$;

commit;
