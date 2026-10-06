# 089 — The search box counted ten orders out of fifteen

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 5 (checking Show more for issue 087)
**Surface:** workbench › Search everything (both consoles); every search that reports a count: products, customers, orders, everything, the support search
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Gillett has fifteen orders, O-000001 to O-000015, every one in the search index. Doty typed "O-0000". The box listed eight orders and said "13 records matched. 2 more match and are not shown yet." She pressed Show more and got two more, then "15 records matched." Orders O-000001 to O-000005 never appeared, and nothing said they existed.

## What should have happened

"N records matched" is a count. Fifteen orders start with "O-0000", so the box finds fifteen, and Show more reaches all of them.

## How to reproduce

1. As Doty, open Search everything and type "O-0000".
2. Before the fix: 8 orders shown, "2 more"; Show more stops at O-000006. Every time.
3. Straight to the engine: the same query asking for 5 rows reported `found: 4`; asking for 16 reported `found: 10`.

## Why it matters

The count is the one thing on the screen that says whether what she is looking for exists. Here it said five real orders did not, and the number moved with how many rows the box happened to ask for. It is the same for a customer name, a product name or any half-typed word, not only order numbers.

## Where it lives

Typesense grows the last, half-typed word of a query into the indexed words it starts, but only into its `max_candidates` best ones, which defaults to 4. Its `found` counts what those few words match. No search in `wizeworks/packages/search/src/search.ts` or `operator.ts` set it.

## The fix

`EVERY_PREFIX = { max_candidates: 100 }` in `search.ts`, sent by every search that reports a count: products (and the fleet-ranked product search), customers, orders, everything, the three searches inside the search box, and the support search for customers and orders. One setting, one place. Measured on the engine: at 50 and at 100, "O-0000" found 15 at any page size, in 0 ms.

Siblings checked: the admin counts ask `q: '*'`, which grows no word, so they are untouched.

Test: `search/src/every-prefix-counts.test.ts` runs each search through a fake engine and checks what it asked for. Taking the setting out reddens exactly 8 of 9 (the ninth checks the value itself).

## Confirmed by

On screen, 2026-10-06, as Doty: "O-0000" now reads "13 records matched. 7 more match and are not shown yet." Show more lists O-000015 down to O-000001, all fifteen, "20 records matched." (five tasks and fifteen orders).

Also on screen the same day: the Products list, "Fleec", "Showing 1–50 of 52" against 52 in the database; the Customers list, "wasatchu", 3 people, all three of Wasatch's. In Piggles as Devi (Juniper Row), "INV-0000" listed all 16 invoices plus supplier invoice FT-INV-2291, "17 records matched."

## Rating effect

—
