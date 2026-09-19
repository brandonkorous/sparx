# 552 — "Freight $0.00", on an order that cost $14.00 to get here

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, checking a supplier's invoice against what she ordered
**Surface:** `wizeworks/packages/inventory/src/services/purchase-order-shared.ts` + `piggles|sparx/apps/workbench/surfaces/inventory/purchase-order-detail.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_fetched_but_never_rendered]] · [[feedback_never_present_absence_as_measurement]]

## What she saw

Partners → Orders to suppliers → **PO-000002**, Fairfield Trims:

> **Freight**
> **$0.00**
> _Spread across the items as they arrive, so what you hold is valued at what it really cost._
>
> **Items** $216.00 · **Total** $216.00
>
> **What you expect it to cost to get here**
> _Nothing expected on top of the goods and the freight._
>
> **What they have billed**
> FT-INV-2291 · **$222.72** · Entered

Three places on one screen say freight is nothing, and the supplier billed
**$6.72 more than the order**. The screen offers no reason for the gap, and
checking an invoice against an order is the exact job this screen is for.

## Measured

The reason is $14.00 of freight, booked in when the goods arrived:

```sql
select po.number,
       po.freight_cents/100.0 as header_freight,
       coalesce((select sum(gc.amount_cents) from inventory_goods_receipt_charges gc
                 join inventory_goods_receipts gr on gr.id = gc.goods_receipt_id
                 where gr.purchase_order_id = po.id), 0)/100.0 as receipt_freight
from inventory_purchase_orders po where po.tenant_id = '<juniper row>';
```

| order     | header freight | freight on its deliveries |
| --------- | -------------- | ------------------------- |
| PO-000001 | $25.00         | $0.00                     |
| PO-000002 | **$0.00**      | **$14.00**                |

Every figure downstream has it. The cost layer for BRASS-BELT-1 is a goods cost
of **$3.60** against a landed cost of **$3.84**, and 58 received × $3.84 is
exactly **$222.72** — the invoice. Only the order screen does not.

## The cause

Freight reaches an order two ways, and the field read one of them:

| how                             | where it lands                           |
| ------------------------------- | ---------------------------------------- |
| agreed when the order is raised | `PurchaseOrder.freightCents`             |
| charged when the goods come in  | `GoodsReceiptCharge` with kind `freight` |

```tsx
<SettledField label="Freight" value={formatCents(draft.header.freightCents, currency)} … />
```

Nothing carries the second back to the order, and the order detail did not even
fetch it. A shop that pays carriage on arrival — which is most of them — sees
$0.00 for ever.

## The fix

`serializePurchaseOrderDetail` now includes the order's deliveries and totals
their `freight` charges into a new `receiptFreightCents`.

**Reported separately rather than added into `freightCents`.** They are
different facts: one is what she AGREED to pay, the other is what TURNED UP, and
the gap between them is the thing she is checking when an invoice arrives. A
single merged figure would hide exactly what the screen exists to show her.

`freight-words.ts`, beside the screen and importing nothing, turns the two into
one field:

| agreed | arrived | shows  | says                                                                                                                                                                                     |
| ------ | ------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| $25.00 | —       | $25.00 | Spread across the items as they arrive…                                                                                                                                                  |
| —      | $14.00  | $14.00 | Nothing was agreed for freight when this order was raised. $14.00 was charged when the goods came in, and it is already in what your stock is worth and in what the supplier billed you. |
| $25.00 | $14.00  | $39.00 | $25.00 agreed when this order was raised, and $14.00 more charged when the goods came in.                                                                                                |
| —      | —       | $0.00  | (unchanged)                                                                                                                                                                              |

## Proven

PO-000002 now reads **Freight $14.00** with that sentence, so the $6.72 on the
invoice has a visible cause.

6 guards in `freight-words.test.ts`, proven red by putting the old
read-the-header-only behavior back: 3 of 6 fail.
