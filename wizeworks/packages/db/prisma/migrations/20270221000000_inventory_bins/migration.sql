-- docs/146 Phase 2 — Bins: where INSIDE a location a thing actually is.
--
-- A warehouse answers "which building". Above roughly five hundred SKUs that
-- stops being enough and the question becomes "which shelf" — without an answer
-- there is no directed picking, no put-away, and counting means walking the room.
--
-- ── The layering, and why the warehouse ledger is left ALONE ─────────────────
--
--     inventory_levels          (variant, warehouse)  ← availability reads this
--       └── inventory_bin_levels     (variant, bin)   ← Σ == the level above
--             └── inventory_bin_movements             ← Σ(delta) == the bin level
--
-- `inventory_movements` and its `on_hand == Σ(delta)` invariant are UNTOUCHED by
-- this migration. That is deliberate: Phase 1's reconciliation job keeps working
-- with no change to its query and merely gains a new cross-check. Putting bins
-- into the warehouse ledger was the obvious alternative and it is wrong — a
-- bin-to-bin move changes no warehouse quantity, so it would have to be written
-- as a −N/+N pair whose `balance_after` dips through a value the shelf never held.
--
-- ── Bins are OPT-IN ─────────────────────────────────────────────────────────
--
-- `inventory_warehouses.uses_bins` defaults FALSE. Every existing location keeps
-- behaving exactly as it does today; the backfill below simply gives each one a
-- DEFAULT bin to land in if it ever turns bins on.
--
-- RLS FOOTGUN (packages/db/CLAUDE.md): the backfill writes to FORCE-RLS tables and
-- `sparx_owner` is a NON-superuser in production, so it runs inside a per-tenant
-- `set_config('app.tenant_id', …)` loop. Unscoped it would touch zero rows and
-- still report success — and it would PASS locally, where docker's owner is a
-- superuser.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Bins
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "inventory_bins" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"      UUID         NOT NULL,
  "warehouse_id"   UUID         NOT NULL,

  "code"           VARCHAR(32)  NOT NULL,
  "name"           VARCHAR(120),

  -- Free text, all four. Every warehouse names its geography differently
  -- (zone/aisle/rack/shelf, room/row/bay, floor/section); a schema insisting on
  -- ours would be fought rather than filled in. They exist to GROUP and FILTER,
  -- not to model a building.
  "zone"           VARCHAR(60),
  "aisle"          VARCHAR(60),
  "rack"           VARCHAR(60),
  "shelf"          VARCHAR(60),

  "type"           VARCHAR(20)  NOT NULL DEFAULT 'pick',
  "is_sellable"    BOOLEAN      NOT NULL DEFAULT true,
  "pick_sequence"  INTEGER,
  "capacity_units" INTEGER,
  "is_default"     BOOLEAN      NOT NULL DEFAULT false,
  "is_system"      BOOLEAN      NOT NULL DEFAULT false,
  "notes"          TEXT,

  "is_active"      BOOLEAN      NOT NULL DEFAULT true,
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "deleted_at"     TIMESTAMPTZ,

  CONSTRAINT "inventory_bins_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_bins_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_bins_warehouse_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_bins_type_check"
    CHECK ("type" IN ('pick', 'bulk', 'receiving', 'staging', 'quarantine', 'damaged')),
  CONSTRAINT "inventory_bins_capacity_check"
    CHECK ("capacity_units" IS NULL OR "capacity_units" > 0)
);

-- Code is unique per WAREHOUSE, not per tenant: two buildings both having an
-- "A-01-01" is normal, and global uniqueness would make people invent prefixes.
CREATE UNIQUE INDEX "inventory_bins_warehouse_code_unique"
  ON "inventory_bins" ("warehouse_id", "code");

-- Exactly one default bin per warehouse. A partial unique index rather than a
-- CHECK because the constraint is across rows, not within one.
CREATE UNIQUE INDEX "inventory_bins_one_default_per_warehouse"
  ON "inventory_bins" ("warehouse_id")
  WHERE "is_default" = true;

CREATE INDEX "inventory_bins_tenant_warehouse_active_idx"
  ON "inventory_bins" ("tenant_id", "warehouse_id", "is_active");
