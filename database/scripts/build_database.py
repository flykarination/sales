#!/usr/bin/env python3
"""
KarinationGroup -- JSON -> relational CSV builder.

Reads the raw TAS exports (kxgroup_info.json, kxgroup_stats.json and one folder
per member carrier) and emits one CSV per table of the Supabase schema defined
in database/sql/01_schema.sql.

Run from anywhere:          python database/scripts/build_database.py
Re-run safely at any time:  it fully rewrites database/csv/*.csv.

Adding a carrier: drop its four JSON files into
database/original_json/<AirlineName>/ and re-run.
Empty or missing carrier folders are skipped with a warning.
"""

from __future__ import annotations

import csv
import json
import math
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # the project folder
SRC = ROOT / "database" / "original_json"           # the raw TAS exports
OUT = ROOT / "database" / "csv"
REPORTS = ROOT / "database" / "reports"

CARRIER_FILES = ("flights_list.json", "fleet_detail.json",
                 "codeshares_list.json", "fleet_summary.json")

# source key prefix -> (cabin_code, cabin_name, sort_order)
CABINS = [
    ("first",   "FIRST",           "First",           1),
    ("biz",     "BUSINESS",        "Business",        2),
    ("premEco", "PREMIUM_ECONOMY", "Premium Economy", 3),
    ("eco",     "ECONOMY",         "Economy",         4),
]

NULL_SENTINELS = {"", "EMPTY", "NONE", "NULL", "N/A", "-"}

# One exported *Pax figure covers a week of operating days. Occupancy in this
# world is always full, so dividing by the number of operating days gives the
# aircraft's actual cabin:
#     round(pax / (len(dowList) * LEGS_PER_ROTATION))
# This reproduces real capacities across all 13 types in the fleet -- 414 seats
# on the 777-9, 36 on the Dash 8 Q100. Raise it to 2 if a pax figure ever turns
# out to pool the outbound and inbound legs together.
LEGS_PER_ROTATION = 1

warnings: list[str] = []
notes: list[str] = []


def warn(msg: str) -> None:
    warnings.append(msg)
    print("  ! " + msg, file=sys.stderr)


def load(path: Path):
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def clean(value):
    """Normalise sentinel strings to None and trim whitespace."""
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        if value.upper() in NULL_SENTINELS:
            return None
    return value


def to_bool(value):
    """The exports carry booleans as the strings 'TRUE' / 'FALSE'."""
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    return str(value).strip().upper() in {"TRUE", "T", "1", "YES"}


def iata(value):
    v = clean(value)
    return v.upper() if isinstance(v, str) else v


def round_half_up(value: float) -> int:
    """Half-up rounding -- 175.5 -> 176. Python's round() would give 176 here but
    174.5 -> 174, which would silently bias seat counts downwards."""
    return int(math.floor(value + 0.5))


# Manufacturers whose name is more than one word, longest first so that
# "De Havilland Canada" wins over "De Havilland".
MULTIWORD_MAKERS = (
    "De Havilland Canada", "De Havilland", "McDonnell Douglas",
    "Bombardier Aerospace", "Pilatus Aircraft",
)


def manufacturer_of(model: str) -> str:
    """
    Leading manufacturer name. Splitting on the first space alone turns
    'De Havilland Canada Dash 8 Q100' into 'De', so multi-word makers are
    matched explicitly first.
    """
    if not model:
        return ""
    for maker in MULTIWORD_MAKERS:
        if model.startswith(maker):
            return maker
    return model.split(" ", 1)[0]


def write_csv(name: str, columns: list[str], rows: list[dict]) -> None:
    path = OUT / (name + ".csv")
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=columns, extrasaction="raise")
        writer.writeheader()
        for row in rows:
            out = {}
            for col in columns:
                val = row.get(col)
                if val is None:
                    out[col] = ""              # -> SQL NULL under COPY ... CSV
                elif isinstance(val, bool):
                    out[col] = "true" if val else "false"
                else:
                    out[col] = val
            writer.writerow(out)
    print("  + {}.csv  ({} rows)".format(name, len(rows)))


