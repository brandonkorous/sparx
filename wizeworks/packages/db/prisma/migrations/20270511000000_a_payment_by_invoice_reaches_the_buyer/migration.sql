-- A payment taken on an INVOICE reaches the buyer's record (issue 533).
--
-- Devi opened her customer list and read:
--
--     Anneliese Vogt    Customer    $0.00
--
-- Anneliese had paid her $180 three weeks earlier. The order says Paid. The
-- invoice says Paid. The payment is on the Money screen. The person who paid it
-- shows as having never spent anything.
--
-- ── WHY IT DRIFTED ──────────────────────────────────────────────────────────
--
-- `customers.total_spent` is `SUM(orders.amount_paid)`. Anything that writes
-- `amount_paid` makes it stale, so the two recomputes are one job. They were
-- written as two, paired by convention at five call sites, and two of the five
-- did not keep the pair:
--
--   crm/services/billing-payment-service.ts   a payment taken against an INVOICE
--   api-rest/lib/payment-webhook-reconcile.ts a card settling at the gateway
--
-- The first is what happened here: Devi raised an invoice for O-000013 and
-- recorded the $180 against it, at 2026-09-08 00:56. The order rollup ran. The
-- customer rollup did not. Her record has said $0.00 ever since.
--
-- The second has never run on this database, because no shop in development has
-- a live payment gateway. In production it is EVERY online sale — an order is
-- created with `amount_paid = 0` and the webhook that captures the money never
-- tells the buyer's record.
--
-- ── WHY THIS IS THE SECOND TIME ─────────────────────────────────────────────
--
-- `20270418000000_a_customers_lifetime_spend_agrees_with_their_orders` repaired
-- exactly this drift, for exactly this customer, on 2026-08-26. It came back
-- within two weeks, because it repaired the ROWS while both writers went on
-- shipping.
--
-- So the code change this migration accompanies does not add a sixth paired
-- call. It moves the customer recompute INSIDE `recomputeOrderPaymentRollup` —
-- the chokepoint every payment path already goes through — and deletes the three
-- calls that used to sit beside it. A rule that must be remembered at five call
-- sites is a rule with five chances to be forgotten.
--
-- ── WHAT THIS DOES ──────────────────────────────────────────────────────────
--
-- Recomputes the five derived columns on `customers` from the orders, for every
-- tenant. Same arithmetic as `recomputeCustomerCommerce`:
--
--   total_spent     SUM(amount_paid)                     money actually received
--   total_ordered   GREATEST(SUM(total) - SUM(refund_total), 0)
--   order_count     COUNT(orders)
--   first_order_at  MIN(placed_at)
--   last_order_at   MAX(placed_at)
--
-- Cancelled orders count toward nothing. `total_ordered` is floored at zero: a
-- refund larger than the order it belongs to is a data fault, not a customer
-- worth negative money.
--
-- Measured before writing: 647 customers on this platform, 646 correct, ONE
-- drifted by $180. This is narrow on purpose — it is the writers that were
-- broad.
--
-- ── WHY THE TENANT LOOP ─────────────────────────────────────────────────────
--
-- `customers` and `orders` are FORCE-RLS. `sparx_owner` is a NON-SUPERUSER in
-- production, so a plain UPDATE sees zero rows there while passing locally on a
-- superuser connection. The 20270418 repair above did not loop, which means it
-- may well have changed nothing in production and nobody would have seen a
-- failure. This one loops.

DO $$
DECLARE
  t RECORD;
  touched INT;
  total_touched INT := 0;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    UPDATE customers c
       SET total_spent    = COALESCE(agg.spent, 0),
           total_ordered  = GREATEST(COALESCE(agg.ordered, 0) - COALESCE(agg.refunded, 0), 0),
           order_count    = COALESCE(agg.orders, 0)::int,
           first_order_at = agg.first_at,
           last_order_at  = agg.last_at,
           updated_at     = NOW()
      FROM (
            SELECT c2.id                  AS customer_id,
                   SUM(o.amount_paid)     AS spent,
                   SUM(o.total)           AS ordered,
                   SUM(o.refund_total)    AS refunded,
                   COUNT(o.id)            AS orders,
                   MIN(o.placed_at)       AS first_at,
                   MAX(o.placed_at)       AS last_at
              FROM customers c2
              LEFT JOIN orders o
                     ON o.customer_id = c2.id
                    AND o.tenant_id   = c2.tenant_id
                    AND o.status <> 'cancelled'
             WHERE c2.tenant_id = t.id
             GROUP BY c2.id
           ) agg
     WHERE agg.customer_id = c.id
       AND (c.total_spent    IS DISTINCT FROM COALESCE(agg.spent, 0)
         OR c.total_ordered  IS DISTINCT FROM GREATEST(COALESCE(agg.ordered, 0) - COALESCE(agg.refunded, 0), 0)
         OR c.order_count    IS DISTINCT FROM COALESCE(agg.orders, 0)::int
         OR c.first_order_at IS DISTINCT FROM agg.first_at
         OR c.last_order_at  IS DISTINCT FROM agg.last_at);

    GET DIAGNOSTICS touched = ROW_COUNT;
    total_touched := total_touched + touched;
  END LOOP;

  -- Printed, not silent. A repair that reports nothing is indistinguishable from
  -- one that matched nothing, which is how the 20270418 loop-less version could
  -- have done nothing in production without anyone noticing.
  RAISE NOTICE 'customers recomputed: %', total_touched;
END $$;
