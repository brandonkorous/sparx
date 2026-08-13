-- docs/146 Phase 9 — demand-side commitments.
--
-- Four capabilities and one shared idea: a PROMISE and the STOCK that answers it
-- are separate facts. Backorders write down who is owed what and in what order;
-- preorder windows make "sell it before it exists" a dated, bounded offer rather
-- than a silent oversell; the ownership axis says which of the stock on your
-- shelves was never yours; returns disposition replaces a boolean with the four
-- things that actually happen to returned goods.
--
-- Every derived date in here is NULLABLE, and the row records where it came
-- from. Phase 7 shipped a classification defaulted to "erratic"; Phase 8 answered
-- with "unmeasurable is NULL, with its sample count beside it". This phase's
-- version is about dates, and it is the one customers read: a backorder screen
-- showing a delivery date for every line is enormously reassuring and, where the
-- date was invented from a lead time nobody measured, a lie told on the
-- business's behalf.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. The backorder queue (9.1)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "inventory_backorders" (
  "id"                         UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"                  UUID NOT NULL,
  "variant_id"                 UUID NOT NULL,
  "warehouse_id"               UUID NOT NULL,

  "quantity"                   INTEGER NOT NULL,
  "allocated_quantity"         INTEGER NOT NULL DEFAULT 0,
  "status"                     VARCHAR(20) NOT NULL DEFAULT 'open',

  "holder_type"                VARCHAR(20) NOT NULL,
  "holder_id"                  UUID NOT NULL,
  "order_item_id"              UUID,
  "customer_id"                UUID,

  "priority"                   INTEGER NOT NULL DEFAULT 0,

  "promised_at"                TIMESTAMPTZ,
  "promise_source"             VARCHAR(20),
  "expected_purchase_order_id" UUID,

  "notified_at"                TIMESTAMPTZ,
  "notified_promised_at"       TIMESTAMPTZ,

  "note"                       TEXT,

  "created_at"                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  "allocated_at"               TIMESTAMPTZ,
  "fulfilled_at"               TIMESTAMPTZ,
  "cancelled_at"               TIMESTAMPTZ,

  CONSTRAINT "inventory_backorders_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "inventory_backorders"
  ADD CONSTRAINT "inventory_backorders_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "inventory_backorders_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "inventory_backorders_warehouse_fk"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE CASCADE,
  -- SET NULL, not CASCADE: deleting a draft purchase order must never erase the
  -- customer commitment that justified raising it. The promise outlives the plan.
  ADD CONSTRAINT "inventory_backorders_expected_po_fk"
    FOREIGN KEY ("expected_purchase_order_id") REFERENCES "inventory_purchase_orders"("id") ON DELETE SET NULL;

ALTER TABLE "inventory_backorders"
  ADD CONSTRAINT "inventory_backorders_status_check" CHECK (
    "status" IN ('open', 'partial', 'allocated', 'fulfilled', 'cancelled')
  ),
  ADD CONSTRAINT "inventory_backorders_holder_check" CHECK (
    "holder_type" IN ('order', 'subscription')
  ),
  ADD CONSTRAINT "inventory_backorders_quantity_check" CHECK (
    "quantity" > 0 AND "allocated_quantity" >= 0 AND "allocated_quantity" <= "quantity"
  ),
  -- The pair that makes the honesty rule structural rather than a convention: a
  -- date with no stated provenance cannot be written, and neither can a
  -- provenance with no date. Whichever half somebody forgets, the insert fails.
  ADD CONSTRAINT "inventory_backorders_promise_pair_check" CHECK (
    ("promised_at" IS NULL) = ("promise_source" IS NULL)
  ),
  ADD CONSTRAINT "inventory_backorders_promise_source_check" CHECK (
    "promise_source" IS NULL OR "promise_source" IN ('purchase_order', 'lead_time', 'manual')
  );