CREATE INDEX "inventory_bins_tenant_warehouse_zone_idx"
  ON "inventory_bins" ("tenant_id", "warehouse_id", "zone");
-- The pick walk order (docs/146 Phase 4). NULLS LAST so an unsequenced warehouse
-- still produces a stable list rather than leading with every unset bin.
CREATE INDEX "inventory_bins_tenant_warehouse_sequence_idx"
  ON "inventory_bins" ("tenant_id", "warehouse_id", "pick_sequence" NULLS LAST);

ALTER TABLE "inventory_bins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_bins" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_bins"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Bin levels
-- ══════════════════════════════════════════════════════════════════════════
--
-- No `allocated` column, deliberately. A reservation holds stock at the
-- LOCATION; which shelf it eventually comes off is a picking decision made
-- later. Allocating against a bin would force that decision at add-to-basket
-- time and then be wrong the moment a picker takes it from the other shelf.

CREATE TABLE "inventory_bin_levels" (
  "variant_id"      UUID        NOT NULL,
  "bin_id"          UUID        NOT NULL,
  "tenant_id"       UUID        NOT NULL,
  -- Denormalized from the bin so the "sum my bins" cross-check and every
  -- warehouse-scoped read run without joining through inventory_bins.
  "warehouse_id"    UUID        NOT NULL,

  "on_hand"         INTEGER     NOT NULL DEFAULT 0,
  "last_counted_at" TIMESTAMPTZ,

  "as_of"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_bin_levels_pkey" PRIMARY KEY ("variant_id", "bin_id"),
  CONSTRAINT "inventory_bin_levels_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_bin_levels_variant_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_bin_levels_bin_fkey"
    FOREIGN KEY ("bin_id") REFERENCES "inventory_bins"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_bin_levels_warehouse_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE CASCADE
);

CREATE INDEX "inventory_bin_levels_tenant_bin_idx"
  ON "inventory_bin_levels" ("tenant_id", "bin_id");
CREATE INDEX "inventory_bin_levels_tenant_variant_wh_idx"
  ON "inventory_bin_levels" ("tenant_id", "variant_id", "warehouse_id");
CREATE INDEX "inventory_bin_levels_tenant_wh_onhand_idx"
  ON "inventory_bin_levels" ("tenant_id", "warehouse_id", "on_hand");

ALTER TABLE "inventory_bin_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_bin_levels" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_bin_levels"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Bin movements
-- ══════════════════════════════════════════════════════════════════════════
--
-- Two kinds of row:
--   • PAIRED to a warehouse movement (`movement_id` set) — a receipt, a sale, a
--     count posting. Both quantities changed.
--   • A bin-to-bin MOVE (`movement_id` null, from/to set) — a −N/+N pair. No
--     warehouse movement exists, which is the honest record: nothing entered or
--     left the building.

CREATE TABLE "inventory_bin_movements" (
  "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"       UUID        NOT NULL,
  "bin_id"          UUID        NOT NULL,
  "variant_id"      UUID        NOT NULL,
  "warehouse_id"    UUID        NOT NULL,

  "delta"           INTEGER     NOT NULL,
  "balance_after"   INTEGER,
  "reason"          VARCHAR(20) NOT NULL,

  -- Soft pointer: both ledgers are append-only and neither should be able to
  -- cascade-delete the other's history.
  "movement_id"     UUID,

  "from_bin_id"     UUID,
  "to_bin_id"       UUID,

  "reference_type"  VARCHAR(63),
  "reference_id"    UUID,

  "actor_type"      VARCHAR(20) NOT NULL DEFAULT 'system',
  "actor_id"        VARCHAR(127),
  "source"          VARCHAR(63),

  "idempotency_key" VARCHAR(127),
  "note"            TEXT,

  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_bin_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_bin_movements_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_bin_movements_bin_fkey"
    FOREIGN KEY ("bin_id") REFERENCES "inventory_bins"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_bin_movements_variant_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_bin_movements_warehouse_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_bin_movements_from_bin_fkey"
    FOREIGN KEY ("from_bin_id") REFERENCES "inventory_bins"("id") ON DELETE SET NULL,
  CONSTRAINT "inventory_bin_movements_to_bin_fkey"
    FOREIGN KEY ("to_bin_id") REFERENCES "inventory_bins"("id") ON DELETE SET NULL,
  -- Same vocabulary as the warehouse ledger, plus the two that have no
  -- warehouse-level equivalent because they move nothing in or out.
  CONSTRAINT "inventory_bin_movements_reason_check"
    CHECK ("reason" IN (
      'sale', 'return', 'cancel', 'recount', 'loss', 'damage',
      'transfer_in', 'transfer_out', 'receive', 'manual', 'sync',
      'put_away', 'bin_move'
    ))
);

