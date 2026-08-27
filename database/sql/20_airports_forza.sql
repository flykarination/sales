-- =====================================================================
-- 20. Real-world detail for the 29 airports FORZA adds
--
-- The exports name airports by IATA code only, so every one arrives bare
-- and is filled in afterwards. 03_airports_backfill.sql did this for the
-- 481 airports Karination reaches; these are the ones only FORZA flies
-- to.
--
-- utc_offset_minutes is STANDARD time -- the offset that holds when
-- daylight saving is not in effect -- which is the convention
-- 03_airports_backfill.sql established and which the arrival-time maths
-- in 04_views.sql depends on. The IANA zone is stored beside it so the
-- app can do full DST maths later if it ever wants to.
--
-- Coordinates are the runway reference point, to four decimals (~11 m).
-- =====================================================================

begin;

update public.airports a
set airport_name       = v.name,
    city_name          = v.city,
    country_code       = v.country,
    timezone           = v.tz,
    utc_offset_minutes = v.offset_min,
    latitude           = v.lat,
    longitude          = v.lon
from (values
    ('ADD', 'Addis Ababa Bole International Airport',        'Addis Ababa',   'ET', 'Africa/Addis_Ababa',            180,   8.9779,   38.7993),
    ('AEP', 'Aeroparque Jorge Newbery',                      'Buenos Aires',  'AR', 'America/Argentina/Buenos_Aires', -180, -34.5592,  -58.4156),
    ('BCN', 'Josep Tarradellas Barcelona-El Prat Airport',   'Barcelona',     'ES', 'Europe/Madrid',                  60,  41.2971,    2.0785),
    ('BFS', 'Belfast International Airport',                 'Belfast',       'GB', 'Europe/London',                   0,  54.6575,   -6.2158),
    ('BHX', 'Birmingham Airport',                            'Birmingham',    'GB', 'Europe/London',                   0,  52.4539,   -1.7480),
    ('BOJ', 'Burgas Airport',                                'Burgas',        'BG', 'Europe/Sofia',                  120,  42.5696,   27.5152),
    ('BRS', 'Bristol Airport',                               'Bristol',       'GB', 'Europe/London',                   0,  51.3827,   -2.7191),
    ('CRL', 'Brussels South Charleroi Airport',              'Charleroi',     'BE', 'Europe/Brussels',                60,  50.4592,    4.4538),
    ('DTB', 'Sisingamangaraja XII International Airport',    'Silangit',      'ID', 'Asia/Jakarta',                  420,   2.2597,   98.9917),
    ('DUB', 'Dublin Airport',                                'Dublin',        'IE', 'Europe/Dublin',                   0,  53.4213,   -6.2701),
    ('EDI', 'Edinburgh Airport',                             'Edinburgh',     'GB', 'Europe/London',                   0,  55.9500,   -3.3725),
    ('FRA', 'Frankfurt Airport',                             'Frankfurt',     'DE', 'Europe/Berlin',                  60,  50.0379,    8.5622),
    ('HNL', 'Daniel K. Inouye International Airport',        'Honolulu',      'US', 'Pacific/Honolulu',             -600,  21.3187, -157.9224),
    ('HOF', 'Al-Ahsa International Airport',                 'Al-Ahsa',       'SA', 'Asia/Riyadh',                   180,  25.2853,   49.4851),
    ('JED', 'King Abdulaziz International Airport',          'Jeddah',        'SA', 'Asia/Riyadh',                   180,  21.6796,   39.1565),
    ('JRO', 'Kilimanjaro International Airport',             'Arusha',        'TZ', 'Africa/Dar_es_Salaam',          180,  -3.4294,   37.0745),
    ('LOS', 'Murtala Muhammed International Airport',        'Lagos',         'NG', 'Africa/Lagos',                   60,   6.5774,    3.3212),
    ('MAD', 'Adolfo Suarez Madrid-Barajas Airport',          'Madrid',        'ES', 'Europe/Madrid',                  60,  40.4719,   -3.5626),
    ('NBE', 'Enfidha-Hammamet International Airport',        'Enfidha',       'TN', 'Africa/Tunis',                   60,  36.0758,   10.4386),
    ('PMI', 'Palma de Mallorca Airport',                     'Palma',         'ES', 'Europe/Madrid',                  60,  39.5517,    2.7388),
    ('SCL', 'Arturo Merino Benitez International Airport',   'Santiago',      'CL', 'America/Santiago',             -240, -33.3930,  -70.7858),
    ('SFO', 'San Francisco International Airport',           'San Francisco', 'US', 'America/Los_Angeles',          -480,  37.6213, -122.3790),
    ('SNN', 'Shannon Airport',                               'Shannon',       'IE', 'Europe/Dublin',                   0,  52.7019,   -8.9248),
    ('STR', 'Stuttgart Airport',                             'Stuttgart',     'DE', 'Europe/Berlin',                  60,  48.6899,    9.2220),
    ('SVX', 'Koltsovo Airport',                              'Yekaterinburg', 'RU', 'Asia/Yekaterinburg',            300,  56.7431,   60.8027),
    ('TBU', 'Fuaamotu International Airport',                'Nukualofa',     'TO', 'Pacific/Tongatapu',             780, -21.2412, -175.1496),
    ('UNN', 'Ranong Airport',                                'Ranong',        'TH', 'Asia/Bangkok',                  420,   9.7778,   98.5855),
    ('VRN', 'Verona Villafranca Airport',                    'Verona',        'IT', 'Europe/Rome',                    60,  45.3957,   10.8885),
    ('YVR', 'Vancouver International Airport',               'Vancouver',     'CA', 'America/Vancouver',            -480,  49.1939, -123.1844)
) as v(iata, name, city, country, tz, offset_min, lat, lon)
where a.iata_code = v.iata;

commit;
