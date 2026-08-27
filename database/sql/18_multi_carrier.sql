-- =====================================================================
-- 18. Room for a second carrier
--
-- Loading FORZA (Z4) alongside Karination (KX) breaks two assumptions
-- that were only ever true because the group had one airline with data.
--
--   1. Registrations are not unique. Both carriers are Vietnamese and the
--      game issues each its own VN-A___ sequence, so 223 marks appear in
--      both fleets -- VN-A104 is an A321XLR at Karination and a
--      777-300ER at FORZA. Nor is it unique within a carrier: FORZA has
--      two separate 787-10s both marked VN-A287, both flying. The mark
--      is a label; aircraft_id is the identity.
--
--   2. A codeshare can be marketed on a flight we do not hold. All four
--      of FORZA's are seats it sells on an outside carrier's Incheon
--      departures, and the group export only ever contains the group's
--      own flights. Requiring operating_flight_id meant discarding a
--      real commercial fact -- that Z4 sells ICN-BKK, ICN-SGN and
--      ICN-HAN -- because we lack the operator's timetable.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Registration is a label, not a key.
-- ---------------------------------------------------------------------
-- The index is owned by a unique CONSTRAINT, so it cannot be dropped on its
-- own; dropping the constraint takes the index with it.
alter table public.aircraft
    drop constraint if exists aircraft_registration_key;
drop index if exists public.aircraft_registration_key;

-- Not unique per airline either, as it turns out. FORZA carries two
-- distinct 787-10s both marked VN-A287 -- different aircraft ids, both in
-- service, one working Z4 873 and the other three more. The game has
-- issued the mark twice, so registration is a label and aircraft_id is
-- the key. Indexed for lookups, not constrained.
create index if not exists aircraft_airline_registration_idx
    on public.aircraft (airline_uid, registration);

comment on column public.aircraft.registration is
    'Tail mark. NOT unique: two group carriers on the same national register '
    'reuse marks, and FORZA carries the same mark on two airframes. '
    'aircraft_id is the identity.';


-- ---------------------------------------------------------------------
-- 2. A codeshare may name a flight we do not have.
--
-- The unique key that pairs an operating flight with a marketing carrier
-- has to become partial: NULLs are distinct in a unique index, but being
-- explicit about it says the intent rather than relying on that.
-- ---------------------------------------------------------------------
alter table public.codeshares
    alter column operating_flight_id drop not null;

alter table public.codeshares
    drop constraint if exists codeshares_one_per_partner;

create unique index if not exists codeshares_one_per_partner
    on public.codeshares (operating_flight_id, marketing_airline_uid)
    where operating_flight_id is not null;

comment on column public.codeshares.operating_flight_id is
    'The flight actually flown, when we hold it. NULL where the operator is '
    'outside the group and its timetable is not in our exports -- the '
    'codeshare is still real, we simply cannot join to the departure.';

commit;
