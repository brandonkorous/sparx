# 541 — "Nothing is running low", over the one thing that had run out

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, checking what she needs to order
**Surface:** `piggles/apps/workbench/surfaces/inventory/stock-list-empty.tsx`, `sparx/.../stock-list.tsx`
**Filed:** 2026-09-16
**Family:** [534](issues/534-two-tabs-told-her-opposite-things-and-both-were-false.md) — the same shape, on a different screen

## What she saw

Stock → Running low:

> **Nothing is running low**
> _Everything with a reorder rule is above the level you asked to be warned at._

## Measured

```sql
select count(*) as rows,
       count(*) filter (where reorder_point is not null) as with_rule,
       count(*) filter (where reorder_point is not null
                          and on_hand - allocated <= reorder_point) as below
from inventory_levels where tenant_id = '<juniper row>';
```

| rows | with a reorder rule | below it |
| ---- | ------------------- | -------- |
| 74   | **1**               | **1**    |

Her one item with a reorder rule:

| sku                  | on hand | allocated | reorder point |
| -------------------- | ------- | --------- | ------------- |
| THE-ASH-OVER-XS-BONE | **0**   | 0         | 2             |

It is not "above the level you asked to be warned at". It is at zero, against a
rule that says warn me at two. The sentence was false about the only item it
could have been about.

## Why

The tab is deliberately two filters, and the comment in the API says so:

```ts
// Only what a customer can still buy. Paired with `low_stock_only` it means
// "running low but not yet gone", which is what the console badges "Running
// low" — and it keeps the two counts disjoint for a caller adding them up.
sellable_only: queryBool.optional(),
```

So an item that is below its rule AND completely gone drops out of "Running low"
and appears under "None to sell". That split is right, and the item is there.

The empty state was not right. One empty list, **three** causes:

| cause                                         | how it reads  | what it is       |
| --------------------------------------------- | ------------- | ---------------- |
| items have rules, all comfortably above       | good news     | good news        |
| no item has a reorder rule at all             | good news     | nothing measured |
| an item is below its rule and has **run out** | **good news** | **urgent**       |

The sentence only knew the first, and the third is the one a shop owner must not
be reassured about.

## Fixed

The description now says what the tab COVERS rather than asserting a fact about
her stock, so it is true in all three cases and points at the tab she needs:

> **Nothing is running low**
> This shows items that have a reorder rule, are below it, and still have some
> left to sell. Anything that has run out completely is under "None to sell".

No counts were needed to make it honest, which is why this is a copy fix and not
a query.

## Files

- `piggles/apps/workbench/surfaces/inventory/stock-list-empty.tsx`
- `sparx/apps/workbench/surfaces/inventory/stock-list.tsx`
