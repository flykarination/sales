#!/usr/bin/env python3
"""
Push database/csv/*.csv into a hosted Supabase project over its REST API.

For when psql is not installed. Uses nothing but the Python standard library.

    set SUPABASE_URL=https://<project-ref>.supabase.co
    set SUPABASE_SERVICE_ROLE_KEY=<service role key>
    python database/scripts/load_to_supabase.py

    ...or pass them positionally:
    python database/scripts/load_to_supabase.py <url> <service_role_key>

Run 01_schema.sql in the Supabase SQL editor first -- this script only moves
rows, it does not create tables.

Use the SECRET key (sb_secret_...) or a legacy service_role JWT, from
Project Settings -> API Keys. Only those bypass row level security, which is
what makes the load possible; the publishable key will be rejected. Keep it out
of the browser and out of version control.

Tables are loaded in foreign-key order and upserted, so re-running is safe.
"""

from __future__ import annotations

import csv
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV_DIR = ROOT / "database" / "csv"
BATCH = 500

# (table, conflict target) in an order the foreign keys allow
TABLES = [
    ("airports",               "iata_code"),
    ("airlines",               "uid"),
    ("aircraft_models",        "aircraft_model"),
    ("cabin_classes",          "cabin_code"),
    ("airline_hubs",           "airline_uid,airport_iata"),
    ("airline_stats",          "airline_uid"),
    ("aircraft",               "aircraft_id"),
    ("flights",                "flight_id"),
    ("flight_assignments",     "flight_id,aircraft_id"),
    ("flight_assignment_days", "flight_id,aircraft_id,day_of_week"),
    ("flight_fares",           "flight_id,aircraft_id,cabin_code"),
    ("codeshares",             "codeshare_id"),
]


def coerce(value: str):
    """CSV is all strings; give PostgREST proper JSON types."""
    if value == "":
        return None
    low = value.lower()
    if low == "true":
        return True
    if low == "false":
        return False
    try:
        return int(value)
    except ValueError:
        pass
    try:
        return float(value)
    except ValueError:
        return value


def post(url: str, key: str, table: str, conflict: str, rows: list[dict]) -> None:
    body = json.dumps(rows).encode("utf-8")
    request = urllib.request.Request(
        "{}/rest/v1/{}?on_conflict={}".format(url.rstrip("/"), table, conflict),
        data=body,
        method="POST",
        headers={
            "apikey": key,
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "Content-Profile": "public",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            response.read()
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", "replace")[:600]
        raise SystemExit(
            "\nFAILED on {} (HTTP {}):\n{}\n\n"
            "If this says a relation does not exist, run 01_schema.sql first."
            .format(table, err.code, detail))


def main() -> int:
    url = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("SUPABASE_URL", "")).strip()
    key = (sys.argv[2] if len(sys.argv) > 2
           else os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")).strip()
    if not url or not key:
        print(__doc__)
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
              file=sys.stderr)
        print("       SUPABASE_URL is the Project URL "
              "(https://<ref>.supabase.co), not a postgresql:// string.",
              file=sys.stderr)
        return 2
    if "supabase.co" not in url:
        print("WARNING: {} does not look like a Supabase project URL.".format(url),
              file=sys.stderr)

    print("target: {}".format(url))
    grand_total = 0
    for table, conflict in TABLES:
        path = CSV_DIR / (table + ".csv")
        if not path.exists():
            print("  -- {:<24} no CSV, skipped".format(table))
            continue
        with path.open(encoding="utf-8", newline="") as fh:
            rows = [{k: coerce(v) for k, v in row.items()} for row in csv.DictReader(fh)]
        sent = 0
        for start in range(0, len(rows), BATCH):
            post(url, key, table, conflict, rows[start:start + BATCH])
            sent += len(rows[start:start + BATCH])
            print("  .. {:<24} {}/{}".format(table, sent, len(rows)), end="\r")
        print("  OK {:<24} {} rows        ".format(table, len(rows)))
        grand_total += len(rows)

    print("\n{} rows loaded.".format(grand_total))
    print("Next: run 04_views.sql, 05_reservations.sql, 06_demand_simulation.sql "
          "and 07_rls_policies.sql in the SQL editor.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
