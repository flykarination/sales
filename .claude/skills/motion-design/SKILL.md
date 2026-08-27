---
name: motion-design
description: How motion works on the Karination site - the one signature moment, the small set of sanctioned transitions, the Motion library patterns to use, and the performance and reduced-motion rules. Use whenever adding or reviewing any animation, transition or loading state.
---

# Motion

The library is `motion` (motion.dev), already installed. Import from
`motion/react`.

## The budget

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
