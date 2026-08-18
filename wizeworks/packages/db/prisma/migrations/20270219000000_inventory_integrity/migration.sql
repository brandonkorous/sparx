-- docs/146 Phase 1 — Inventory integrity: make "your stock number is right" checkable.
--
-- The ledger already guarantees `on_hand == Σ(inventory_movements.delta)` by
-- construction — `applyMovement()` is the only writer and it appends inside the
-- same row lock that mutates the level. But a guarantee nobody re-derives is a
-- belief, and "inaccurate inventory" is the single most common complaint in this
-- category. Four tables and one column set turn the belief into evidence:
--
--   1. inventory_reconciliation_runs / _drifts — a scheduled job re-derives the
--      sum per level and records what it found. A clean run is a result worth
--      showing, not silence.
--   2. inventory_oversell_incidents — one row every time we refused a sale for
--      lack of stock, or took one we could not cover. Diagnosable at the moment
--      it happens rather than after the refund.
--   3. inventory_channel_buffers — the oversell cushion, per sales channel. One
--      number on the level cannot express "a live storefront needs none and a
--      15-minute marketplace push needs three".
--   4. inventory_sources freshness SLO — how old this feed's stock may get before
--      it stops being trustworthy, and what to do when it does.
--
-- Every new table is ENABLE + FORCE RLS with a tenant_isolation policy.
--
-- RLS FOOTGUN (packages/db/CLAUDE.md): the ONE backfill here writes to
-- `inventory_sources`, which is FORCE RLS, and `sparx_owner` is a NON-superuser
-- in production. An unscoped UPDATE would silently touch zero rows (and pass
-- locally, where docker's owner IS a superuser). Hence the per-tenant
-- `set_config('app.tenant_id', …)` loop at the bottom.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Reconciliation runs
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "inventory_reconciliation_runs" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"         UUID         NOT NULL,

  "status"            VARCHAR(12)  NOT NULL DEFAULT 'running',
  "scope"             VARCHAR(12)  NOT NULL DEFAULT 'full',

  "levels_checked"    INTEGER      NOT NULL DEFAULT 0,
  "drift_count"       INTEGER      NOT NULL DEFAULT 0,
  "drift_units"       INTEGER      NOT NULL DEFAULT 0,
  "drift_value_cents" INTEGER      NOT NULL DEFAULT 0,

  "started_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "finished_at"       TIMESTAMPTZ,
  "duration_ms"       INTEGER,
  "error"             TEXT,

  CONSTRAINT "inventory_reconciliation_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_reconciliation_runs_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  -- The vocabulary is pinned at the DB level as well as in Zod: a run whose
  -- status is a typo reads as "not ok" to a human and as "unknown" to a query,
  -- and the difference decides whether anyone is paged.
  CONSTRAINT "inventory_reconciliation_runs_status_check"
    CHECK ("status" IN ('running', 'ok', 'drift', 'error')),
  CONSTRAINT "inventory_reconciliation_runs_scope_check"
    CHECK ("scope" IN ('full', 'sample', 'variant'))
);

CREATE INDEX "inventory_reconciliation_runs_tenant_started_idx"
  ON "inventory_reconciliation_runs" ("tenant_id", "started_at" DESC);
CREATE INDEX "inventory_reconciliation_runs_tenant_status_idx"
  ON "inventory_reconciliation_runs" ("tenant_id", "status");

ALTER TABLE "inventory_reconciliation_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_reconciliation_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_reconciliation_runs"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Reconciliation drifts
-- ══════════════════════════════════════════════════════════════════════════
--
-- A drift is NEVER auto-corrected. Writing the derived value over the recorded
-- one would destroy the evidence, and it could be the wrong direction — if the
-- ledger is the corrupted side then "fixing" the level propagates the corruption.
-- Resolution is an explicit human act (post a count) and `resolved_at` records it.

CREATE TABLE "inventory_reconciliation_drifts" (
  "id"                     UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"              UUID        NOT NULL,
  "run_id"                 UUID        NOT NULL,

  "variant_id"             UUID        NOT NULL,
  "warehouse_id"           UUID        NOT NULL,

  "recorded_on_hand"       INTEGER     NOT NULL,
  "derived_on_hand"        INTEGER     NOT NULL,
  -- recorded − derived. POSITIVE is the dangerous direction: the level claims
  -- more than the ledger can account for, which is what oversells.
  "delta"                  INTEGER     NOT NULL,
  "value_cents"            INTEGER     NOT NULL DEFAULT 0,

  "resolved_at"            TIMESTAMPTZ,
  -- Soft pointer: the ledger is append-only and must never be deleted under a
  -- drift row, so this is deliberately not a foreign key.
  "resolution_movement_id" UUID,

  "created_at"             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_reconciliation_drifts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_reconciliation_drifts_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_reconciliation_drifts_run_fkey"
    FOREIGN KEY ("run_id") REFERENCES "inventory_reconciliation_runs"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_reconciliation_drifts_variant_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_reconciliation_drifts_warehouse_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE CASCADE
);

