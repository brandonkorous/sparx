-- docs/146 Phase 9.8 — tell somebody ONCE that a batch is running out of time.
--
-- The expiring-stock sweep runs nightly and a lot that is 27 days from expiry is
-- still 26 days from expiry tomorrow. Re-announcing it every night for a month is
-- how a business learns to ignore the alert, which is the same lesson Phase 8's
-- late-order alert had to be taught (`late_alerted_at`).
--
-- So the first crossing into the nearest horizon stamps this column and the lot
-- goes quiet. Nothing clears it: unlike a purchase order's expected arrival, an
-- expiry date is a fact about the goods rather than a promise somebody can renew.
-- A batch whose date is CORRECTED — a mis-keyed year, a supplier re-certifying —
-- is a different batch's worth of news, and the service clears the stamp when the
-- date itself moves.

ALTER TABLE "inventory_lot_batches"
  ADD COLUMN "expiry_alerted_at" TIMESTAMPTZ;

-- The sweep's own read: dated batches with stock left that nobody has flagged.
-- Partial, because a catalogue is overwhelmingly made of lots that are undated,
-- empty, or already announced.
CREATE INDEX "inventory_lot_batches_expiry_sweep_idx"
  ON "inventory_lot_batches" ("tenant_id", "expires_at")
  WHERE "expires_at" IS NOT NULL
    AND "quantity" > 0
    AND "expiry_alerted_at" IS NULL;
