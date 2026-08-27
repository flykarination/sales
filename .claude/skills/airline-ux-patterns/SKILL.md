---
name: airline-ux-patterns
description: Conventions real airline booking sites follow - search widget, results and fare presentation, timetable typography, stopover and codeshare display, the booking funnel, and the accessibility rules travel sites are held to. Use when designing or building any passenger-facing flight page, alongside frontend-design for the visual direction.
---

# Airline UX patterns

`frontend-design` decides how the site should *look*. This decides what has to
be *true* about it. Travellers read these pages under time pressure and have
thirty years of muscle memory for how they work; breaking the conventions reads
as amateur no matter how good the art direction is.

## The one rule

**An airline page is a document about facts, not a marketing page with a form on
it.** Times, durations, fares and seat counts are the content. Art direction
happens around them, never on top of them. If a design choice makes a departure
time harder to read at a glance, the design choice loses.

## Search widget

- Origin and destination, dates, passengers, cabin. Nothing else above the fold.
- Airport fields autocomplete on **both** IATA code and city name - people type
  "SGN" and they type "Saigon". Show `CITY (CODE) - Airport Name`.
- Never a free-text airport field that can submit an unmatched string.
- A one-way / return toggle changes which date inputs exist; do not grey out a
  return date, remove it.
- Passenger count and cabin belong in the same popover, and the trigger shows a
  summary: "2 adults, Economy".
- Swap-direction button between origin and destination. Small, obvious, animated.

## Results

Order by price ascending by default, and say so. Offer duration and departure
time as alternative sorts.

Each result must show, without interaction:

| element | rule |
|---|---|
| departure and arrival time | largest type in the row; 24-hour clock |
| origin and destination | IATA code, with the city name secondary |
| date rollover | `+1` superscript next to the arrival time, never a new line |
| duration | `12h 45m`, never `765 minutes` or `12.75h` |
| stops | "Direct" or "1 stop - SLL", never "0 stops" |
| operating carrier | "Operated by ..." whenever it differs from the marketing one |
| aircraft | secondary; enthusiasts care, most travellers do not |
| price | per passenger, currency explicit, aligned right |

A results row is a horizontal band, not a card grid. Cards force the eye to
zigzag; travellers scan a column of times and a column of prices.

## Times, everywhere

- All times are **local to their own airport**. Print them bare. Never render a
  timezone conversion, a UTC offset, or a "your time" toggle - it is the single
  most common way to make a timetable wrong.
- 24-hour clock throughout. It is unambiguous and it is what timetables use.
- Tabular figures (`font-variant-numeric: tabular-nums`) on every time, duration
  and price, so columns align down the page.
- Duration is a computed fact - show it, do not make people subtract.

## Stopovers

A one-stop journey under a single flight number is **one flight with a stop**,
not two flights. Render it as one row with the via-point on the connecting line,
and show the ground time ("1h 00m in SLL"). Two separate flight numbers would be
a connection and would be presented as two rows.

## Fares and cabins

- Cabin order is always First, Business, Premium Economy, Economy.
- Show a per-cabin lead-in price on the same row when it fits: travellers
  upgrade at the results stage, not later.
- Never display a cabin the aircraft does not sell. An empty or $0 cabin is a
  bug on screen.
- Scarcity messaging must be true. Only show "3 seats left" when the number
  genuinely came from live availability, and never invent urgency.

## The funnel

Search -> results -> passenger details -> confirmation. Four steps, a visible
step indicator, and the itinerary summary pinned throughout so the traveller can
always see what they are buying and for how much.

- Never lose the selected flight on a back navigation.
- Total price is visible at every step, and it only ever goes up if the
  traveller added something themselves.
- Passenger name fields: given name and family name separately, matching the
  passport. One "full name" field causes ticketing errors.
- Confirmation shows the **PNR** in large, letter-spaced, monospace type - it is
  the one thing on the page they will write down or screenshot.
- Retrieval takes PNR plus email. Say clearly that both are needed.

## Empty, loading, error

- A route with no flights gets "No flights on this date" plus the nearest dates
  that do have them. Never a bare empty list.
- Skeleton rows while searching, matching the real row height, so the page does
  not jump.
- A failed search offers a retry. A failed booking must never be ambiguous about
  whether money moved.

## Accessibility

Travel sites are held to a higher bar than most, and are routinely litigated.

- Every time and duration needs a screen-reader-friendly label: the visible text
  may read `07:20`, the accessible name should read "departs 7:20 AM".
- The date picker must be usable by keyboard alone, and there must be a typed
  date input as an alternative.
- Results update announced via a live region: "12 flights found".
- 4.5:1 contrast minimum on every price, time and label. Airline brand colours
  are frequently mid-tone and fail this - check rather than assume.
- Never encode meaning in colour alone. A "cheapest" flag needs a word or icon.
- Focus must be visible and must move to the results heading after a search.

## Things that consistently look cheap

Stock photography of smiling cabin crew. Full-bleed hero images that push the
search widget below the fold. Gradient buttons. Countdown timers. Fake
"7 people are viewing this". Rounded-corner cards for flight results. Centre-
aligned body text. Times in 12-hour clock without am/pm. Prices without a
currency.
