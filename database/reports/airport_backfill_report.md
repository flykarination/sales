# Airport backfill report

Source: `airports_reference.json`

| metric | value |
|---|---:|
| airports in the database | 481 |
| resolved from the reference | 481 |
| left with a code only | 0 |
| offsets derived from flight timings | 28 |
| of those, disagreeing with the reference | 1 |

## Validation against the export's own timings

| airport | implied by flight data | reference | zone |
|---|---:|---:|---|
| ALG | +90 | +60 | Africa/Algiers |

A row above is not necessarily a bad offset. The derivation assumes every stopover connects in 60 minutes; where the game allows a longer connection, the extra shows up here as an apparent offset difference. Treat the reference column as correct unless the gap is a whole number of hours.

## Unresolved airports

None.
