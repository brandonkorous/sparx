# 665 — It let me order the same twelve shirts twice

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 236
**Surface:** Stock — What to reorder
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 236 (the warning, the join, and PO-000004 at 24 rather than a PO-000005)

## What she did

Having linked a supplier ([663](663-the-buying-list-i-could-not-buy-from.md)), Devi
ticked her one reorder line and pressed **Draft 1 order**. It made **PO-000003**
for twelve shirts, and said so.

The row then updated itself, exactly as designed, to read:

> The Ash Overshirt · THE-ASH-OVER-XS-BONE · Main Warehouse (MAIN) · Takes 21 days
> **12 already on the way**

with **To order 12** still in its column.

So she ticked it again and pressed the button again. It made **PO-000004**, for
twelve more.

Nothing warned her. The confirm dialog said what it always says. The toast said
"1 draft order created". A third click would have made PO-000005.

```
PO-000003 | draft | 12 | THE-ASH-OVER-XS-BONE
PO-000004 | draft | 12 | THE-ASH-OVER-XS-BONE
```

Two orders to the same supplier, for the same location, for the same item, one
minute apart. At $24.00 each that is $576.00 of shirts she did not mean to buy,
and two draft orders to notice, reconcile and cancel one of.

## The guard existed, on the other path

`reorder.ts` has two ways to draft. The automatic one — the action behind the
`inventory.low` automation — does both of the things the screen did not:

```ts
// Already inbound? Don't re-order what an open PO (draft/submitted/partial)
// already covers — this is what keeps repeated `inventory.low` events from
// spawning duplicate orders.
const onOrder = await openOrderQty(tx, variantId, warehouseId);
if (onOrder > 0) return { ...base, outcome: 'skipped_already_drafted', quantity };
```

and, a few lines further down, find-or-append into one open draft per (supplier,
warehouse) "so the low items for one supplier converge into one reviewable
order".

`draftGroupsOnTx` — the path a PERSON uses — called `createPurchaseOrderOnTx`
unconditionally and checked nothing. The machine was protected from ordering
twice; the buyer was not. [[feedback_a_fix_leaves_its_neighbour_behind]]

The integration test covering the manual path even carried the belief in a
comment: _"The drafted variants now read as on-order, so they won't be
re-suggested blind."_ They were re-suggested, and re-drafted, blind.

## What happens now

**It warns, and does not refuse.** A buyer may genuinely want more — demand
jumped, or the open order is one they mean to cancel — and the confirm is where
that decision is being made, so the fact goes there:

> **Draft 1 purchase order?**
> One of these already has stock on the way: 24 units on an order you have not
> received yet. Drafting now asks for that much again, on top of what is coming.
> This turns the 1 chosen item into 1 draft order …

**And the lines join the order that is already open**, the same rule the
automatic path has always followed. A second line for the same item adds to the
first rather than appearing twice, the total is recomputed, and a different item
joins as a new line.

Because "created" then stops being true, the toast says what actually happened:

> **Added to a draft order you already had**
> PO-000004. Nothing new was created: that supplier already had an order open for
> this location. Find it under Purchase orders.

## Driven end to end

```
tick · Draft 1 order → the warning names 24 units already coming
  → Create drafts
  → "Added to a draft order you already had · PO-000004"
  → PO-000004 is now one line of 24, $576.00. There is no PO-000005.
```

## What was left alone, deliberately

**"To order" still reads 12**, not 0. It means the shortfall against the level
she set, which is what the column says and what every report using
`suggestedQuantity` means by it. Netting inbound stock into it would make the
number mean one thing on a quiet line and another on a line with an order out.
The inbound figure is its own fact, on the row and now in the dialog.

## Files

- `wizeworks/packages/inventory/src/services/reorder.ts`
- `wizeworks/packages/inventory/test/integration/reorder.test.ts`
- `piggles|sparx/apps/workbench/surfaces/inventory/{reorder-supplier-words.ts,reorder-data.ts}` + test
- `piggles/apps/workbench/surfaces/inventory/reorder-selection.ts`
- `sparx/apps/workbench/surfaces/inventory/reorder-list.tsx`
