# 117 — The money she took over the counter never reached her money screens

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · act 8
**Surface:** mypiggles › Money › Money paid to you · What you kept
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Two sales were written down at the till and paid in full — $45 on card, $22 in
cash. Both orders read **Paid**, and each one's own "Money in" panel listed the
payment. Then Money:

> **No payments yet** — When a customer pays — on your website, a marketplace, or
> in person — it will show up here.

Sixty-seven dollars, taken in person, on a screen whose own copy promises "or in
person". And Money › What you kept:

> **Nothing to measure in this period** — No money came in and no costs were
> recorded, so there is no profit figure to give you.

Pressing **Rebuild figures** changed nothing. Pressing it again changed nothing.

## What should have happened

Money in is money in. Both screens should show it the moment it is recorded, and
the button labelled Rebuild figures should rebuild the figures.

## How to reproduce

1. Take a sale at the till and mark it paid.
2. Open Money › Money paid to you. Every time, before the fix: nothing.
3. Open Money › What you kept, press Rebuild figures. Every time: "No money came
   in".

## Why it matters

Wrong money, and it says something false. She has no way to answer "what did I
take today" — the one question a person who works with their hands asks the
software at the end of a shift. Worse, both screens answer it confidently and
wrongly: "no money came in" is a measurement, and nobody measured anything.
(Root RULE #4 — never present absence as measurement.)

## Where it lives

Two separate causes with the same symptom, which is why it took two fixes.

1. **No origin site on the order.** `/v1/finance/payments` scopes to
   `order.propertyId`, absence meaning "the site I am working in"
   ([property.ts](../../../../wizeworks/services/api-rest/src/lib/property.ts),
   which spells out why: _"A default that depends on every present and future
   caller remembering something is not a default."_). The till was one of those
   callers, and left it null.
2. **A cache of an empty cache.** The profit rollup reads revenue out of
   `rollup_commerce_daily_revenue`, which a **nightly** job owns
   ([commerce-cron.ts](../../../../wizeworks/services/api-rest/src/routes/internal/commerce-cron.ts)).
   Recomputing profit therefore rebuilt a subtraction over a revenue table
   nobody had touched since the small hours — so Rebuild figures could not move
   the number for anything sold today, which is precisely what the button exists
   for.

## The fix

1. The till stamps the site it was taken at
   ([sale-data.ts](../../../apps/workbench/surfaces/commerce/sale-data.ts)), from
   `useActivePropertyId()`.
2. `POST /v1/finance/profit/recompute` and the read route's `refresh` flag now
   reconcile the commerce revenue window **first**, then recompute profit
   ([profit.ts](../../../../wizeworks/services/api-rest/src/routes/v1/finance/profit.ts)).
   One `rebuild()` helper, used by both, so the two paths cannot drift.

Left open deliberately: whether `POST /v1/orders` should default `propertyId` to
the request's active site for every caller, the way the list side already
defaults. That would fix this class of bug once instead of per caller, but it
changes what import and MCP write, so it is a decision rather than a repair.

## Confirmed by

> Re-ran P02 act 8 as Nia. Took a third sale (Rob Alvarez, dry cut, $40 cash).
> Money › Money paid to you now lists **Today · Rob Alvarez · O-000003 · Cash ·
> In person or by phone · Paid · $40.00**. Money › What you kept, after pressing
> Rebuild figures, reads **You kept $40.00** with **Money in $40.00** and
> "Read straight from your orders and paid invoices — never typed in twice."

The first two sales stay missing from those totals: they were written before the
site was stamped, and they are the evidence.

## Rating effect

`Money › Money paid to you — Trust 2 → 8`, `Money › What you kept — Trust 2 → 8`.
Recorded in [rating.md](../rating.md).
