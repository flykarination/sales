-- =====================================================================
--  KarinationGroup -- lock the operations data
--
--  07_rls_policies.sql made departure_inventory and demand_events world
--  readable, which also makes every load factor and revenue figure
--  readable by anyone with the publishable key. The ops dashboard is
--  meant for the operator alone, so this file closes that.
--
--  Two things have to keep working afterwards:
--    * the booking page still needs live seat counts   -> kx_available_seats
--      becomes SECURITY DEFINER, so it reads the table on the caller's
--      behalf without granting the caller the table itself
--    * the operator's dashboard still needs the numbers -> ops_snapshot()
--      and ops_recent_sales() return them in exchange for a shared token
--
--  Run after 07_rls_policies.sql.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Take the simulation tables back off the public API
-- ---------------------------------------------------------------------

drop policy if exists departure_inventory_public_read on public.departure_inventory;
drop policy if exists demand_events_public_read       on public.demand_events;

revoke all on public.departure_inventory from anon, authenticated;
revoke all on public.demand_events       from anon, authenticated;

-- The views over them are only as readable as their base tables
-- (security_invoker = on), but revoke explicitly so the intent is on record.
revoke all on public.v_departure_load       from anon, authenticated;
revoke all on public.v_management_dashboard from anon, authenticated;
revoke all on public.v_recent_sales         from anon, authenticated;

-- ---------------------------------------------------------------------
-- Keep "3 seats left" working on the public booking page
-- ---------------------------------------------------------------------

-- Same body as in 06, but definer rights: a passenger may learn how many
-- seats remain on one departure without being able to read the table and
-- harvest the whole network's load factors.
create or replace function public.kx_available_seats(
    p_flight_id   uuid,
    p_aircraft_id uuid,
    p_direction   text,
    p_date        date,
    p_cabin       text
) returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(
        (select di.capacity_seats - di.simulated_seats_sold - di.booked_seats
           from public.departure_inventory di
          where di.flight_id = p_flight_id and di.aircraft_id = p_aircraft_id
            and di.direction = p_direction and di.travel_date = p_date
            and di.cabin_code = p_cabin),
        (select fr.seats_per_departure
           from public.flight_fares fr
          where fr.flight_id = p_flight_id and fr.aircraft_id = p_aircraft_id
            and fr.cabin_code = p_cabin),
        0);
$$;

grant execute on function public.kx_available_seats(uuid, uuid, text, date, text)
    to anon, authenticated;

-- ---------------------------------------------------------------------
-- A private corner for operator secrets
-- ---------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from anon, authenticated, public;

create table if not exists private.app_secrets (
    key        text primary key,
    value      text not null,
    created_at timestamptz not null default now()
);

revoke all on private.app_secrets from anon, authenticated, public;

-- Mint an ops token once and leave it alone on re-runs.
insert into private.app_secrets (key, value)
values ('ops_token', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

comment on table private.app_secrets is
    'Operator secrets. Not in the public schema, so PostgREST never exposes it. Read the ops token with: select value from private.app_secrets where key = ''ops_token'';';

-- ---------------------------------------------------------------------
-- The operator's two doors
-- ---------------------------------------------------------------------

-- Supabase installs pgcrypto into "extensions", so digest() has to be reachable
-- from this function's own search_path -- a SECURITY DEFINER function does not
-- inherit the caller's.
create or replace function public.kx_check_ops_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = private, extensions, pg_temp
as $$
    -- compare digests rather than the raw values, so a wrong guess cannot be
    -- narrowed down by how long the comparison took
    select exists (
        select 1 from private.app_secrets s
        where s.key = 'ops_token'
          and encode(extensions.digest(s.value, 'sha256'), 'hex')
            = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    );
$$;

revoke all on function public.kx_check_ops_token(text) from public, anon, authenticated;

create or replace function public.ops_snapshot(p_token text)
returns setof public.v_management_dashboard
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.kx_check_ops_token(p_token) then
        raise exception 'not authorised' using errcode = 'insufficient_privilege';
    end if;
    return query select * from public.v_management_dashboard;
end;
$$;

create or replace function public.ops_recent_sales(p_token text)
returns setof public.v_recent_sales
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.kx_check_ops_token(p_token) then
        raise exception 'not authorised' using errcode = 'insufficient_privilege';
    end if;
    return query select * from public.v_recent_sales;
end;
$$;

create or replace function public.ops_departure_load(p_token text, p_limit integer default 200)
returns setof public.v_departure_load
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.kx_check_ops_token(p_token) then
        raise exception 'not authorised' using errcode = 'insufficient_privilege';
    end if;
    return query
    select * from public.v_departure_load
    order by load_factor_pct desc
    limit least(greatest(p_limit, 1), 500);
end;
$$;

grant execute on function public.ops_snapshot(text)                to anon, authenticated;
grant execute on function public.ops_recent_sales(text)            to anon, authenticated;
grant execute on function public.ops_departure_load(text, integer) to anon, authenticated;

comment on function public.ops_snapshot(text) is
    'Operator dashboard data. Requires the ops token from private.app_secrets; the route that calls it is compiled out of production builds.';

commit;

-- =====================================================================
--  After applying, put the token in the dev environment only:
--
--    psql "$KX_DB_URL" -t -A \
--      -c "select 'VITE_OPS_TOKEN=' || value from private.app_secrets
--            where key = 'ops_token'" >> web/.env.local
--
--  .env.local is gitignored and is never read by a production build, so
--  the token cannot reach the bundle your friends download.
--
--  Verify the lock:
--    set role anon;
--    select count(*) from public.departure_inventory;   -- permission denied
--    select public.kx_available_seats(...);             -- still works
--    select * from public.ops_snapshot('wrong');        -- not authorised
--    reset role;
-- =====================================================================
