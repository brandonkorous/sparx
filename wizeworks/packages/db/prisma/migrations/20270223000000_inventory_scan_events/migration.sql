-- docs/146 Phase 3.5–3.9 — Scan events: the record of every trigger pull.
--
-- ── Idempotency, which is what makes offline scanning correct ───────────────
--
-- A hand terminal in a metal-racked warehouse loses its connection constantly.
-- The workable answer is to keep scanning into a local queue and replay when the
-- signal returns — but a replay that cannot distinguish "this scan again" from
-- "this scan a second time" turns a dropped connection into a receiving error,
-- and a warehouse burned once by that will never trust the feature again. Every
-- scan therefore carries a client-generated key, and the unique index below
-- makes the replay safe by construction: the second arrival inserts nothing.
--
-- Same discipline as `inventory_movements.idempotency_key`, one layer out. The
-- movement ledger protects the QUANTITY; this protects the ACT — including the
-- acts that produce no movement at all (a lookup, a scan of something we do not
-- stock, a scan that was refused).
--
-- ── scanned_at vs created_at ────────────────────────────────────────────────
--
-- `scanned_at` is when the trigger was pulled, per the device. `created_at` is
-- when we heard about it. On a live connection they match; on a replayed queue
-- the gap between them IS the outage, recorded rather than inferred. That is the
-- difference between "entered at 09:14" and "entered at 06:02, reached us at
-- 09:14", and only one of those is true.
--
-- No backfill: nothing has ever been scanned, so there is nothing to record.

CREATE TABLE "inventory_scan_events" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"       UUID         NOT NULL,

  "idempotency_key" VARCHAR(127) NOT NULL,

  -- Raw, before normalization. When a code will not resolve the first useful
  -- question is what the gun actually sent, and a cleaned copy cannot answer it.
  "value"           VARCHAR(256) NOT NULL,

  "context_type"    VARCHAR(20)  NOT NULL,
  "context_id"      UUID,

  "outcome"         VARCHAR(20)  NOT NULL,
  "message"         TEXT,

  "variant_id"      UUID,
  "bin_id"          UUID,

  -- Base units, pack size already multiplied in, so nobody downstream has to
  -- remember that a case scan meant twelve.
  "quantity"        INTEGER      NOT NULL DEFAULT 1,

  -- Of those, how many arrived broken. Split at the moment of scanning because
  -- the receiver looking at the carton is the only person who will ever know,
  -- and a receipt that mixes the two books damaged goods as sellable stock.
  "damaged_quantity" INTEGER     NOT NULL DEFAULT 0,

  "device_id"       VARCHAR(64),
  "actor_id"        VARCHAR(127),

  "scanned_at"      TIMESTAMPTZ  NOT NULL,
  "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_scan_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_scan_events_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_scan_events_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE SET NULL,
  CONSTRAINT "inventory_scan_events_bin_fk"
    FOREIGN KEY ("bin_id") REFERENCES "inventory_bins" ("id") ON DELETE SET NULL,

  CONSTRAINT "inventory_scan_events_context_check" CHECK (
    "context_type" IN ('count','receipt','transfer','put_away','pick','lookup')
  ),
  CONSTRAINT "inventory_scan_events_outcome_check" CHECK (
    "outcome" IN ('applied','duplicate','not_found','rejected')
  ),
  -- Damaged is a SUBSET of what arrived, not an addition to it. Letting the two
  -- drift apart is how a receipt reports more broken units than units.
  CONSTRAINT "inventory_scan_events_damaged_check" CHECK (
    "damaged_quantity" >= 0 AND "damaged_quantity" <= "quantity"
  )
);

-- The constraint the offline queue rests on.
CREATE UNIQUE INDEX "inventory_scan_events_tenant_idempotency_unique"
  ON "inventory_scan_events" ("tenant_id", "idempotency_key");

-- "What was scanned into this receiving session" — the replay view, and the
-- audit trail behind a disputed count.
CREATE INDEX "inventory_scan_events_tenant_context_idx"
  ON "inventory_scan_events" ("tenant_id", "context_type", "context_id");
CREATE INDEX "inventory_scan_events_tenant_created_idx"
  ON "inventory_scan_events" ("tenant_id", "created_at" DESC);
CREATE INDEX "inventory_scan_events_tenant_variant_idx"
  ON "inventory_scan_events" ("tenant_id", "variant_id");

ALTER TABLE "inventory_scan_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_scan_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_scan_events"
  USING ("tenant_id" = current_tenant_id());
