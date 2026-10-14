# 253 — A new count schedule kept a name that no longer described it

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · confirming issue 242's split screens (Piggles as The Marrow Review)
**Surface:** Stock › Counting schedules › New schedule, sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** sparx as Doty and Piggles as The Marrow Review, 2026-10-13
**Blocked on:** —

## What happened

A new counting schedule opens already named "Top-value stock, monthly", matching its
starting choices. Rosalind changed "Which stock" to "Everything at this location" and
set it up. It was saved as "Top-value stock, monthly": a name that says the opposite of
what the schedule counts. The name is what the schedule list, the tab, and the toast
("Schedule set up. Top-value stock, monthly: next count …") all show.

The starting name is a fixed string. Nothing updates it when the choices it describes
change.

## What should have happened

Until the owner types a name of their own, the name follows the choices: "Everything
here, monthly", "Mid-value stock, every quarter". Once they type one, it is theirs.

## How to reproduce

1. Stock › Counting schedules › New schedule.
2. Change "Which stock" to "Everything at this location". Look at "What to call it".

## Why it matters

A schedule list where the names lie about what each one counts cannot be trusted at a
glance, which is what a list is for.

## Where it lives

`surfaces/inventory/count-schedule-detail.tsx` (sparx) and the split Piggles files
(`count-schedule-draft.ts`, `use-count-schedule-draft.ts`, `count-schedule-setup-cards.tsx`).

## The fix

A new `count-schedule-name.ts` per console: `suggestedScheduleName` builds the name from
what it counts and how often ("Everything here, monthly", "Top-value stock in Mezzanine,
every 10 days"). On a new schedule, each change renames it until a name is typed; a typed
name is kept. Tests: `count-schedule-name.test.ts` in both (red on the form, green).

One slip on the way: sparx's form already had a local `scheduleName` (the tab title),
which hid the function's first name. Lint caught it as an error type; it is called
`suggestedScheduleName` now.

## Confirmed by

- sparx, Doty: the name went "Top-value stock, monthly", then "Everything here, monthly",
  then "Everything here, every quarter". A typed "Concord Park full count" held through a
  cadence change, and the toast said "Concord Park full count: next count 10/13/2026."
- Piggles, Rosalind: "Top-value stock, monthly", then "Everything here, monthly"; a typed
  "Back-issue shelves, every month" held through a cadence change and was saved.

## Rating effect

Counting schedule (new): the name says what it counts.