CREATE INDEX "inventory_backorders_queue_idx"
  ON "inventory_backorders" ("tenant_id", "variant_id", "warehouse_id", "status", "priority" DESC, "created_at");
CREATE INDEX "inventory_backorders_promise_idx"
  ON "inventory_backorders" ("tenant_id", "status", "promised_at");
CREATE INDEX "inventory_backorders_holder_idx"
  ON "inventory_backorders" ("tenant_id", "holder_type", "holder_id");
CREATE INDEX "inventory_backorders_customer_idx"
  ON "inventory_backorders" ("tenant_id", "customer_id");

ALTER TABLE "inventory_backorders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_backorders" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_backorders"
  USING ("tenant_id" = current_tenant_id());


CREATE TABLE "inventory_backorder_allocations" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"    UUID NOT NULL,
  "backorder_id" UUID NOT NULL,

  "quantity"     INTEGER NOT NULL,

  "source_type"  VARCHAR(20) NOT NULL,
  "source_id"    UUID,
  "movement_id"  UUID,

  "allocated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "actor_type"   VARCHAR(20) NOT NULL DEFAULT 'system',
  "actor_id"     VARCHAR(127),

  CONSTRAINT "inventory_backorder_allocations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "inventory_backorder_allocations"
  ADD CONSTRAINT "inventory_backorder_allocations_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "inventory_backorder_allocations_backorder_fk"
    FOREIGN KEY ("backorder_id") REFERENCES "inventory_backorders"("id") ON DELETE CASCADE;

ALTER TABLE "inventory_backorder_allocations"
  ADD CONSTRAINT "inventory_backorder_allocations_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "inventory_backorder_allocations_source_check" CHECK (
    "source_type" IN ('goods_receipt', 'transfer', 'count', 'manual')
  );

CREATE INDEX "inventory_backorder_allocations_backorder_idx"
  ON "inventory_backorder_allocations" ("tenant_id", "backorder_id");
CREATE INDEX "inventory_backorder_allocations_source_idx"
  ON "inventory_backorder_allocations" ("tenant_id", "source_type", "source_id");

ALTER TABLE "inventory_backorder_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_backorder_allocations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_backorder_allocations"
  USING ("tenant_id" = current_tenant_id());


-- ══════════════════════════════════════════════════════════════════════════
-- 2. Preorder windows (9.4)
-- ══════════════════════════════════════════════════════════════════════════
--
-- `inventoryPolicy = 'preorder'` has existed since the first commerce migration
-- and has always been a pure synonym for `continue` — sell it, let on-hand go
-- negative, tell the customer nothing. This table is what turns it into an offer.

