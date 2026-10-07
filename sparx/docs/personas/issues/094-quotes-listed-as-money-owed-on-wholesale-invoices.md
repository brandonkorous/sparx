# 094 — Quotes listed as money owed on Wholesale invoices

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 6 (opening INV-000009 from the search box)
**Surface:** workbench › Wholesale › Invoices (both consoles); Search everything › an invoice; API `GET /v1/b2b/reports/top-accounts`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty typed INV-000009 into Search everything and pressed Enter. The whole Wholesale invoices list opened, not the invoice. The list showed his six invoices and then eight quotes, every one marked "Owed": Q-000002 to Q-000013, $22,389.72 that nobody owed him. Q-000011 was a draft never sent. Q-000010 was O'Malley's quote whose order he had turned down.

## What should have happened

A search hit for an invoice opens that invoice. The Wholesale invoices list holds bills: quotes have their own list, and an offer is not a debt.

## How to reproduce

1. As Doty, Search everything, type "INV-000009", press Enter. Before the fix: the list opens. Every time.
2. Look at the list. Before the fix: 14 rows, 8 of them quotes marked Owed.

## Why it matters

The list exists to answer "who owes me". It overstated that by $22,389.72, 65% of what was really owed then. Its detail page would also open a quote as an invoice, and "Mark as paid" or "Write off" could be pressed on one. The top accounts report added a quote and its order's invoice together, so Wasatch's $4,075.60 counted twice.

## Where it lives

- `listInvoices`, `getInvoice`, `markInvoicePaid`, `writeOffInvoice` in `@wizeworks/b2b` `invoices.ts` asked only `companyId is not null`. `ISSUED_BILL_WHERE` (crm), written for exactly this kind of list, was never asked.
- `/v1/b2b/reports/top-accounts` summed every billing document of an account.
- The search box opened every `billing_document` hit on the entity's home, the list, though the search entry stores the invoice's own address.

## The fix

- `TRADE_BILL_WHERE` in `invoices.ts`: an account's issued bills (`ISSUED_BILL_WHERE`). Every read and action there goes through it.
- The top accounts report counts issued bills only.
- `recordDestination` in `@wizeworks/links`: a hit opens the address its search entry stored when that address names this exact record on a known pane; anything else (an old address, another record) falls back to the entity's home. Both consoles' search boxes use it.

Tests, each proved red against the old code:

- `b2b/src/invoices-are-bills.test.ts`: the old queries redden 4 of 4.
- `links/test/record-destination.test.ts`: ignoring the stored address reddens 2 of 6; dropping the same-record check reddens 1 more.

## Confirmed by

On screen, 2026-10-06, as Doty: Wholesale invoices lists only INV-000001 to INV-000015 and the moved-in 4471 and 4466, no quotes. "INV-000009" and "INV-000015" in Search everything each open the invoice itself.

## Rating effect

—