CREATE INDEX "inventory_reconciliation_drifts_tenant_run_idx"
  ON "inventory_reconciliation_drifts" ("tenant_id", "run_id");
CREATE INDEX "inventory_reconciliation_drifts_tenant_level_idx"
  ON "inventory_reconciliation_drifts" ("tenant_id", "variant_id", "warehouse_id");
-- The open-drift list is the read that matters operationally; a partial index
-- keeps it cheap no matter how long the resolved history grows.
CREATE INDEX "inventory_reconciliation_drifts_tenant_open_idx"
  ON "inventory_reconciliation_drifts" ("tenant_id", "created_at" DESC)
  WHERE "resolved_at" IS NULL;

ALTER TABLE "inventory_reconciliation_drifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_reconciliation_drifts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_reconciliation_drifts"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Oversell incidents
-- ══════════════════════════════════════════════════════════════════════════
--
-- Three genuinely different events that all read as "out of stock" in a support
-- ticket, kept apart so they can be counted apart:
--   blocked          — a `deny` variant refused the hold. Lost revenue, correct.
--   allowed          — a `continue`/`preorder` variant took a hold it can't cover.
--                      A promise was made; correct only if the merchant meant it.
--   negative_on_hand — a committed sale drove on-hand below zero. Goods left that
--                      the system did not believe existed. Always worth a look.
--
-- Every quantity is a SNAPSHOT at the decision, not a live read. The whole value
-- of the row is answering "what did we think we had?" months later.

CREATE TABLE "inventory_oversell_incidents" (
  "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"             UUID        NOT NULL,

  "variant_id"            UUID        NOT NULL,
  "warehouse_id"          UUID        NOT NULL,

  "kind"                  VARCHAR(20) NOT NULL,

  "requested_quantity"    INTEGER     NOT NULL,
  "available_quantity"    INTEGER     NOT NULL,
  "shortfall"             INTEGER     NOT NULL DEFAULT 0,

  "on_hand_at_decision"    INTEGER    NOT NULL DEFAULT 0,
  "allocated_at_decision"  INTEGER    NOT NULL DEFAULT 0,
  "buffer_at_decision"     INTEGER    NOT NULL DEFAULT 0,

  "policy"                VARCHAR(20) NOT NULL,

  "channel"               VARCHAR(63),
  "holder_type"           VARCHAR(20),
  "holder_id"             UUID,

  "actor_type"            VARCHAR(20) NOT NULL DEFAULT 'system',
  "actor_id"              VARCHAR(127),

  -- Deliberately not a foreign key: an incident is history, and deleting the feed
  -- that caused a cluster of them must not delete the evidence that it did.
  "source_id"             UUID,
  "stock_age_seconds"     INTEGER,

  "occurred_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_oversell_incidents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_oversell_incidents_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_oversell_incidents_variant_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_oversell_incidents_warehouse_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_oversell_incidents_kind_check"
    CHECK ("kind" IN ('blocked', 'allowed', 'negative_on_hand'))
);

CREATE INDEX "inventory_oversell_incidents_tenant_occurred_idx"
  ON "inventory_oversell_incidents" ("tenant_id", "occurred_at" DESC);
CREATE INDEX "inventory_oversell_incidents_tenant_variant_idx"
  ON "inventory_oversell_incidents" ("tenant_id", "variant_id", "occurred_at" DESC);
CREATE INDEX "inventory_oversell_incidents_tenant_kind_idx"
  ON "inventory_oversell_incidents" ("tenant_id", "kind", "occurred_at" DESC);
CREATE INDEX "inventory_oversell_incidents_tenant_channel_idx"
  ON "inventory_oversell_incidents" ("tenant_id", "channel");

ALTER TABLE "inventory_oversell_incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_oversell_incidents" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_oversell_incidents"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 4. Per-channel safety buffers
-- ══════════════════════════════════════════════════════════════════════════
--
-- Resolution order for a channel's sellable quantity:
--   1. a row matching (channel, variant, warehouse)          — surgical override
--   2. a row matching (channel) with NULL variant+warehouse  — channel default
--   3. inventory_levels.safety_buffer                        — all-channels floor

