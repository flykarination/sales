# KarinationGroup Information


## 0. Task brief
To convert data from JSON to CSV and to prepare data to be suitable for Supabase.
Data rows should be linked to one another correctly.
This is to build the groundwork for a database-powered reservations site.


## 1. File structure

(root)
kxgroup_info.json
kxgroup_stats.json
db_notes.md
|
-- Karination
---- codeshares_list.json
---- fleet_detail.json
---- fleet_summary.json
---- flights_list.json

-- FORZA
-- Sonder


## 2. Our member carriers
1. Karination
2. FORZA
3. Sonder

More information about each carrier is found in kxgroup_info.json. It contains the following essential information fields for each carrier: uid, airlineCode, airlineName, hubAirports, airlineCountry, alliance


## 3. Key name meanings
This section contains the meaning of the JSON row keys, whose values are specific for the airline/fleet/etc. It is separated by filename for ease of processing. Only rows essential for this reservations database are explained. The rest should be interpreted as trivial.

### 3.1. kxgroup_info.json
introduces the name, IATA code, 2-letter country code, and hub airports of each carrier in the group.

- "uid": The ID of the airline within the TAS game system. Each airline has a unique uid and this serves as a primary key to many tables.
- "airlineCode": The IATA code of the airline. Flight numbers are always displayed as "(code) (number)"
- "airlineName": Name of the airline.
- "hubAirports": The IATA code of the airline's hubs. Flights can only originate or terminate at a hub unless it is the second leg of a stopover.
- "airlineCountry": The 2-letter country code of the country the airline first grows from.
- "alliance": (optional) The name of the alliance which the airline is a member of.

### 3.2. kxgroup_stats.json
introduces the number of aircrafts, routes, flights, flagship aircraft type, and major hub airport of each carrier in the group. 

- "uid": FK -> kxgroup_info.json/uid
- "numAircraft": The number of aircrafts owned by the airline. Does not necessarily have to be operating.
- "numRoutes": The number of routes operated by the airline. Does not necessarily have to have flights.
- "numFlights": The number of flight pairs operated by the airline. Each pair is a depart/return number pairing.
- "flagshipAircraft": The aircraft that is the most common in the airline's fleet.

### 3.3. codeshares_list.json
Each carrier has its own file. It details every codeshare flight that is operated by the main carrier but also allows other carriers within the alliance to sell tickets on.
- "codeshareId": the unique identifier for a particular partnership. Each flights may have several codeshare airlines, then for each airline there is a relationship.
- "operatingFlightId": FK -> flights_list.json/flightId
- "operatingUid": FK -> the uid of the airline owning the plane to fly the route. On booking engines, display as "operated by <airline name>"
- "marketingUid": the uid of the airline that is also partnering to sell tickets on the route. Is not a member of our KarinationGroup.

### 3.4 fleet_detail.json
Each carrier has its own file. It details each and every aircraft owned by the airline.
- "aircraftId": the unique identifier for the specific aircraft. To be matched with the aircraftId operating each flight on each day.
- "uid": FK -> kxgroup_info.json/uid
- "aircraftModel": The model of the aircraft.
- "registration": The registration of the aircraft. Usable within each group as a backup aircraftId.

### 3.5. flights_list.json
The big one. Each carrier has its own file. It details each and every flight operated by the airline. Each flight is a depart/return pair.
- "flightId": the unique identifier for the specific flight within the TAS server. Helpful to distinguish between flights by own carrier, serving as a unique ID number.
- "uid": FK -> kxgroup_info.json/uid
- "outboundFlightNumber": the number of the outbound flight
- "inboundFlightNumber": the number of the inbound flight
- "flightString": the two ends of the flight in 3-letter IATA format.
- "originAirport": the airport where the outbound flight leaves.
- "destinationAirport": the airport where the inboudn flight leaves.
- "departureDailyTimestamp": the time of day the outbound flight leaves, in seconds from 00:00. Therefore e.g. 78300 = 21:45
- "outboundFlightDuration": duration of the outbound flight in minutes, to be shown on the booking engine.
- "inboundFlightDuration": duration of the inbound flight in minutes, to be shown on the booking engine.
- "isStopover": boolean whether the flight is a stopover. if TRUE: has a second leg.
- "childStopoverFlightId": The flightId of the second leg, if one exists.
- "aircraftAssignments": details the assigned aircraft to the flight on each day of the week.
-- Each key is an aircraftId.
-- Each value is a nested set of key-value pairs for the specific aircraft:
--- "bizPax": the number of business class tickets on sale.
--- "ecoPax": the number of economy class tickets on sale.
--- "dowList": an array containing the date of the week in which the aircraft is assigned on the route. 0 for Monday, 1 for Tuesday, going to 6 for Sunday.
--- "bizPrice": the business class ticket price in US dollars.
--- "ecoPrice": the economy class ticket price in US dollars.
--- "firstPax:" the number of first class tickets on sale.
--- "aircraftId": aircraftId as above.
--- "firstPrice": the first class ticket price in US dollars.
--- "premEcoPax": the number of premium economy class tickets on sale.
--- "premEcoPrice": the premium economy class ticket price in US dollars.

There are no add-ons or flexible fare classes within this virtual world, however I might add some at my own discretion.