CREATE TABLE "inventory_preorder_windows" (
  "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"         UUID NOT NULL,
  "variant_id"        UUID NOT NULL,

  "status"            VARCHAR(20) NOT NULL DEFAULT 'scheduled',

  "starts_at"         TIMESTAMPTZ,
  "ends_at"           TIMESTAMPTZ,

  "available_at"      TIMESTAMPTZ,
  "availability_note" VARCHAR(255),

  "max_quantity"      INTEGER NOT NULL DEFAULT 0,
  "is_capped"         BOOLEAN NOT NULL DEFAULT false,
  "sold_quantity"     INTEGER NOT NULL DEFAULT 0,

  "charge_up_front"   BOOLEAN NOT NULL DEFAULT true,

  "note"              TEXT,

  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "closed_at"         TIMESTAMPTZ,

  CONSTRAINT "inventory_preorder_windows_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "inventory_preorder_windows"
  ADD CONSTRAINT "inventory_preorder_windows_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "inventory_preorder_windows_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants"("id") ON DELETE CASCADE;

ALTER TABLE "inventory_preorder_windows"
  ADD CONSTRAINT "inventory_preorder_windows_status_check" CHECK (
    "status" IN ('scheduled', 'open', 'closed', 'cancelled')
  ),
  ADD CONSTRAINT "inventory_preorder_windows_quantity_check" CHECK (
    "max_quantity" >= 0 AND "sold_quantity" >= 0
  ),
  -- A cap of zero is not a cap, it is a closed shop. Requiring a positive number
  -- when `is_capped` is on stops "limited to 0 units" reaching a storefront.
  ADD CONSTRAINT "inventory_preorder_windows_cap_check" CHECK (
    "is_capped" = false OR "max_quantity" > 0
  ),
  ADD CONSTRAINT "inventory_preorder_windows_dates_check" CHECK (
    "starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at"
  );

-- At most ONE window per variant may be live at a time. A partial unique index
-- rather than application logic, because the race is real: two admins opening a
-- preorder on the same item from two tabs is a Tuesday, and two live windows
-- means two different dates promised for the same product.
CREATE UNIQUE INDEX "inventory_preorder_windows_one_live_per_variant"
  ON "inventory_preorder_windows" ("variant_id")
  WHERE "status" IN ('scheduled', 'open');

CREATE INDEX "inventory_preorder_windows_variant_idx"
  ON "inventory_preorder_windows" ("tenant_id", "variant_id", "status");
CREATE INDEX "inventory_preorder_windows_available_idx"
  ON "inventory_preorder_windows" ("tenant_id", "status", "available_at");

ALTER TABLE "inventory_preorder_windows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_preorder_windows" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_preorder_windows"
  USING ("tenant_id" = current_tenant_id());


-- ══════════════════════════════════════════════════════════════════════════
-- 3. The ownership axis (9.5)
-- ══════════════════════════════════════════════════════════════════════════
--
-- `owned` is the honest default here, unlike most defaults in this schema. Every
-- existing level got its stock through a purchase order onto the tenant's own
-- shelves, which IS ownership — this is not a class being invented for rows
-- nobody classified, it is the recording of a fact that was already true.
--
-- The behavioural consequence is deliberately narrow: valuation excludes
-- everything that is not `owned`, and availability excludes NOTHING. Consigned
-- stock is sellable — holding it is the entire point — while being none of your
-- balance sheet.

ALTER TABLE "inventory_levels"
  ADD COLUMN "ownership"          VARCHAR(20) NOT NULL DEFAULT 'owned',
  ADD COLUMN "owner_supplier_id"  UUID,
  ADD COLUMN "owner_customer_id"  UUID,
  ADD COLUMN "unsellable_on_hand" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "inventory_levels"
  ADD CONSTRAINT "inventory_levels_owner_supplier_fk"
    FOREIGN KEY ("owner_supplier_id") REFERENCES "inventory_suppliers"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "inventory_levels_owner_customer_fk"
    FOREIGN KEY ("owner_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL;

ALTER TABLE "inventory_levels"
  ADD CONSTRAINT "inventory_levels_ownership_check" CHECK (
    "ownership" IN ('owned', 'consignment', 'customer_owned', '3pl_owned')
  ),
  -- Owned stock has no external owner; anything else has at most one. "At most"
  -- rather than "exactly" on purpose: a tenant flipping a level to consignment
  -- before they have created the supplier record should not be blocked, and the
  -- settlement service is where the missing owner becomes an error — at the point
  -- it actually matters, which is when money is owed to somebody unnamed.
  ADD CONSTRAINT "inventory_levels_owner_check" CHECK (
    ("ownership" = 'owned' AND "owner_supplier_id" IS NULL AND "owner_customer_id" IS NULL)
    OR ("ownership" <> 'owned' AND NOT ("owner_supplier_id" IS NOT NULL AND "owner_customer_id" IS NOT NULL))
  ),
  ADD CONSTRAINT "inventory_levels_unsellable_check" CHECK ("unsellable_on_hand" >= 0);

CREATE INDEX "inventory_levels_ownership_idx"
  ON "inventory_levels" ("tenant_id", "ownership")
  WHERE "ownership" <> 'owned';

-- Ownership STAMPED on the movement, not joined from the level at read time.
--
-- Ownership changes: a consignment gets bought outright, a 3PL contract ends and
-- the stock comes in-house. Classifying a three-month-old sale by today's
-- ownership silently rewrites what you owed that quarter, and a settlement that
-- moves after it was paid is worse than no settlement at all.
--
-- NULL on every row written before this migration, and null is NOT `owned` — it
-- means nobody recorded it. Settlement counts only rows explicitly stamped
-- `consignment`, so the historic ledger is silent rather than wrong.
ALTER TABLE "inventory_movements"
  ADD COLUMN "ownership" VARCHAR(20);

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_ownership_check" CHECK (
    "ownership" IS NULL OR "ownership" IN ('owned', 'consignment', 'customer_owned', '3pl_owned')
  );

-- The settlement read: consigned sales in a period, by variant and location.
CREATE INDEX "inventory_movements_consignment_idx"
  ON "inventory_movements" ("tenant_id", "variant_id", "warehouse_id", "created_at")
  WHERE "ownership" = 'consignment' AND "reason" = 'sale';


-- ══════════════════════════════════════════════════════════════════════════
-- 4. Consignment settlement (9.6)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "inventory_consignment_settlements" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"        UUID NOT NULL,

  "number"           VARCHAR(31) NOT NULL,

  "owner_type"       VARCHAR(20) NOT NULL,
  "supplier_id"      UUID,
  "customer_id"      UUID,

  "period_start"     TIMESTAMPTZ NOT NULL,
  "period_end"       TIMESTAMPTZ NOT NULL,

  "status"           VARCHAR(20) NOT NULL DEFAULT 'draft',

  "currency"         VARCHAR(3) NOT NULL DEFAULT 'USD',
  "total_cents"      INTEGER NOT NULL DEFAULT 0,
  "units_sold"       INTEGER NOT NULL DEFAULT 0,

  "supplier_bill_id" UUID,

  "note"             TEXT,

  "closed_at"        TIMESTAMPTZ,
  "invoiced_at"      TIMESTAMPTZ,
  "paid_at"          TIMESTAMPTZ,
  "cancelled_at"     TIMESTAMPTZ,

  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_consignment_settlements_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "inventory_consignment_settlements"
  ADD CONSTRAINT "inventory_consignment_settlements_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  -- RESTRICT on the owner: a settled period is a financial record naming a
  -- counterparty, and deleting the counterparty out from under it would leave an
  -- amount owed to nobody.
  ADD CONSTRAINT "inventory_consignment_settlements_supplier_fk"
    FOREIGN KEY ("supplier_id") REFERENCES "inventory_suppliers"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "inventory_consignment_settlements_customer_fk"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "inventory_consignment_settlements_bill_fk"
    FOREIGN KEY ("supplier_bill_id") REFERENCES "inventory_supplier_bills"("id") ON DELETE SET NULL;

ALTER TABLE "inventory_consignment_settlements"
  ADD CONSTRAINT "inventory_consignment_settlements_status_check" CHECK (
    "status" IN ('draft', 'closed', 'invoiced', 'paid', 'cancelled')
  ),
  ADD CONSTRAINT "inventory_consignment_settlements_owner_check" CHECK (
    ("owner_type" = 'supplier' AND "supplier_id" IS NOT NULL AND "customer_id" IS NULL)
    OR ("owner_type" = 'customer' AND "customer_id" IS NOT NULL AND "supplier_id" IS NULL)
  ),
  -- Half-open `[start, end)`, so adjacent periods cannot both claim a sale that
  -- happened at midnight.
  ADD CONSTRAINT "inventory_consignment_settlements_period_check" CHECK (
    "period_end" > "period_start"
  ),
  ADD CONSTRAINT "inventory_consignment_settlements_totals_check" CHECK (
    "total_cents" >= 0 AND "units_sold" >= 0
  );

CREATE UNIQUE INDEX "inventory_consignment_settlements_tenant_number_unique"
  ON "inventory_consignment_settlements" ("tenant_id", "number");
CREATE INDEX "inventory_consignment_settlements_status_idx"
  ON "inventory_consignment_settlements" ("tenant_id", "status", "period_end" DESC);
CREATE INDEX "inventory_consignment_settlements_supplier_idx"
  ON "inventory_consignment_settlements" ("tenant_id", "supplier_id");

ALTER TABLE "inventory_consignment_settlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_consignment_settlements" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_consignment_settlements"
  USING ("tenant_id" = current_tenant_id());


CREATE TABLE "inventory_consignment_settlement_lines" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"       UUID NOT NULL,
  "settlement_id"   UUID NOT NULL,
  "variant_id"      UUID NOT NULL,
  "warehouse_id"    UUID NOT NULL,

  "units_sold"      INTEGER NOT NULL,
  "unit_cost_cents" INTEGER NOT NULL,
  "amount_cents"    INTEGER NOT NULL,

  "movement_ids"    JSONB NOT NULL DEFAULT '[]',

  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_consignment_settlement_lines_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "inventory_consignment_settlement_lines"
  ADD CONSTRAINT "inventory_consignment_settlement_lines_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "inventory_consignment_settlement_lines_settlement_fk"
    FOREIGN KEY ("settlement_id") REFERENCES "inventory_consignment_settlements"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "inventory_consignment_settlement_lines_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "inventory_consignment_settlement_lines_warehouse_fk"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE CASCADE;

ALTER TABLE "inventory_consignment_settlement_lines"
  ADD CONSTRAINT "inventory_consignment_settlement_lines_units_check" CHECK ("units_sold" > 0);

CREATE INDEX "inventory_consignment_settlement_lines_settlement_idx"
  ON "inventory_consignment_settlement_lines" ("tenant_id", "settlement_id");
CREATE INDEX "inventory_consignment_settlement_lines_variant_idx"
  ON "inventory_consignment_settlement_lines" ("tenant_id", "variant_id");

ALTER TABLE "inventory_consignment_settlement_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_consignment_settlement_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_consignment_settlement_lines"
  USING ("tenant_id" = current_tenant_id());


-- ══════════════════════════════════════════════════════════════════════════
-- 5. Returns disposition (9.7)
-- ══════════════════════════════════════════════════════════════════════════
--
-- `restockable BOOLEAN` cannot describe what happens to returned goods. Four
-- things do, and only one of them is "put it back":
--
--   restock     to a sellable shelf
--   quarantine  physically here, not sellable, decision pending
--   repair      here, not sellable, work required first
--   scrap       worthless; never re-enters stock
--
-- NULL until somebody decides, and this is the one column in the phase where a
-- default would be actively dangerous in both directions: defaulting to
-- `restock` puts a customer's damaged goods back on the shelf, and defaulting to
-- `scrap` throws away stock that was fine. There is no safe default, so there is
-- none.
--
-- The boolean is KEPT and kept in step (restock ⇒ true, everything else ⇒
-- false). It is read by the refund path and by tenants' existing API calls, and
-- silently changing what an existing column means is worse than carrying a
-- redundant one.

ALTER TABLE "commerce_return_inspections"
  ADD COLUMN "disposition"        VARCHAR(20),
  ADD COLUMN "disposition_bin_id" UUID,
  ADD COLUMN "disposition_at"     TIMESTAMPTZ,
  ADD COLUMN "disposition_by"     UUID,
  ADD COLUMN "disposition_note"   TEXT;

ALTER TABLE "commerce_return_inspections"
  ADD CONSTRAINT "commerce_return_inspections_disposition_bin_fk"
    FOREIGN KEY ("disposition_bin_id") REFERENCES "inventory_bins"("id") ON DELETE SET NULL;

ALTER TABLE "commerce_return_inspections"
  ADD CONSTRAINT "commerce_return_inspections_disposition_check" CHECK (
    "disposition" IS NULL OR "disposition" IN ('restock', 'quarantine', 'repair', 'scrap')
  ),
  -- Recording WHEN without recording WHAT is a decision with no content.
  ADD CONSTRAINT "commerce_return_inspections_disposition_pair_check" CHECK (
    ("disposition" IS NULL) = ("disposition_at" IS NULL)
  ),
  -- Scrapped goods went nowhere, so they cannot have gone to a shelf.
  ADD CONSTRAINT "commerce_return_inspections_scrap_bin_check" CHECK (
    "disposition" <> 'scrap' OR "disposition_bin_id" IS NULL
  );

CREATE INDEX "commerce_return_inspections_disposition_idx"
  ON "commerce_return_inspections" ("tenant_id", "disposition", "disposition_at" DESC);

-- Existing inspections carry a decision that WAS made, in the vocabulary
-- available at the time. Backfilling them is therefore recording history rather
-- than inventing it — `restockable` is a real answer to a narrower question, and
-- `restock`/`quarantine` are its faithful translations. `disposition_at` takes
-- the inspection's own timestamp, because that is when the call was made.
--
-- Note the direction of the mapping: false becomes `quarantine`, never `scrap`.
-- "Not fit to sell" and "throw it away" are different findings, and the old
-- boolean only ever recorded the first.
--
-- Loops tenants with `set_config`: `commerce_return_inspections` is FORCE RLS and
-- `sparx_owner` is a NON-SUPERUSER in production, so an unscoped UPDATE here sees
-- zero rows and silently backfills nothing (packages/db/CLAUDE.md).
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT DISTINCT "tenant_id" AS id FROM "commerce_return_inspections" LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);
    UPDATE "commerce_return_inspections"
       SET "disposition"    = CASE WHEN "restockable" THEN 'restock' ELSE 'quarantine' END,
           "disposition_at" = "created_at"
     WHERE "tenant_id"   = t.id
       AND "disposition" IS NULL;
  END LOOP;
  PERFORM set_config('app.tenant_id', '', true);
