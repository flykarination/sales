#!/usr/bin/env python3
"""
Fill in real-world detail for the airports the exports only name by IATA code.

    python database/scripts/backfill_airports.py <reference-file>

The reference file is any of:
  * mwgg/Airports airports.json   -- {"VVTS": {"iata": "SGN", "name": ..., "tz": ...}}
  * a JSON array of the same objects
  * an OurAirports-style airports.csv with iata_code / name / municipality /
    iso_country / latitude_deg / longitude_deg columns

Writes database/sql/03_airports_backfill.sql -- one UPDATE ... FROM (VALUES ...)
statement covering every airport it could resolve.

utc_offset_minutes is the STANDARD-time offset (the one that holds when daylight
saving is not in effect), found by walking a year of the IANA zone. The IANA name
is stored alongside it so the app can do full DST maths later if it ever wants to.

The script checks itself: the game's own stopover timings pin down the offset of
every airport a stopover passes through, and those are compared against the
reference data. Any disagreement is printed and written into the report.
"""

from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
CSV_DIR = ROOT / "database" / "csv"
SQL_OUT = ROOT / "database" / "sql" / "03_airports_backfill.sql"
REPORT = ROOT / "database" / "reports" / "airport_backfill_report.md"

# The only hand-entered facts in this script: where each carrier's own clock
# sits. Everything else about every other airport is derived from these plus
# the flight timings in the export.
HUB_ANCHORS = {
    "SGN": 7 * 60, "HAN": 7 * 60, "DAD": 7 * 60, "CXR": 7 * 60, "PQC": 7 * 60,  # Vietnam
    "ICN": 9 * 60,                                                              # Korea
}

# Ground time the game leaves between the two legs of a stopover.
STOPOVER_CONNECTION_MINUTES = 60

# Codes the reference file gets wrong, mapped to the ICAO key holding the right
# record. FRU (Bishkek Manas) is filed there under the stale code BSZ.
ICAO_FALLBACK = {
    "FRU": "UCFM",
}


