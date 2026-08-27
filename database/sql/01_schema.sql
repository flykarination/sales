-- =====================================================================
--  KarinationGroup reservations database -- core schema
--  Target: Supabase (PostgreSQL 15+), schema "public"
--
--  Run the files in numeric order:
--    01_schema             tables, keys, indexes          (this file)
--    02_load_from_csv      the exported data
--    03_airports_backfill  real-world airport detail      (optional)
--    04_views              directional legs, search
--    05_reservations       bookings, passengers, tickets
--    06_demand_simulation  self-filling departures
--    07_rls_policies       row level security and the RPCs
--
--  Source of every table is the raw TAS export kept in
--  database/original_json/. See database/README.md for the mapping.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Reference / lookup tables
-- ---------------------------------------------------------------------

-- Every airport that appears anywhere in the exports. The exports carry
-- IATA codes only, so the descriptive columns start out NULL and can be
-- enriched later without touching any other table.
create table if not exists public.airports (
    iata_code           text primary key
                        check (iata_code ~ '^[A-Z]{3}$'),
    airport_name        text,
    city_name           text,
    country_code        text check (country_code ~ '^[A-Z]{2}$'),
    timezone            text,                       -- IANA name, e.g. 'Asia/Ho_Chi_Minh'
    utc_offset_minutes  integer check (utc_offset_minutes between -840 and 840),
    offset_source       text,                       -- how utc_offset_minutes was obtained
    latitude            double precision check (latitude between -90 and 90),
    longitude           double precision check (longitude between -180 and 180)
);

comment on table public.airports is
    'Airport dimension. Codes are derived from flights, hubs, fleet bases and codeshares; names/coordinates are not present in the source exports.';
comment on column public.airports.utc_offset_minutes is
    'Minutes east of UTC. Needed to render arrival times in local time -- all daily timestamps in this database are local to the *departure* airport.';

-- The three member carriers of KarinationGroup plus any outside carrier
-- referenced as a codeshare marketing partner (is_group_member = false,
-- name/code unknown because the exports carry only their uid).
create table if not exists public.airlines (
    uid                       uuid primary key,
    airline_code              text check (airline_code ~ '^[A-Z0-9]{2}$'),
    airline_name              text,
    airline_slug              text,                 -- source "airlineId", e.g. 'his-journey-bottom'
    airline_country           text check (airline_country ~ '^[A-Z]{2}$'),
    alliance                  text,
    flagship_aircraft_model   text,
    extra_special_livery_slot integer,
    version_string            text,
    claim_profit_time         timestamptz,
    is_group_member           boolean not null default false
);

comment on table public.airlines is
    'Carriers. uid is the TAS game identifier and the parent key for fleet, flights and codeshares.';

-- One IATA code may be reused by a marketing partner outside the group,
-- so the code is only unique among group members.
create unique index if not exists airlines_group_code_key
    on public.airlines (airline_code)
    where is_group_member;

create index if not exists airlines_alliance_idx
    on public.airlines (alliance) where alliance is not null;

-- Hubs. A flight may only start or end at a hub of its operator, unless it
-- is the second leg of a stopover (db_notes.md section 3.1).
create table if not exists public.airline_hubs (
    airline_uid  uuid not null references public.airlines (uid) on delete cascade,
    airport_iata text not null references public.airports (iata_code),
    is_major_hub boolean not null default false,
    primary key (airline_uid, airport_iata)
);

create index if not exists airline_hubs_airport_idx on public.airline_hubs (airport_iata);

-- One major hub per carrier (kxgroup_stats.majorHubAirport).
create unique index if not exists airline_hubs_one_major_key
    on public.airline_hubs (airline_uid) where is_major_hub;

-- Headline numbers reported by the game for each carrier. Kept separate
-- from airlines because it is a snapshot that changes on its own cadence.
create table if not exists public.airline_stats (
    airline_uid             uuid primary key references public.airlines (uid) on delete cascade,
    num_aircraft            integer check (num_aircraft >= 0),
    num_routes              integer check (num_routes >= 0),
    num_flights             integer check (num_flights >= 0),
    flagship_aircraft_model text,
    major_hub_iata          text references public.airports (iata_code),
    last_online_time        timestamptz
);

comment on table public.airline_stats is
    'Snapshot counters from kxgroup_stats.json. Karination/fleet_summary.json holds an older copy of the same three rows and is not loaded.';

create table if not exists public.aircraft_models (
    aircraft_model text primary key,
    manufacturer   text
);

comment on table public.aircraft_models is
    'Distinct aircraftModel values. manufacturer is the leading token of the model name.';

-- Fixed four-cabin ladder used by the whole game. source_key_prefix records
-- which JSON key the seats/price came from ("bizPax" -> BUSINESS, etc).
create table if not exists public.cabin_classes (
    cabin_code       text primary key,
    cabin_name       text not null,
    sort_order       smallint not null unique,
    source_key_prefix text not null unique
);

-- ---------------------------------------------------------------------
-- Fleet
-- ---------------------------------------------------------------------

