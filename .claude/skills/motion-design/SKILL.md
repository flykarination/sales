---
name: motion-design
description: How motion works on the Karination site - v2 "kinetic light" outside the booking funnel, the calm sanctioned set inside it, the Motion library patterns to use, and the performance and reduced-motion rules. Use whenever adding or reviewing any animation, transition or loading state.
---

# Motion

The library is `motion` (motion.dev), already installed. Import from
`motion/react` -- but **not on the home page or anything it imports**: any
`motion.*` element pulls the whole animation engine into the first-load
bundle (+136 kB, measured November 2026). Use CSS animations, a passive
scroll listener, or `@/lib/useReducedMotion` there.

## Two territories (v2, November 2026)

The owner chose "kinetic light" for the v2 rebrand: **outside the booking
funnel, motion is the brand.** The night sky (stars, rainbow auroras, a
shooting star), the fluoro streak sliding through headline letters as you
scroll, the aircraft crossing the hero, destinations sliding past in a
marquee -- all sanctioned on marketing pages (home, destinations, fleet,
About, RainbowOne, news). See `web/src/styles/v2.css` and
`web/src/components/v2/`.

**Inside the funnel** (search results, passengers, payment, confirmation,
manage booking, check-in), the rules below still hold: one signature moment,
everything else under 200ms. The fluoro may appear there only as a still edge
light (`.kx-dayfall::before`), never moving behind text someone is reading.

Wherever it is, ambient motion must:

- move by `transform` and `opacity` only (the fluoro text's
  `background-position` on a few words is the one exception);
- pause when its section is off screen (`data-paused` on `.kx-night`) and
  when the tab is hidden;
- have a sensible final frame, because `index.css` snaps every CSS animation
  to its end under `prefers-reduced-motion`;
- if it advances content (the hero gallery), stop on hover and focus, offer
  a pause button (WCAG 2.2.2), and never auto-advance under reduced motion.

The "Never" list below applies in full inside the funnel. Outside it, the
first two items are relaxed for the v2 effects listed above, and only them.

## The budget (inside the funnel)

**One signature moment. Everything else is under 200ms and unnoticeable.**

Karination's signature is the **rainbow arc draw**: selecting a route draws its
great-circle arc across the map, origin to destination, in a spectrum gradient.
That is the only animation allowed to be *watched*. Every other piece of motion
exists to stop the interface feeling jumpy, and if a user notices it, it is too
much.

Scattered effects are the strongest tell of a machine-made page. Spend the
boldness once.

## The signature: rainbow arc draw

```tsx
import { motion } from 'motion/react'

<motion.path
  d={greatCirclePath(from, to, projection)}
  stroke="url(#kx-spectrum)"
  strokeWidth={1.5}
  fill="none"
  strokeLinecap="round"
  initial={{ pathLength: 0, opacity: 0 }}
  animate={{ pathLength: 1, opacity: 1 }}
  transition={{
    pathLength: { duration: 1.1, ease: [0.22, 1, 0.36, 1] },
    opacity: { duration: 0.2 },
  }}
/>
```

Rules for it:

- It draws **once** per selection, origin to destination, never looping.
- The gradient runs along the arc, so the `linearGradient` needs
  `gradientUnits="userSpaceOnUse"` with x1/y1/x2/y2 set to the projected
  endpoints — otherwise the spectrum orients to the bounding box and every arc
  looks different for no reason.
- Arcs already on screen do not redraw when a new one is added.
- With reduced motion, the arc appears at full length instantly. It is never
  removed — the information is the point, the drawing is the flourish.

## The sanctioned set

Nothing outside this list without a reason.

| where | what | duration |
|---|---|---|
| hover on a result row | background wash, 1px rule darkens | 120ms |
| focus | outline appears, no transition | 0 |
| result list arriving | fade + 4px rise, stagger 20ms, cap 8 items | 220ms |
| search pending | skeleton rows at the real row height | — |
| step change in the funnel | crossfade, no slide | 180ms |
| accordion / details | height auto, ease-paint | 200ms |
| number changing (load factor, seats left) | count up, tabular figures | 400ms |

`--ease-paint` (`cubic-bezier(0.22, 1, 0.36, 1)`) is the house curve: fast out,
settled landing. Use it for anything spatial. Use plain `ease-out` for opacity.

## Never

- Parallax, scroll-jacking, or reveal-on-scroll for body content. Timetables are
  read, not scrolled through cinematically.
- Looping ambient animation behind text.
- Animating `width`, `height`, `top` or `left`. Transform and opacity only —
  anything else lands on the main thread and stutters a 100-row results list.
- Staggering more than 8 items. Row 30 arriving half a second late reads as lag.
- Animating a price or a seat count into place before the user can read it.
- Motion as the only signal that something changed. Pair it with text.

## Reduced motion is a hard requirement

`index.css` already zeroes durations globally under
`prefers-reduced-motion: reduce`. That covers CSS, **not** Motion's JS-driven
values — those need the hook:

```tsx
import { useReducedMotion } from 'motion/react'

const reduced = useReducedMotion()
<motion.div animate={{ opacity: 1, y: reduced ? 0 : 0 }} ... />
```

Every `motion` component that moves something must consult it. The end state is
always identical; only the journey is skipped.

## Performance

- The route map can carry hundreds of arcs. Animate only the **selected** one;
  render the rest as static paths.
- `layout` animations are expensive — do not put them on list items.
- Prefer CSS transitions for simple hover states; reach for Motion only when
  there is orchestration, `pathLength`, or an exit animation.
- Anything animating during a search must not block the results rendering.
