#!/usr/bin/env python3
"""
Real-world detail for the 24 airports added by the 4 November 2026 scrape:
mostly FORZA's and Sonder's reach into South America, plus Bermuda,
Mazar-i-Sharif, Omsk, Yuzhno-Sakhalinsk and Saipan.

    python database/scripts/airports_2026_11.py "<comma-separated codes>"

Writes database/sql/28_airports_2026_11.sql. The checks are September's
(see airports_2026_09.py): coverage exact, every zone resolves to its typed
standard offset, and every sector implies a speed a real aircraft flies --
now checked against all three airlines' schedules, since Karination brought
new destinations this time too.
"""

from __future__ import annotations

import csv
import json
import math
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "database" / "original_json"
SQL_OUT = ROOT / "database" / "sql" / "28_airports_2026_11.sql"

# iata: (name, city, country, IANA zone, standard offset minutes, lat, lon)
AIRPORTS: dict[str, tuple[str, str, str, str, int, float, float]] = {
    # ---- South America ------------------------------------------------------
    "BOG": ("El Dorado International Airport", "Bogota", "CO", "America/Bogota", -300, 4.7016, -74.1469),
    "CLO": ("Alfonso Bonilla Aragon International Airport", "Cali", "CO", "America/Bogota", -300, 3.5432, -76.3816),
    "CTG": ("Rafael Nunez International Airport", "Cartagena", "CO", "America/Bogota", -300, 10.4424, -75.5130),
    "MDE": ("Jose Maria Cordova International Airport", "Medellin", "CO", "America/Bogota", -300, 6.1645, -75.4231),
    "UIO": ("Mariscal Sucre International Airport", "Quito", "EC", "America/Guayaquil", -300, -0.1292, -78.3575),
    "GYE": ("Jose Joaquin de Olmedo International Airport", "Guayaquil", "EC", "America/Guayaquil", -300, -2.1574, -79.8836),
    "LIM": ("Jorge Chavez International Airport", "Lima", "PE", "America/Lima", -300, -12.0219, -77.1143),
    "CBB": ("Jorge Wilstermann International Airport", "Cochabamba", "BO", "America/La_Paz", -240, -17.4211, -66.1771),
    "VVI": ("Viru Viru International Airport", "Santa Cruz", "BO", "America/La_Paz", -240, -17.6448, -63.1354),
    "GEO": ("Cheddi Jagan International Airport", "Georgetown", "GY", "America/Guyana", -240, 6.4985, -58.2541),
    "PBM": ("Johan Adolf Pengel International Airport", "Paramaribo", "SR", "America/Paramaribo", -180, 5.4528, -55.1878),
    "BSB": ("Brasilia International Airport", "Brasilia", "BR", "America/Sao_Paulo", -180, -15.8711, -47.9186),
    "CNF": ("Tancredo Neves International Airport", "Belo Horizonte", "BR", "America/Sao_Paulo", -180, -19.6244, -43.9719),
    "GRU": ("Sao Paulo Guarulhos International Airport", "Sao Paulo", "BR", "America/Sao_Paulo", -180, -23.4356, -46.4731),
    "VCP": ("Viracopos International Airport", "Campinas", "BR", "America/Sao_Paulo", -180, -23.0074, -47.1345),
    "CWB": ("Afonso Pena International Airport", "Curitiba", "BR", "America/Sao_Paulo", -180, -25.5285, -49.1758),
    "FLN": ("Hercilio Luz International Airport", "Florianopolis", "BR", "America/Sao_Paulo", -180, -27.6703, -48.5525),
    "MVD": ("Carrasco International Airport", "Montevideo", "UY", "America/Montevideo", -180, -34.8384, -56.0308),
    "COR": ("Ingeniero Ambrosio Taravella International Airport", "Cordoba", "AR", "America/Argentina/Cordoba", -180, -31.3236, -64.2080),
    # ---- North Atlantic -----------------------------------------------------
    "BDA": ("L.F. Wade International Airport", "Bermuda", "BM", "Atlantic/Bermuda", -240, 32.3640, -64.6787),
    # ---- Asia and the Pacific -----------------------------------------------
    "MZR": ("Mazar-i-Sharif International Airport", "Mazar-i-Sharif", "AF", "Asia/Kabul", 270, 36.7069, 67.2097),
    "OMS": ("Omsk Tsentralny Airport", "Omsk", "RU", "Asia/Omsk", 360, 54.9670, 73.3105),
    "UUS": ("Yuzhno-Sakhalinsk Airport", "Yuzhno-Sakhalinsk", "RU", "Asia/Sakhalin", 660, 46.8887, 142.7180),
    "SPN": ("Francisco C. Ada Saipan International Airport", "Saipan", "MP", "Pacific/Saipan", 600, 15.1190, 145.7290),
}