def main() -> int:
    print("KarinationGroup database build\n  root: {}".format(ROOT))
    OUT.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)

    group_info = load(SRC / "kxgroup_info.json")
    group_stats = load(SRC / "kxgroup_stats.json") or []
    if not group_info:
        print("FATAL: kxgroup_info.json not found or empty", file=sys.stderr)
        return 1

    # ---------------------------------------------------------------- airlines
    airlines: dict[str, dict] = {}
    airline_hubs: list[dict] = []
    for a in group_info:
        uid = a["uid"]
        airlines[uid] = {
            "uid": uid,
            "airline_code": clean(a.get("airlineCode")),
            "airline_name": clean(a.get("airlineName")),
            "airline_slug": clean(a.get("airlineId")),
            "airline_country": clean(a.get("airlineCountry")),
            "alliance": clean(a.get("alliance")),
            "flagship_aircraft_model": clean(a.get("flagshipAircraftModel")),
            "extra_special_livery_slot": a.get("extraSpecialLiverySlot"),
            "version_string": clean(a.get("versionString")),
            "claim_profit_time": clean(a.get("claimProfitTime")),
            "is_group_member": True,
        }
        for hub in a.get("hubAirports") or []:
            airline_hubs.append({"airline_uid": uid, "airport_iata": iata(hub),
                                 "is_major_hub": False})

    stats_by_uid = {s["uid"]: s for s in group_stats}
    for uid in stats_by_uid:
        if uid not in airlines:
            warn("kxgroup_stats.json has uid {} with no entry in "
                 "kxgroup_info.json".format(uid))

    # the major hub flag comes from the stats file
    major = {s["uid"]: iata(s.get("majorHubAirport")) for s in group_stats}
    for hub in airline_hubs:
        if major.get(hub["airline_uid"]) == hub["airport_iata"]:
            hub["is_major_hub"] = True

    airline_stats = [{
        "airline_uid": s["uid"],
        "num_aircraft": s.get("numAircraft"),
        "num_routes": s.get("numRoutes"),
        "num_flights": s.get("numFlights"),
        "flagship_aircraft_model": clean(s.get("flagshipAircraft")),
        "major_hub_iata": iata(s.get("majorHubAirport")),
        "last_online_time": clean(s.get("lastOnlineTime")),
    } for s in group_stats if s["uid"] in airlines]

    # ------------------------------------------------------- per-carrier files
    aircraft: list[dict] = []
    flights: list[dict] = []
    assignments: list[dict] = []
    assignment_days: list[dict] = []
    fares: list[dict] = []
    codeshares: list[dict] = []
    per_carrier: dict[str, Counter] = {}

    for uid, air in airlines.items():
        folder = SRC / (air["airline_name"] or "")
        label = "{} ({})".format(air["airline_name"], air["airline_code"])
        counts = per_carrier.setdefault(air["airline_name"], Counter())
        if not folder.is_dir():
            warn("{}: folder {}/ not found -- carrier skipped".format(label, folder.name))
            continue
        present = [f for f in CARRIER_FILES if (folder / f).exists()]
        if not present:
            warn("{}: folder {}/ is empty -- no fleet or flights loaded"
                 .format(label, folder.name))
            continue
        for missing in sorted(set(CARRIER_FILES) - set(present)):
            warn("{}: {} missing".format(label, missing))
        print("  reading {}/ ...".format(folder.name))

        # ---- fleet_detail.json -> aircraft
        for row in load(folder / "fleet_detail.json") or []:
            if row.get("uid") != uid:
                warn("{}: aircraft {} carries a foreign uid {} -- kept with its own uid"
                     .format(label, row.get("registration"), row.get("uid")))
            aircraft.append({
                "aircraft_id": row["aircraftId"],
                "airline_uid": row["uid"],
                "aircraft_model": clean(row.get("aircraftModel")),
                "registration": clean(row.get("registration")),
                "delivery_date": clean(row.get("deliveryDate")),
                "hub_airport_iata": iata(row.get("hubAirport")),
                "eco_ratio": row.get("ecoRatio"),
                "prem_eco_ratio": row.get("premEcoRatio"),
                "biz_ratio": row.get("bizRatio"),
                "first_ratio": row.get("firstRatio"),
                "eco_product": clean(row.get("ecoProduct")),
                "prem_eco_product": clean(row.get("premEcoProduct")),
                "biz_product": clean(row.get("bizProduct")),
                "first_product": clean(row.get("firstProduct")),
                "eco_config_type": clean(row.get("ecoConfigType")),
                "eco_pitch": row.get("ecoPitch"),
                "prem_eco_pitch": row.get("premEcoPitch"),
                "biz_pitch": row.get("bizPitch"),
                "first_pitch": row.get("firstPitch"),
                "engine_option": clean(row.get("engineOption")),
                "winglet_option": (clean(row.get("wingletOption")) or "").lower() or None,
                "eyemask_option": clean(row.get("eyemaskOption")),
                "livery_config_id": clean(row.get("liveryConfigId")),
                "background_image_index": row.get("backgroundImageIndex"),
                "weekly_flight_time": row.get("weeklyFlightTime"),
            })
            counts["aircraft"] += 1

        # ---- flights_list.json -> flights + assignments + days + fares
        for row in load(folder / "flights_list.json") or []:
            flight_id = row["flightId"]
            flights.append({
                "flight_id": flight_id,
                "airline_uid": row["uid"],
                "outbound_flight_number": row.get("outboundFlightNumber"),
                "inbound_flight_number": row.get("inboundFlightNumber"),
                "flight_string": clean(row.get("flightString")),
                "origin_iata": iata(row.get("originAirport")),
                "destination_iata": iata(row.get("destinationAirport")),
                "departure_daily_seconds": row.get("departureDailyTimestamp"),
                "outbound_duration_minutes": row.get("outboundFlightDuration"),
                "inbound_duration_minutes": row.get("inboundFlightDuration"),
                "turnaround_offset_minutes": row.get("turnaroundOffset"),
                "is_stopover": to_bool(row.get("isStopover")),
                "child_stopover_flight_id": clean(row.get("childStopoverFlightId")),
            })
            counts["flights"] += 1

            for aircraft_id, asg in (row.get("aircraftAssignments") or {}).items():
                inner = asg.get("aircraftId")
                if inner and inner != aircraft_id:
                    warn("{}: flight {} assignment key {} != inner aircraftId {} -- key wins"
                         .format(label, flight_id, aircraft_id, inner))
                dows = sorted(set(asg.get("dowList") or []))
                assignments.append({
                    "flight_id": flight_id,
                    "aircraft_id": aircraft_id,
                    "operating_days_per_week": len(dows),
                    "flight_profit": asg.get("flightProfit"),
                })
                counts["assignments"] += 1
                if not dows:
                    warn("{}: flight {} assignment {} has an empty dowList -- it never "
                         "operates".format(label, flight_id, aircraft_id))
                for dow in dows:
                    assignment_days.append({
                        "flight_id": flight_id,
                        "aircraft_id": aircraft_id,
                        "day_of_week": dow,
                    })
                # one departure = one leg on one weekday; the export pools the week
                # and both directions into a single figure
                departures = len(dows) * LEGS_PER_ROTATION
                for prefix, code, _name, _order in CABINS:
                    weekly = asg.get(prefix + "Pax") or 0
                    fares.append({
                        "flight_id": flight_id,
                        "aircraft_id": aircraft_id,
                        "cabin_code": code,
                        "weekly_seats_for_sale": weekly,
                        "seats_per_departure": round_half_up(weekly / departures) if departures else 0,
                        "price_usd": asg.get(prefix + "Price"),
                    })

        # ---- codeshares_list.json
        for row in load(folder / "codeshares_list.json") or []:
            codeshares.append({
                "codeshare_id": row["codeshareId"],
                "operating_flight_id": row.get("operatingFlightId"),
                "operating_airline_uid": row.get("operatingUid"),
                "marketing_airline_uid": row.get("marketingUid"),
                "marketing_outbound_flight_number": row.get("marketingOutboundFlightNumber"),
                "marketing_inbound_flight_number": row.get("marketingInboundFlightNumber"),
                "operating_carrier_profit": row.get("operatingCarrierProfit"),
                "marketing_carrier_profit": row.get("marketingCarrierProfit"),
                "origin_iata": iata(row.get("originAirport")),
                "destination_iata": iata(row.get("destinationAirport")),
            })
            counts["codeshares"] += 1

        # fleet_summary.json duplicates kxgroup_stats.json -- cross-check only
        for s in load(folder / "fleet_summary.json") or []:
            live = stats_by_uid.get(s["uid"])
            if live and any(live.get(k) != s.get(k)
                            for k in ("numAircraft", "numRoutes", "numFlights")):
                warn("{}: fleet_summary.json disagrees with kxgroup_stats.json for uid {} "
                     "-- kxgroup_stats.json used".format(label, s["uid"][:8]))

    # ------------------------------------- marketing partners outside the group
    for cs in codeshares:
        for uid in (cs["operating_airline_uid"], cs["marketing_airline_uid"]):
            if uid and uid not in airlines:
                airlines[uid] = {
                    "uid": uid, "airline_code": None, "airline_name": None,
                    "airline_slug": None, "airline_country": None, "alliance": None,
                    "flagship_aircraft_model": None, "extra_special_livery_slot": None,
                    "version_string": None, "claim_profit_time": None,
                    "is_group_member": False,
                }
    external = sum(1 for a in airlines.values() if not a["is_group_member"])
    if external:
        notes.append("{} external marketing carrier(s) referenced by codeshares were added "
                     "to airlines with is_group_member = false and no name or code (the "
                     "source exports carry only their uid).".format(external))

    # ------------------------------------------------------ derived dimensions
    airports: dict[str, dict] = {}

    def see_airport(code, source):
        code = iata(code)
        if not code:
            return
        rec = airports.setdefault(code, {"iata_code": code, "airport_name": None,
                                         "city_name": None, "country_code": None,
                                         "timezone": None, "latitude": None,
                                         "longitude": None, "_src": set()})
        rec["_src"].add(source)

    for h in airline_hubs:
        see_airport(h["airport_iata"], "hub")
    for s in airline_stats:
        see_airport(s["major_hub_iata"], "hub")
    for a in aircraft:
        see_airport(a["hub_airport_iata"], "fleet")
    for f in flights:
        see_airport(f["origin_iata"], "flight")
        see_airport(f["destination_iata"], "flight")
    for c in codeshares:
        see_airport(c["origin_iata"], "codeshare")
        see_airport(c["destination_iata"], "codeshare")

    models: dict[str, dict] = {}
    for a in aircraft:
        m = a["aircraft_model"]
        if m and m not in models:
            models[m] = {"aircraft_model": m, "manufacturer": manufacturer_of(m)}

    cabin_rows = [{"cabin_code": code, "cabin_name": name, "sort_order": order,
                   "source_key_prefix": prefix}
                  for prefix, code, name, order in CABINS]

    # --------------------------------------------------- referential integrity
    print("  checking referential integrity ...")
    errors: list[str] = []
    air_ids = {a["aircraft_id"] for a in aircraft}
    flight_ids = {f["flight_id"] for f in flights}

    def check_unique(rows, keys, table):
        seen = Counter(tuple(r[k] for k in keys) for r in rows)
        dupes = [k for k, v in seen.items() if v > 1]
        if dupes:
            errors.append("{}: {} duplicate key(s) on {}, e.g. {}"
                          .format(table, len(dupes), keys, dupes[:3]))

    check_unique(list(airlines.values()), ["uid"], "airlines")
    check_unique(aircraft, ["aircraft_id"], "aircraft")
    # Registration is deliberately NOT checked for uniqueness. Two group
    # carriers on the same national register reuse marks (VN-A104 is an
    # A321XLR at Karination and a 777-300ER at FORZA), and FORZA carries two
    # separate 787-10s both marked VN-A287. aircraft_id is the identity; the
    # mark is a label. Repeats are reported below as a note, not an error.
    _reg = Counter((a["airline_uid"], a["registration"]) for a in aircraft)
    _shared = sum(v - 1 for v in _reg.values() if v > 1)
    if _shared:
        notes.append("{} aircraft share a registration with another airframe "
                     "in the same fleet; aircraft_id remains unique."
                     .format(_shared))
    check_unique(flights, ["flight_id"], "flights")
    check_unique(assignments, ["flight_id", "aircraft_id"], "flight_assignments")
    check_unique(assignment_days, ["flight_id", "aircraft_id", "day_of_week"],
                 "flight_assignment_days")
    check_unique(fares, ["flight_id", "aircraft_id", "cabin_code"], "flight_fares")
    check_unique(codeshares, ["codeshare_id"], "codeshares")
    check_unique(codeshares, ["operating_flight_id", "marketing_airline_uid"],
                 "codeshares(operating_flight_id, marketing_airline_uid)")

    # one aircraft per flight per weekday
    dow_clash = Counter((d["flight_id"], d["day_of_week"]) for d in assignment_days)
    clashes = [k for k, v in dow_clash.items() if v > 1]
    if clashes:
        errors.append("flight_assignment_days: {} flight/day pairs served by more than one "
                      "aircraft, e.g. {}".format(len(clashes), clashes[:3]))

    for a in aircraft:
        if a["airline_uid"] not in airlines:
            errors.append("aircraft {}: unknown airline_uid".format(a["registration"]))
    for f in flights:
        if f["airline_uid"] not in airlines:
            errors.append("flight {}: unknown airline_uid".format(f["flight_id"]))
        child = f["child_stopover_flight_id"]
        if child and child not in flight_ids:
            errors.append("flight {}: child_stopover_flight_id {} not found"
                          .format(f["flight_id"], child))
    for r in assignments:
        if r["flight_id"] not in flight_ids:
            errors.append("assignment: unknown flight_id {}".format(r["flight_id"]))
        if r["aircraft_id"] not in air_ids:
            errors.append("assignment: unknown aircraft_id {}".format(r["aircraft_id"]))
    # A codeshare can name a flight we do not hold: the group export contains
    # only the group's own flights, and a member may market seats on an
    # outside carrier. The codeshare is still real, so it is kept with a null
    # operating flight rather than discarded.
    external = 0
    for c in codeshares:
        if c["operating_flight_id"] not in flight_ids:
            c["operating_flight_id"] = ""
            external += 1
    if external:
        notes.append("{} codeshare(s) are marketed on flights operated outside "
                     "the group; kept with no operating flight linked."
                     .format(external))

    # ------------------------------------------------------------ consistency
    used_aircraft = {r["aircraft_id"] for r in assignments}
    idle = sorted(a["registration"] for a in aircraft if a["aircraft_id"] not in used_aircraft)
    if idle:
        notes.append("{} aircraft are not assigned to any flight ({}{}).".format(
            len(idle), ", ".join(idle[:8]), " ..." if len(idle) > 8 else ""))
    routes = {(f["airline_uid"], f["origin_iata"], f["destination_iata"]) for f in flights}
    for uid, s in stats_by_uid.items():
        got_ac = sum(1 for a in aircraft if a["airline_uid"] == uid)
        got_fl = sum(1 for f in flights if f["airline_uid"] == uid)
        got_rt = sum(1 for r in routes if r[0] == uid)
        name = airlines[uid]["airline_name"] if uid in airlines else uid[:8]
        if got_fl and (got_ac, got_fl) != (s.get("numAircraft"), s.get("numFlights")):
            notes.append("{}: kxgroup_stats reports {} aircraft / {} routes / {} flights; "
                         "the exports contain {} / {} / {}."
                         .format(name, s.get("numAircraft"), s.get("numRoutes"),
                                 s.get("numFlights"), got_ac, got_rt, got_fl))

    # ------------------------------------------------------------------ write
    print("  writing CSV ...")
    write_csv("airlines",
              ["uid", "airline_code", "airline_name", "airline_slug", "airline_country",
               "alliance", "flagship_aircraft_model", "extra_special_livery_slot",
               "version_string", "claim_profit_time", "is_group_member"],
              sorted(airlines.values(),
                     key=lambda r: (not r["is_group_member"], r["airline_code"] or "zz")))
    write_csv("airports",
              ["iata_code", "airport_name", "city_name", "country_code", "timezone",
               "latitude", "longitude"],
              [{k: v for k, v in r.items() if k != "_src"}
               for r in sorted(airports.values(), key=lambda r: r["iata_code"])])
    write_csv("aircraft_models", ["aircraft_model", "manufacturer"],
              sorted(models.values(), key=lambda r: r["aircraft_model"]))
    write_csv("cabin_classes", ["cabin_code", "cabin_name", "sort_order", "source_key_prefix"],
              cabin_rows)
    write_csv("airline_hubs", ["airline_uid", "airport_iata", "is_major_hub"],
              sorted(airline_hubs, key=lambda r: (r["airline_uid"], r["airport_iata"])))
    write_csv("airline_stats",
              ["airline_uid", "num_aircraft", "num_routes", "num_flights",
               "flagship_aircraft_model", "major_hub_iata", "last_online_time"],
              airline_stats)
    write_csv("aircraft",
              ["aircraft_id", "airline_uid", "aircraft_model", "registration", "delivery_date",
               "hub_airport_iata", "eco_ratio", "prem_eco_ratio", "biz_ratio", "first_ratio",
               "eco_product", "prem_eco_product", "biz_product", "first_product",
               "eco_config_type", "eco_pitch", "prem_eco_pitch", "biz_pitch", "first_pitch",
               "engine_option", "winglet_option", "eyemask_option", "livery_config_id",
               "background_image_index", "weekly_flight_time"],
              sorted(aircraft, key=lambda r: r["registration"] or ""))
    write_csv("flights",
              ["flight_id", "airline_uid", "outbound_flight_number", "inbound_flight_number",
               "flight_string", "origin_iata", "destination_iata", "departure_daily_seconds",
               "outbound_duration_minutes", "inbound_duration_minutes",
               "turnaround_offset_minutes", "is_stopover", "child_stopover_flight_id"],
              sorted(flights, key=lambda r: (r["airline_uid"],
                                             r["outbound_flight_number"] or 0)))
    write_csv("flight_assignments",
              ["flight_id", "aircraft_id", "operating_days_per_week", "flight_profit"],
              assignments)
    write_csv("flight_assignment_days", ["flight_id", "aircraft_id", "day_of_week"],
              assignment_days)
    write_csv("flight_fares",
              ["flight_id", "aircraft_id", "cabin_code", "weekly_seats_for_sale",
               "seats_per_departure", "price_usd"], fares)
    write_csv("codeshares",
              ["codeshare_id", "operating_flight_id", "operating_airline_uid",
               "marketing_airline_uid", "marketing_outbound_flight_number",
               "marketing_inbound_flight_number", "operating_carrier_profit",
               "marketing_carrier_profit", "origin_iata", "destination_iata"],
              sorted(codeshares, key=lambda r: r["codeshare_id"]))

    # ----------------------------------------------------------------- report
    lines = ["# Build report", "",
             "Generated by `database/scripts/build_database.py`. Do not edit by hand.", "",
             "## Row counts", "", "| table | rows |", "|---|---:|"]
    for path in sorted(OUT.glob("*.csv")):
        with path.open(encoding="utf-8") as fh:
            n = sum(1 for _ in fh) - 1
        lines.append("| {} | {} |".format(path.stem, n))
    lines += ["", "## Rows per carrier", "",
              "| carrier | aircraft | flights | assignments | codeshares |",
              "|---|---:|---:|---:|---:|"]
    for name, c in per_carrier.items():
        lines.append("| {} | {} | {} | {} | {} |".format(
            name, c["aircraft"], c["flights"], c["assignments"], c["codeshares"]))
    lines += ["", "## Referential integrity", ""]
    lines.append("All primary keys are unique and every foreign key resolves."
                 if not errors else "\n".join("- **ERROR** " + e for e in errors))
    lines += ["", "## Warnings", ""]
    lines.append("\n".join("- " + w for w in warnings) or "None.")
    lines += ["", "## Notes on the source data", ""]
    lines.append("\n".join("- " + n for n in notes) or "None.")
    (REPORTS / "build_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("  + reports/build_report.md")

    print("\nDone." if not errors else "\nDone with {} integrity error(s).".format(len(errors)))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
