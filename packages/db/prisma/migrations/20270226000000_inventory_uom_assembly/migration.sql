-- docs/146 Phase 6 — Units of measure, kits and assembly.
--
-- Six tables, eleven columns and two widened CHECKs. Two features that ship
-- together because they are the same idea at two scales: a case is twelve of
-- something, and a finished assembly is a list of somethings.
--
-- WHAT THIS IS FOR. A distributor buys in cases of twelve, keeps singles on the
-- shelf and sells pairs. Today the platform knows one number per variant and no
-- unit at all — so a buyer ordering four cases types 48 and hopes, a receiver
-- counting cartons multiplies in their head, and a counter looking at a shelf of
-- sealed boxes has to decide for themselves what "quantity" meant. Each of those
-- is a place a stock number goes wrong quietly.
--
-- And a manufacturer takes components off a shelf and puts a finished thing on
-- it. `Bundle` looks adjacent and is not: a bundle is a selling construct where
-- three stock numbers go down at checkout. Nothing is ever BUILT, so there is no
-- moment where components stop existing and a new thing starts — which is the
-- moment an assembly is, and where a manufacturer's cost actually forms.
--
-- THE BASE UNIT IS THE LEDGER'S UNIT, ALWAYS. `on_hand`, every movement delta
-- and every bin level stay in base units and none of them changes. A unit of
-- measure is a way of ENTERING and DISPLAYING a quantity, never a second way of
-- storing one. Document lines carry `uom_code` + `units_per_uom` as a SNAPSHOT
-- with no foreign key — an FK's SET NULL would erase what "4" meant from a
-- historical purchase order the day somebody tidies their unit list.
--
-- FACTORS ARE INTEGERS. A fractional factor makes on-hand fractional, and an
-- inventory system that can hold 4.999999 of something cannot reconcile. Goods
-- that genuinely divide get a smaller BASE unit instead: stock grams, sell a
-- 500 g bag as a unit of 500.
--
-- ASSEMBLIES MOVE STOCK THROUGH THE ONE LEDGER. Completing one writes ordinary
-- `applyMovement` calls — an `assembly_out` per component and one `assembly_in`
-- for the finished goods, in a single transaction. No second writer of on_hand.
--
-- CHECK-CONSTRAINT NOTE (this bit has bitten twice — docs/146 Phase 4, Phase 5):
-- `inventory_movements.reason` has no CHECK, but `inventory_bin_movements.reason`
-- and `inventory_cost_layers.source_type` both do, and both are widened below.
-- A reason absent from a CHECK fails at INSERT with a bare 23514 that nothing
-- upstream predicts.
--
-- No backfill of quantities: every existing line is already in base units, which
-- is exactly what `units_per_uom DEFAULT 1` and a null code mean.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Units of measure
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "inventory_units_of_measure" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"   UUID         NOT NULL,

  -- Upper-cased on write: "4 CS" and "4 cs" are the same unit and must not be
  -- two rows.
  "code"        VARCHAR(12)  NOT NULL,

  -- Both forms, because "1 case" and "4 cases" appear on the same screen and a
  -- naive `+ 's'` gets boxes right and inches wrong.
  "name"        VARCHAR(60)  NOT NULL,
  "plural_name" VARCHAR(60)  NOT NULL,

  "dimension"   VARCHAR(12)  NOT NULL DEFAULT 'count',

  -- Seeded by the platform for a tenant that had none, so the list can say so
  -- and a bootstrap re-run recognises its own work.
  "is_system"   BOOLEAN      NOT NULL DEFAULT false,
  "is_active"   BOOLEAN      NOT NULL DEFAULT true,

  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_uom_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_uom_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_uom_dimension_check" CHECK (
    "dimension" IN ('count','weight','volume','length','area')
  ),
  CONSTRAINT "inventory_uom_code_check" CHECK (length(btrim("code")) > 0)
);

CREATE UNIQUE INDEX "inventory_uom_tenant_code_unique"
  ON "inventory_units_of_measure" ("tenant_id", "code");
