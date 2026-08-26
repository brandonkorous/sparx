-- A customer's lifetime spend agrees with their orders (issue 232).
--
-- Devi opened her customer list and read:
--
--     Anneliese Vogt    Customer    -$42.00     —
--     Jo Kim            Customer      $0.00     —
--     Tessa Wren        Customer    $101.95     Aug 24
--
-- Anneliese had paid $170 and been given $42 back. Jo Kim had paid $147. Tessa
-- had paid nothing at all — her $101.95 is the face value of an unpaid order.
-- Every figure on the screen was wrong, and one of them was a NEGATIVE lifetime
-- spend, which is not a number a shop owner can act on or even interpret.
--
-- ── WHY THEY DRIFTED ────────────────────────────────────────────────────────
--
-- `total_spent`, `order_count`, `first_order_at` and `last_order_at` were kept
-- by an event consumer applying `{ increment: order.total }` on order.created
-- and a matching decrement on order.refunded. Three faults, all of which fired:
--
--   * A consumer failure is swallowed by the bus's per-handler catch, so a lost
--     increment is silent and permanent. Three of five orders on this one shop
--     never reached the buyer's record.
--   * The decrement kept working while the increment was missing, so the figure
--     went below zero.
--   * The increment ran on PLACEMENT, at the order's face value, so an unpaid
--     order counted as money spent — while the decrement it was paired with only
--     makes sense against money received. One column, two definitions.
--
-- The code fix makes all four columns DERIVED, recomputed from the orders inside
-- the same transaction that writes the order, the payment, the refund or the
-- cancellation (`crm/src/services/customer-rollup.ts`). From here on a lost
-- event heals on the next write.
--
-- That fixes the future. Every row that already drifted stays wrong until it is
-- recomputed, which is what this migration does — and it cannot be left to "the
-- next order", because a customer who never orders again never gets one.
--
-- ── STEP 1: REFUNDS THAT NEVER REACHED THEIR ORDER ──────────────────────────
--
-- Jo Kim needs one more thing first. Her $42 went back through the returns
-- bench, which settled the return (`status = 'refunded'`,
-- `refunded_amount_cents = 4200`) and wrote nothing against the order. So the
-- order still reads `amount_paid 147.00, refund_total 0.00` and recomputing from
-- it would replace one wrong number with another.
--
-- The returns path now records the refund against the order, so this recovers
-- the ones settled before it did. Identified strictly: a return that is
-- `refunded` with a positive amount, whose order has NO refund row at all. Not
-- "no matching amount" — a partial recovery would double-count a refund that was
-- recorded correctly and then topped up.
INSERT INTO order_refunds (
  id, tenant_id, order_id, payment_id, amount, currency, reason,
  processor_ref, status, refunded_at, metadata, created_at, updated_at
)
SELECT gen_random_uuid(),
       r.tenant_id,
       r.order_id,
       NULL,
       (r.refunded_amount_cents::numeric / 100),
       o.currency,
       'Sent back by the customer',
       NULL,
       'completed',
       COALESCE(r.updated_at, r.created_at),
       jsonb_build_object('returnId', r.id, 'recoveredBy', '20270418000000'),
       COALESCE(r.updated_at, r.created_at),
       NOW()
  FROM commerce_return_requests r
  JOIN orders o ON o.id = r.order_id AND o.tenant_id = r.tenant_id
 WHERE r.status = 'refunded'
   AND COALESCE(r.refunded_amount_cents, 0) > 0
   AND NOT EXISTS (
         SELECT 1 FROM order_refunds x
          WHERE x.order_id = r.order_id AND x.tenant_id = r.tenant_id
       );

-- The order's own money columns follow from its payments and refunds. Same
-- arithmetic as `recomputeOrderPaymentRollup`: amount_paid is captured minus
-- refunded and never negative, and the status reads off that.
WITH money AS (
  SELECT o.id,
         o.tenant_id,
         o.total,
         o.paid_at,
         COALESCE((SELECT SUM(p.amount) FROM order_payments p
                    WHERE p.order_id = o.id AND p.status = 'captured'), 0) AS captured,
         COALESCE((SELECT SUM(x.amount) FROM order_refunds x
                    WHERE x.order_id = o.id AND x.status = 'completed'), 0) AS refunded
    FROM orders o
)
UPDATE orders o
   SET amount_paid  = GREATEST(money.captured - money.refunded, 0),
       refund_total = money.refunded,
       payment_status = CASE
         WHEN money.refunded > 0 AND GREATEST(money.captured - money.refunded, 0) = 0
           THEN 'refunded'
         WHEN GREATEST(money.captured - money.refunded, 0) >= money.total AND money.total > 0
           THEN 'paid'
         WHEN GREATEST(money.captured - money.refunded, 0) > 0
           THEN 'partially_paid'
         ELSE 'unpaid'
       END,
       updated_at = NOW()
  FROM money
 WHERE money.id = o.id
   AND (o.amount_paid <> GREATEST(money.captured - money.refunded, 0)
        OR o.refund_total <> money.refunded);

-- ── STEP 2: THE CUSTOMER SUMMARY ────────────────────────────────────────────
--
-- All four columns from the orders, for every customer on the platform.
-- Cancelled orders count toward nothing — an order that did not happen is not a
-- purchase, and nothing reversed one before.
--
-- `total_spent` is `SUM(amount_paid)`, which is money actually received: the
-- refund path writes `amount_paid` already net of what was given back, so
-- subtracting `refund_total` again here would take it off twice.
UPDATE customers c
   SET total_spent    = COALESCE(agg.spent, 0),
       order_count    = COALESCE(agg.orders, 0),
       first_order_at = agg.first_at,
       last_order_at  = agg.last_at,
       updated_at     = NOW()
  FROM (
        SELECT c2.id AS customer_id,
               SUM(o.amount_paid)  AS spent,
               COUNT(o.id)         AS orders,
               MIN(o.placed_at)    AS first_at,
               MAX(o.placed_at)    AS last_at
          FROM customers c2
          LEFT JOIN orders o
                 ON o.customer_id = c2.id
                AND o.tenant_id   = c2.tenant_id
                AND o.status <> 'cancelled'
         GROUP BY c2.id
       ) agg
 WHERE agg.customer_id = c.id
   AND (c.total_spent    IS DISTINCT FROM COALESCE(agg.spent, 0)
     OR c.order_count    IS DISTINCT FROM COALESCE(agg.orders, 0)::int
     OR c.first_order_at IS DISTINCT FROM agg.first_at
     OR c.last_order_at  IS DISTINCT FROM agg.last_at);
