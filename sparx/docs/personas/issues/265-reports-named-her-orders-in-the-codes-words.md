# 265 — Reports named where her customers came from in the code's words

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · rating Customers › Reports
**Surface:** Customers › Reports › "Where new customers come from" (sparx console), and every API and AI answer that names an order's channel
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

Doty opened Customers › Reports. "Where new customers come from" read:

> Admin 4 · 80%
> Storefront 1 · 20%

Every other screen calls the same orders "Added by hand" and "Your website".
"Admin" is a role on the Team screen. "Storefront" is a word the platform retired.

## What should have happened

One name for one fact. Both consoles keep that name in `lib/console/channels.ts`.

## How to reproduce

1. Sign in as Doty. Open Customers › Reports.
2. Scroll to "Where new customers come from".

Every time, for any business with orders.

## Why it matters

The owner reads a code word where her own word should be, and the same sale has a
second name on this screen. It also reached the REST reports and the AI tools,
which repeat the label to her.

## Where it lives

- `wizeworks/packages/crm-schemas/src/orders.ts`: `ORDER_CHANNEL_LABELS` said
  "Storefront", "B2B portal", "Admin", "Import", "MCP / AI". The crm and commerce
  reporting services label every channel row from it.
- `sparx/apps/workbench/surfaces/crm/lead-sources.ts` passed the API's label through.
  Piggles already named the row from its key (`channelKeyLabel`); sparx was left
  behind.
- `wizeworks/services/api-rest/src/lib/analytics/metrics/commerce-sales.ts` kept a
  fifth copy of the table, with the right words.

## The fix

- `ORDER_CHANNEL_LABELS` now holds the owners' words, the same as both consoles:
  Your website, Wholesale portal, Added by hand, At the till, Subscriptions,
  Imported, AI assistant, Marketplace, Other.
- sparx `lib/console/channels.ts` gains `channelKeyLabel`, as in Piggles, and
  `splitLeadSources` names each row from its key with it.
- The api-rest copy is gone; `commerce-sales.ts` reads `channelKeyLabel` from the
  shared table.
- Sibling screens checked: the sparx commerce reports, carts, checkouts, price lists
  and finance already use `channelLabel`. Piggles already used `channelKeyLabel`.

Tests, red then green: crm-schemas `channel-words.test.ts` (2; 107/107), sparx
`surfaces/crm/lead-sources.test.ts` (one new, one fixture word changed; 129/129 in
crm and lib/console).

## Confirmed by

sparx as Doty, Customers › Reports, light and at 360px: "Where new customers come
from" reads "Added by hand 4 · 80%" and "Your website 1 · 20%".

## Rating effect

crm.reports: one name for one fact.
