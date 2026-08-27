-- =====================================================================
--  RainbowOne -- Karination's frequent flyer programme
--
--  Four tiers named for the four cabin hues, so the loyalty colours and
--  the cabin colours are one vocabulary:
--
--      JADE      teal      entry
--      AMBER     amber
--      AMETHYST  violet
--      RUBY      magenta   top
--
--  Members earn on DISTANCE x CABIN MULTIPLIER. The multiplier lives in
--  its own table keyed by (cabin, fare product), with a NULL fare product
--  meaning "any fare in this cabin" -- so when fare_products is populated
--  later, a Flex fare can earn differently from a Basic one without a
--  schema change.
--
--  Identity is the email address. A member signs up with email and
--  password through Supabase Auth, which creates a row in auth.users;
--  the trigger below mirrors that into ff_members. Because bookings are
--  also email-keyed, a member who checks out as a guest with their own
--  address is credited automatically.
--
--  Earning starts at launch. Nothing is retro-credited.
--
--  Run after 08_lock_simulation.sql.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Distance, for earning
-- ---------------------------------------------------------------------

-- Great-circle distance between two airports, in kilometres. Haversine on
-- the coordinates already loaded into public.airports.
create or replace function public.kx_distance_km(p_from text, p_to text)
returns integer
language sql
stable
parallel safe
as $$
    select case
        when a.latitude is null or b.latitude is null then null
        else round(
            6371 * 2 * asin(sqrt(
                power(sin(radians(b.latitude - a.latitude) / 2), 2)
              + cos(radians(a.latitude)) * cos(radians(b.latitude))
              * power(sin(radians(b.longitude - a.longitude) / 2), 2)
            ))
        )::integer
    end
    from public.airports a, public.airports b
    where a.iata_code = upper(p_from) and b.iata_code = upper(p_to);
$$;

comment on function public.kx_distance_km(text, text) is
    'Great-circle distance in km between two airports. NULL if either lacks coordinates.';

-- ---------------------------------------------------------------------
-- Tiers
-- ---------------------------------------------------------------------

create table if not exists public.ff_tiers (
    tier_code                 text primary key,
    tier_name                 text not null,
    tier_rank                 smallint not null unique check (tier_rank between 1 and 9),
    -- qualifying miles needed in a membership year to hold this tier
    qualifying_miles_required integer not null check (qualifying_miles_required >= 0),
    -- extra miles earned, as a percentage on top of the base calculation
    earn_bonus_pct            numeric(5,2) not null default 0 check (earn_bonus_pct >= 0),
    -- the design token this tier shares with its cabin
    hue_token                 text not null,
    tagline                   text,
    perks                     jsonb not null default '[]'::jsonb
);

comment on table public.ff_tiers is
    'RainbowOne tiers, lowest rank first. hue_token matches the cabin colour tokens in the web app.';

insert into public.ff_tiers
    (tier_code, tier_name, tier_rank, qualifying_miles_required, earn_bonus_pct, hue_token, tagline, perks)
values
    ('JADE', 'Jade', 1, 0, 0,
     '--color-spectrum-teal',
     'Where every RainbowOne journey begins.',
     '["Earn miles on every Karination flight", "Manage bookings in one place"]'::jsonb),
    ('AMBER', 'Amber', 2, 25000, 25,
     '--color-spectrum-amber',
     'Warmer welcomes, sooner.',
     '["25% bonus miles", "Priority check-in", "Extra checked bag"]'::jsonb),
    ('AMETHYST', 'Amethyst', 3, 60000, 50,
     '--color-spectrum-violet',
     'The colour of the long haul.',
     '["50% bonus miles", "Lounge access", "Priority boarding", "Two extra checked bags"]'::jsonb),
    ('RUBY', 'Ruby', 4, 120000, 100,
     '--color-spectrum-magenta',
     'Our brightest colour, for our furthest flyers.',
     '["Double miles", "Guaranteed Business upgrade space", "Lounge access with a guest", "First boarding"]'::jsonb)
