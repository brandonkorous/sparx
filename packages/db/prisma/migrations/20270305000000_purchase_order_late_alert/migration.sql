-- docs/146 Phase 8.3 — one marker, so a late-order alert fires once.
--
-- The nightly pass finds every submitted order that has passed the date it was
-- due with nothing received against it. Without somewhere to record that it has
-- been said, it gets said again every night for as long as the order is
-- outstanding — and an alert that repeats for six weeks is an alert everyone
-- has already learned to ignore, which is worse than no alert at all.
--
-- NULLABLE, and null means "never flagged" rather than "not late". Clearing it
-- is meaningful in its own right: when a buyer moves the expected arrival date
-- they have accepted a NEW promise, and the alert re-arms so the next broken one
-- is heard.

ALTER TABLE "inventory_purchase_orders"
  ADD COLUMN "late_alerted_at" TIMESTAMPTZ;

-- Partial index: the sweep asks "which open orders have not been flagged", and
-- that is a small slice of a table that grows forever.
CREATE INDEX "inventory_purchase_orders_open_unflagged_idx"
  ON "inventory_purchase_orders" ("tenant_id", "expected_arrival_at")
  WHERE "status" IN ('submitted', 'partial') AND "late_alerted_at" IS NULL;
