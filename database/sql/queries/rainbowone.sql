-- =====================================================================
-- RainbowOne membership
--
-- Paste into the Supabase SQL editor. All read-only.
--
-- Members are identified by email, and so are bookings, so that is the
-- join throughout: lower(ff_members.email) = lower(bookings.contact_email).
-- There is no membership column on a booking, because a booking does not
-- require an account.
--
-- ---------------------------------------------------------------------
-- ONE TRAP, worth knowing before you edit any of these.
--
-- Do NOT join passengers and tickets in the same query unless you mean
-- to. A ticket already belongs to one passenger on one segment, so
--
--     bookings -> booking_segments -> tickets            is correct
--     bookings -> booking_segments -> tickets -> passengers   fans out
--
-- and the second form multiplies every fare by the number of passengers
-- on the booking. On a two-passenger booking it silently doubles your
-- revenue. None of the queries below join passengers to tickets.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. EVERY MEMBER, and how much they have booked.
--    The one to run if you only run one.
-- ---------------------------------------------------------------------
select
    m.member_number,
    m.full_name,
    m.email,
    t.tier_name,
    m.balance_miles,
    m.lifetime_miles,
    m.qualifying_miles_ytd,
    m.joined_at::date                                    as joined,

    count(distinct b.booking_id)                         as reservations,
    -- There is no retro-credit, so anything booked before they joined
    -- earned them nothing. Worth seeing separately.
    count(distinct b.booking_id)
      filter (where b.created_at >= m.joined_at)         as since_joining,
    count(distinct b.booking_id)
      filter (where b.status = 'CONFIRMED')              as confirmed,
    count(distinct b.booking_id)
      filter (where b.status = 'CANCELLED')              as cancelled,
    count(distinct bs.segment_id)                        as flights_booked,
    coalesce(sum(tk.fare_usd), 0)::numeric(12,2)         as spent_usd,
    max(b.created_at)::timestamptz(0)                    as last_booked

from public.ff_members m
join public.ff_tiers t on t.tier_code = m.tier_code
left join public.bookings b
       on lower(b.contact_email) = lower(m.email)
left join public.booking_segments bs on bs.booking_id = b.booking_id
left join public.tickets          tk on tk.segment_id  = bs.segment_id
group by m.member_id, m.member_number, m.full_name, m.email,
         t.tier_name, t.tier_rank, m.balance_miles, m.lifetime_miles,
         m.qualifying_miles_ytd, m.joined_at
order by m.lifetime_miles desc;


-- ---------------------------------------------------------------------
-- 2. WHO IS BOOKING AND NOT A MEMBER.
--    Members sort to the bottom, so the top of this list is everyone
--    worth inviting — and how much business they have already given you.
-- ---------------------------------------------------------------------
select
    b.contact_email,
    max(b.contact_name)                          as name,
    count(distinct b.booking_id)                 as reservations,
    min(b.created_at)::date                      as first_booked,
    max(b.created_at)::date                      as last_booked,
    sum(tk.fare_usd)::numeric(12,2)              as spent_usd,
    coalesce(m.member_number, 'not a member')    as membership
from public.bookings b
left join public.booking_segments bs on bs.booking_id = b.booking_id
left join public.tickets          tk on tk.segment_id  = bs.segment_id
left join public.ff_members       m  on lower(m.email) = lower(b.contact_email)
group by b.contact_email, m.member_id, m.member_number
order by (m.member_id is not null), count(distinct b.booking_id) desc, 6 desc;


-- ---------------------------------------------------------------------
-- 3. HOW CLOSE EACH MEMBER IS TO THE NEXT TIER.
--    Jade 0, Amber 25,000, Amethyst 60,000, Ruby 120,000 qualifying
--    miles. Ruby members show no target, because there isn't one.
-- ---------------------------------------------------------------------
select
    m.member_number,
    m.full_name,
    here.tier_name                                       as tier_now,
    m.qualifying_miles_ytd                               as qualifying,
    next.tier_name                                       as next_tier,
    next.qualifying_miles_required                       as needs,
    greatest(next.qualifying_miles_required - m.qualifying_miles_ytd, 0) as miles_to_go,
    round(
      100.0 * m.qualifying_miles_ytd
      / nullif(next.qualifying_miles_required, 0), 1)     as pct_of_next
from public.ff_members m
join public.ff_tiers here on here.tier_code = m.tier_code
left join public.ff_tiers next on next.tier_rank = here.tier_rank + 1
order by here.tier_rank desc, m.qualifying_miles_ytd desc;


-- ---------------------------------------------------------------------
-- 4. WHERE THE MILES CAME FROM, per member.
--    Every earn and every spend, newest first.
-- ---------------------------------------------------------------------
select
    m.member_number,
    m.full_name,
    x.occurred_at::timestamptz(0)                as occurred_at,
    x.txn_type,
    x.miles,
    x.qualifying_miles,
    x.distance_km,
    x.cabin_code,
    x.multiplier,
    x.tier_bonus_pct,
    x.description
from public.ff_transactions x
join public.ff_members m on m.member_id = x.member_id
order by x.occurred_at desc
limit 200;


-- ---------------------------------------------------------------------
-- 5. THE PROGRAMME AT A GLANCE.
-- ---------------------------------------------------------------------
select
    t.tier_rank,
    t.tier_name,
    t.qualifying_miles_required                  as threshold,
    t.earn_bonus_pct                             as bonus_pct,
    count(m.member_id)                           as members,
    coalesce(sum(m.balance_miles), 0)            as miles_outstanding,
    coalesce(sum(m.lifetime_miles), 0)           as miles_ever_earned
from public.ff_tiers t
left join public.ff_members m on m.tier_code = t.tier_code
group by t.tier_rank, t.tier_name, t.qualifying_miles_required, t.earn_bonus_pct
order by t.tier_rank;


-- ---------------------------------------------------------------------
-- 6. SIGNED UP BUT NEVER FLOWN.
--    Accounts with no booking against their email at all.
-- ---------------------------------------------------------------------
select m.member_number, m.full_name, m.email, m.joined_at::date as joined,
       m.balance_miles
from public.ff_members m
where not exists (
    select 1 from public.bookings b
     where lower(b.contact_email) = lower(m.email)
)
order by m.joined_at;
