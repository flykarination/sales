-- =====================================================================
--  KarinationGroup reservations database -- booking layer
--
--  Nothing here comes from the TAS export; these are the tables the
--  reservations site writes to. Bookings are keyed by contact email, not
--  by a Supabase auth user, so the site can sell without accounts.
--
--  Fare products and ancillaries are deliberately empty stubs: the keys
--  and joins exist, so adding a "Flex" fare or a checked bag later is an
--  INSERT rather than a migration.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Extension points (empty on purpose)
-- ---------------------------------------------------------------------

-- Branded fares sitting on top of a cabin: Basic / Standard / Flex ...
create table if not exists public.fare_products (
    fare_product_id  uuid primary key default gen_random_uuid(),
    cabin_code       text not null references public.cabin_classes (cabin_code),
    product_code     text not null,
    product_name     text not null,
    -- what the passenger gets
    checked_bags     smallint not null default 0 check (checked_bags >= 0),
    carry_on_bags    smallint not null default 1 check (carry_on_bags >= 0),
    seat_selection   boolean  not null default false,
    is_refundable    boolean  not null default false,
    is_changeable    boolean  not null default false,
    change_fee_usd   numeric(10,2) not null default 0 check (change_fee_usd >= 0),
    -- applied to flight_fares.price_usd; 1.0 keeps the exported price
    price_multiplier numeric(6,3) not null default 1.0 check (price_multiplier > 0),
    price_delta_usd  numeric(10,2) not null default 0,
    sort_order       smallint not null default 0,
    is_active        boolean not null default true,
    unique (cabin_code, product_code)
);

comment on table public.fare_products is
    'STUB, intentionally empty. db_notes.md: "There are no add-ons or flexible fare classes within this virtual world, however I might add some at my own discretion."';

-- Paid extras: bags, seats, meals, lounge ...
create table if not exists public.ancillaries (
    ancillary_id   uuid primary key default gen_random_uuid(),
    ancillary_code text not null unique,
    ancillary_name text not null,
    category       text not null check (category in
                       ('BAGGAGE', 'SEAT', 'MEAL', 'LOUNGE', 'INSURANCE', 'OTHER')),
    -- what one unit attaches to
    scope          text not null default 'SEGMENT'
                   check (scope in ('BOOKING', 'SEGMENT', 'PASSENGER', 'PASSENGER_SEGMENT')),
    price_usd      numeric(10,2) not null default 0 check (price_usd >= 0),
    max_quantity   smallint not null default 1 check (max_quantity > 0),
    is_active      boolean not null default true
);

comment on table public.ancillaries is 'STUB, intentionally empty. See fare_products.';

-- ---------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------

