# 884 — A called-off order still said twelve were coming

**Status:** fixed
**Severity:** **moderate** — the column a buyer reads to decide who to chase was
loudest about the one order nobody should chase. The console did its own
arithmetic and reached a different answer from the planner running underneath it
**Found by:** P03 · act 314, sweeping Partners by data weight
**Surface:** mypiggles › Partners › Orders to suppliers; and the supplier's own
pane and the order's header, in both consoles
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** 7 tests, proved red two ways including the tempting narrow
fix; and her own list, before and after

## What she saw

```
Order       Supplier          Total      Still due   Expected      State
PO-000005   Ashcombe Mills    $108.00    —           Sep 4, 2026   Received
PO-000004   Ashcombe Mills    $576.00    24          Sep 10, 2026  Placed
PO-000003   Ashcombe Mills    $288.00    12          —             Canceled
PO-000002   Fairfield Trims   $216.00    —           Sep 24, 2026  Received
PO-000001   Ashcombe Mills    $745.00    —           Sep 30, 2026  Received
```

**Canceled, and twelve still due.** The row says both at once, two columns apart.

## Measured

```
PO-000003   status cancelled   ordered 12   received 0   →  shown as 12 due
PO-000004   status submitted   ordered 24   received 0   →  shown as 24 due   correct
```

## The chain

```ts
export function outstandingUnits(po: {
  quantityOrdered: number;
  quantityReceived: number;
}): number {
  return Math.max(0, po.quantityOrdered - po.quantityReceived);
}
```

The state is not in the sum. Nothing was ever received against a called-off
order and nothing ever will be, so the subtraction returns the full quantity and
keeps returning it for ever.

Four screens per console read it: the list's **Still due** column, the order's
own header, the supplier's pane, and the label in the picker used when booking
stock in. The picker is filtered to receivable orders already, so it was safe;
the other three were not.

## The server never had this wrong

Both places the platform works out what is on its way say the same thing:

```sql
WHERE pol.variant_id = l.variant_id
  AND po.warehouse_id = l.warehouse_id
  AND po.status IN ('draft', 'submitted', 'partial')
```

`reorder.ts` and `planning-reports.ts`, identically. So the reorder suggestion
underneath this screen was already excluding the called-off order while the
screen above it counted it in. Two numbers about the same twelve units, on the
same page. [[feedback_a_fix_leaves_its_neighbour_behind]]

## What it does now

`outstandingUnits` takes the state and returns zero unless the order is in one
the platform counts as on order — **the same three the SQL names**, lifted into
a `stillArriving()` predicate that says where the list came from.

Deliberately broader than `isReceivable`, which is `submitted || partial`. A
draft cannot have goods booked against it, but it is stock the business has
decided to bring in and the planner counts it. A console that drew the
receivable set instead would disagree with the planner in the other direction.

## Proved

**7 tests**, and two wrong versions:

```
ignore the state entirely (the original)  →  3 fail
exclude only `cancelled`                  →  2 fail
```

The second is the one worth having. Special-casing `cancelled` is the obvious
fix, it makes this screen correct, and it leaves **closed** — an order somebody
finished short and wrote off — still reporting the shortfall as a chase. The
same test also pins an unknown future status to zero, so a state added later
that nobody teaches this function about cannot start claiming units are coming.
[[feedback_a_test_that_cannot_go_red]]

**Checks:** piggles console 167 files / 1559 tests (2 failing in
`surfaces/migration/column-guess.test.ts`, an untracked file belonging to
another agent's in-progress work), sparx workbench 136 / 1241 all green.
Typecheck 0 on both consoles. ESLint and prettier clean.

**On her own list**, PO-000003 now reads **Still due —**, and PO-000004 still
reads 24.

## Files

- `piggles/apps/workbench/surfaces/inventory/purchase-orders-data.ts`
- `sparx/apps/workbench/surfaces/inventory/purchase-orders-data.ts`
- `piggles/apps/workbench/surfaces/inventory/outstanding-units.test.ts` (new)
- `sparx/apps/workbench/surfaces/inventory/outstanding-units.test.ts` (new)

## Two things checked and correctly NOT filed

**Supplier payment terms.** The Suppliers list prints `net 30` raw, which looks
like the trade jargon this console exists to translate, and there is even a
`payment-terms.ts` that turns `net30` into "30 days to pay". It is the wrong
comparison: that helper serves `Company.paymentTerms`, a constrained picker.
A supplier's terms are a deliberately FREE-TEXT field, labelled "How you pay"
with the description _"e.g. net 30, cash on delivery"_ — so the list echoing
exactly what she typed is right, and translating it would mean translating
"cash on delivery" too.

**The due date computed from that free text.** The obvious risk is a digit-
grabbing parser reading "cash on delivery" as zero days. It does not:

```ts
const match = /^net[\s_-]?(\d{1,3})$/i.exec(terms.trim());
return match?.[1] ? Number(match[1]) : null;
```

Anchored, tolerant of the space her rows actually carry (`net 30`, which the
field's own placeholder shows), and returning **null** rather than 0 for
anything that is not a day count — so a bill from a cash-on-delivery supplier
gets no suggested due date instead of one dated today.
[[feedback_never_present_absence_as_measurement]]

Both of these read like defects from the list screen. Neither is. Checking cost
less than filing would have.

## The thing to remember

**A number computed from two columns is wrong whenever a third column changes
what those two mean.** Ordered minus received is arithmetic anybody would write,
it is right on four of her five orders, and it has no way to be right on the
fifth.

The measurement that finds it is not "does this number add up" — it does. It is
**"does the platform already answer this question somewhere else, and does it
answer it the same way?"** Here the SQL two packages away had the rule written
down, in a `WHERE` clause, and the screen had never been told.