def standard_offset_minutes(zone: str) -> int:
    """The offset that holds when daylight saving is not in effect: the
    smallest UTC offset the zone uses across a year. Same method as
    backfill_airports.py."""
    tz = ZoneInfo(zone)
    start = datetime(2026, 1, 1)
    return min(
        int((start + timedelta(days=d)).replace(tzinfo=tz).utcoffset().total_seconds() // 60)
        for d in range(0, 366, 7)
    )


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def main() -> int:
    failures: list[str] = []

    # ---- 1. coverage --------------------------------------------------------
    known = {r["iata_code"]: r for r in csv.DictReader(open(ROOT / "database" / "csv" / "airports.csv", encoding="utf-8"))}
    referenced: set[str] = set()
    for carrier in ("Karination", "FORZA", "Sonder"):
        for f in json.load(open(SRC / carrier / "flights_list.json", encoding="utf-8")):
            referenced.update((f["originAirport"], f["destinationAirport"]))
    needs = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None
    if needs is not None:
        missing = sorted(needs - AIRPORTS.keys())
        extra = sorted(AIRPORTS.keys() - needs)
        if missing:
            failures.append(f"coverage: no entry for {missing}")
        if extra:
            failures.append(f"coverage: entries nobody needs {extra}")

    # ---- 2. zones and offsets ----------------------------------------------
    for iata, (_, _, _, zone, offset, _, _) in AIRPORTS.items():
        try:
            derived = standard_offset_minutes(zone)
        except Exception as e:  # unknown zone
            failures.append(f"{iata}: zone {zone!r} does not resolve ({e})")
            continue
        if derived != offset:
            failures.append(f"{iata}: typed offset {offset} but {zone} is {derived}")

    # ---- 3. coordinates against the schedule --------------------------------
    # Existing coordinates are not in the CSV -- the builder emits airports as
    # bare codes and the detail is applied afterwards in SQL -- so they are
    # read from the generated front-end table, which mirrors the database.
    import re
    coords: dict[str, tuple[float, float]] = {}
    ts = (ROOT / "web" / "src" / "data" / "airports.ts").read_text(encoding="utf-8")
    for m in re.finditer(r'iata: "([A-Z]{3})".*?lat: (-?[\d.]+), lon: (-?[\d.]+)', ts):
        coords[m.group(1)] = (float(m.group(2)), float(m.group(3)))
    for iata, (_, _, _, _, _, lat, lon) in AIRPORTS.items():
        coords[iata] = (lat, lon)

    worst: list[tuple[float, str]] = []
    for carrier in ("Karination", "FORZA", "Sonder"):
        for f in json.load(open(SRC / carrier / "flights_list.json", encoding="utf-8")):
            o, d = f["originAirport"], f["destinationAirport"]
            if o not in AIRPORTS and d not in AIRPORTS:
                continue
            if o not in coords or d not in coords:
                continue
            minutes = f.get("outboundFlightDuration") or 0
            if not minutes:
                continue
            km = haversine_km(coords[o], coords[d])
            # block time includes taxi, so allow slow short hops and fast
            # long-haul tailwinds, but nothing no airliner could do
            kmh = km / (minutes / 60)
            if kmh < 180 or kmh > 1050:
                failures.append(f"{o}-{d}: {km:.0f} km in {minutes} min is {kmh:.0f} km/h")
            worst.append((kmh, f"{o}-{d}"))

    if failures:
        print("REFUSING to write SQL:")
        for f in failures:
            print("  -", f)
        return 1

    worst.sort()
    print(f"{len(AIRPORTS)} airports: every zone resolves and every offset matches its zone.")
    print(f"{len(worst)} sectors checked against block time: "
          f"slowest {worst[0][1]} {worst[0][0]:.0f} km/h, fastest {worst[-1][1]} {worst[-1][0]:.0f} km/h.")

    # ---- write --------------------------------------------------------------
    def q(s: str) -> str:
        return "'" + s.replace("'", "''") + "'"

    rows = ",\n".join(
        f"    ({q(i)}, {q(n)}, {q(c)}, {q(cc)}, {q(z)}, {o}, {la}, {lo})"
        for i, (n, c, cc, z, o, la, lo) in sorted(AIRPORTS.items())
    )
    SQL_OUT.write_text(
        "-- =====================================================================\n"
        "-- 28. Real-world detail for the airports added on 4 November 2026\n"
        "--\n"
        "-- Generated by database/scripts/airports_2026_11.py, which refuses to\n"
        "-- write this file unless every zone resolves, every offset matches its\n"
        "-- zone, and every coordinate gives a plausible speed against the\n"
        "-- schedule. utc_offset_minutes is standard time, as in 03 and 20.\n"
        "-- =====================================================================\n\n"
        "begin;\n\n"
        "update public.airports a\n"
        "set airport_name = v.name, city_name = v.city, country_code = v.country,\n"
        "    timezone = v.tz, utc_offset_minutes = v.offset_min,\n"
        "    latitude = v.lat, longitude = v.lon\n"
        "from (values\n" + rows + "\n"
        ") as v(iata, name, city, country, tz, offset_min, lat, lon)\n"
        "where a.iata_code = v.iata;\n\n"
        "commit;\n",
        encoding="utf-8",
    )
    print(f"wrote {SQL_OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