create table if not exists public.bookings (
    booking_id       uuid primary key default gen_random_uuid(),
    pnr              text not null unique check (pnr ~ '^[A-Z0-9]{6}$'),
    contact_email    text not null check (contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    contact_name     text,
    contact_phone    text,
    status           text not null default 'CONFIRMED'
                     check (status in ('HELD', 'CONFIRMED', 'CANCELLED', 'FLOWN')),
    currency         text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
    total_amount_usd numeric(12,2) not null default 0 check (total_amount_usd >= 0),
    held_until       timestamptz,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    cancelled_at     timestamptz,
    constraint bookings_cancel_time check (
        (status = 'CANCELLED') = (cancelled_at is not null)
    )
);

comment on table public.bookings is
    'One reservation. Identified to the passenger by pnr; looked up by pnr + contact_email.';

create index if not exists bookings_email_idx  on public.bookings (lower(contact_email));
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_created_idx on public.bookings (created_at desc);

-- Six characters, no vowels (avoids accidental words) and no 0/1/I/O.
create or replace function public.kx_generate_pnr()
returns text language plpgsql volatile as $$
declare
    alphabet constant text := 'BCDFGHJKLMNPQRSTVWXYZ23456789';
    candidate text;
begin
    for _attempt in 1 .. 50 loop
        candidate := '';
        for _i in 1 .. 6 loop
            candidate := candidate ||
                substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
        end loop;
        if not exists (select 1 from public.bookings b where b.pnr = candidate) then
            return candidate;
        end if;
    end loop;
    raise exception 'could not allocate a free PNR after 50 attempts';
end;
$$;

create or replace function public.kx_bookings_before_write()
returns trigger language plpgsql as $$
begin
    if tg_op = 'INSERT' and (new.pnr is null or new.pnr = '') then
        new.pnr := public.kx_generate_pnr();
    end if;
    new.contact_email := lower(trim(new.contact_email));
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists bookings_before_write on public.bookings;
create trigger bookings_before_write
    before insert or update on public.bookings
    for each row execute function public.kx_bookings_before_write();

-- ---------------------------------------------------------------------
-- Passengers
-- ---------------------------------------------------------------------

create table if not exists public.passengers (
    passenger_id   uuid primary key default gen_random_uuid(),
    booking_id     uuid not null references public.bookings (booking_id) on delete cascade,
    passenger_seq  smallint not null check (passenger_seq > 0),
    given_name     text not null,
    family_name    text not null,
    passenger_type text not null default 'ADULT'
                   check (passenger_type in ('ADULT', 'CHILD', 'INFANT')),
    date_of_birth  date,
    unique (booking_id, passenger_seq)
);

create index if not exists passengers_booking_idx on public.passengers (booking_id);

-- ---------------------------------------------------------------------
-- Segments -- one flown leg on one date
--
-- The carrier, number, times and price are copied in at sell time. A
-- reservation has to keep what was sold even if the schedule is
-- re-exported from the game later.
-- ---------------------------------------------------------------------

create table if not exists public.booking_segments (
    segment_id       uuid primary key default gen_random_uuid(),
    booking_id       uuid not null references public.bookings (booking_id) on delete cascade,
    segment_order    smallint not null check (segment_order > 0),

    flight_id        uuid not null,
    aircraft_id      uuid not null,
    direction        text not null check (direction in ('OUTBOUND', 'INBOUND')),
    cabin_code       text not null references public.cabin_classes (cabin_code),
    fare_product_id  uuid references public.fare_products (fare_product_id),
    travel_date      date not null,

    -- snapshot of what was sold
    marketing_airline_uid uuid references public.airlines (uid),
    operating_airline_uid uuid references public.airlines (uid),
    flight_number    integer not null,
    origin_iata      text not null references public.airports (iata_code),
    destination_iata text not null references public.airports (iata_code),
    departure_time   time,
    arrival_time     time,
    arrival_date     date,
    price_usd        numeric(10,2) not null default 0 check (price_usd >= 0),
    status           text not null default 'CONFIRMED'
                     check (status in ('CONFIRMED', 'CANCELLED', 'FLOWN')),

    unique (booking_id, segment_order),
    foreign key (flight_id, aircraft_id)
        references public.flight_assignments (flight_id, aircraft_id),
    foreign key (flight_id, aircraft_id, cabin_code)
        references public.flight_fares (flight_id, aircraft_id, cabin_code)
);

comment on table public.booking_segments is
    'A sold leg. flight_id + aircraft_id + direction + travel_date identifies the departure; the rest is the snapshot shown on the ticket.';

create index if not exists booking_segments_booking_idx on public.booking_segments (booking_id);
create index if not exists booking_segments_departure_idx
    on public.booking_segments (flight_id, aircraft_id, direction, travel_date, cabin_code);
create index if not exists booking_segments_date_idx on public.booking_segments (travel_date);

-- Does this leg actually fly on this date?
create or replace function public.kx_flight_operates_on(
    p_flight_id   uuid,
    p_aircraft_id uuid,
    p_direction   text,
    p_date        date
) returns boolean language sql stable as $$
    select exists (
        select 1
        from public.v_bookable_departures d
        where d.flight_id   = p_flight_id
          and d.aircraft_id = p_aircraft_id
          and d.direction   = p_direction
          and d.departure_day_of_week = (extract(isodow from p_date)::int - 1)
    );
$$;

create or replace function public.kx_segment_before_write()
returns trigger language plpgsql as $$
begin
    if not public.kx_flight_operates_on(new.flight_id, new.aircraft_id,
                                        new.direction, new.travel_date) then
        raise exception
            'flight % (%) does not operate on % (weekday %)',
            new.flight_id, new.direction, new.travel_date,
            extract(isodow from new.travel_date)::int - 1
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

drop trigger if exists booking_segments_validate on public.booking_segments;
create trigger booking_segments_validate
    before insert or update of flight_id, aircraft_id, direction, travel_date
    on public.booking_segments
    for each row execute function public.kx_segment_before_write();

-- ---------------------------------------------------------------------
-- Tickets -- one passenger on one segment
-- ---------------------------------------------------------------------

create table if not exists public.tickets (
    ticket_id     uuid primary key default gen_random_uuid(),
    passenger_id  uuid not null references public.passengers (passenger_id) on delete cascade,
    segment_id    uuid not null references public.booking_segments (segment_id) on delete cascade,
    ticket_number text unique,
    fare_usd      numeric(10,2) not null default 0 check (fare_usd >= 0),
    taxes_usd     numeric(10,2) not null default 0 check (taxes_usd >= 0),
    seat_number   text,
    status        text not null default 'ISSUED'
                  check (status in ('ISSUED', 'VOID', 'REFUNDED', 'FLOWN')),
    issued_at     timestamptz not null default now(),
    unique (passenger_id, segment_id)
);

create index if not exists tickets_segment_idx on public.tickets (segment_id);

-- ---------------------------------------------------------------------
-- Purchased extras (rows appear once ancillaries is populated)
-- ---------------------------------------------------------------------

create table if not exists public.booking_ancillaries (
    booking_ancillary_id uuid primary key default gen_random_uuid(),
    booking_id   uuid not null references public.bookings (booking_id) on delete cascade,
    segment_id   uuid references public.booking_segments (segment_id) on delete cascade,
    passenger_id uuid references public.passengers (passenger_id) on delete cascade,
    ancillary_id uuid not null references public.ancillaries (ancillary_id),
    quantity     smallint not null default 1 check (quantity > 0),
    price_usd    numeric(10,2) not null default 0 check (price_usd >= 0)
);

create index if not exists booking_ancillaries_booking_idx
    on public.booking_ancillaries (booking_id);

-- ---------------------------------------------------------------------
-- Keep bookings.total_amount_usd in step with tickets and extras
-- ---------------------------------------------------------------------

create or replace function public.kx_recalculate_booking_total(p_booking_id uuid)
returns void language sql as $$
    update public.bookings b
       set total_amount_usd = coalesce((
               select sum(t.fare_usd + t.taxes_usd)
               from public.tickets t
               join public.booking_segments s on s.segment_id = t.segment_id
               where s.booking_id = b.booking_id
                 and t.status <> 'VOID'
           ), 0) + coalesce((
               select sum(ba.price_usd * ba.quantity)
               from public.booking_ancillaries ba
               where ba.booking_id = b.booking_id
           ), 0),
           updated_at = now()
     where b.booking_id = p_booking_id;
$$;

create or replace function public.kx_touch_booking_total()
returns trigger language plpgsql as $$
declare
    v_booking uuid;
begin
    if tg_table_name = 'tickets' then
        select s.booking_id into v_booking
        from public.booking_segments s
        where s.segment_id = coalesce(new.segment_id, old.segment_id);
    else
        v_booking := coalesce(new.booking_id, old.booking_id);
    end if;

    if v_booking is not null then
        perform public.kx_recalculate_booking_total(v_booking);
    end if;
    return null;
end;
$$;

drop trigger if exists tickets_total on public.tickets;
create trigger tickets_total
    after insert or update or delete on public.tickets
    for each row execute function public.kx_touch_booking_total();

drop trigger if exists booking_ancillaries_total on public.booking_ancillaries;
create trigger booking_ancillaries_total
    after insert or update or delete on public.booking_ancillaries
    for each row execute function public.kx_touch_booking_total();

-- ---------------------------------------------------------------------
-- Reading a reservation back
-- ---------------------------------------------------------------------

create or replace view public.v_booking_details
with (security_invoker = on) as
select
    b.booking_id,
    b.pnr,
    b.contact_email,
    b.contact_name,
    b.status                 as booking_status,
    b.total_amount_usd,
    b.created_at,
    s.segment_id,
    s.segment_order,
    s.travel_date,
    s.direction,
    s.flight_number,
    op.airline_code          as operating_airline_code,
    op.airline_name          as operating_airline_name,
    s.origin_iata,
    s.destination_iata,
    s.departure_time,
    s.arrival_time,
    s.arrival_date,
    s.cabin_code,
    cc.cabin_name,
    s.price_usd              as segment_price_usd,
    s.status                 as segment_status,
    ac.registration,
    ac.aircraft_model,
    (select count(*) from public.passengers p where p.booking_id = b.booking_id)
                             as passenger_count
from public.bookings b
join public.booking_segments s on s.booking_id = b.booking_id
join public.cabin_classes cc   on cc.cabin_code = s.cabin_code
left join public.airlines op   on op.uid = s.operating_airline_uid
left join public.aircraft ac   on ac.aircraft_id = s.aircraft_id
order by b.created_at desc, s.segment_order;

comment on view public.v_booking_details is
    'Flattened reservation for a "manage my booking" page: look up by pnr and contact_email.';

commit;