CREATE INDEX "inventory_uom_tenant_active_idx"
  ON "inventory_units_of_measure" ("tenant_id", "is_active");

ALTER TABLE "inventory_units_of_measure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_units_of_measure" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_units_of_measure"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 2. What a unit means FOR ONE VARIANT
-- ══════════════════════════════════════════════════════════════════════════
--
-- Per variant because that is the only place the answer is knowable: a case of
-- spark plugs is 12 and a case of oil filters is 6, and both are "CS".

CREATE TABLE "inventory_variant_uom_conversions" (
  "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"           UUID        NOT NULL,
  "variant_id"          UUID        NOT NULL,
  "uom_id"              UUID        NOT NULL,

  "units_per_uom"       INTEGER     NOT NULL,

  "is_purchase_default" BOOLEAN     NOT NULL DEFAULT false,
  "is_sales_default"    BOOLEAN     NOT NULL DEFAULT false,

  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_variant_uom_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_variant_uom_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_variant_uom_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_variant_uom_uom_fk"
    FOREIGN KEY ("uom_id") REFERENCES "inventory_units_of_measure" ("id") ON DELETE CASCADE,

  -- Integers, ≥ 1. See the header on why fractional factors are refused.
  CONSTRAINT "inventory_variant_uom_factor_check" CHECK ("units_per_uom" >= 1)
);

CREATE UNIQUE INDEX "inventory_variant_uom_unique"
  ON "inventory_variant_uom_conversions" ("variant_id", "uom_id");
CREATE INDEX "inventory_variant_uom_tenant_variant_idx"
  ON "inventory_variant_uom_conversions" ("tenant_id", "variant_id");

-- "Usually bought by the case" is ONE fact. Two rows claiming it is a question
-- with no answer, so the database refuses rather than letting the application
-- pick whichever it read first.
CREATE UNIQUE INDEX "inventory_variant_uom_one_purchase_default"
  ON "inventory_variant_uom_conversions" ("variant_id")
  WHERE "is_purchase_default";
CREATE UNIQUE INDEX "inventory_variant_uom_one_sales_default"
  ON "inventory_variant_uom_conversions" ("variant_id")
  WHERE "is_sales_default";

ALTER TABLE "inventory_variant_uom_conversions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_variant_uom_conversions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_variant_uom_conversions"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Bills of materials — the recipe
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "inventory_bills_of_materials" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"         UUID         NOT NULL,

  "output_variant_id" UUID         NOT NULL,
  "name"              VARCHAR(127) NOT NULL,

  -- Bumped by hand when the recipe changes materially. Being able to say WHICH
  -- version a finished batch was built to is the difference between a recall you
  -- can scope and one you cannot.
  "version"           INTEGER      NOT NULL DEFAULT 1,
  "status"            VARCHAR(12)  NOT NULL DEFAULT 'draft',

  -- The batch size. Component quantities below are per BATCH, so a run of 100
  -- needing three litres of glue records 3 — where per-unit would record 0.03,
  -- and an integer ledger cannot hold that.
  "output_quantity"   INTEGER      NOT NULL DEFAULT 1,

  -- What it costs in PEOPLE to run the batch once. Folded into the finished
  -- unit's cost, because a business pricing assembled goods off components alone
  -- is pricing its own time at zero.
  "labor_cost_cents"  INTEGER      NOT NULL DEFAULT 0,

  "notes"             TEXT,

  "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_boms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_boms_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_boms_output_fk"
    FOREIGN KEY ("output_variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_boms_status_check" CHECK (
    "status" IN ('draft','active','archived')
  ),
  CONSTRAINT "inventory_boms_output_quantity_check" CHECK ("output_quantity" >= 1),
  CONSTRAINT "inventory_boms_version_check" CHECK ("version" >= 1),
  CONSTRAINT "inventory_boms_labor_check" CHECK ("labor_cost_cents" >= 0)
);

CREATE UNIQUE INDEX "inventory_boms_variant_version_unique"
  ON "inventory_bills_of_materials" ("tenant_id", "output_variant_id", "version");
