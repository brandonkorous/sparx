# 323 — Email lines showed their amount with tax, above a subtotal without it

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · scoring the screens outside the console
**Surface:** Order confirmation email; invoice email; quote and invoice builder emails; api-rest email data, crm invoice mail
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** sparx as Doty and Renée (Gillett Diesel Service), 2026-10-18, in part
**Blocked on:** —

## What happened

Renée's order confirmation for O-000031 listed the additive at "$13.41", then "Subtotal $12.50", "Shipping $15.00", "Tax $0.91", "Total $28.41". The invoice email for INV-000030 read "1 × $12.50 … $13.41". The line printed `lineTotal`, which carries the line's sales tax, beside a subtotal that does not. The printed invoice already shows lines before tax ([227]); the emails were left behind.

## What should have happened

Each line at its amount before tax, so the lines add up to the subtotal and tax shows once, on its own row.

## How to reproduce

1. Place an order with a taxed line.
2. Read the confirmation email: add up the lines and compare with the subtotal.

## Why it matters

Two numbers in one email that cannot both be right make a buyer question the whole bill, and the invoice email disagreed with the invoice it linked to.

## Where it lives

`wizeworks/services/api-rest/src/lib/email-data.ts` (order items, quote lines, invoice lines), `wizeworks/packages/crm/src/services/billing-document-mail.ts`.

## The fix

The emails read `lineSubtotal`, the figure the printed invoice prints. All 33 of Gillett's orders and 30 of its invoices have a subtotal equal to the sum of their line subtotals, checked against the local database.

Tests: the crm email and print tests pass (18). The database-backed `email-data.test.ts` now gives its first line a subtotal of $600 and $48 tax and still expects "$600.00"; those suites do not run here: not run.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

2026-10-18. The email's own data step, run read-only against O-000031, now reads the line at "$12.50" with "Subtotal $12.50", "Tax $0.91" and "Total $28.41".

Not checked: a new email in the dev outbox (no order was placed for it).

## Rating effect

See the screen's row under "Outside the console" in `rating.md`.