def standard_offset_minutes(tz_name: str) -> int | None:
    """Offset from UTC in minutes when daylight saving is *not* in effect."""
    try:
        zone = ZoneInfo(tz_name)
    except Exception:
        return None
    fallback = None
    probe = datetime(2026, 1, 1, 12, 0)
    for month in range(12):
        moment = (probe + timedelta(days=31 * month)).replace(tzinfo=zone)
        offset, dst = moment.utcoffset(), moment.dst()
        if offset is None:
            continue
        if fallback is None:
            fallback = int(offset.total_seconds() // 60)
        if dst is not None and dst == timedelta(0):
            return int(offset.total_seconds() // 60)
    return fallback


def load_reference(path: Path) -> tuple[dict[str, dict], dict[str, dict]]:
    """Return ({IATA: record}, {ICAO: record}) from any supported file."""
    out: dict[str, dict] = {}
    by_icao: dict[str, dict] = {}

    def take(rec: dict) -> None:
        code = (rec.get("iata") or rec.get("iata_code") or "").strip().upper()
        icao = (rec.get("icao") or rec.get("ident") or "").strip().upper()
        if not icao and (len(code) != 3 or not code.isalpha()):
            return
        lat = rec.get("lat", rec.get("latitude_deg"))
        lon = rec.get("lon", rec.get("longitude_deg"))
        try:
            lat = float(lat) if lat not in (None, "") else None
            lon = float(lon) if lon not in (None, "") else None
        except (TypeError, ValueError):
            lat = lon = None
        parsed = {
            "name": (rec.get("name") or "").strip() or None,
            "city": (rec.get("city") or rec.get("municipality") or "").strip() or None,
            "country": (rec.get("country") or rec.get("iso_country") or "").strip().upper() or None,
            "tz": (rec.get("tz") or rec.get("timezone") or "").strip() or None,
            "lat": lat,
            "lon": lon,
        }
        if len(code) == 3 and code.isalpha():
            out.setdefault(code, parsed)
        if icao:
            by_icao.setdefault(icao, parsed)

    if path.suffix.lower() == ".csv":
        with path.open(encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh):
                take(row)
    else:
        data = json.loads(path.read_text(encoding="utf-8"))
        records = data.values() if isinstance(data, dict) else data
        for rec in records:
            if isinstance(rec, dict):
                take(rec)
    return out, by_icao


def derive_offsets_from_stopovers() -> dict[str, int]:
    """
    Every stopover in the export lands at an airport and departs again after a
    fixed ground time. Because both timestamps are local to their own airport,
    the difference reveals the stop's offset relative to the origin hub:

        naive_gap = (child_departure - (parent_departure + block)) mod 24h
                  = (offset_stop - offset_origin) + connection

    Returns {IATA: utc_offset_minutes} for everything reachable from a hub.
    """
    flights = []
    for path in sorted((ROOT / "database" / "original_json").glob("*/flights_list.json")):
        flights.extend(json.loads(path.read_text(encoding="utf-8")))
    by_id = {f["flightId"]: f for f in flights}
    known = dict(HUB_ANCHORS)
    edges = []
    for parent in flights:
        child_id = parent.get("childStopoverFlightId")
        if not child_id or child_id not in by_id:
            continue
        child = by_id[child_id]
        arrival = parent["departureDailyTimestamp"] + parent["outboundFlightDuration"] * 60
        gap = ((child["departureDailyTimestamp"] - arrival) % 86400) // 60
        delta = (gap - STOPOVER_CONNECTION_MINUTES) % 1440
        if delta > 720:
            delta -= 1440
        edges.append((parent["originAirport"], child["originAirport"], delta))

    # one hop from a hub covers the whole export, but loop anyway
    for _ in range(4):
        for origin, stop, delta in edges:
            if origin in known and stop not in known:
                known[stop] = known[origin] + delta
    return known


def sql_literal(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, (int, float)):
        return repr(value)
    return "'" + str(value).replace("'", "''") + "'"


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        print("ERROR: pass the path to a reference airport file.", file=sys.stderr)
        return 2
    ref_path = Path(sys.argv[1])
    if not ref_path.exists():
        print("ERROR: {} does not exist.".format(ref_path), file=sys.stderr)
        return 2

    wanted = [r["iata_code"] for r in
              csv.DictReader((CSV_DIR / "airports.csv").open(encoding="utf-8"))]
    print("airports to fill: {}".format(len(wanted)))

    reference, by_icao = load_reference(ref_path)
    print("reference records with an IATA code: {}".format(len(reference)))

    derived = derive_offsets_from_stopovers()
    print("offsets the flight data itself determines: {}".format(len(derived)))

    rows, missing, mismatches = [], [], []
    for code in wanted:
        rec = reference.get(code) or by_icao.get(ICAO_FALLBACK.get(code, ""))
        if not rec:
            missing.append(code)
            continue
        offset = standard_offset_minutes(rec["tz"]) if rec["tz"] else None
        if code in derived and offset is not None and derived[code] != offset:
            mismatches.append((code, derived[code], offset, rec["tz"]))
        rows.append({
            "iata": code,
            "name": rec["name"],
            "city": rec["city"],
            "country": rec["country"] if rec["country"] and len(rec["country"]) == 2 else None,
            "tz": rec["tz"],
            "offset": offset,
            "lat": rec["lat"],
            "lon": rec["lon"],
        })

    print("resolved: {}   unresolved: {}   offset disagreements: {}"
          .format(len(rows), len(missing), len(mismatches)))
    for code, want, got, tz in mismatches:
        print("  ! {}: flight data implies {:+d} min, {} gives {:+d} min"
              .format(code, want, tz, got))

    # ---------------------------------------------------------------- SQL
    values = ",\n".join(
        "    ({}, {}, {}, {}, {}, {}, {}, {})".format(
            sql_literal(r["iata"]), sql_literal(r["name"]), sql_literal(r["city"]),
            sql_literal(r["country"]), sql_literal(r["tz"]),
            "null" if r["offset"] is None else str(r["offset"]),
            sql_literal(r["lat"]), sql_literal(r["lon"]))
        for r in rows)

    sql = """-- =====================================================================
--  KarinationGroup reservations database -- airport backfill
--
--  Generated by database/scripts/backfill_airports.py from {source}
--  on {stamp}. Do not edit by hand; re-run the script instead.
--
--  {n_ok} of {n_all} airports resolved, {n_missing} left with a code only.
--  utc_offset_minutes is the standard-time (non-DST) offset; the IANA name
--  in timezone is the authority if the app wants full DST handling.
--
--  Cross-checked against the {n_derived} offsets that the export's own
--  stopover timings determine: {verdict}.
-- =====================================================================

begin;

update public.airports a
   set airport_name = v.airport_name,
       city_name    = v.city_name,
       country_code = coalesce(v.country_code, a.country_code),
       timezone     = v.timezone,
       utc_offset_minutes = v.utc_offset_minutes,
       offset_source = case when v.utc_offset_minutes is null
                            then a.offset_source else 'iana_standard_time' end,
       latitude     = v.latitude,
       longitude    = v.longitude
  from (values
{values}
  ) as v (iata_code, airport_name, city_name, country_code,
          timezone, utc_offset_minutes, latitude, longitude)
 where a.iata_code = v.iata_code;

commit;

-- Airports still carrying nothing but a code:
--   select iata_code from public.airports where airport_name is null order by 1;
""".format(source=ref_path.name,
           stamp=datetime.now().strftime("%Y-%m-%d"),
           n_ok=len(rows), n_all=len(wanted), n_missing=len(missing),
           n_derived=len(derived),
           verdict="all agree" if not mismatches
                   else "{} disagree, see the report".format(len(mismatches)),
           values=values)
    SQL_OUT.write_text(sql, encoding="utf-8")
    print("+ {}".format(SQL_OUT.relative_to(ROOT)))

    # ------------------------------------------------------------- report
    lines = ["# Airport backfill report", "",
             "Source: `{}`".format(ref_path.name), "",
             "| metric | value |", "|---|---:|",
             "| airports in the database | {} |".format(len(wanted)),
             "| resolved from the reference | {} |".format(len(rows)),
             "| left with a code only | {} |".format(len(missing)),
             "| offsets derived from flight timings | {} |".format(len(derived)),
             "| of those, disagreeing with the reference | {} |".format(len(mismatches)),
             "", "## Validation against the export's own timings", ""]
    if mismatches:
        lines += ["| airport | implied by flight data | reference | zone |", "|---|---:|---:|---|"]
        lines += ["| {} | {:+d} | {:+d} | {} |".format(c, w, g, tz)
                  for c, w, g, tz in mismatches]
    else:
        lines.append("Every airport whose offset the stopover timings pin down matches "
                     "the reference data exactly.")
    lines += ["", "A row above is not necessarily a bad offset. The derivation assumes every "
              "stopover connects in {} minutes; where the game allows a longer connection, "
              "the extra shows up here as an apparent offset difference. Treat the "
              "reference column as correct unless the gap is a whole number of hours."
              .format(STOPOVER_CONNECTION_MINUTES)]
    lines += ["", "## Unresolved airports", "",
              ", ".join(missing) if missing else "None."]
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("+ {}".format(REPORT.relative_to(ROOT)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
