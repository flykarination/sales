# KarinationGroup reservations database

The TAS exports in this folder, turned into a relational database a booking site
can run on. Built for Supabase (PostgreSQL 15+).

The original JSON is untouched. A verbatim copy lives in
[`original_json/`](original_json/) so it stays available for building the
bookings page later.

---

## Layout

```
database/
  README.md                  this file
  original_json/             verbatim copy of every source file
  csv/                       12 tables, ready to load
  sql/                       01 .. 07, run in numeric order
  scripts/
    build_database.py        JSON  -> csv/          (re-run any time)
    backfill_airports.py     csv/  -> sql/03_...    (re-run with a reference file)
    load_to_supabase.py      csv/  -> Supabase, no psql required
    deploy.ps1               the whole thing, with psql
  reports/
    build_report.md          row counts, integrity checks, warnings
    airport_backfill_report.md   what the airport backfill resolved
```

---

## Deploying

### The short version, with psql

The winget package is versioned -- a bare `PostgreSQL.PostgreSQL` does not
exist, and the installer does not put psql on PATH (deploy.ps1 finds it anyway):

```powershell
winget install PostgreSQL.PostgreSQL.17
.\database\scripts\save_password.ps1     # once: stores the password in pgpass.conf
.\database\scripts\deploy.ps1 -ConnectionString $env:KX_DB_URL
```

`save_password.ps1` prompts for the database password without echoing it and
writes it to `%APPDATA%\postgresql\pgpass.conf`, so no password ever appears on
a command line, in shell history, or in this repo. It also sets `KX_DB_URL`.

This project lives in **eu-west-1**, so its pooler URL is:

```
postgresql://postgres.fqxiskkyvbkhrpejxtol@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require
```

The installer bundles a whole local server you do not need; untick everything
except **Command Line Tools**.

Note that this is the **session pooler** host, not the **direct connection**
string the dashboard offers first. The direct host, `db.<ref>.supabase.co`,
publishes only an AAAA record, so on an IPv4-only network psql cannot resolve
it at all and reports "could not translate host name". `deploy.ps1` checks for
exactly that before touching the database and tells you to switch. Take the
session pooler (port 5432) rather than the transaction pooler (6543) -- `\copy`
needs a session that survives between statements.

To find the pooler host for a different project, read it off **Connect ->
Session pooler** in the dashboard. Failing that, probing each regional pooler
with a deliberately wrong password identifies it: the wrong region answers
"Tenant or user not found", the right one answers "password authentication
failed".

The whole run takes well under a minute for all 18,378 rows.

### Without psql

Here you want the **Project URL**, not a connection string -- this path goes
through the REST API rather than Postgres.

1. Open the Supabase **SQL Editor** and run `sql/01_schema.sql`.
2. Load the data. The key must be the **secret** key (`sb_secret_...`, or a
   legacy `service_role` JWT) from **Project Settings → API Keys**. The
   *publishable* key is the browser-safe one and RLS will reject every insert
   it makes.

   ```powershell
   $env:SUPABASE_URL="https://<project-ref>.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="<secret key>"
   python database/scripts/load_to_supabase.py
   ```

3. Back in the SQL Editor, run `04_views.sql`, `05_reservations.sql`,
   `06_demand_simulation.sql`, `07_rls_policies.sql` in that order.
4. Start the world moving: `select public.seed_departure_inventory(14);`

### Entirely from the browser

Same as above, but instead of step 2 use **Table Editor → Import data from
CSV** on each file in `csv/`, in exactly this order — the foreign keys depend
on it:

`airports` → `airlines` → `aircraft_models` → `cabin_classes` →
`airline_hubs` → `airline_stats` → `aircraft` → `flights` →
`flight_assignments` → `flight_assignment_days` → `flight_fares` → `codeshares`

### Checking it worked

```sql
select count(*) from public.flights;                 -- 1302
select * from public.search_flights('SGN','KGD', current_date + 7, 'ECONOMY', 2);
select * from public.v_management_dashboard limit 10;
```

---

## The tables

**Catalog — straight from the export**

| table | rows | what it is |
|---|---:|---|
| `airlines` | 8 | the 3 group carriers + 5 outside codeshare partners |
| `airline_hubs` | 19 | which airports a carrier may start and end flights at |
| `airline_stats` | 3 | the game's headline counters per carrier |
| `airports` | 481 | every IATA code in the export, with name, city, country, timezone, UTC offset and coordinates |
| `aircraft_models` | 13 | distinct types, with manufacturer split out |
| `aircraft` | 717 | individual airframes, cabin layout and base |
| `cabin_classes` | 4 | FIRST / BUSINESS / PREMIUM_ECONOMY / ECONOMY |
| `flights` | 1302 | flight **pairs** — an outbound and its return |
| `flight_assignments` | 1395 | which airframe works which pair |
| `flight_assignment_days` | 8795 | the weekdays it works, one row per day |
| `flight_fares` | 5580 | seats and price, per cabin, per assignment |
| `codeshares` | 63 | partner-marketed seats on a KX-operated flight |

