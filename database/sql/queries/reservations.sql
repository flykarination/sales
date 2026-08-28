-- =====================================================================
-- Looking at reservations
--
-- Paste any of these into the Supabase SQL editor. They are read-only.
--
-- Why they work there and not from the app: the reservation tables carry
-- row-level security with no policy granted to anon, so the publishable
-- key cannot read them at all -- which is the point. The SQL editor runs
-- as a privileged role and is not subject to that, so you see everything.
--
-- These are queries, not migrations. Nothing here changes any data.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. EVERY RESERVATION, one row each, newest first.
--    The one to run if you only run one.
-- ---------------------------------------------------------------------
select
    b.pnr,
    b.created_at::timestamptz(0)                      as booked_at,
    b.status,
    b.contact_name,
    b.contact_email,

    count(distinct p.passenger_id)                    as pax,
    count(distinct p.passenger_id) filter (where p.passenger_type = 'ADULT')  as adults,
    count(distinct p.passenger_id) filter (where p.passenger_type = 'CHILD')  as children,
    count(distinct p.passenger_id) filter (where p.passenger_type = 'INFANT') as infants,

    -- The journey in travel order: every origin in sequence, then the last
    -- destination. Reads as SGN -> CXR -> DAD -> SGN.
    (
      (select string_agg(s.origin_iata, ' -> ' order by s.segment_order)
         from public.booking_segments s where s.booking_id = b.booking_id)
      || ' -> ' ||
      (select s.destination_iata
         from public.booking_segments s where s.booking_id = b.booking_id
        order by s.segment_order desc limit 1)
    )                                                 as routing,

    count(distinct bs.segment_id)                     as segments,
    min(bs.travel_date)                               as departs,
    max(bs.arrival_date)                              as last_arrival,
    string_agg(distinct bs.cabin_code, ', ')          as cabins,
    -- more than one code here means a cross-carrier itinerary
    string_agg(distinct a.airline_code, ', ')         as carriers,

    -- What was actually charged, summed from the tickets themselves rather
    -- than trusting the header total. They should agree; if one ever does
    -- not, the ticket rows are the truth.
    sum(t.fare_usd)                                   as charged_usd,
    count(distinct bs.segment_id) filter (where bs.checked_in_at is not null) as checked_in

from public.bookings b
left join public.passengers       p  on p.booking_id  = b.booking_id
left join public.booking_segments bs on bs.booking_id = b.booking_id
left join public.airlines         a  on a.uid         = bs.operating_airline_uid
left join public.tickets          t  on t.segment_id  = bs.segment_id
                                    and t.passenger_id = p.passenger_id
group by b.booking_id, b.pnr, b.created_at, b.status,
         b.contact_name, b.contact_email
order by b.created_at desc;


-- ---------------------------------------------------------------------
-- 2. EVERY LEG OF EVERY BOOKING, per passenger.
--    One row per ticket: who is on which flight, in which seat, for how
--    much. This is the manifest view.
-- ---------------------------------------------------------------------
select
    b.pnr, b.status, b.contact_email,
    bs.segment_order                             as leg,
    a.airline_code || ' ' || bs.flight_number    as flight,
    bs.origin_iata || '-' || bs.destination_iata as sector,
    bs.travel_date, bs.departure_time, bs.arrival_time,
    bs.cabin_code,
    bs.status                                    as segment_status,
    p.passenger_seq                              as pax_no,
    p.given_name || ' ' || p.family_name         as passenger,
    p.passenger_type,
    t.fare_usd, t.seat_number,
    t.status                                     as ticket_status
from public.bookings b
join public.booking_segments bs on bs.booking_id = b.booking_id
join public.passengers       p  on p.booking_id  = b.booking_id
left join public.tickets     t  on t.segment_id  = bs.segment_id
                               and t.passenger_id = p.passenger_id
left join public.airlines    a  on a.uid = bs.operating_airline_uid
order by b.created_at desc, bs.segment_order, p.passenger_seq;


-- ---------------------------------------------------------------------
-- 3. WHAT IT ADDS UP TO, by carrier and cabin.
--    The rollup gives per-cabin lines, a per-carrier subtotal, and the
--    grand total on the row where both are null.
-- ---------------------------------------------------------------------
select
    coalesce(a.airline_code, 'ALL')   as carrier,
    coalesce(bs.cabin_code, 'all')    as cabin,
    count(distinct b.booking_id)      as bookings,
    count(t.ticket_id)                as tickets,
    sum(t.fare_usd)::numeric(12,2)    as revenue_usd
from public.bookings b
join public.booking_segments bs on bs.booking_id = b.booking_id
join public.tickets          t  on t.segment_id  = bs.segment_id
left join public.airlines    a  on a.uid = bs.operating_airline_uid
where b.status = 'CONFIRMED'
group by rollup (a.airline_code, bs.cabin_code)
order by 1, 2;


-- ---------------------------------------------------------------------
-- 4. ONE BOOKING, everything about it.
--    Change the reference and run.
-- ---------------------------------------------------------------------
select * from public.v_booking_details
where pnr = 'GV9498'
order by segment_order;


-- ---------------------------------------------------------------------
-- 5. WHAT HAS HAPPENED TO A BOOKING since it was made -- date changes,
--    cancellations, upgrades, miles payments.
-- ---------------------------------------------------------------------
select b.pnr, e.occurred_at::timestamptz(0), e.event_type, e.detail
from public.booking_events e
join public.bookings b on b.booking_id = e.booking_id
order by e.occurred_at desc
limit 100;


-- ---------------------------------------------------------------------
-- 6. REAL BOOKINGS ONLY.
--    Sales are simulated as well as sold: departure_inventory carries a
--    simulated_seats_sold figure that drives the load percentages on the
--    site. None of that appears above -- everything in these queries is a
--    reservation a person actually made. This is the proof:
--    booked_seats is the real half, simulated_seats_sold is the theatre.
-- ---------------------------------------------------------------------
select
    sum(booked_seats)                        as seats_really_sold,
    sum(simulated_seats_sold)                as seats_simulated,
    count(*) filter (where booked_seats > 0) as departures_with_a_real_booking
from public.departure_inventory;
