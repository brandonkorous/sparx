-- What a customer's ORDERS are worth, as against what they have handed over.
--
-- `total_spent` answers "has this person paid me", which is the right question on a
-- shop taking cards and the wrong one on a shop taking manual payment, where an
-- order that is placed and unpaid is the normal state. Juniper Row's customer card
-- read "$0.00 across 3 orders" directly above a list of orders worth $502, and the
-- figure was arithmetically correct: none of them had been paid (issue 323).
--
-- NET OF REFUNDS, and deliberately so. The refund path already writes `amount_paid`
-- net -- a $170 order refunded $42 carries 128.00 -- so a gross column beside it
-- would put two different populations on one card, which is the exact defect this
-- closes rather than repeats. It is also what a return means: an order the money
-- went back on is worth nothing to the person who sold it.
--
-- Backfilled, not defaulted to zero. A derived column that starts at 0 on every
-- existing row reads as a measurement of nothing until each customer's next order
-- happens to rewrite it, and a customer who never orders again would read $0.00
-- forever. `recomputeCustomerCommerce` writes the same answer from then on.

ALTER TABLE "customers"
  ADD COLUMN "total_ordered" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "customers" c
SET "total_ordered" = COALESCE(o.net, 0)
FROM (
  SELECT "customer_id", SUM("total" - COALESCE("refund_total", 0)) AS net
  FROM "orders"
  WHERE "customer_id" IS NOT NULL
    AND "status" <> 'cancelled'
  GROUP BY "customer_id"
) o
WHERE o."customer_id" = c."id";

-- The list sorts and filters on it the way it already does on `total_spent`.
CREATE INDEX "customers_tenant_id_total_ordered_idx"
  ON "customers" ("tenant_id", "total_ordered" DESC);
