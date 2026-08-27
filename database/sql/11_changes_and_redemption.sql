-- =====================================================================
--  Changing a booking, and spending RainbowOne miles
--
--  Two gaps closed:
--
--  1. A booking could be made but never changed or cancelled. Seats stayed
--     taken forever and the reservation had nowhere to go.
--
--  2. Members earned miles with nothing to spend them on. Award flights and
--     cabin upgrades are added here, and the redemption catalogue carries a
--     category so hotels and duty-free can be added later without a schema
--     change.
--
--  Run after 10_checkin.sql.
-- =====================================================================

begin;

-- How far ahead the published schedule may be booked or changed into. Without
-- a bound, a daily flight accepts any future date at all -- a change to 2034
-- succeeds, which is not a schedule anybody publishes.
create or replace function public.kx_booking_horizon_days() returns integer
language sql immutable parallel safe as $$ select 360 $$;

-- ---------------------------------------------------------------------
-- An audit trail for anything that happens to a booking after sale
-- ---------------------------------------------------------------------

create table if not exists public.booking_events (
    event_id    uuid primary key default gen_random_uuid(),
    booking_id  uuid not null references public.bookings (booking_id) on delete cascade,
    segment_id  uuid,
    event_type  text not null check (event_type in
                   ('CREATED', 'CHANGED', 'CANCELLED', 'CHECKED_IN', 'UPGRADED', 'AWARD_ISSUED')),
    detail      text not null,
    occurred_at timestamptz not null default now()
);

create index if not exists booking_events_booking_idx
    on public.booking_events (booking_id, occurred_at desc);

comment on table public.booking_events is
    'What has happened to a reservation since it was sold, in the passenger''s own words.';

-- ---------------------------------------------------------------------
-- Give seats back
-- ---------------------------------------------------------------------

/**
 * Release the seats a segment was holding.
 *
 * booked_seats is decremented rather than zeroed, because several bookings
 * share one departure. The row is un-sold-out if it had filled, so the
 * simulation can start selling it again.
 */