**Reservations — new, written by the site**

`bookings` → `passengers`, `booking_segments` → `tickets`, plus
`booking_ancillaries`. Keyed by contact email and a six-character PNR; no
Supabase auth user is involved.

**Extension points — deliberately empty**

`fare_products` (branded fares) and `ancillaries` (bags, seats, meals). The keys
and joins already exist, so adding a "Flex" fare later is an `INSERT`, not a
migration.

**Simulation**

`departure_inventory` holds live seat state per departure; `demand_events` is
the ticker feed.

### How the keys line up

```
airlines ──< airline_hubs >── airports
    │                            ▲  ▲
    ├──< airline_stats           │  │
    ├──< aircraft >── aircraft_models
    │        │                   │
    └──< flights ────────────────┘  (origin_iata, destination_iata)
            │  └─ child_stopover_flight_id ──┐ (self, second leg)
            │  ◄─────────────────────────────┘
            ├──< flight_assignments ──< flight_assignment_days
            │            └──< flight_fares >── cabin_classes
            └──< codeshares >── airlines (marketing + operating)

bookings ──< passengers ──┐
     └────< booking_segments ──< tickets
                  └── flight_assignments, flight_fares, airports
```

### The views the site actually queries

| view | one row per |
|---|---|
| `v_flight_legs` | directional leg — two per `flights` row |
| `v_bookable_departures` | leg × weekday × cabin, with seats and price |
| `v_stopover_itineraries` | through journey A→B→C |
| `v_routes` | carrier + city pair, with lead-in fares |
| `v_codeshares` | codeshare with both carriers resolved |
| `v_fleet` | airframe with its cabin products |
| `v_departure_load` | departure, with load factor |
| `v_management_dashboard` | carrier × date rollup |
| `v_booking_details` | flattened reservation |

Functions: `search_flights(origin, destination, date, cabin, seats)`,
`create_booking(email, name, passengers, segments)`, `find_booking(pnr, email)`,
`kx_available_seats(...)`.

---

## What the data actually meant

Six things were not obvious from `db_notes.md` and shape the schema.

**1. A `flights` row is a pair, not a flight.** Each carries an outbound and an
inbound number, and `inbound = outbound + 1` holds for all 1302 rows. The
booking engine wants single directional legs, so `v_flight_legs` splits every
pair in two. The inbound leg's departure is not in the export; it is computed as
outbound arrival + ground time, where ground time is
`greatest(turnaround_offset_minutes, 60)`. Change the 60 in
`kx_ground_minutes()` and every timetable follows.

**2. Times are local to the departure airport.** The export never says so, but
the stopovers prove it: DAD 07:20 + 6h40 lands at Salalah at 14:00 on Da Nang's
clock, and the onward leg departs at 12:00 — which is a clean one-hour
connection once you know Salalah is three hours behind. Every one of the 22
stopover airports back-solves to its correct real-world offset this way.

