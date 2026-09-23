-- =====================================================================
-- 26. A booking can belong to a RainbowOne account
--
-- Until now a reservation was reachable only by its PNR and the email it
-- was made with, and RainbowOne knew about it only obliquely: miles were
-- credited to whichever member's address happened to be the contact on the
-- booking. A member had nowhere to see what they had booked.
--
-- A booking now carries an optional `member_id`. It is set when the member
-- asks for it -- at booking time from the funnel, or afterwards from manage
-- booking -- never inferred from the address alone, because an address is
-- not a claim of ownership: several of this database's bookings share one
-- inbox between different travellers.
--
-- Two consequences worth stating:
--
--   * Miles follow the account, not the address. kx_credit_segment now
--     credits the account a booking is on, and falls back to matching the
--     contact address only when it is on no account. A member booking for
--     their family on a shared address therefore earns for themselves.
--   * Attaching credits what was never earned. A guest who joins later, or
--     a member who forgot to sign in, gets the miles for that booking when
--     they add it -- but only for segments no one has earned on, so the
--     same flight can never be earned twice. A booking made with another
--     member's address is refused outright: it is already on their account
--     to add, and taking it would take their miles with it.
--
-- Adding a booking asks for the PNR and the email it was booked with, the
-- same pair manage booking has always asked for. Knowing it already allows
-- cancelling the booking, so it is no weaker a proof than the site's own.
--
-- What a member sees (my_bookings) is deliberately wider than what they
-- have attached: it also lists bookings made with their own membership
-- address, marked as not yet on the account, so nothing of theirs is
-- invisible and adding it is one click.
-- =====================================================================

begin;

alter table public.bookings
    add column if not exists member_id uuid
        references public.ff_members (member_id) on delete set null;

comment on column public.bookings.member_id is
    'The RainbowOne account this booking was added to. Null for a guest booking, '
    'or one whose owner never asked for it to be on their account.';

create index if not exists bookings_member_idx
    on public.bookings (member_id, created_at desc);

-- ---------------------------------------------------------------------
-- Earning: the account the booking is on wins over the contact address
-- ---------------------------------------------------------------------

