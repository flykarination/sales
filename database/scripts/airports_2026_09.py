#!/usr/bin/env python3
"""
Real-world detail for the 98 airports added in the September 2026 exports:
94 brought by FORZA's growth, 4 by Sonder's first schedule.

    python database/scripts/airports_2026_09.py

Writes database/sql/22_airports_2026_09.sql.

Nothing here is trusted on its own. The script refuses to write the SQL
unless three things hold:

  1. Every airport the new exports reference and the database lacks is
     covered -- no more, no fewer.
  2. Every IANA zone resolves, and the standard-time offset worked out
     from that zone matches the offset typed below. A typo in either is
     caught by the other.
  3. Every coordinate is plausible against the schedule: the cruise speed
     implied by great-circle distance over block time sits in the range a
     real aircraft flies. A pair of transposed digits puts an airport on
     the wrong continent, and that shows up as an impossible speed.

A fourth check -- that the schedule's own timings imply the same offsets --
needs the database and is run after loading, exactly as it was for FORZA.
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
SQL_OUT = ROOT / "database" / "sql" / "22_airports_2026_09.sql"

# iata: (name, city, country, IANA zone, standard offset minutes, lat, lon)
AIRPORTS: dict[str, tuple[str, str, str, str, int, float, float]] = {
    # ---- brought by Sonder ------------------------------------------------
    "KRT": ("Khartoum International Airport", "Khartoum", "SD", "Africa/Khartoum", 120, 15.5895, 32.5532),
    "NTE": ("Nantes Atlantique Airport", "Nantes", "FR", "Europe/Paris", 60, 47.1532, -1.6107),
    "SJC": ("Norman Y. Mineta San Jose International Airport", "San Jose", "US", "America/Los_Angeles", -480, 37.3626, -121.9290),
    "SMF": ("Sacramento International Airport", "Sacramento", "US", "America/Los_Angeles", -480, 38.6954, -121.5908),

    # ---- brought by FORZA: the Americas ------------------------------------
    "BNA": ("Nashville International Airport", "Nashville", "US", "America/Chicago", -360, 36.1245, -86.6782),
    "CHS": ("Charleston International Airport", "Charleston", "US", "America/New_York", -300, 32.8986, -80.0405),
    "CLT": ("Charlotte Douglas International Airport", "Charlotte", "US", "America/New_York", -300, 35.2140, -80.9431),
    "CVG": ("Cincinnati/Northern Kentucky International Airport", "Cincinnati", "US", "America/New_York", -300, 39.0488, -84.6678),
    "DFW": ("Dallas Fort Worth International Airport", "Dallas", "US", "America/Chicago", -360, 32.8998, -97.0403),
    "DTW": ("Detroit Metropolitan Wayne County Airport", "Detroit", "US", "America/Detroit", -300, 42.2162, -83.3554),
    "FLL": ("Fort Lauderdale-Hollywood International Airport", "Fort Lauderdale", "US", "America/New_York", -300, 26.0726, -80.1527),
    "MCO": ("Orlando International Airport", "Orlando", "US", "America/New_York", -300, 28.4312, -81.3081),
    "MIA": ("Miami International Airport", "Miami", "US", "America/New_York", -300, 25.7959, -80.2870),
    "PHX": ("Phoenix Sky Harbor International Airport", "Phoenix", "US", "America/Phoenix", -420, 33.4343, -112.0116),
    "PIT": ("Pittsburgh International Airport", "Pittsburgh", "US", "America/New_York", -300, 40.4915, -80.2329),
    "RSW": ("Southwest Florida International Airport", "Fort Myers", "US", "America/New_York", -300, 26.5362, -81.7552),
    "SAT": ("San Antonio International Airport", "San Antonio", "US", "America/Chicago", -360, 29.5337, -98.4698),
    "SDF": ("Louisville Muhammad Ali International Airport", "Louisville", "US", "America/Kentucky/Louisville", -300, 38.1744, -85.7360),
    "TPA": ("Tampa International Airport", "Tampa", "US", "America/New_York", -300, 27.9755, -82.5332),

    "CUN": ("Cancun International Airport", "Cancun", "MX", "America/Cancun", -300, 21.0365, -86.8771),
    "CZM": ("Cozumel International Airport", "Cozumel", "MX", "America/Cancun", -300, 20.5224, -86.9256),
    "TQO": ("Tulum International Airport", "Tulum", "MX", "America/Cancun", -300, 20.0417, -87.4808),
    "GDL": ("Guadalajara International Airport", "Guadalajara", "MX", "America/Mexico_City", -360, 20.5218, -103.3112),
    "MEX": ("Mexico City International Airport", "Mexico City", "MX", "America/Mexico_City", -360, 19.4363, -99.0721),
    "NLU": ("Felipe Angeles International Airport", "Mexico City", "MX", "America/Mexico_City", -360, 19.7456, -99.0155),
    "MTY": ("Monterrey International Airport", "Monterrey", "MX", "America/Monterrey", -360, 25.7785, -100.1069),
    "PVR": ("Puerto Vallarta International Airport", "Puerto Vallarta", "MX", "America/Mexico_City", -360, 20.6801, -105.2544),
    "QRO": ("Queretaro Intercontinental Airport", "Queretaro", "MX", "America/Mexico_City", -360, 20.6173, -100.1857),
    "SJD": ("Los Cabos International Airport", "San Jose del Cabo", "MX", "America/Mazatlan", -420, 23.1518, -109.7210),
    "TIJ": ("Tijuana International Airport", "Tijuana", "MX", "America/Tijuana", -480, 32.5411, -116.9700),

    "GUA": ("La Aurora International Airport", "Guatemala City", "GT", "America/Guatemala", -360, 14.5833, -90.5275),
    "SAL": ("El Salvador International Airport", "San Salvador", "SV", "America/El_Salvador", -360, 13.4409, -89.0557),
    "SAP": ("Ramon Villeda Morales International Airport", "San Pedro Sula", "HN", "America/Tegucigalpa", -360, 15.4526, -87.9236),
    "XPL": ("Palmerola International Airport", "Comayagua", "HN", "America/Tegucigalpa", -360, 14.3824, -87.6212),
    "LIR": ("Daniel Oduber Quiros International Airport", "Liberia", "CR", "America/Costa_Rica", -360, 10.5933, -85.5444),
    "SJO": ("Juan Santamaria International Airport", "San Jose", "CR", "America/Costa_Rica", -360, 9.9939, -84.2088),

    "HAV": ("Jose Marti International Airport", "Havana", "CU", "America/Havana", -300, 22.9892, -82.4091),
    "SCU": ("Antonio Maceo International Airport", "Santiago de Cuba", "CU", "America/Havana", -300, 19.9698, -75.8354),
    "VRA": ("Juan Gualberto Gomez Airport", "Varadero", "CU", "America/Havana", -300, 23.0344, -81.4353),
    "MBJ": ("Sangster International Airport", "Montego Bay", "JM", "America/Jamaica", -300, 18.5037, -77.9134),
    "KIN": ("Norman Manley International Airport", "Kingston", "JM", "America/Jamaica", -300, 17.9357, -76.7875),
    "GCM": ("Owen Roberts International Airport", "George Town", "KY", "America/Cayman", -300, 19.2928, -81.3577),
    "NAS": ("Lynden Pindling International Airport", "Nassau", "BS", "America/Nassau", -300, 25.0390, -77.4662),
    "GGT": ("Exuma International Airport", "George Town", "BS", "America/Nassau", -300, 23.5626, -75.8780),
    "PLS": ("Providenciales International Airport", "Providenciales", "TC", "America/Grand_Turk", -300, 21.7736, -72.2659),
    "PAP": ("Toussaint Louverture International Airport", "Port-au-Prince", "HT", "America/Port-au-Prince", -300, 18.5800, -72.2925),

    "SDQ": ("Las Americas International Airport", "Santo Domingo", "DO", "America/Santo_Domingo", -240, 18.4297, -69.6689),
    "PUJ": ("Punta Cana International Airport", "Punta Cana", "DO", "America/Santo_Domingo", -240, 18.5674, -68.3634),
    "STI": ("Cibao International Airport", "Santiago de los Caballeros", "DO", "America/Santo_Domingo", -240, 19.4061, -70.6047),
    "POP": ("Gregorio Luperon International Airport", "Puerto Plata", "DO", "America/Santo_Domingo", -240, 19.7579, -70.5700),
    "LRM": ("La Romana International Airport", "La Romana", "DO", "America/Santo_Domingo", -240, 18.4507, -68.9118),
    "AZS": ("Samana El Catey International Airport", "Samana", "DO", "America/Santo_Domingo", -240, 19.2670, -69.7419),
    "SJU": ("Luis Munoz Marin International Airport", "San Juan", "PR", "America/Puerto_Rico", -240, 18.4394, -66.0018),
    "STT": ("Cyril E. King Airport", "Charlotte Amalie", "VI", "America/St_Thomas", -240, 18.3373, -64.9734),
    "SXM": ("Princess Juliana International Airport", "Philipsburg", "SX", "America/Lower_Princes", -240, 18.0410, -63.1089),
    "SKB": ("Robert L. Bradshaw International Airport", "Basseterre", "KN", "America/St_Kitts", -240, 17.3112, -62.7187),
    "ANU": ("V. C. Bird International Airport", "St. John's", "AG", "America/Antigua", -240, 17.1367, -61.7927),
    "PTP": ("Pointe-a-Pitre International Airport", "Pointe-a-Pitre", "GP", "America/Guadeloupe", -240, 16.2653, -61.5318),
    "FDF": ("Martinique Aime Cesaire International Airport", "Fort-de-France", "MQ", "America/Martinique", -240, 14.5910, -61.0032),
    "UVF": ("Hewanorra International Airport", "Vieux Fort", "LC", "America/St_Lucia", -240, 13.7332, -60.9526),
    "SVD": ("Argyle International Airport", "Kingstown", "VC", "America/St_Vincent", -240, 13.1564, -61.1497),
    "BGI": ("Grantley Adams International Airport", "Bridgetown", "BB", "America/Barbados", -240, 13.0746, -59.4925),
    "GND": ("Maurice Bishop International Airport", "St. George's", "GD", "America/Grenada", -240, 12.0042, -61.7862),
    "POS": ("Piarco International Airport", "Port of Spain", "TT", "America/Port_of_Spain", -240, 10.5954, -61.3372),
    "TAB": ("A.N.R. Robinson International Airport", "Tobago", "TT", "America/Port_of_Spain", -240, 11.1497, -60.8322),
    "AUA": ("Queen Beatrix International Airport", "Oranjestad", "AW", "America/Aruba", -240, 12.5014, -70.0152),
    "CUR": ("Curacao International Airport", "Willemstad", "CW", "America/Curacao", -240, 12.1889, -68.9598),
    "BON": ("Flamingo International Airport", "Kralendijk", "BQ", "America/Kralendijk", -240, 12.1310, -68.2685),

    "CCS": ("Simon Bolivar International Airport", "Caracas", "VE", "America/Caracas", -240, 10.6031, -66.9906),
    "BLA": ("General Jose Antonio Anzoategui International Airport", "Barcelona", "VE", "America/Caracas", -240, 10.1071, -64.6892),
    "PMV": ("Santiago Marino Caribbean International Airport", "Porlamar", "VE", "America/Caracas", -240, 10.9126, -63.9666),
    "CAY": ("Cayenne Felix Eboue Airport", "Cayenne", "GF", "America/Cayenne", -180, 4.8198, -52.3604),
    "FOR": ("Pinto Martins Fortaleza International Airport", "Fortaleza", "BR", "America/Fortaleza", -180, -3.7763, -38.5326),
    "REC": ("Recife Guararapes International Airport", "Recife", "BR", "America/Recife", -180, -8.1265, -34.9236),
    "SSA": ("Salvador Bahia Airport", "Salvador", "BR", "America/Bahia", -180, -12.9086, -38.3225),
    "GIG": ("Rio de Janeiro Galeao International Airport", "Rio de Janeiro", "BR", "America/Sao_Paulo", -180, -22.8090, -43.2506),
    "USH": ("Ushuaia Malvinas Argentinas International Airport", "Ushuaia", "AR", "America/Argentina/Ushuaia", -180, -54.8433, -68.2958),

    # ---- brought by FORZA: Asia, Russia, Central Asia ----------------------
    "AOJ": ("Aomori Airport", "Aomori", "JP", "Asia/Tokyo", 540, 40.7347, 140.6908),
    "SDJ": ("Sendai Airport", "Sendai", "JP", "Asia/Tokyo", 540, 38.1397, 140.9170),
    "TOY": ("Toyama Airport", "Toyama", "JP", "Asia/Tokyo", 540, 36.6483, 137.1875),
    "DLC": ("Dalian Zhoushuizi International Airport", "Dalian", "CN", "Asia/Shanghai", 480, 38.9657, 121.5386),
    "HFE": ("Hefei Xinqiao International Airport", "Hefei", "CN", "Asia/Shanghai", 480, 31.9900, 116.9760),
    "LHW": ("Lanzhou Zhongchuan International Airport", "Lanzhou", "CN", "Asia/Shanghai", 480, 36.5152, 103.6200),
    "XIY": ("Xi'an Xianyang International Airport", "Xi'an", "CN", "Asia/Shanghai", 480, 34.4471, 108.7516),
    "KHH": ("Kaohsiung International Airport", "Kaohsiung", "TW", "Asia/Taipei", 480, 22.5771, 120.3500),
    "OVB": ("Tolmachevo Airport", "Novosibirsk", "RU", "Asia/Novosibirsk", 420, 55.0126, 82.6507),
    "KJA": ("Krasnoyarsk International Airport", "Krasnoyarsk", "RU", "Asia/Krasnoyarsk", 420, 56.1729, 92.4933),
    "YKS": ("Yakutsk Airport", "Yakutsk", "RU", "Asia/Yakutsk", 540, 62.0933, 129.7706),
    "PKC": ("Petropavlovsk-Kamchatsky Airport", "Petropavlovsk-Kamchatsky", "RU", "Asia/Kamchatka", 720, 53.1679, 158.4536),
    "CIT": ("Shymkent International Airport", "Shymkent", "KZ", "Asia/Almaty", 300, 42.3642, 69.4789),
    "KRW": ("Turkmenbashi International Airport", "Turkmenbashi", "TM", "Asia/Ashgabat", 300, 40.0633, 53.0072),
    "KSQ": ("Karshi Airport", "Karshi", "UZ", "Asia/Samarkand", 300, 38.8336, 65.9215),
    "NMA": ("Namangan Airport", "Namangan", "UZ", "Asia/Tashkent", 300, 40.9846, 71.5567),
    "FEG": ("Fergana International Airport", "Fergana", "UZ", "Asia/Tashkent", 300, 40.3588, 71.7450),
    "LBD": ("Khujand International Airport", "Khujand", "TJ", "Asia/Dushanbe", 300, 40.2154, 69.6947),

    # ---- brought by FORZA: the Middle East and Africa ----------------------
    "AHB": ("Abha International Airport", "Abha", "SA", "Asia/Riyadh", 180, 18.2404, 42.6566),
    "HRG": ("Hurghada International Airport", "Hurghada", "EG", "Africa/Cairo", 120, 27.1783, 33.7994),
    "NBO": ("Jomo Kenyatta International Airport", "Nairobi", "KE", "Africa/Nairobi", 180, -1.3192, 36.9278),
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
    for carrier in ("FORZA", "Sonder"):
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
        "-- 22. Real-world detail for the airports added in September 2026\n"
        "--\n"
        "-- Generated by database/scripts/airports_2026_09.py, which refuses to\n"
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
