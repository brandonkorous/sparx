# 184 — Cores owed chased cores for parts that never left the shop

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 13 (a core comes back on an account order)
**Surface:** Workbench › Commerce › Cores owed (and its "Out over 30 days" and "Out over 60 days" filters)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Cores owed listed six deposit lines. None of those parts had been handed over: O-000008
(six injectors for Wasatch), O-000012, O-000018 and O-000020 have no fulfillment at all,
and O-000020 is still waiting for sign-off. Each row said the customer owed its cores,
"6 days" or "2 days" out, counted from the day the order was placed. The header added
O-000020's two deposits ($300.00) to money Doty "would give back", on an order nobody
has paid or received.

## What should have happened

A customer owes an old part once they have the new one. A deposit line is listed for the
parts handed over, and "Out for" counts from the handover. A core that comes in early can
still be recorded from the order.

## How to reproduce

1. Place an order with a core charge. Do not mark it collected or shipped.
2. Commerce › Cores owed: it is listed as owed, "N days" out from the order date.

## Why it matters

Doty chases a fleet for six old injectors they have not been given yet. The "Out over 30
days" filter fills with orders still on the shelf.

## Where it lives

`wizeworks/packages/commerce/src/services/core-service.ts` `listOwed`: owed is
`coresOwed(line)` (quantity less refunded, returned, kept), with no look at what was
handed over; `daysOut` and `olderThanDays` read `order.placedAt`.

## The fix

- `wizeworks/packages/commerce-schemas/src/cores.ts`: `coresOutstanding(line)`, one core
  per part handed over (less those back, kept, or returned as a part); a send-first line
  owes its old part from the start.
- `core-service.ts` `listOwed`: lists what is outstanding, counts "Out for" from the
  first fulfillment that carried the line, and filters "over 30/60 days" on that, in
  code (no column holds it). A core that comes in early can still be recorded from the
  order.
- Workbench, both consoles: `CoreLine.outstanding`; the order page badge splits "N cores
  still owed" from "N cores due once handed over" (info, not warning). The dialog says
  "still to come back from", true either way.

Tests, red first: `cores-deposit-split.test.ts` (5 for `coresOutstanding`),
`core-service.test.ts` (4 for the list), `core-line-words.test.ts` in each console (3).

## Confirmed by

P01 on screen, 2026-10-09: Cores owed lists only O-000003, Brynn's send-first injector
waiting on its old part; the account orders whose parts have not gone out are gone. On
O-000008 (six injectors, "To send") the badge reads "6 cores due once handed over".

A part-sent line, on screen 2026-10-19: O-000008 had 2 of 6 injectors picked, packed and sent.
Cores owed read "O-000008 · 2 of 6 · $300.00 off INV-000003" (the invoice is still open), and
the order read "2 of 6 sent so far · 2 cores still owed · 4 cores due once handed over". The
check found [355] to [359]. Piggles not opened.

## Rating effect

—