on conflict (tier_code) do update
    set tier_name = excluded.tier_name,
        tier_rank = excluded.tier_rank,
        qualifying_miles_required = excluded.qualifying_miles_required,
        earn_bonus_pct = excluded.earn_bonus_pct,
        hue_token = excluded.hue_token,
        tagline = excluded.tagline,
        perks = excluded.perks;

-- ---------------------------------------------------------------------
-- Earn rates
-- ---------------------------------------------------------------------

-- One row per (cabin, fare product). fare_product_id NULL is the default
-- for that cabin and is what applies today, since fare_products is empty.
create table if not exists public.ff_earn_rates (
    earn_rate_id    uuid primary key default gen_random_uuid(),
    cabin_code      text not null references public.cabin_classes (cabin_code),
    fare_product_id uuid references public.fare_products (fare_product_id) on delete cascade,
    multiplier      numeric(6,3) not null check (multiplier >= 0),
    -- qualifying miles can differ from earned miles; a discounted fare might
    -- earn spendable miles but count less towards tier
    qualifying_multiplier numeric(6,3) not null default 1.0 check (qualifying_multiplier >= 0),
    valid_from      date not null default current_date,
    valid_to        date,
    constraint ff_earn_rates_window check (valid_to is null or valid_to >= valid_from)
);

-- exactly one default per cabin, and one override per cabin+product
create unique index if not exists ff_earn_rates_cabin_default_key
    on public.ff_earn_rates (cabin_code) where fare_product_id is null and valid_to is null;
create unique index if not exists ff_earn_rates_cabin_product_key
    on public.ff_earn_rates (cabin_code, fare_product_id) where valid_to is null;

comment on table public.ff_earn_rates is
    'Miles per kilometre flown. A NULL fare_product_id is the cabin default; add a row with a fare_product_id to tune a specific fare later.';

insert into public.ff_earn_rates (cabin_code, fare_product_id, multiplier, qualifying_multiplier)
values ('ECONOMY', null, 1.000, 1.000),
       ('PREMIUM_ECONOMY', null, 1.500, 1.250),
       ('BUSINESS', null, 2.000, 1.500),
       ('FIRST', null, 3.000, 2.000)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Members
--
-- user_id points at Supabase Auth. The email is duplicated here on purpose:
-- it is the join key to guest bookings, and it must survive even if the
-- auth user is later deleted.
-- ---------------------------------------------------------------------