The practical consequence: an arrival time is only right if you know the
destination's offset. `03_airports_backfill.sql` supplies one for all 481
airports, along with names, cities, countries and coordinates, from
[mwgg/Airports](https://github.com/mwgg/Airports). `v_flight_legs.tz_resolved`
stays in the view for any airport added later that has no offset yet.

That backfill validates itself against the game. The stopover timings
independently determine the offset of 28 airports, and 27 match the real-world
data exactly. The odd one out is Algiers, where the derivation reads +90
against a true +60 — because that particular stopover connects in 90 minutes
rather than 60, not because either figure is wrong.

**3. Seats are pooled by the week.** One exported `ecoPax` covers every
operating day at once — 2457 economy seats, not 351. Occupancy in this world is
always full, so `flight_fares` keeps the raw figure as `weekly_seats_for_sale`
and divides out what a booking page needs:

```
seats_per_departure = round(weekly_seats_for_sale / operating_days_per_week)
```

That is `LEGS_PER_ROTATION = 1` in `build_database.py`. The result reproduces
real capacities across all 13 types in the fleet — 414 seats on the 777-9, 364
on the A350-1000, 160 on the A320neo, 35 on the Dash 8 Q100 — which is the
check that settled the divisor.

**4. Stopover legs reuse the parent's flight number.** DAD–KUT–IST is KX 73/74
end to end, so a flight number alone is not unique. The unique key is
`(airline, flight number, origin, destination)`.

**5. Second legs can depart "tomorrow".** Eleven of them carry a
`departureDailyTimestamp` above 86400 — up to 31:30 — meaning the day after the
parent departed. `departure_day_offset` carries this through the views, and
`search_flights` accounts for it when matching a weekday.

**6. Marketing partners are strangers.** The five codeshare partners are outside
KarinationGroup and the export gives only their `uid` — no name, no code. They
are in `airlines` with `is_group_member = false` and null name, so the foreign
key holds. Fill the names in when you know them.

### Things worth knowing about the source

- `Karination/fleet_summary.json` is a stale duplicate of `kxgroup_stats.json`
  — same three rows, older `lastOnlineTime`. Not loaded; the build script
  cross-checks it and warns on disagreement.
- `fleet_detail.json` has 717 airframes; `kxgroup_stats` says 712. The extra
  five are A318s (`VN-A778`–`VN-A782`) with hub `EMPTY` and no assignments —
  loaded, with a null hub.
- The export has 755 distinct city pairs against a reported 766 routes.
- `flightString` puts its two ends in inconsistent order (735 rows read
  origin-destination, 567 the other way). It is kept verbatim but never used —
  `origin_iata` and `destination_iata` are the truth.
- `weekly_flight_time` is 0 on every airframe, and `livery_config_id` is null
  on every one.

---

## Simulated demand

Every future departure fills up on its own, at its own pace, and stops at the
aircraft's seat count. Real bookings sit on top and count against the same cap —
and if a departure is full of simulated passengers, they give way rather than
turning a real customer away.

```sql
select public.seed_departure_inventory(14);   -- create the next 14 days
select * from public.simulate_bookings();     -- one tick
select * from public.v_management_dashboard;  -- watch it climb
select * from public.v_recent_sales;          -- the live ticker
```

Each departure gets a stable personality from a hash of its own identity — some
fill in four days, some take four weeks — and demand accelerates as the date
approaches. Ticking sells against elapsed wall-clock time, so running it more
often does not sell faster.

To leave it running, enable `pg_cron` under **Database → Extensions**:

```sql
select cron.schedule('kx-demand', '*/15 * * * *', $$select public.simulate_bookings(2000)$$);
select cron.schedule('kx-seed',   '17 3 * * *',   $$select public.seed_departure_inventory(14)$$);
select cron.schedule('kx-prune',  '42 * * * *',
       $$select public.prune_demand_events(6), public.prune_departed_inventory(3)$$);
```

### Staying inside the free tier

Every quarter hour rather than every minute is deliberate, and it costs nothing
in realism: seats accrue against *elapsed wall-clock time*, so a fifteen-minute
cadence fills the world at exactly the same speed as a one-minute cadence while
doing a fifteenth of the writes. A batch smaller than the table is fine too --
rows are taken least-recently-touched first, so 2000 a tick simply rotates
through the whole inventory in about half a day and nothing is starved.

| | per minute, 4000 rows | per 15 min, 2000 rows |
|---|---:|---:|
| row updates per day | 5,760,000 | 192,000 |
| event rows per day | up to 5,760,000 | up to 192,000 |
| event table at steady state | ~1.8 GB (48 h) | ~8 MB (6 h) |
| planner work per tick | seq scan + sort of 106k rows | index scan of 2000 |
| tick execution time | tens of ms, 2 parallel workers | ~2 ms, no workers |

The first column would have exceeded the 500 MB database limit within a day.

Two things make the second column cheap: `departure_inventory_tick_idx`, which
matches the tick's `order by last_simulated_at` exactly so it walks only the
rows it is about to touch, and `prune_demand_events(6)`, since the ticker view
only ever shows the most recent 200 events.

Check the cost at any time:

```sql
select * from public.simulation_status();
```

Watch database size there against the 500 MB budget. If it creeps, shorten the
event retention or lower the batch -- neither changes how fast the world fills.
The other free-tier constraint is the 5 GB monthly egress: have the management
page read `v_management_dashboard` (one row per carrier per day) rather than
`v_departure_load` (one row per departure, 100k+).

---

## Security

RLS is on for every table.

- **Catalog** — world readable with the anon key, writable by nobody.
- **Reservations** — no policy at all, so the anon key sees nothing. Reads and
  writes go through `find_booking(pnr, email)` and `create_booking(...)`, both
  `security definer`. `create_booking` reads prices and flight details from the
  schedule rather than from its caller, so a browser cannot set its own fare.
- **`simulate_bookings` and the seeding functions** are revoked from `anon` —
  operator tools, not public endpoints.

The `service_role` key bypasses all of this. Server side only.

---

## Re-running the build

```powershell
python database/scripts/build_database.py
```

Rewrites every CSV from the JSON and refreshes `reports/build_report.md`. It
checks primary keys, foreign keys, and that no two aircraft are rostered on the
same flight on the same weekday.

**Adding FORZA and Sonder:** their folders are currently empty, so only their
`airlines` and `airline_stats` rows exist. Drop their four JSON files into
`FORZA/` and `Sonder/` and re-run — the script picks up any carrier named in
`kxgroup_info.json` and warns about the ones it cannot find.