-- "Which recipe do we build to" must have exactly one answer.
CREATE UNIQUE INDEX "inventory_boms_one_active_per_output"
  ON "inventory_bills_of_materials" ("tenant_id", "output_variant_id")
  WHERE "status" = 'active';
CREATE INDEX "inventory_boms_tenant_status_idx"
  ON "inventory_bills_of_materials" ("tenant_id", "status");

ALTER TABLE "inventory_bills_of_materials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_bills_of_materials" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_bills_of_materials"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 4. The ingredients
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "inventory_bom_components" (
  "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"     UUID          NOT NULL,
  "bom_id"        UUID          NOT NULL,
  "variant_id"    UUID          NOT NULL,

  -- Base units per BATCH.
  "quantity_per"  INTEGER       NOT NULL,

  -- Offcuts, spills, the first one that never comes out right. A percentage so
  -- it scales with the run; two decimals because 2.5% is a real answer.
  "scrap_percent" DECIMAL(5,2)  NOT NULL DEFAULT 0,

  "position"      INTEGER       NOT NULL DEFAULT 0,
  "notes"         TEXT,

  "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_bom_components_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_bom_components_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_bom_components_bom_fk"
    FOREIGN KEY ("bom_id") REFERENCES "inventory_bills_of_materials" ("id") ON DELETE CASCADE,
  -- RESTRICT: a variant that is an ingredient in a live recipe cannot be deleted
  -- out from under it, the same guard `commerce_bundle_components` uses.
  CONSTRAINT "inventory_bom_components_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE RESTRICT,

  CONSTRAINT "inventory_bom_components_quantity_check" CHECK ("quantity_per" >= 1),
  CONSTRAINT "inventory_bom_components_scrap_check" CHECK (
    "scrap_percent" >= 0 AND "scrap_percent" < 100
  )
);

CREATE UNIQUE INDEX "inventory_bom_components_unique"
  ON "inventory_bom_components" ("bom_id", "variant_id");
CREATE INDEX "inventory_bom_components_tenant_variant_idx"
  ON "inventory_bom_components" ("tenant_id", "variant_id");

ALTER TABLE "inventory_bom_components" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_bom_components" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_bom_components"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 5. Assembly orders — the run
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "inventory_assembly_orders" (
  "id"                     UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"              UUID         NOT NULL,

  "number"                 VARCHAR(20)  NOT NULL,

  -- assemble | disassemble. One table, because they are the same event with the
  -- arrows reversed.
  "kind"                   VARCHAR(12)  NOT NULL DEFAULT 'assemble',

  -- Nullable: a disassembly can be recorded against a unit whose recipe was
  -- archived, and refusing that would mean un-archiving a bill to take
  -- something apart.
  "bom_id"                 UUID,

  "output_variant_id"      UUID         NOT NULL,
  "warehouse_id"           UUID         NOT NULL,

  --   planned    on paper; nothing has moved
  --   released   components are HELD, not consumed, so nobody sells the last of
  --              a part a scheduled build needs
  --   completed  terminal; movements written, cost settled
  --   cancelled  terminal; the hold is released and nothing was consumed
  "status"                 VARCHAR(12)  NOT NULL DEFAULT 'planned',

  "quantity_planned"       INTEGER      NOT NULL,
  "quantity_completed"     INTEGER      NOT NULL DEFAULT 0,

  "labor_cost_cents"       INTEGER      NOT NULL DEFAULT 0,

  -- Settled on completion: (Σ what the components actually cost + labour) ÷ what
  -- came out. From the movements' own `cost_consumed_cents` (Phase 5), so it is
  -- the sum of what genuinely left the shelf rather than a price-list estimate.
  "output_unit_cost_cents" INTEGER,
  "total_cost_cents"       INTEGER,

  "notes"                  TEXT,

  "planned_for"            TIMESTAMPTZ,
  "released_at"            TIMESTAMPTZ,
  "completed_at"           TIMESTAMPTZ,
  "cancelled_at"           TIMESTAMPTZ,
  "cancelled_reason"       VARCHAR(500),

  "created_by"             VARCHAR(127),
  "created_at"             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"             TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_assembly_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_assembly_orders_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_assembly_orders_bom_fk"
    FOREIGN KEY ("bom_id") REFERENCES "inventory_bills_of_materials" ("id") ON DELETE SET NULL,
  CONSTRAINT "inventory_assembly_orders_output_fk"
    FOREIGN KEY ("output_variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_assembly_orders_warehouse_fk"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_assembly_orders_kind_check" CHECK (
    "kind" IN ('assemble','disassemble')
  ),
  CONSTRAINT "inventory_assembly_orders_status_check" CHECK (
    "status" IN ('planned','released','completed','cancelled')
  ),
  CONSTRAINT "inventory_assembly_orders_planned_check" CHECK ("quantity_planned" >= 1),
  CONSTRAINT "inventory_assembly_orders_completed_check" CHECK (
    "quantity_completed" >= 0 AND "quantity_completed" <= "quantity_planned"
  ),
  CONSTRAINT "inventory_assembly_orders_labor_check" CHECK ("labor_cost_cents" >= 0)
);

