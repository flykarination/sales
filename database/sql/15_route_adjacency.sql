-- =====================================================================
-- 15. Materialised route adjacency
--
-- v_routes aggregates the whole flights table to produce 1,508 rows and
-- costs ~376ms every time it is touched. The connection search joins it
-- up to three times just to work out which airports are worth looking
-- at, so that alone was a second of work before a single timetable row
-- was read.
--
-- The adjacency itself -- which airport reaches which -- only changes
-- when the schedule changes, which for this airline is when the game
-- data is reloaded. So it is materialised and indexed both ways.
-- Rebuild it with kx_refresh_route_adjacency() after any schedule load.
-- =====================================================================

begin;

drop materialized view if exists public.mv_route_adjacency cascade;

create materialized view public.mv_route_adjacency as
select distinct
    f.origin_iata      as o,
    f.destination_iata as d
from public.v_routes f;

create unique index mv_route_adjacency_pk on public.mv_route_adjacency (o, d);
create index mv_route_adjacency_o on public.mv_route_adjacency (o);
create index mv_route_adjacency_d on public.mv_route_adjacency (d);

comment on materialized view public.mv_route_adjacency is
    'Directed airport adjacency, one row per served city pair. Rebuilt by '
    'kx_refresh_route_adjacency() after a schedule reload.';

grant select on public.mv_route_adjacency to anon, authenticated;

create or replace function public.kx_refresh_route_adjacency()
returns void language sql security definer set search_path = public as $$
    refresh materialized view concurrently public.mv_route_adjacency;
$$;

comment on function public.kx_refresh_route_adjacency() is
    'Rebuild mv_route_adjacency. Run after loading a new schedule.';

commit;
