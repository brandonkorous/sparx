# 223 — The AI app said Renée had six orders and had spent $150

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 12 (AI over MCP)
**Surface:** MCP `search_all`, `search_customers`; the search box's customer results
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P01 over MCP, 2026-10-11
**Blocked on:** —

## What happened

With search working again (issue 176), Doty's AI app looked up "wasatch". Renée
Castañeda came back with `"order_count": 6`, `"total_spent_cents": 15000` and a last
order on 2026-10-09.

Her customer record says 12 orders, $11,285.69 ordered, $150.00 paid, last order
2026-10-11 08:58. The six orders she placed on 2026-10-10 and 2026-10-11 (O-000022 to
O-000027) are missing from what the AI app was told.

## What should have happened

The AI app reads the same figures as the customer's own page: every order she has
placed, what they come to, and what she has paid.

## How to reproduce

1. As Renée on the site, place an order (any product, on account).
2. Call `search_all` with `q: "wasatch"` over Doty's key. Her `order_count` has not
   moved. Every time.

## Why it matters

Doty asks his AI app "how much does Wasatch buy from us?" and it answers with half
her orders and only the money she has paid ($150 of $11,285.69). It says something
false about his biggest fleet customer. This is issue 163 again, in the search copy
instead of the chat panel.

## Where it lives

- `wizeworks/packages/commerce-indexer/src/handler.ts`, the `order.*` cases: each
  re-reads the order into search and never the buyer. The buyer's figures are written
  in the same transaction as the order (`crm/src/services/customer-rollup.ts`), and
  nothing tells search they moved. The customer is re-read only on a `crm.customer.*`
  event, which an order does not raise.
- `wizeworks/packages/search/src/schemas/customers.ts` and `projectCustomer` in
  `wizeworks/packages/commerce/src/search-projection.ts`: the document carries
  `total_spent_cents` (money received) and no `total_ordered`, so even a fresh copy
  reads "$150" for a fleet on account.

## The fix

- `commerce-indexer/src/handler.ts`: every `order.*` and held-order event re-reads the
  order's buyer into search after the order (`reindexCustomer`, without re-reading the
  buyer's other orders, which copy nothing that moved). A guest order touches no
  customer.
- `search/src/schemas/customers.ts` and `commerce/src/search-projection.ts`: the
  customer document carries `total_ordered_cents` (what their orders come to, net of
  refunds, paid or not) beside `total_spent_cents`. Optional, so the live collection
  takes it on the next indexer boot; Typesense returns it either way.

Shared: every brand, every customer. A customer's copy refreshes on their next order,
payment, refund or cancellation, or on a search rebuild (`search.reindex.requested`,
ops.yml); until then an older copy still lacks `total_ordered_cents`.

Tests, red first: `commerce-indexer/test/unit/order-moves-its-buyer.test.ts` (8, 6 red
before), `commerce/src/order-search-account.test.ts` (+1, red with the projection line
taken out). Indexer 81 pass, search 46, lint clean on every touched file. Typecheck not
run (Brandon: leave it for now).

## Confirmed by

P01, 2026-10-11. Renée placed O-000028 on the site (Stanadyne additive, $28.41 on
account). Then Doty's key, `search_all` with "renee": "orders 13, spent 15000, ordered
1131410, last 2026-10-11 09:45:42", the same as her record (13, $150.00, $11,314.10).
Before: 6 orders, $150.00, last order 2026-10-09.

## Rating effect

—