create or replace function public.kx_credit_segment(p_segment_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    seg        record;
    v_member   public.ff_members%rowtype;
    v_rate     public.ff_earn_rates%rowtype;
    v_bonus    numeric(5,2);
    v_km       integer;
    v_miles    integer;
    v_qmiles   integer;
begin
    select s.*, b.contact_email, b.member_id
      into seg
      from public.booking_segments s
      join public.bookings b using (booking_id)
     where s.segment_id = p_segment_id;
    if not found then return 0; end if;

    -- The account it belongs to, if it belongs to one; otherwise the member
    -- whose address made it, which is how every booking earned before
    -- accounts could hold one.
    if seg.member_id is not null then
        select * into v_member from public.ff_members where member_id = seg.member_id;
    else
        select * into v_member from public.ff_members
         where lower(email) = lower(seg.contact_email);
    end if;
    if not found then return 0; end if;          -- not a member: nothing to credit

    v_km := public.kx_distance_km(seg.origin_iata, seg.destination_iata);
    if v_km is null or v_km <= 0 then return 0; end if;

    -- the fare-specific rate wins over the cabin default
    select * into v_rate from public.ff_earn_rates r
     where r.cabin_code = seg.cabin_code
       and (r.valid_to is null or r.valid_to >= current_date)
       and r.valid_from <= current_date
       and (r.fare_product_id = seg.fare_product_id
            or (r.fare_product_id is null and seg.fare_product_id is null)
            or r.fare_product_id is null)
     order by (r.fare_product_id is not null) desc
     limit 1;
    if not found then return 0; end if;

    select earn_bonus_pct into v_bonus from public.ff_tiers where tier_code = v_member.tier_code;

    v_miles  := round(v_km * v_rate.multiplier * (1 + coalesce(v_bonus, 0) / 100.0));
    v_qmiles := round(v_km * v_rate.qualifying_multiplier);

    insert into public.ff_transactions (
        member_id, segment_id, txn_type, miles, qualifying_miles,
        distance_km, cabin_code, multiplier, tier_bonus_pct, description)
    values (
        v_member.member_id, p_segment_id, 'EARN_FLIGHT', v_miles, v_qmiles,
        v_km, seg.cabin_code, v_rate.multiplier, v_bonus,
        seg.origin_iata || ' to ' || seg.destination_iata || ' on ' || seg.travel_date)
    on conflict do nothing;

    if not found then return 0; end if;

    update public.ff_members
       set balance_miles = balance_miles + v_miles,
           lifetime_miles = lifetime_miles + v_miles,
           qualifying_miles_ytd = qualifying_miles_ytd + v_qmiles,
           updated_at = now()
     where member_id = v_member.member_id;

    perform public.kx_reassess_tier(v_member.member_id);
    return v_miles;
end;
$$;

comment on function public.kx_credit_segment(uuid) is
    'Credit one segment to the account its booking is on, or to the member whose '
    'address made it. Safe to call again: the unique index makes a repeat a no-op.';

-- ---------------------------------------------------------------------
-- Adding a booking to the signed-in member's account
-- ---------------------------------------------------------------------

create or replace function public.attach_booking_to_account(p_pnr text, p_email text)
returns table (ok boolean, message text, miles_credited integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_member  public.ff_members%rowtype;
    v_booking public.bookings%rowtype;
    v_segment uuid;
    v_miles   integer := 0;
begin
    select * into v_member from public.ff_members where user_id = auth.uid();
    if not found then
        return query select false, 'Sign in to your RainbowOne account first.'::text, 0;
        return;
    end if;

    -- Both halves of the secret, exactly as manage booking asks for them:
    -- being signed in is not by itself a claim on somebody else's booking.
    select * into v_booking from public.bookings
     where pnr = upper(trim(p_pnr))
       and lower(contact_email) = lower(trim(p_email));
    if not found then
        return query select false,
            'No booking matches that reference and email.'::text, 0;
        return;
    end if;

    if v_booking.member_id = v_member.member_id then
        return query select true, 'That booking is already on your account.'::text, 0;
        return;
    end if;
    if v_booking.member_id is not null then
        return query select false,
            'That booking is already on another RainbowOne account.'::text, 0;
        return;
    end if;

    -- Another member's address is their claim on it: the booking is already
    -- listed on their account for them to add. Taking it would take their
    -- miles too, and leave them unable to add their own trip.
    if exists (select 1 from public.ff_members m
                where lower(m.email) = lower(v_booking.contact_email)
                  and m.member_id <> v_member.member_id) then
        return query select false,
            'That booking was made with another RainbowOne member''s address, '
            'so it is theirs to add.'::text, 0;
        return;
    end if;

    update public.bookings
       set member_id = v_member.member_id, updated_at = now()
     where booking_id = v_booking.booking_id;

    -- Miles for whatever was never earned. A segment already earned on --
    -- by this member or by the address that booked it -- is left alone.
    if v_booking.status = 'CONFIRMED' then
        for v_segment in
            select s.segment_id
              from public.booking_segments s
             where s.booking_id = v_booking.booking_id
               and not exists (
                   select 1 from public.ff_transactions t
                    where t.segment_id = s.segment_id and t.txn_type = 'EARN_FLIGHT')
        loop
            v_miles := v_miles + public.kx_credit_segment(v_segment);
        end loop;
    end if;

    return query select true,
        case when v_miles > 0
             then 'Added to your account, and ' || v_miles || ' miles credited.'
             else 'Added to your account.' end,
        v_miles;
end;
$$;

comment on function public.attach_booking_to_account(text, text) is
    'Put a booking on the signed-in member''s account, crediting any miles it '
    'never earned. Requires the PNR and the email it was booked with.';

-- ---------------------------------------------------------------------
-- What a member has booked
-- ---------------------------------------------------------------------

create or replace function public.my_bookings()
returns table (
    pnr              text,
    status           text,
    contact_email    text,
    contact_name     text,
    total_amount_usd numeric,
    created_at       timestamptz,
    passenger_count  integer,
    segment_count    integer,
    first_travel_date date,
    last_travel_date  date,
    origin_iata      text,
    destination_iata text,
    on_account       boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with me as (
        select m.member_id, lower(m.email) as email
        from public.ff_members m
        where m.user_id = auth.uid()
    ),
    mine as (
        select b.booking_id, b.pnr, b.status, b.contact_email, b.contact_name,
               b.total_amount_usd, b.created_at, b.member_id
        from public.bookings b
        cross join me
        -- on the account, or made with the membership address and on no
        -- other account; never one that someone else has claimed
        where b.member_id = me.member_id
           or (b.member_id is null and lower(b.contact_email) = me.email)
    ),
    legs as (
        select s.booking_id,
               count(*)::int                                     as segment_count,
               min(s.travel_date)                                as first_travel_date,
               max(s.travel_date)                                as last_travel_date,
               (array_agg(s.origin_iata order by s.segment_order))[1] as origin_iata
        from public.booking_segments s
        where s.booking_id in (select booking_id from mine)
        group by s.booking_id
    ),
    -- Where the trip actually goes: the furthest point from where it starts.
    -- The last segment's destination is no answer at all on a return, where
    -- it is home again -- "SGN to SGN" describes nothing.
    far as (
        select l.booking_id,
               (select s.destination_iata
                  from public.booking_segments s
                 where s.booking_id = l.booking_id
                 order by coalesce(public.kx_distance_km(l.origin_iata, s.destination_iata), 0) desc,
                          s.segment_order
                 limit 1) as destination_iata
        from legs l
    ),
    heads as (
        select p.booking_id, count(*)::int as passenger_count
        from public.passengers p
        where p.booking_id in (select booking_id from mine)
        group by p.booking_id
    )
    select m.pnr, m.status, m.contact_email, m.contact_name,
           m.total_amount_usd, m.created_at,
           coalesce(h.passenger_count, 0), coalesce(l.segment_count, 0),
           l.first_travel_date, l.last_travel_date, l.origin_iata, f.destination_iata,
           m.member_id is not null
    from mine m
    left join legs  l on l.booking_id = m.booking_id
    left join far   f on f.booking_id = m.booking_id
    left join heads h on h.booking_id = m.booking_id
    -- trips still to come first, soonest first; then flown ones, latest first
    order by case when l.last_travel_date >= current_date then 0 else 1 end,
             case when l.last_travel_date >= current_date then l.first_travel_date end
                 asc nulls last,
             l.first_travel_date desc nulls last;
$$;

comment on function public.my_bookings() is
    'Every booking the signed-in member has: the ones on their account, and any '
    'made with their membership address that no other account holds. Upcoming first.';

grant execute on function public.my_bookings()                          to authenticated;
grant execute on function public.attach_booking_to_account(text, text)  to authenticated;

commit;
