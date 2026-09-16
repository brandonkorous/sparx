-- Give every existing order's freight the charge that now carries it.
--
-- `20270503000000_freight_is_not_shipping` renamed the column and taught
-- `recomputeTotals` to keep a matching PurchaseOrderCharge in step, because a
-- charge is the only thing that can spread a cost across part-deliveries
-- without spending itself twice. Orders raised BEFORE that have their freight
-- in `freight_cents` and no charge behind it, and nothing will create one until
-- somebody happens to edit the order.
--
-- Leaving them is not neutral. Six of the nine affected orders are PARTIAL: a
-- delivery is already posted and more is still to come. With no charge, the
-- rest of the goods land carrying no freight at all. With a charge created at
-- `allocated_cents = 0`, it is worse the other way — the final delivery on an
-- order is the one that sweeps up everything still unallocated, so two metres
-- of linen would swallow the whole $25 that belonged to forty.
--
-- So the charge is created with the share the ALREADY-POSTED deliveries would
-- have taken, marked as spent. Three things follow, and all three are intended:
--
--   * Nothing already posted is re-costed. Those receipt lines keep the cost
--     they were booked at. Freight that was never applied to them is not
--     recoverable and this does not pretend otherwise.
--   * What is still to come carries its own proportional share, exactly as it
--     would on an order raised today.
--   * The charge cannot be over-spent, because `allocated_cents` already
--     reflects what the earlier deliveries accounted for.
--
-- The arithmetic mirrors `resolveCharges` in landed-cost.ts deliberately, line
-- for line: a delivery's share is its goods value over the ORDER's value (not
-- over what remains), capped at one, and the running total is capped at the
-- charge. Base currency throughout, via each receipt's own `fx_rate`, so the
-- share divides like with like.
--
-- Cancelled orders are skipped: they will never receive anything, and a
-- cancelled order should not grow rows.

WITH order_value AS (
  SELECT purchase_order_id,
         SUM(quantity_ordered::bigint * unit_cost_cents)::numeric AS value_cents
    FROM inventory_purchase_order_lines
   GROUP BY purchase_order_id
),
delivery_value AS (
  SELECT r.purchase_order_id,
         SUM(ROUND(rl.unit_cost_cents * r.fx_rate) * rl.quantity_received)::numeric AS value_cents
    FROM inventory_goods_receipts r
    JOIN inventory_goods_receipt_lines rl ON rl.goods_receipt_id = r.id
   GROUP BY r.purchase_order_id
),
target AS (
  SELECT po.id,
         po.tenant_id,
         po.freight_cents,
         -- What the posted deliveries between them have already accounted for.
         -- Summed across the order rather than per delivery: the per-delivery
         -- caps compose to the same ceiling, which is the charge itself.
         LEAST(
           po.freight_cents,
           ROUND(po.freight_cents *
             -- An order with no lines has no value to divide by, and
             -- `resolveCharges` treats that as a full share rather than none.
             -- Spelled out rather than left to LEAST() quietly ignoring a NULL.
             CASE WHEN COALESCE(ov.value_cents, 0) > 0
                  THEN LEAST(1.0, COALESCE(dv.value_cents, 0) / ov.value_cents)
                  ELSE 1.0
             END)
         )::int AS already_spent
    FROM inventory_purchase_orders po
    LEFT JOIN order_value    ov ON ov.purchase_order_id = po.id
    LEFT JOIN delivery_value dv ON dv.purchase_order_id = po.id
   WHERE po.freight_cents > 0
     AND po.status <> 'cancelled'
     AND NOT EXISTS (
           SELECT 1 FROM inventory_purchase_order_charges c
            WHERE c.purchase_order_id = po.id AND c.is_order_freight
         )
)
INSERT INTO inventory_purchase_order_charges
  (tenant_id, purchase_order_id, kind, description, amount_cents,
   allocation_basis, allocated_cents, is_order_freight)
SELECT tenant_id, id, 'freight', 'Freight on the order', freight_cents,
       'value', COALESCE(already_spent, 0), true
  FROM target;
