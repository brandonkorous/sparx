# 169 — The bill listed a line called "staff"

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · act 11 (team)
**Surface:** workbench › Your sparx bill › What makes up your bill
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08 (sparx)
**Blocked on:** —

## What happened

Every other line on the bill has a name and a line under it: "Wholesale · Trade
pricing and accounts $99.00/mo", "Bookings · Appointments and classes $29.00/mo". One
line reads only "staff", lowercase, with nothing under it, at $29.00/mo.

## What should have happened

The module's name, the way the Modules screen and the sidebar name it, and a line on
what it is for.

## How to reproduce

1. As anyone at Gillett, open Your sparx bill (the trial banner's "Add payment
   method" goes there).
2. The line above the total. Every time.

## Why it matters

The one thing a bill must do is say what each dollar is for. "staff" reads as a code.

## Where it lives

`sparx/apps/workbench/surfaces/finance/subscription.tsx` kept its own table of twelve
module names (`MODULE_LABELS`). There are sixteen modules; `staff`, `social`,
`finance` and `funnels` fell through to the slug. Its names also disagreed with the
Modules screen ("Website builder" against "Website"). Piggles had the same table.

## The fix

- `surfaces/modules/data.ts` (both consoles): `moduleBillLabel(slug)`, the name and
  line the Modules screen gives the module, from the one catalog (`MODULE_META`). A
  slug the catalog has never heard of is still shown as words, never as a slug.
- `surfaces/finance/subscription.tsx` (both consoles): the table is gone; each line
  uses `moduleBillLabel`.
- `surfaces/finance/bill-lines.test.ts` (both consoles): every module's bill line is
  its Modules-screen name and line; "staff" reads "Your team"; no slug ever; the bill
  screen keeps no table of its own. Red 4 of 4 before the change in sparx, green
  after; Piggles' copy was added after its change and run green only. Lint clean.
  Typecheck not run (Brandon: leave it for now).

## Confirmed by

P01 on screen, 2026-10-08 (sparx, as Alyssa): Your sparx bill lists "Your team · Keep
hours, pay rates, shifts, time off and license renewals, so you know what an hour of
work really costs. Not payroll: sparx hands the hours to whoever runs yours.
$29.00/mo", and every other line under its Modules-screen name. Total $440.00.

Not checked on screen: Piggles (its test passes).

## Rating effect

—
