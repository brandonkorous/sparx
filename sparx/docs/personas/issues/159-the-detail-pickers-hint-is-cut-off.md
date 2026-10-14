# 159 — The detail picker's hint is cut off

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · act 10 (a campaign)
**Surface:** workbench › Campaigns › a campaign › "What counts as success"; the same condition editor in Automations
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08
**Blocked on:** —

## What happened

In "Winter fleet readiness, 2026", Doty clicked "Add a condition". The new row's empty
detail box read "Pick a detail, like Booking · St". The hint stops in the middle of a
word.

## What should have happened

The hint fits its box and tells Doty what to do. Since issue 158, the box finds a
detail by the words an owner uses ("paid" finds "Order · Payment", "booked" finds
"Booking · Status"). The hint can say that, and it is the more useful thing to say.

## How to reproduce

1. As Doty, open Campaigns › "Winter fleet readiness, 2026".
2. Under "What counts as success", click "Add a condition".
3. Read the empty detail box. Every time, at the workbench's normal width.

## Why it matters

Cosmetic, and it is the first thing the owner reads in a new row. A cut word reads
as a broken screen, and the example it was cut from is the one part that helps.

## Where it lives

- `sparx/apps/workbench/surfaces/automations/condition-editor.tsx`, `ConditionRow`:
  `placeholder="Pick a detail, like Booking · Status"` in a `w-72` box.
- `piggles/apps/workbench/surfaces/automations/condition-editor.tsx`: the same.

## Fix

The hint now reads "Type a word, like booked" in both consoles' `condition-editor.tsx`.
It fits the box, and it tells the owner what the search understands since issue 158
(a value or an everyday word, not only the detail's name). Copy only; no test.

## Confirmed by

P01 on screen, 2026-10-08: "Winter fleet readiness, 2026" › "Add a condition"; the empty
detail box reads "Type a word, like booked" in full. The test row was removed unsaved.

## Rating effect

—