CREATE TABLE "inventory_channel_buffers" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"    UUID        NOT NULL,

  "channel"      VARCHAR(63) NOT NULL,

  "variant_id"   UUID,
  "warehouse_id" UUID,

  "buffer"       INTEGER     NOT NULL DEFAULT 0,
  "note"         TEXT,

  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_channel_buffers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_channel_buffers_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_channel_buffers_variant_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_channel_buffers_warehouse_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE CASCADE,
  -- Both set (a surgical override) or both null (the channel default). A row with
  -- one of the two has no coherent meaning — "this variant, at every warehouse"
  -- is a different feature and would need a different resolution order.
  CONSTRAINT "inventory_channel_buffers_scope_check"
    CHECK (
      ("variant_id" IS NULL AND "warehouse_id" IS NULL)
      OR ("variant_id" IS NOT NULL AND "warehouse_id" IS NOT NULL)
    ),
  CONSTRAINT "inventory_channel_buffers_nonneg_check" CHECK ("buffer" >= 0)
);

-- Two partial unique indexes rather than one @@unique: Postgres treats NULLs as
-- distinct, so a plain UNIQUE (tenant, channel, variant, warehouse) would happily
-- accept unlimited duplicate channel defaults — the exact row that most needs to
-- be unique.
CREATE UNIQUE INDEX "inventory_channel_buffers_default_unique"
  ON "inventory_channel_buffers" ("tenant_id", "channel")
  WHERE "variant_id" IS NULL;
CREATE UNIQUE INDEX "inventory_channel_buffers_override_unique"
  ON "inventory_channel_buffers" ("tenant_id", "channel", "variant_id", "warehouse_id")
  WHERE "variant_id" IS NOT NULL;

CREATE INDEX "inventory_channel_buffers_tenant_channel_idx"
  ON "inventory_channel_buffers" ("tenant_id", "channel");
CREATE INDEX "inventory_channel_buffers_tenant_level_idx"
  ON "inventory_channel_buffers" ("tenant_id", "variant_id", "warehouse_id");

ALTER TABLE "inventory_channel_buffers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_channel_buffers" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_channel_buffers"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 5. Source freshness SLO
-- ══════════════════════════════════════════════════════════════════════════
--
-- `sync_interval_sec` says how often we INTEND to pull. It says nothing about
-- when the number stops being trustworthy, and those are different questions —
-- a nightly feed is healthy at 23 hours old and alarming at 30.

ALTER TABLE "inventory_sources"
  ADD COLUMN "expected_interval_sec" INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN "staleness_policy"      VARCHAR(20) NOT NULL DEFAULT 'warn',
  ADD COLUMN "staleness_buffer"      INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN "is_stale"              BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN "stale_since"           TIMESTAMPTZ;

ALTER TABLE "inventory_sources"
  ADD CONSTRAINT "inventory_sources_staleness_policy_check"
    CHECK ("staleness_policy" IN ('warn', 'buffer_up', 'pause_channel')),
  ADD CONSTRAINT "inventory_sources_staleness_buffer_check"
    CHECK ("staleness_buffer" >= 0),
  ADD CONSTRAINT "inventory_sources_expected_interval_check"
    CHECK ("expected_interval_sec" >= 0);

-- The freshness sweep reads "which sources are overdue" across every tenant it
-- has scoped in; a partial index on the ones that declared an SLO keeps that read
-- proportional to the sources that opted in rather than to all of them.
CREATE INDEX "inventory_sources_tenant_slo_idx"
  ON "inventory_sources" ("tenant_id", "last_sync_at")
  WHERE "expected_interval_sec" > 0 AND "deleted_at" IS NULL;

-- ── Backfill: give existing sources an SLO of twice their declared cadence ──
--
-- A source that already told us how often it syncs has effectively declared what
-- "on time" means; doubling it is the conservative reading of that declaration
-- and means nobody has to go and set a number by hand before the sweep is useful.
-- Sources with no cadence (0 = manual-only) stay exempt.
--
-- FORCE RLS + non-superuser `sparx_owner` in prod ⇒ the per-tenant scope loop.
-- Without it this reports success having updated zero rows, and passes locally
-- because docker's owner IS a superuser.
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, false);
        UPDATE "inventory_sources"
           SET "expected_interval_sec" = "sync_interval_sec" * 2
         WHERE "tenant_id" = t.id
           AND "sync_interval_sec" > 0;
    END LOOP;
    PERFORM set_config('app.tenant_id', '', false);
END $$;
