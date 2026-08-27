---
name: ui-ux-craft
description: Interaction and layout craft standards for the Karination site - spacing and hierarchy, control and form behaviour, every interactive state, responsive rules, and the accessibility floor. Use when building or reviewing any component or page, alongside frontend-design for aesthetics and airline-ux-patterns for domain conventions.
---

# UI/UX craft

Three skills divide the work: `frontend-design` decides how it looks,
`airline-ux-patterns` decides what must be true of a flight page, and this
decides whether it is well made. This one is about the parts users feel rather
than notice.

## Hierarchy

One thing is the most important on every screen, and it is the largest. On the
landing page that is the search widget, not the tagline. On a results row it is
the departure time. On confirmation it is the PNR.

Size, weight and colour should agree with each other. If a heading needs a
colour *and* a size *and* a weight *and* a rule to read as a heading, the scale
is wrong.

Establish level with space, not with boxes. A card around everything is what a
design does when the spacing has not been thought about.

## Spacing

Use a 4px base. The whole site should read as multiples of 4, and mostly of 8.

Space belongs to what it separates: a label sits closer to its own field than to
the field above. When two elements are equidistant from a third, they read as a
group — check that they actually are one.

Vertical rhythm beats horizontal decoration. Two sections separated by 64px of
nothing read as more distinct than two sections separated by 16px and a border.

## Controls

Every interactive element needs all six states designed, not just the default:

`default` · `hover` · `focus-visible` · `active` · `disabled` · `loading`

- **Hit target** is at least 44×44 CSS px on touch, even when the visible
  control is smaller. Pad the target, do not inflate the design.
- **Disabled** must explain itself. A greyed-out button with no reason beside it
  is a dead end; either say what is missing or leave it enabled and validate on
  submit.
- **Loading** replaces the label with a spinner *and* keeps the button's width,
  so the layout does not jump. The button stays disabled during the request.
- **Destructive** actions are never the default focus target.

Buttons say what they do: `Search flights`, `Confirm and book`. Never `Submit`,
never `Continue` when something more specific is true. The verb on the button
matches the verb in the confirmation that follows.

## Forms

- Labels are always visible. Placeholders are examples, not labels — they vanish
  exactly when the user needs them.
- One column. Multi-column forms cause skipped fields.
- Validate on blur, not on every keystroke; show success only where it is
  reassuring (a valid PNR), never on every field.
- Errors sit next to the field, in words, saying how to fix it. Never a summary
  at the top alone, never colour alone, never a toast that disappears.
- Inputs that expect a specific format (dates, PNRs) accept whatever the user
  types and normalise it, rather than rejecting `sgn` because it is lowercase.
- `autocomplete` attributes on every name, email and phone field.

## Empty, loading, error

Every list has three non-happy states, and all three must be designed:

- **Empty because nothing exists yet** — explain what will appear here and offer
  the action that creates it.
- **Empty because the filter excluded everything** — say which filter, and offer
  to clear it. On a flight search, offer the nearest dates that do have flights.
- **Failed** — say what failed and offer retry. Never blame the user, never
  apologise, never say "Oops".

Skeletons match the real content's dimensions. A skeleton that is a different
height from what replaces it causes a jump, which is worse than a spinner.

## Responsive

Design the narrow layout first; it forces the hierarchy to be honest.

- Breakpoints belong where the content breaks, not at device widths.
- A results row becomes a stacked block on mobile, but the departure time stays
  the largest element in it.
- Tables scroll horizontally inside their own container; the page body never
  scrolls sideways.
- Anything hover-only needs a tap equivalent. Tooltips carrying real information
  are a bug on touch.
- Test at 320px. It still has to work.

## Accessibility floor

Not optional, not a later pass.

- Semantic elements first: `button` for actions, `a` for navigation, real
  `label` elements, one `h1` per page, headings in order.
- Visible focus on everything focusable, and focus moves somewhere sensible
  after a route change or a search.
- 4.5:1 on text, 3:1 on interactive boundaries and icons. Check the brand hues —
  bright turquoise fails on paper and is dark-surfaces-only.
- Colour is never the only carrier of meaning. Cabin hues always ship with the
  cabin name.
- Live regions for anything that updates without a navigation: search result
  counts, availability changes.
- `aria-label` on icon-only controls. Decorative images get `alt=""`.
- Keyboard: no traps, escape closes overlays, arrow keys move within composite
  widgets like the date picker.

## Self-check before calling a component done

1. Tab through it with the mouse untouched. Can you complete the task?
2. Shrink to 320px. Does anything overflow or overlap?
3. Turn on reduced motion. Does anything still move?
4. Empty state, error state, loading state — do all three exist?
5. Read the labels aloud. Do they say what the thing does?
6. Remove one element. Is the screen better? If yes, leave it removed.