create or replace function public.kx_release_segment(p_segment_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    seg     record;
    v_seats integer;
begin
    select s.*, (select count(*) from public.passengers p where p.booking_id = s.booking_id) as pax
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
$$;

-- ---------------------------------------------------------------------
-- Cancel
-- ---------------------------------------------------------------------

/**
 * Cancel a whole booking. Seats go back, tickets are voided, miles earned on
 * it are clawed back, and the reservation is kept rather than deleted so the
 * passenger can still see what happened.
 *
 * Karination sells one fare per cabin with no change or refund conditions
 * attached, so there is no fee to apply — the refund is simply the amount paid.
 */
create or replace function public.cancel_booking(p_pnr text, p_email text)
returns table (pnr text, status text, refunded_usd numeric, seats_released integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_booking uuid;
    v_total   numeric(12,2);
    v_seats   integer := 0;
    seg       record;
    v_member  uuid;
    v_miles   integer := 0;
begin
    select b.booking_id, b.total_amount_usd into v_booking, v_total
      from public.bookings b
     where b.pnr = upper(trim(p_pnr))
       and lower(b.contact_email) = lower(trim(p_email))
       and b.status <> 'CANCELLED';
    if v_booking is null then return; end if;

    for seg in select segment_id from public.booking_segments where booking_id = v_booking loop
        v_seats := v_seats + public.kx_release_segment(seg.segment_id);
    end loop;

    -- take back the miles this booking earned
    select m.member_id into v_member
      from public.ff_members m
      join public.bookings b on lower(b.contact_email) = lower(m.email)
     where b.booking_id = v_booking;

    if v_member is not null then
        select coalesce(sum(t.miles), 0) into v_miles
          from public.ff_transactions t
          join public.booking_segments s on s.segment_id = t.segment_id
         where s.booking_id = v_booking and t.txn_type = 'EARN_FLIGHT';

        if v_miles > 0 then
            insert into public.ff_transactions
                (member_id, txn_type, miles, qualifying_miles, description)
            values (v_member, 'ADJUST', -v_miles, 0, 'Miles reversed — booking cancelled');
            update public.ff_members
               set balance_miles = greatest(0, balance_miles - v_miles),
                   lifetime_miles = greatest(0, lifetime_miles - v_miles),
                   updated_at = now()
             where member_id = v_member;
        end if;
    end if;

    update public.booking_segments set status = 'CANCELLED' where booking_id = v_booking;
    update public.tickets t set status = 'VOID'
      from public.booking_segments s
     where s.segment_id = t.segment_id and s.booking_id = v_booking;
    update public.bookings
       set status = 'CANCELLED', cancelled_at = now(), updated_at = now()
     where booking_id = v_booking;

    insert into public.booking_events (booking_id, event_type, detail)
    values (v_booking, 'CANCELLED',
            'Booking cancelled and ' || v_seats || ' seat(s) released'
            || case when v_miles > 0 then ', ' || v_miles || ' miles reversed' else '' end);

    return query select upper(trim(p_pnr)), 'CANCELLED'::text, v_total, v_seats;
end;
$$;

-- ---------------------------------------------------------------------
-- Change the date of a segment
-- ---------------------------------------------------------------------

/**
 * Move one segment to another date on the same route and cabin.
 *
 * The new date must be one the flight actually operates and must have room.
 * Seats move across in one transaction, so a failed change never leaves a
 * passenger holding neither date.
 */
create or replace function public.change_segment_date(
    p_pnr text, p_email text, p_segment_id uuid, p_new_date date
)
returns table (ok boolean, message text, new_date date)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    seg      record;
    v_pax    integer;
    v_avail  integer;
begin
    select s.* into seg
      from public.booking_segments s
      join public.bookings b on b.booking_id = s.booking_id
     where s.segment_id = p_segment_id
       and b.pnr = upper(trim(p_pnr))
       and lower(b.contact_email) = lower(trim(p_email))
       and b.status = 'CONFIRMED'
       and s.status = 'CONFIRMED';
    if not found then
        return query select false, 'No such booking, or it has been cancelled.'::text, null::date;
        return;
    end if;

    if p_new_date < current_date then
        return query select false, 'Choose a date in the future.'::text, null::date;
        return;
    end if;

    if p_new_date > current_date + public.kx_booking_horizon_days() then
        return query select false,
            ('Our schedule is published ' || public.kx_booking_horizon_days()
             || ' days ahead. Choose an earlier date.')::text, null::date;
        return;
    end if;

    if p_new_date = seg.travel_date then
        return query select false, 'That is the date you are already booked on.'::text, null::date;
        return;
    end if;

    if not public.kx_flight_operates_on(seg.flight_id, seg.aircraft_id, seg.direction, p_new_date) then
        return query select false,
            ('This flight does not operate on ' || to_char(p_new_date, 'FMDay DD Mon'))::text, null::date;
        return;
    end if;

    select greatest(count(*), 1) into v_pax
      from public.passengers where booking_id = seg.booking_id;

    v_avail := public.kx_available_seats(
        seg.flight_id, seg.aircraft_id, seg.direction, p_new_date, seg.cabin_code);
    if v_avail < v_pax then
        return query select false,
            ('Only ' || v_avail || ' seat(s) left in that cabin on the new date.')::text, null::date;
        return;
    end if;

    perform public.kx_release_segment(p_segment_id);

    update public.booking_segments
       set travel_date = p_new_date,
           arrival_date = p_new_date + (coalesce(arrival_date, travel_date) - travel_date)
     where segment_id = p_segment_id;

    -- take the seats on the new date
    insert into public.departure_inventory (
        flight_id, aircraft_id, direction, travel_date, cabin_code,
        capacity_seats, demand_rate_per_hour, price_usd, booked_seats)
    select seg.flight_id, seg.aircraft_id, seg.direction, p_new_date, seg.cabin_code,
           fr.seats_per_departure,
           public.kx_demand_rate(seg.flight_id::text || seg.direction || seg.cabin_code
                                 || p_new_date::text, fr.seats_per_departure),
           fr.price_usd, 0
      from public.flight_fares fr
     where fr.flight_id = seg.flight_id and fr.aircraft_id = seg.aircraft_id
       and fr.cabin_code = seg.cabin_code
    on conflict do nothing;

    update public.departure_inventory
       set booked_seats = booked_seats + v_pax
     where flight_id = seg.flight_id and aircraft_id = seg.aircraft_id
       and direction = seg.direction and travel_date = p_new_date
       and cabin_code = seg.cabin_code;

    insert into public.booking_events (booking_id, segment_id, event_type, detail)
    values (seg.booking_id, p_segment_id, 'CHANGED',
            seg.origin_iata || ' to ' || seg.destination_iata || ' moved from '
            || seg.travel_date || ' to ' || p_new_date);

    return query select true, 'Your flight has been moved.'::text, p_new_date;
end;
$$;

-- ---------------------------------------------------------------------
-- Spending miles
-- ---------------------------------------------------------------------

-- What miles can be spent on. Categories beyond flying are listed now so the
-- catalogue, the ledger and the UI already understand them; the rows simply
-- do not exist yet.
create table if not exists public.reward_categories (
    category_code text primary key,
    category_name text not null,
    description   text,
    sort_order    smallint not null default 0,
    is_live       boolean not null default false
);

insert into public.reward_categories (category_code, category_name, description, sort_order, is_live)
values
  ('AWARD_FLIGHT', 'Award flights', 'Pay for a seat entirely in miles.', 1, true),
  ('UPGRADE', 'Cabin upgrades', 'Move up a cabin on a flight you have already booked.', 2, true),
  ('HOTEL', 'Hotels', 'Discounted stays with our partners.', 3, false),
  ('DUTY_FREE', 'Duty free', 'Spend miles on board and in airport shops.', 4, false)
on conflict (category_code) do update
  set category_name = excluded.category_name,
      description = excluded.description,
      sort_order = excluded.sort_order;

alter table public.reward_categories enable row level security;
drop policy if exists reward_categories_read on public.reward_categories;
create policy reward_categories_read on public.reward_categories
    for select to anon, authenticated using (true);
grant select on public.reward_categories to anon, authenticated;

/**
 * Miles price of a cash fare.
 *
 * 100 miles per dollar keeps the two currencies legible to each other: an
 * 8,774 km Business sector earns 17,548 miles and costs 383,300 to redeem, so
 * roughly twenty-two of those flights buys a free one. Upgrades are charged on
 * the difference between the cabins, not the full fare.
 */
create or replace function public.kx_award_price(p_usd numeric)
returns integer language sql immutable parallel safe as $$
    select greatest(round(coalesce(p_usd, 0) * 100)::int, 0);
$$;

comment on function public.kx_award_price(numeric) is
    'Miles needed for a fare in US dollars, at 100 miles to the dollar.';

/**
 * Spend miles on an upgrade for a segment already held.
 *
 * Charges the fare difference between the cabins in miles, moves the segment,
 * and hands the old seats back so the simulation can resell them.
 */
create or replace function public.redeem_upgrade(
    p_pnr text, p_email text, p_segment_id uuid, p_to_cabin text
)
returns table (ok boolean, message text, miles_spent integer, balance_miles integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    seg      record;
    v_member public.ff_members%rowtype;
    v_new    integer;
    v_old    integer;
    v_cost   integer;
    v_pax    integer;
    v_avail  integer;
begin
    select s.* into seg
      from public.booking_segments s
      join public.bookings b on b.booking_id = s.booking_id
     where s.segment_id = p_segment_id
       and b.pnr = upper(trim(p_pnr))
       and lower(b.contact_email) = lower(trim(p_email))
       and b.status = 'CONFIRMED' and s.status = 'CONFIRMED';
    if not found then
        return query select false, 'No such booking.'::text, 0, 0; return;
    end if;

    select * into v_member from public.ff_members
     where lower(email) = lower(trim(p_email));
    if not found then
        return query select false, 'Upgrades are for RainbowOne members. Joining is free.'::text, 0, 0;
        return;
    end if;

    if (select sort_order from public.cabin_classes where cabin_code = upper(p_to_cabin))
       >= (select sort_order from public.cabin_classes where cabin_code = seg.cabin_code) then
        return query select false, 'That is not an upgrade.'::text, 0, v_member.balance_miles;
        return;
    end if;

    select fr.price_usd into v_new from public.flight_fares fr
     where fr.flight_id = seg.flight_id and fr.aircraft_id = seg.aircraft_id
       and fr.cabin_code = upper(p_to_cabin);
    select fr.price_usd into v_old from public.flight_fares fr
     where fr.flight_id = seg.flight_id and fr.aircraft_id = seg.aircraft_id
       and fr.cabin_code = seg.cabin_code;
    if v_new is null or v_old is null then
        return query select false, 'That cabin is not sold on this aircraft.'::text, 0, v_member.balance_miles;
        return;
    end if;

    select greatest(count(*), 1) into v_pax from public.passengers where booking_id = seg.booking_id;
    v_cost := public.kx_award_price(greatest(v_new - v_old, 0)) * v_pax;

    if v_member.balance_miles < v_cost then
        return query select false,
            ('You need ' || v_cost || ' miles for this upgrade and have ' || v_member.balance_miles || '.')::text,
            0, v_member.balance_miles;
        return;
    end if;

    v_avail := public.kx_available_seats(
        seg.flight_id, seg.aircraft_id, seg.direction, seg.travel_date, upper(p_to_cabin));
    if v_avail < v_pax then
        return query select false,
            ('Only ' || v_avail || ' seat(s) left in that cabin.')::text, 0, v_member.balance_miles;
        return;
    end if;

    perform public.kx_release_segment(p_segment_id);
    update public.booking_segments set cabin_code = upper(p_to_cabin) where segment_id = p_segment_id;

    insert into public.departure_inventory (
        flight_id, aircraft_id, direction, travel_date, cabin_code,
        capacity_seats, demand_rate_per_hour, price_usd, booked_seats)
    select seg.flight_id, seg.aircraft_id, seg.direction, seg.travel_date, upper(p_to_cabin),
           fr.seats_per_departure,
           public.kx_demand_rate(seg.flight_id::text || seg.direction || upper(p_to_cabin)
                                 || seg.travel_date::text, fr.seats_per_departure),
           fr.price_usd, 0
      from public.flight_fares fr
     where fr.flight_id = seg.flight_id and fr.aircraft_id = seg.aircraft_id
       and fr.cabin_code = upper(p_to_cabin)
    on conflict do nothing;

    update public.departure_inventory set booked_seats = booked_seats + v_pax
     where flight_id = seg.flight_id and aircraft_id = seg.aircraft_id
       and direction = seg.direction and travel_date = seg.travel_date
       and cabin_code = upper(p_to_cabin);

    insert into public.ff_transactions
        (member_id, segment_id, txn_type, miles, qualifying_miles, cabin_code, description)
    values (v_member.member_id, p_segment_id, 'REDEEM', -v_cost, 0, upper(p_to_cabin),
            'Upgrade to ' || initcap(replace(p_to_cabin, '_', ' ')) || ' · '
            || seg.origin_iata || ' to ' || seg.destination_iata);

    -- balance_miles is also an OUT parameter of this function, so the column
    -- has to be qualified or plpgsql cannot tell which one is meant
    update public.ff_members
       set balance_miles = public.ff_members.balance_miles - v_cost,
           updated_at = now()
     where member_id = v_member.member_id;

    insert into public.booking_events (booking_id, segment_id, event_type, detail)
    values (seg.booking_id, p_segment_id, 'UPGRADED',
            'Upgraded to ' || initcap(replace(p_to_cabin, '_', ' ')) || ' for ' || v_cost || ' miles');

    return query select true, 'Upgraded.'::text, v_cost, v_member.balance_miles - v_cost;
end;
$$;

-- ---------------------------------------------------------------------
-- Reading a booking's history
-- ---------------------------------------------------------------------

create or replace function public.booking_history(p_pnr text, p_email text)
returns setof public.booking_events
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select e.* from public.booking_events e
    join public.bookings b on b.booking_id = e.booking_id
    where b.pnr = upper(trim(p_pnr))
      and lower(b.contact_email) = lower(trim(p_email))
    order by e.occurred_at desc;
$$;

alter table public.booking_events enable row level security;
revoke all on public.booking_events from anon, authenticated;

grant execute on function public.cancel_booking(text, text)                       to anon, authenticated;
grant execute on function public.change_segment_date(text, text, uuid, date)      to anon, authenticated;
grant execute on function public.redeem_upgrade(text, text, uuid, text)           to anon, authenticated;
grant execute on function public.booking_history(text, text)                      to anon, authenticated;
grant execute on function public.kx_award_price(numeric)                          to anon, authenticated;
revoke all on function public.kx_release_segment(uuid) from public, anon, authenticated;

commit;
