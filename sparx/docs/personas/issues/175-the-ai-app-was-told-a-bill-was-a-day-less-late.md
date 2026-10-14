# 175 — The AI app was told a bill was a day less late than the screen said

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 12 (AI over MCP: "which fleets are past due?")
**Surface:** MCP `list_b2b_invoices` / `get_b2b_invoice`; the Wholesale invoices API the consoles and site read; same in Piggles
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 over MCP, 2026-10-09 (sparx)
**Blocked on:** —

## What happened

At 1:27am Denver time on Oct 9, Doty's AI app asked for the overdue fleet invoices
over MCP. It got O'Malley Ranch & Hay Co.'s 4471 "overdueDays": 42 and Wasatch Front's
4459 9. The workbench's Invoices list said "43 days late" and "10 days late". 4471 was
due Aug 27; Oct 9 is 43 days on.

## What should have happened

The same number everywhere: the days late on the business's calendar today.

## How to reproduce

1. Between midnight and 6pm Denver, call `list_b2b_invoices` with `status: overdue`.
2. Compare `overdueDays` with the Invoices list. One day apart. Every day.

## Why it matters

An assistant answering "how late is O'Malley?" gives a different number from the
screen, and a reminder written from it says the wrong thing.

## Where it lives

- `wizeworks/packages/b2b/src/invoices.ts`, `mapInvoice`: returns the stored
  `billing_documents.overdue_days`, which a daily job refreshes (last at 18:09 Denver,
  Oct 8). The workbench works the days out itself with `daysPastDue`.
- The same file filters `status: overdue` on the stored `status`, so a bill that
  fell due this morning is still "unpaid" there until the job runs.

## The fix

- `wizeworks/packages/b2b/src/invoice-lateness.ts`: `invoiceLateness`, the status and
  days late as of now, on the business's calendar, with the `daysPastDue` the screens
  use. 5 tests (Doty's 4471 at 1:27am Denver: 43).
- `wizeworks/packages/b2b/src/invoices.ts`: every invoice read (list and one) maps
  through it, and the status filter is as of today: "overdue" is an owed bill past
  its due day; "unpaid" and "part paid" leave out those now late.
- `@wizeworks/crm` exports `startOfBusinessDay` beside `daysPastDue`.
- The bills test's fake CRM gained the two helpers. b2b 105 tests pass; lint clean.

## Confirmed by

P01 over MCP with Doty's key, 2026-10-09 (sparx): `list_b2b_invoices` status overdue
answers 4471 O'Malley Ranch & Hay Co. 43 days, 4466 Høgberg Diesel & Performance 23,
4459 Wasatch Front 10: the Invoices screen's figures, and $3,818.80 in all.

## Rating effect

—