CREATE UNIQUE INDEX "inventory_bin_movements_tenant_idempotency_unique"
  ON "inventory_bin_movements" ("tenant_id", "idempotency_key");
CREATE INDEX "inventory_bin_movements_tenant_bin_created_idx"
  ON "inventory_bin_movements" ("tenant_id", "bin_id", "created_at" DESC);
CREATE INDEX "inventory_bin_movements_tenant_variant_created_idx"
  ON "inventory_bin_movements" ("tenant_id", "variant_id", "created_at" DESC);
CREATE INDEX "inventory_bin_movements_tenant_movement_idx"
  ON "inventory_bin_movements" ("tenant_id", "movement_id");

ALTER TABLE "inventory_bin_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_bin_movements" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_bin_movements"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 4. Columns on existing tables
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE "inventory_warehouses"
  ADD COLUMN "uses_bins"           BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN "allocation_strategy" VARCHAR(20) NOT NULL DEFAULT 'fifo';

ALTER TABLE "inventory_warehouses"
  ADD CONSTRAINT "inventory_warehouses_allocation_strategy_check"
    CHECK ("allocation_strategy" IN ('fifo', 'fefo', 'nearest_bin', 'single_bin'));

ALTER TABLE "commerce_product_variants"
  ADD COLUMN "default_bin_id" UUID;
ALTER TABLE "commerce_product_variants"
  ADD CONSTRAINT "commerce_product_variants_default_bin_fkey"
    FOREIGN KEY ("default_bin_id") REFERENCES "inventory_bins"("id") ON DELETE SET NULL;
CREATE INDEX "commerce_product_variants_default_bin_idx"
  ON "commerce_product_variants" ("default_bin_id")
  WHERE "default_bin_id" IS NOT NULL;

-- Nullable and NOT backfilled: recording "we put it in the default bin" for a
-- delivery nobody was ever asked about would be inventing a fact.
ALTER TABLE "inventory_goods_receipt_lines"
  ADD COLUMN "bin_id" UUID;
ALTER TABLE "inventory_goods_receipt_lines"
  ADD CONSTRAINT "inventory_goods_receipt_lines_bin_fkey"
    FOREIGN KEY ("bin_id") REFERENCES "inventory_bins"("id") ON DELETE SET NULL;

ALTER TABLE "inventory_counts"
  ADD COLUMN "scope"     VARCHAR(12) NOT NULL DEFAULT 'location',
  ADD COLUMN "bin_id"    UUID,
  ADD COLUMN "zone_name" VARCHAR(60),
  ADD COLUMN "is_blind"  BOOLEAN     NOT NULL DEFAULT false;

ALTER TABLE "inventory_counts"
  ADD CONSTRAINT "inventory_counts_scope_check"
    CHECK ("scope" IN ('location', 'zone', 'bin')),
  ADD CONSTRAINT "inventory_counts_bin_fkey"
    FOREIGN KEY ("bin_id") REFERENCES "inventory_bins"("id") ON DELETE SET NULL,
  -- A scope must carry what it scopes TO. Without this, a 'bin' count with no
  -- bin would silently behave as a location count — and a location count applies
  -- zero to every variant absent from the sheet, which is the single most
  -- destructive thing this module can do.
  ADD CONSTRAINT "inventory_counts_scope_target_check"
    CHECK (
      ("scope" = 'location' AND "bin_id" IS NULL AND "zone_name" IS NULL)
      OR ("scope" = 'zone' AND "zone_name" IS NOT NULL)
      OR ("scope" = 'bin' AND "bin_id" IS NOT NULL)
    );

ALTER TABLE "inventory_count_lines"
  ADD COLUMN "bin_id" UUID;
