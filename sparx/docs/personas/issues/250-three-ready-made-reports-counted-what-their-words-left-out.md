# 250 — Three ready-made reports counted what their own words left out

**Status:** open
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · confirming issue 247 (Customers › Build a report, as Doty)
**Surface:** the reports sparx ships, for every business, in both consoles
**Filed:** 2026-10-13
**Fixed:** —
**Confirmed by:** —
**Blocked on:** —

## What happened

With issue 247 fixed, "Where your deals are" could finally be read. Its rows were First
call (2), Trial order, Visited their yard, Proposal sent, and **Lost**. Its description
says "How many open deals are sitting at each step of your process". A lost deal is not
open. The report has no filter at all.

Checking the other seven against their own words found two more:

| Report               | It says                          | It counts                          | On the dev data               |
| -------------------- | -------------------------------- | ---------------------------------- | ----------------------------- |
| Where your deals are | open deals                       | every deal, won and lost too       | Gillett's lost deal ($15,000) |
| Who is carrying what | everything still to do           | every task with no completion date | 3 canceled tasks              |
| Requests by urgency  | requests nobody has answered yet | every request not sorted           | 6 of 14 had been answered     |

A sentence that says what a number counts is a contract. These broke it.

## What should have happened

Each report counts what it says it counts.

## How to reproduce

1. Customers › Build a report › "Where your deals are". A "Lost" row is listed.

## Why it matters

These are the examples an owner learns from and hangs on a dashboard. "Where your deals
are" overstated Gillett's open pipeline by the $15,000 they had already lost.

## Where it lives

- `wizeworks/packages/crm/src/services/report-builtins.ts`: the definitions.
- Existing businesses keep the rows they were seeded with (the file says so itself), so
  a fix there needs a migration beside it, as
  `20270518000000_the_ready_made_reports_say_what_this_file_says` did.

## The fix

`report-builtins.ts`: "Where your deals are" filters on Closed not set; "Who is carrying
what" on status = open; "Requests by urgency" now says "Requests not sorted yet". A new
migration, `20270530000035_ready_made_reports_count_what_they_say`, brings existing
businesses' rows in line, matched on `builtin_slug`, gated on `created_at = updated_at`,
looping per business because of row-level security.

Tests: crm `report-builtins-count-what-they-say.test.ts` (red 3 of 3, green 4 of 4; the
fourth compiles every ready-made report). The migration was run inside a transaction and
rolled back on the dev database: "ready-made reports brought in line with their words:
3993 rows", and nothing changed.

## Confirmed by

Not yet on screen. The dev database still holds the old rows: migrations are applied by
the user or the pipeline, not by me. This stays open until the migration is applied and
"Where your deals are" no longer lists Lost.

## Rating effect

—