CREATE UNIQUE INDEX "inventory_assembly_orders_tenant_number_unique"
  ON "inventory_assembly_orders" ("tenant_id", "number");
CREATE INDEX "inventory_assembly_orders_tenant_status_idx"
  ON "inventory_assembly_orders" ("tenant_id", "status", "created_at" DESC);
CREATE INDEX "inventory_assembly_orders_tenant_output_idx"
  ON "inventory_assembly_orders" ("tenant_id", "output_variant_id");
CREATE INDEX "inventory_assembly_orders_tenant_warehouse_idx"
  ON "inventory_assembly_orders" ("tenant_id", "warehouse_id", "status");

ALTER TABLE "inventory_assembly_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_assembly_orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_assembly_orders"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 6. What each run pulls — the recipe, snapshot
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "inventory_assembly_order_lines" (
  "id"                  UUID          NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"           UUID          NOT NULL,
  "assembly_order_id"   UUID          NOT NULL,
  "variant_id"          UUID          NOT NULL,

  -- The recipe as it stood when this run was planned. Snapshot for the same
  -- reason a purchase order snapshots its prices.
  "quantity_per_batch"  INTEGER       NOT NULL,
  "scrap_percent"       DECIMAL(5,2)  NOT NULL DEFAULT 0,

  -- What the plan says to pull, scrap included. Computed once at planning, so
  -- editing the recipe afterwards cannot silently change what a released order
  -- is holding.
  "quantity_required"   INTEGER       NOT NULL,

  -- What actually went in. The difference from `quantity_required` is the number
  -- a production manager actually wants.
  "quantity_consumed"   INTEGER       NOT NULL DEFAULT 0,

  -- From the movement's own `cost_consumed_cents` (Phase 5), not a price list.
  "cost_consumed_cents" INTEGER       NOT NULL DEFAULT 0,

  "movement_id"         UUID,
  "reservation_id"      UUID,

  "position"            INTEGER       NOT NULL DEFAULT 0,

  "created_at"          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_assembly_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_assembly_lines_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_assembly_lines_order_fk"
    FOREIGN KEY ("assembly_order_id") REFERENCES "inventory_assembly_orders" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_assembly_lines_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE RESTRICT,

  CONSTRAINT "inventory_assembly_lines_per_batch_check" CHECK ("quantity_per_batch" >= 1),
  CONSTRAINT "inventory_assembly_lines_required_check" CHECK ("quantity_required" >= 0),
  CONSTRAINT "inventory_assembly_lines_consumed_check" CHECK ("quantity_consumed" >= 0),
  CONSTRAINT "inventory_assembly_lines_scrap_check" CHECK (
    "scrap_percent" >= 0 AND "scrap_percent" < 100
  )
);

CREATE UNIQUE INDEX "inventory_assembly_lines_unique"
  ON "inventory_assembly_order_lines" ("assembly_order_id", "variant_id");
CREATE INDEX "inventory_assembly_lines_tenant_variant_idx"
  ON "inventory_assembly_order_lines" ("tenant_id", "variant_id");