create table if not exists public.aircraft (
    aircraft_id            uuid primary key,
    airline_uid            uuid not null references public.airlines (uid) on delete cascade,
    aircraft_model         text not null references public.aircraft_models (aircraft_model),
    registration           text not null unique,
    delivery_date          timestamptz,
    hub_airport_iata       text references public.airports (iata_code),

    -- cabin split; the four ratios sum to 1 for every row in the export
    eco_ratio              double precision check (eco_ratio      between 0 and 1),
    prem_eco_ratio         double precision check (prem_eco_ratio between 0 and 1),
    biz_ratio              double precision check (biz_ratio      between 0 and 1),
    first_ratio            double precision check (first_ratio    between 0 and 1),
    constraint aircraft_ratio_sum_check check (
        coalesce(eco_ratio, 0) + coalesce(prem_eco_ratio, 0)
      + coalesce(biz_ratio, 0) + coalesce(first_ratio, 0) between 0.999 and 1.001
    ),

    -- product / comfort, shown on the booking page
    eco_product            text,
    prem_eco_product       text,
    biz_product            text,
    first_product          text,
    eco_config_type        text,
    eco_pitch              smallint check (eco_pitch      >= 0),
    prem_eco_pitch         smallint check (prem_eco_pitch >= 0),
    biz_pitch              smallint check (biz_pitch      >= 0),
    first_pitch            smallint check (first_pitch    >= 0),

    -- cosmetic / game bookkeeping
    engine_option          text,
    winglet_option         text,
    eyemask_option         text,
    livery_config_id       uuid,
    background_image_index integer,
    weekly_flight_time     integer
);

comment on table public.aircraft is
    'One row per physical airframe (fleet_detail.json). registration doubles as a human-readable key.';
comment on column public.aircraft.hub_airport_iata is
    'Base of the airframe. NULL where the export carried the sentinel "EMPTY" (undeployed aircraft).';

create index if not exists aircraft_airline_idx on public.aircraft (airline_uid);
create index if not exists aircraft_model_idx   on public.aircraft (aircraft_model);
create index if not exists aircraft_hub_idx     on public.aircraft (hub_airport_iata);

-- ---------------------------------------------------------------------
-- Schedule
-- ---------------------------------------------------------------------

-- A row here is a *flight pair*: one outbound leg origin -> destination and
-- one inbound leg destination -> origin, sold under two flight numbers.
-- Directional legs for the booking engine live in the view v_flight_legs.
create table if not exists public.flights (
    flight_id                 uuid primary key,
    airline_uid               uuid not null references public.airlines (uid) on delete cascade,
    outbound_flight_number    integer not null check (outbound_flight_number between 1 and 9999),
    inbound_flight_number     integer not null check (inbound_flight_number  between 1 and 9999),
    flight_string             text,
    origin_iata               text not null references public.airports (iata_code),
    destination_iata          text not null references public.airports (iata_code),

    -- local clock at origin_iata, seconds after midnight. Values of 86400 and
    -- above occur on stopover second legs and mean "the following day"
    -- relative to the parent leg's departure day.
    departure_daily_seconds   integer not null
                              check (departure_daily_seconds >= 0
                                 and departure_daily_seconds < 172800),
    outbound_duration_minutes integer not null check (outbound_duration_minutes > 0),
    inbound_duration_minutes  integer not null check (inbound_duration_minutes  > 0),
    turnaround_offset_minutes numeric(8,4) not null default 0,

    is_stopover               boolean not null default false,
    child_stopover_flight_id  uuid,

    constraint flights_endpoints_differ check (origin_iata <> destination_iata),
    constraint flights_child_requires_stopover check (
        child_stopover_flight_id is null or is_stopover
    ),
    constraint flights_no_self_child check (child_stopover_flight_id <> flight_id),
    constraint flights_child_fkey foreign key (child_stopover_flight_id)
        references public.flights (flight_id)
        deferrable initially deferred
);

comment on table public.flights is
    'Flight pairs from flights_list.json. Each row yields two directional legs; see v_flight_legs.';
comment on column public.flights.departure_daily_seconds is
    'Outbound departure, seconds after local midnight at origin_iata. >= 86400 means the next day (stopover second legs only).';
comment on column public.flights.child_stopover_flight_id is
    'Second leg of a stopover. The child keeps the same flight numbers and departs from this row''s destination.';
comment on column public.flights.flight_string is
    'Raw route label from the export. Its two ends are not consistently ordered -- use origin_iata / destination_iata.';

-- The same flight number is reused by the two legs of a stopover, so the
-- number alone is not unique; the number plus the city pair is.
create unique index if not exists flights_carrier_number_route_key
    on public.flights (airline_uid, outbound_flight_number, origin_iata, destination_iata);

create index if not exists flights_origin_dest_idx  on public.flights (origin_iata, destination_iata);
create index if not exists flights_dest_origin_idx  on public.flights (destination_iata, origin_iata);
create index if not exists flights_airline_idx      on public.flights (airline_uid);
create index if not exists flights_outbound_num_idx on public.flights (airline_uid, outbound_flight_number);
create index if not exists flights_inbound_num_idx  on public.flights (airline_uid, inbound_flight_number);
-- lets a second leg find its parent
create index if not exists flights_child_idx
    on public.flights (child_stopover_flight_id) where child_stopover_flight_id is not null;