END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- 6. The repair shelf (9.7)
-- ══════════════════════════════════════════════════════════════════════════
--
-- Distinct from `damaged` because the two have opposite futures: damaged stock is
-- a write-off looking for a bin, repair stock is an asset with a job queued
-- against it. A business that refurbishes needs the second pile visible without
-- it reading as shrinkage.

ALTER TABLE "inventory_bins" DROP CONSTRAINT "inventory_bins_type_check";
ALTER TABLE "inventory_bins"
  ADD CONSTRAINT "inventory_bins_type_check" CHECK (
    "type" IN ('pick', 'bulk', 'receiving', 'staging', 'quarantine', 'damaged', 'repair')
  );

-- Seat `unsellable_on_hand` from the shelves that already exist.
--
-- This is the opening position, not a movement: the units are already on
-- unsellable shelves, and the column has simply never counted them. Without this
-- every location that quarantined something before today would report it as
-- sellable until the next bin movement happened to touch that level.
--
-- Tenant-looped for the same FORCE-RLS reason as the backfill above.
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT DISTINCT "tenant_id" AS id FROM "inventory_bin_levels" LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);
    UPDATE "inventory_levels" l
       SET "unsellable_on_hand" = sub.qty
      FROM (
        SELECT bl."variant_id", bl."warehouse_id", SUM(bl."on_hand")::int AS qty
          FROM "inventory_bin_levels" bl
          JOIN "inventory_bins" b ON b."id" = bl."bin_id"
         WHERE bl."tenant_id" = t.id
           AND b."is_sellable" = false
           AND bl."on_hand" > 0
         GROUP BY bl."variant_id", bl."warehouse_id"
      ) sub
     WHERE l."tenant_id"    = t.id
       AND l."variant_id"   = sub."variant_id"
       AND l."warehouse_id" = sub."warehouse_id";
  END LOOP;
  PERFORM set_config('app.tenant_id', '', true);
END $$;
