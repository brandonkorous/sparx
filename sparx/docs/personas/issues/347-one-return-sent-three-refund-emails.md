# 347 — One return sent three refund emails

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · checking issue 178 (a card-paid return), in the dev outbox
**Surface:** the "Order refunded: email" automation every shop gets with commerce (`wizeworks/packages/automation-actions/src/seeds/commerce.ts`)
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** P01 in the dev outbox as Renée Castañeda, 2026-10-18
**Blocked on:** —

## What happened

Doty gave Dana Whitcomb $640.96 back for her return. In 0.2 seconds Dana got three emails:
"Your refund for O-000035 is on the way", the same again word for word, and "Your refund for
O-000035 is complete". Marisol Vega got the same three. Each "on the way" said "Refund amount
$640.96", so it read like two more refunds.

## What should have happened

One return, one refund email: the return's own "Your refund is complete".

## How to reproduce

1. A customer returns something. Refund the return.
2. The customer gets "on the way" once per thing given back (a part, its core deposit), then
   "complete". Every time.

## Why it matters

The customer is told three times about one refund, and does not know which to believe.

## Where it lives

A return records its money as one refund row per thing given back (`return-service`
`issueRefund`), and each row publishes `order.refunded`, which the search index, the CRM
timeline and staff commissions each need once per row. The "Order refunded: email" automation
runs on every `order.refunded`. The return then publishes `return.refunded`, and the "Return
refunded: email" automation sends "complete".

## The fix

The refund says where it came from. `order.refunded` gets its own field resolver
(`wizeworks/packages/automation/src/resolvers/builtins.ts`): the order's fields, `refund.id`,
and `refund.source`, read from the refund row: `return` when its metadata names a return
(`refund-source.ts`), else `order`. The email automation adds one condition, `refund.source`
is not `return`. The events stay as they were. The release's seed sync carries the new
condition to every shop that has not edited its copy.

Tests, red first: `automation-actions/src/seeds/order-refunded-seed.test.ts` (2) runs the
seed's own conditions: not sent for a refund from a return (red before the condition), sent
for one made on the order. `automation/src/resolvers/refund-source.test.ts` (2). Seeds 42 pass.
Lint and format clean.

## Confirmed by

P01, 2026-10-18. The seed sync the release runs (`/internal/cron/reconcile-seeds?only=seeds`
on the event worker) gave Gillett's copy the new condition. Renée Castañeda's O-000036 ($108.44
by card) was shipped, returned and refunded $93.44 by Doty; her outbox then held "Your return
for O-000036 is approved", "We’ve received your return" and one refund email, "Your refund for
O-000036 is complete". Not checked on screen: a refund made on the order page still sends "on
the way" (the second seed test covers it).

## Rating effect

—