-- Which airframe works a flight pair. aircraftAssignments in the source is an
-- object keyed by aircraftId, so (flight, aircraft) is the natural key.
create table if not exists public.flight_assignments (
    flight_id               uuid not null references public.flights (flight_id) on delete cascade,
    aircraft_id             uuid not null references public.aircraft (aircraft_id) on delete cascade,
    -- length of the source dowList; the divisor behind flight_fares.seats_per_departure
    operating_days_per_week smallint not null default 0
                            check (operating_days_per_week between 0 and 7),
    flight_profit           integer,
    primary key (flight_id, aircraft_id)
);

comment on table public.flight_assignments is
    'Aircraft rostered onto a flight pair. Several airframes may share one pair, each covering different weekdays.';
comment on column public.flight_assignments.operating_days_per_week is
    'Must equal the number of rows this assignment has in flight_assignment_days; both are written by the same ETL pass.';
comment on column public.flight_assignments.flight_profit is
    'Weekly profit for the whole rotation (both directions, all operating days), exactly as exported.';

create index if not exists flight_assignments_aircraft_idx on public.flight_assignments (aircraft_id);

-- dowList exploded: 0 = Monday ... 6 = Sunday.
create table if not exists public.flight_assignment_days (
    flight_id   uuid not null,
    aircraft_id uuid not null,
    day_of_week smallint not null check (day_of_week between 0 and 6),
    primary key (flight_id, aircraft_id, day_of_week),
    foreign key (flight_id, aircraft_id)
        references public.flight_assignments (flight_id, aircraft_id) on delete cascade
);

comment on table public.flight_assignment_days is
    'Operating weekdays per aircraft assignment. 0 = Monday, 6 = Sunday.';

-- A flight pair can only be worked by one airframe on a given weekday.
create unique index if not exists flight_assignment_days_one_aircraft_key
    on public.flight_assignment_days (flight_id, day_of_week);

create index if not exists flight_assignment_days_dow_idx on public.flight_assignment_days (day_of_week);

-- Seats on sale and price per cabin, per aircraft assignment. Replaces the
-- eight wide columns (bizPax/bizPrice/...) of the source object.
create table if not exists public.flight_fares (
    flight_id             uuid not null,
    aircraft_id           uuid not null,
    cabin_code            text not null references public.cabin_classes (cabin_code),
    weekly_seats_for_sale integer not null default 0 check (weekly_seats_for_sale >= 0),
    seats_per_departure   integer not null default 0 check (seats_per_departure >= 0),
    price_usd             integer not null default 0 check (price_usd >= 0),
    primary key (flight_id, aircraft_id, cabin_code),
    foreign key (flight_id, aircraft_id)
        references public.flight_assignments (flight_id, aircraft_id) on delete cascade
);

comment on table public.flight_fares is
    'Per-cabin inventory and price for one aircraft assignment.';
comment on column public.flight_fares.weekly_seats_for_sale is
    'The exported *Pax figure, verbatim: seats pooled across the whole week AND both directions.';
comment on column public.flight_fares.seats_per_departure is
    'Seats on one leg on one operating day: round(weekly_seats_for_sale / (operating_days_per_week * 2)), half up. Sell against this.';
comment on column public.flight_fares.price_usd is
    'One-way price in whole US dollars for this cabin.';

create index if not exists flight_fares_cabin_price_idx on public.flight_fares (cabin_code, price_usd);
create index if not exists flight_fares_flight_idx      on public.flight_fares (flight_id);

-- ---------------------------------------------------------------------
-- Codeshares
-- ---------------------------------------------------------------------

create table if not exists public.codeshares (
    codeshare_id                     uuid primary key,
    operating_flight_id              uuid not null references public.flights (flight_id) on delete cascade,
    operating_airline_uid            uuid not null references public.airlines (uid),
    marketing_airline_uid            uuid not null references public.airlines (uid),
    marketing_outbound_flight_number integer check (marketing_outbound_flight_number between 1 and 9999),
    marketing_inbound_flight_number  integer check (marketing_inbound_flight_number  between 1 and 9999),
    operating_carrier_profit         integer,
    marketing_carrier_profit         integer,
    origin_iata                      text references public.airports (iata_code),
    destination_iata                 text references public.airports (iata_code),
    constraint codeshares_distinct_carriers check (operating_airline_uid <> marketing_airline_uid),
    constraint codeshares_one_per_partner unique (operating_flight_id, marketing_airline_uid)
);

comment on table public.codeshares is
    'Seats on an operated flight resold by a partner carrier. Display as "operated by <operating airline>".';

create index if not exists codeshares_marketing_idx on public.codeshares (marketing_airline_uid);
create index if not exists codeshares_flight_idx    on public.codeshares (operating_flight_id);

commit;
