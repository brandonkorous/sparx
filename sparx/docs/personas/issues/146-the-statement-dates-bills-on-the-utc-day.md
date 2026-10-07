# 146 — The account statement dates bills and payments on the UTC day

**Status:** open
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 10 (checking the siblings of [145])
**Surface:** workbench › Wholesale › an account › Statement; the statement PDF and email
**Filed:** 2026-10-06
**Fixed:** —
**Confirmed by:** —
**Blocked on:** scope (act 11, finance, where statements are under test)

## What happened

Found by reading, not yet seen on screen. The statement places each invoice, payment and write-off by the exact moment it happened, compared against period edges that are the business's calendar days ([099]) and printed as UTC dates. So the same shape as [145]: a bill raised after 6pm in Denver prints the next day's date on the statement, and a bill raised after 6pm on the last day of a month falls into the next month's statement.

## What should have happened

Each row lands on, and prints, the day it happened in the shop.

## Why not fixed with 145

The statement's arithmetic orders events by their exact moment (a payment received at the moment of a write-off counts before it). Moving every event to its business day changes which month a bill lands in and how same-day events order. That needs its own measured test on a real statement, which act 11 does.

## Where it lives

- `wizeworks/packages/crm/src/services/b2b-statement-service.ts`: `toBillInput` (`issuedAtOf`, `receivedAt`, `voidedAt` as moments).
- `wizeworks/packages/crm/src/services/b2b-statement.ts`: `computeStatement`, `eventsOf`.

## The fix

## Confirmed by

## Rating effect

—