ALTER TABLE "inventory_assembly_order_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_assembly_order_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_assembly_order_lines"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 7. Columns on what already exists
-- ══════════════════════════════════════════════════════════════════════════

-- The unit the LEDGER counts a variant in. Null means "each", which is what
-- every variant meant before units existed and what most will go on meaning.
ALTER TABLE "commerce_product_variants"
  ADD COLUMN "stocking_uom_id" UUID;

ALTER TABLE "commerce_product_variants"
  ADD CONSTRAINT "commerce_product_variants_stocking_uom_fk"
    FOREIGN KEY ("stocking_uom_id") REFERENCES "inventory_units_of_measure" ("id") ON DELETE SET NULL;

CREATE INDEX "commerce_product_variants_stocking_uom_idx"
  ON "commerce_product_variants" ("stocking_uom_id")
  WHERE "stocking_uom_id" IS NOT NULL;

-- Document lines: what was TYPED, and what it was worth. The quantity columns
-- next to these stay in BASE units and are untouched. Text + factor, no FK —
-- see the header.
ALTER TABLE "inventory_purchase_order_lines"
  ADD COLUMN "uom_code" VARCHAR(12),
  ADD COLUMN "units_per_uom" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "inventory_goods_receipt_lines"
  ADD COLUMN "uom_code" VARCHAR(12),
  ADD COLUMN "units_per_uom" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "inventory_count_lines"
  ADD COLUMN "uom_code" VARCHAR(12),
  ADD COLUMN "units_per_uom" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "inventory_transfer_lines"
  ADD COLUMN "uom_code" VARCHAR(12),
  ADD COLUMN "units_per_uom" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "order_items"
  ADD COLUMN "uom_code" VARCHAR(12),
  ADD COLUMN "units_per_uom" INTEGER NOT NULL DEFAULT 1;

-- A factor of zero would make a base quantity of zero out of any entry, silently.
ALTER TABLE "inventory_purchase_order_lines"
  ADD CONSTRAINT "inventory_po_lines_units_per_uom_check" CHECK ("units_per_uom" >= 1);
ALTER TABLE "inventory_goods_receipt_lines"
  ADD CONSTRAINT "inventory_gr_lines_units_per_uom_check" CHECK ("units_per_uom" >= 1);
ALTER TABLE "inventory_count_lines"
  ADD CONSTRAINT "inventory_count_lines_units_per_uom_check" CHECK ("units_per_uom" >= 1);
ALTER TABLE "inventory_transfer_lines"
  ADD CONSTRAINT "inventory_transfer_lines_units_per_uom_check" CHECK ("units_per_uom" >= 1);
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_units_per_uom_check" CHECK ("units_per_uom" >= 1);

-- ══════════════════════════════════════════════════════════════════════════
-- 8. The two CHECKs that would otherwise fail at INSERT
-- ══════════════════════════════════════════════════════════════════════════
--
-- `inventory_movements.reason` has no CHECK, so `assembly_in` / `assembly_out`
-- need nothing there. These two do, and a reason absent from a CHECK fails with
-- a bare 23514 that nothing upstream predicts (docs/146 Phase 4 and 5 both
-- learned this the same way).

ALTER TABLE "inventory_bin_movements"
  DROP CONSTRAINT "inventory_bin_movements_reason_check";
ALTER TABLE "inventory_bin_movements"
  ADD CONSTRAINT "inventory_bin_movements_reason_check" CHECK (
    "reason" IN ('sale','return','cancel','recount','loss','damage','transfer_in',
      'transfer_out','receive','manual','sync','put_away','bin_move','pick','pick_short',
      'assembly_in','assembly_out')
  );

-- A finished assembly is a costed arrival like any other, and needs a layer to
-- be sold out of later.
ALTER TABLE "inventory_cost_layers"
  DROP CONSTRAINT "inventory_cost_layers_source_check";
ALTER TABLE "inventory_cost_layers"
  ADD CONSTRAINT "inventory_cost_layers_source_check" CHECK (
    "source_type" IN ('receipt','adjustment','return','transfer_in','opening','count','assembly')
  );