create table if not exists public.ff_members (
    member_id            uuid primary key default gen_random_uuid(),
    user_id              uuid unique,
    member_number        text not null unique check (member_number ~ '^RO[0-9]{8}$'),
    email                text not null unique
                         check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    full_name            text,
    tier_code            text not null default 'JADE' references public.ff_tiers (tier_code),
    tier_since           date not null default current_date,
    -- spendable balance
    balance_miles        integer not null default 0 check (balance_miles >= 0),
    -- never decreases; the lifetime record
    lifetime_miles       integer not null default 0 check (lifetime_miles >= 0),
    -- counts towards the next tier, resets each membership year
    qualifying_miles_ytd integer not null default 0 check (qualifying_miles_ytd >= 0),
    year_started_on      date not null default current_date,
    marketing_opt_in     boolean not null default false,
    joined_at            timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

comment on table public.ff_members is
    'RainbowOne membership. Identified by email; linked to a Supabase Auth user when one exists.';

create index if not exists ff_members_email_idx on public.ff_members (lower(email));
create index if not exists ff_members_tier_idx  on public.ff_members (tier_code);

do $$
begin
    if exists (select 1 from information_schema.tables
               where table_schema = 'auth' and table_name = 'users')
       and not exists (select 1 from pg_constraint where conname = 'ff_members_user_fkey')
    then
        alter table public.ff_members
            add constraint ff_members_user_fkey
            foreign key (user_id) references auth.users (id) on delete set null;
    end if;
end $$;

-- RO + 8 digits, retried on collision
create or replace function public.kx_generate_member_number()
returns text language plpgsql volatile as $$
declare candidate text;
begin
    for _attempt in 1 .. 50 loop
        candidate := 'RO' || lpad((floor(random() * 100000000))::bigint::text, 8, '0');
        if not exists (select 1 from public.ff_members m where m.member_number = candidate) then
            return candidate;
        end if;
    end loop;
    raise exception 'could not allocate a free RainbowOne number';
end;
$$;

-- ---------------------------------------------------------------------
-- The ledger
-- ---------------------------------------------------------------------

create table if not exists public.ff_transactions (
    txn_id            uuid primary key default gen_random_uuid(),
    member_id         uuid not null references public.ff_members (member_id) on delete cascade,
    segment_id        uuid references public.booking_segments (segment_id) on delete set null,
    txn_type          text not null check (txn_type in
                        ('EARN_FLIGHT', 'EARN_BONUS', 'REDEEM', 'ADJUST', 'EXPIRE')),
    miles             integer not null,               -- signed: earning positive, spending negative
    qualifying_miles  integer not null default 0,
    -- how the number was arrived at, kept so a member can see the working
    distance_km       integer,
    cabin_code        text references public.cabin_classes (cabin_code),
    multiplier        numeric(6,3),
    tier_bonus_pct    numeric(5,2),
    description       text not null,
    occurred_at       timestamptz not null default now()
);

comment on table public.ff_transactions is
    'Every miles movement, with the distance and multiplier that produced it.';

create index if not exists ff_transactions_member_idx
    on public.ff_transactions (member_id, occurred_at desc);
-- one earning row per segment per member
create unique index if not exists ff_transactions_segment_key
    on public.ff_transactions (member_id, segment_id)
    where segment_id is not null and txn_type = 'EARN_FLIGHT';

-- ---------------------------------------------------------------------
-- Signing up
-- ---------------------------------------------------------------------

-- Mirror a new Supabase Auth user into a RainbowOne membership. If the
-- address already has a membership (they booked as a guest first, then
-- joined) the existing row is claimed rather than duplicated.
create or replace function public.handle_new_ff_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_email text := lower(trim(new.email));
    v_name  text := coalesce(new.raw_user_meta_data ->> 'full_name',
                             new.raw_user_meta_data ->> 'name');
begin
    if v_email is null or v_email = '' then
        return new;
    end if;

    update public.ff_members
       set user_id = new.id,
           full_name = coalesce(full_name, v_name),
           updated_at = now()
     where lower(email) = v_email and user_id is null;

    if not found then
        insert into public.ff_members (user_id, member_number, email, full_name)
        values (new.id, public.kx_generate_member_number(), v_email, v_name)
        on conflict (email) do update
            set user_id = excluded.user_id,
                full_name = coalesce(public.ff_members.full_name, excluded.full_name),
                updated_at = now();
    end if;

    return new;
end;
$$;

do $$
begin
    if exists (select 1 from information_schema.tables
               where table_schema = 'auth' and table_name = 'users') then
        drop trigger if exists on_auth_user_created on auth.users;
        create trigger on_auth_user_created
            after insert on auth.users
            for each row execute function public.handle_new_ff_member();
    end if;
end $$;

-- ---------------------------------------------------------------------
-- Earning
-- ---------------------------------------------------------------------

-- Credit a member for one flown segment. Called by the trigger below, and
-- safe to call again: the unique index makes a second attempt a no-op.
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
    select s.*, b.contact_email
      into seg
      from public.booking_segments s
      join public.bookings b using (booking_id)
     where s.segment_id = p_segment_id;
    if not found then return 0; end if;

    select * into v_member from public.ff_members
     where lower(email) = lower(seg.contact_email);
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

-- Promote a member as soon as they cross a threshold. Demotion happens on
-- the membership-year rollover, not the moment a balance is spent.
create or replace function public.kx_reassess_tier(p_member_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_tier text; v_current text;
begin
    select tier_code into v_current from public.ff_members where member_id = p_member_id;

    select t.tier_code into v_tier
      from public.ff_members m
      join public.ff_tiers t on t.qualifying_miles_required <= m.qualifying_miles_ytd
     where m.member_id = p_member_id
     order by t.tier_rank desc
     limit 1;

    if v_tier is not null and v_tier is distinct from v_current then
        update public.ff_members
           set tier_code = v_tier, tier_since = current_date, updated_at = now()
         where member_id = p_member_id
           and (select tier_rank from public.ff_tiers where tier_code = v_tier)
             > (select tier_rank from public.ff_tiers where tier_code = v_current);
    end if;

    return coalesce(v_tier, v_current);
end;
$$;

create or replace function public.kx_segment_earn_miles()
returns trigger language plpgsql as $$
begin
    perform public.kx_credit_segment(new.segment_id);
    return null;
end;
$$;

drop trigger if exists booking_segments_earn_miles on public.booking_segments;
create trigger booking_segments_earn_miles
    after insert on public.booking_segments
    for each row execute function public.kx_segment_earn_miles();

-- ---------------------------------------------------------------------
-- What a member sees
-- ---------------------------------------------------------------------

create or replace view public.v_ff_account
with (security_invoker = on) as
select
    m.member_id,
    m.user_id,
    m.member_number,
    m.email,
    m.full_name,
    m.balance_miles,
    m.lifetime_miles,
    m.qualifying_miles_ytd,
    m.joined_at,
    t.tier_code,
    t.tier_name,
    t.tier_rank,
    t.hue_token,
    t.tagline,
    t.perks,
    t.earn_bonus_pct,
    next_t.tier_code as next_tier_code,
    next_t.tier_name as next_tier_name,
    greatest(next_t.qualifying_miles_required - m.qualifying_miles_ytd, 0) as miles_to_next_tier
from public.ff_members m
join public.ff_tiers t on t.tier_code = m.tier_code
left join public.ff_tiers next_t on next_t.tier_rank = t.tier_rank + 1;

comment on view public.v_ff_account is
    'One row per member: tier, balances, and how far to the next tier.';

-- ---------------------------------------------------------------------
-- Security: a member sees themselves and nobody else
-- ---------------------------------------------------------------------

alter table public.ff_tiers        enable row level security;
alter table public.ff_earn_rates   enable row level security;
alter table public.ff_members      enable row level security;
alter table public.ff_transactions enable row level security;

drop policy if exists ff_tiers_public_read on public.ff_tiers;
create policy ff_tiers_public_read on public.ff_tiers
    for select to anon, authenticated using (true);

drop policy if exists ff_earn_rates_public_read on public.ff_earn_rates;
create policy ff_earn_rates_public_read on public.ff_earn_rates
    for select to anon, authenticated using (true);

-- signed in, and only your own row
drop policy if exists ff_members_self_read on public.ff_members;
create policy ff_members_self_read on public.ff_members
    for select to authenticated using (user_id = auth.uid());

drop policy if exists ff_members_self_update on public.ff_members;
create policy ff_members_self_update on public.ff_members
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists ff_txn_self_read on public.ff_transactions;
create policy ff_txn_self_read on public.ff_transactions
    for select to authenticated using (
        member_id in (select member_id from public.ff_members where user_id = auth.uid())
    );

grant select on public.ff_tiers, public.ff_earn_rates to anon, authenticated;
grant select on public.ff_members, public.ff_transactions, public.v_ff_account to authenticated;
grant update (full_name, marketing_opt_in) on public.ff_members to authenticated;
revoke all on public.ff_members, public.ff_transactions from anon;

commit;

-- =====================================================================
--  Before this works end to end
--
--  1. Supabase → Authentication → Providers → Email must be enabled.
--  2. For a game, turn OFF "Confirm email" under Authentication →
--     Sign In / Providers, or nobody can join without a real inbox.
--  3. Sign-up from the app; the trigger mints the RO number automatically.
--
--  Check it:
--    select tier_code, tier_name, qualifying_miles_required, earn_bonus_pct
--      from public.ff_tiers order by tier_rank;
--    select public.kx_distance_km('SGN','KGD');    -- ~8,600 km
-- =====================================================================