ALTER TABLE "inventory_count_lines"
  ADD CONSTRAINT "inventory_count_lines_bin_fkey"
    FOREIGN KEY ("bin_id") REFERENCES "inventory_bins"("id") ON DELETE SET NULL;
CREATE INDEX "inventory_count_lines_tenant_bin_idx"
  ON "inventory_count_lines" ("tenant_id", "bin_id");

-- Uniqueness becomes TWO PARTIAL indexes. Once a line can name a bin, "one line
-- per variant" holds only for a location-wide count — and a plain unique over the
-- nullable bin_id would let a location count hold unlimited duplicate lines for
-- one variant, because Postgres treats NULLs as distinct.
-- CONSTRAINT first, then the index. It was created as a table-level UNIQUE
-- constraint (migration 20260907000000), and Postgres refuses to DROP INDEX on an
-- index a constraint depends on — `IF EXISTS` does not rescue that, because the
-- index does exist and the drop errors on the dependency. The bare DROP INDEX
-- after it is the belt to that braces, for any environment where the same name
-- was ever created as a plain index.
ALTER TABLE "inventory_count_lines"
  DROP CONSTRAINT IF EXISTS "inventory_count_lines_count_variant_unique";
DROP INDEX IF EXISTS "inventory_count_lines_count_variant_unique";
CREATE UNIQUE INDEX "inventory_count_lines_count_variant_unique"
  ON "inventory_count_lines" ("count_id", "variant_id")
  WHERE "bin_id" IS NULL;
CREATE UNIQUE INDEX "inventory_count_lines_count_variant_bin_unique"
  ON "inventory_count_lines" ("count_id", "variant_id", "bin_id")
  WHERE "bin_id" IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════
-- 5. Backfill — a DEFAULT bin per warehouse, holding everything already there
-- ══════════════════════════════════════════════════════════════════════════
--
-- Every existing location gets three system bins:
--   DEFAULT     the fallback every write lands in. Sellable.
--   QUARANTINE  arrived or returned, not yet passed. NOT sellable.
--   DAMAGED     written off, physically still here. NOT sellable.
--
-- and every existing (variant, warehouse) level's whole on-hand is seated in that
-- location's DEFAULT bin, so `Σ(bin levels) == level.on_hand` holds from the
-- first moment the invariant exists rather than from the first put-away.
--
-- NO bin movements are written for the seating. A movement row asserts that
-- something HAPPENED at a time, and nothing happened here — this is the opening
-- position, not an event. Writing a fabricated `put_away` for every level in the
-- system would put a lie in an append-only log on day one, and Phase 1's whole
-- argument is that the log can be trusted.
--
-- FORCE RLS + non-superuser `sparx_owner` in prod ⇒ the per-tenant scope loop.
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, false);

        INSERT INTO "inventory_bins"
            ("tenant_id", "warehouse_id", "code", "name", "type", "is_sellable", "is_default", "is_system")
        SELECT w."tenant_id", w."id", b."code", b."name", b."type", b."is_sellable", b."is_default", true
          FROM "inventory_warehouses" w
         CROSS JOIN (VALUES
              ('DEFAULT',    'Unspecified',   'pick',       true,  true),
              ('QUARANTINE', 'Quarantine',    'quarantine', false, false),
              ('DAMAGED',    'Damaged goods', 'damaged',    false, false)
           ) AS b("code", "name", "type", "is_sellable", "is_default")
         WHERE w."tenant_id" = t.id
        ON CONFLICT ("warehouse_id", "code") DO NOTHING;

        INSERT INTO "inventory_bin_levels"
            ("tenant_id", "variant_id", "bin_id", "warehouse_id", "on_hand", "as_of", "updated_at")
        SELECT l."tenant_id", l."variant_id", b."id", l."warehouse_id", l."on_hand", l."as_of", now()
          FROM "inventory_levels" l
          JOIN "inventory_bins" b
            ON b."warehouse_id" = l."warehouse_id" AND b."is_default" = true
         WHERE l."tenant_id" = t.id
        ON CONFLICT ("variant_id", "bin_id") DO NOTHING;
    END LOOP;
    PERFORM set_config('app.tenant_id', '', false);
END $$;
