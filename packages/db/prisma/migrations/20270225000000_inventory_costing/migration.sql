-- docs/146 Phase 5 — True cost.
--
-- Five tables, ten columns, and one backfill that makes the whole thing usable
-- on the day it ships instead of a year later.
--
-- WHAT THIS IS FOR. A unit's cost basis has until now been what the supplier
-- invoiced for the goods. The freight, the duty, the broker's fee and the
-- insurance were real money spent to acquire that stock and none of it reached
-- the basis — so every margin figure on the platform was optimistic by exactly
-- what it cost to get the pallet here, which on imported goods is routinely
-- 15–30%. This gives those charges somewhere to live and a defensible way to
-- spread them across the lines they arrived with.
--
-- AND WHAT LEFT. `inventory_movements.cost_consumed_cents` stamps the cost of
-- goods on every movement that takes stock out, so COGS is a sum over a column
-- rather than a re-derivation against today's average, and margin is exact.
--
-- NOTHING HERE WRITES on_hand. Cost layers are written and consumed from inside
-- `applyMovement()`, in the same transaction as the stock change. There is still
-- exactly one writer, which is the invariant the whole inventory module rests on.
--
-- RLS FOOTGUN (packages/db/CLAUDE.md): the backfill at the bottom writes to
-- FORCE-RLS tables and `sparx_owner` is a NON-superuser in production, so it runs
-- inside a per-tenant `set_config('app.tenant_id', …)` loop. Unscoped it would
-- touch zero rows and still report success — and it would PASS locally, where
-- docker's owner is a superuser.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Charges on a purchase order — the estimate
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "inventory_purchase_order_charges" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"         UUID         NOT NULL,
  "purchase_order_id" UUID         NOT NULL,

  "kind"              VARCHAR(20)  NOT NULL,
  "description"       VARCHAR(255),

  -- In the purchase order's currency, minor units.
  "amount_cents"      INTEGER      NOT NULL,

  -- `manual` is absent on purpose: a purchase-order charge is apportioned across
  -- deliveries that do not exist yet, so there are no lines to name amounts
  -- against. Manual allocation belongs on the receipt charge.
  "allocation_basis"  VARCHAR(10)  NOT NULL DEFAULT 'value',

  -- How much has already landed on a delivery. The receipt that completes the
  -- order takes amount − allocated, so rounding pennies land somewhere.
  "allocated_cents"   INTEGER      NOT NULL DEFAULT 0,

  "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_po_charges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_po_charges_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_po_charges_po_fk"
    FOREIGN KEY ("purchase_order_id") REFERENCES "inventory_purchase_orders" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_po_charges_kind_check" CHECK (
    "kind" IN ('freight','duty','insurance','broker','handling','other')
  ),
  CONSTRAINT "inventory_po_charges_basis_check" CHECK (
    "allocation_basis" IN ('value','quantity','weight')
  ),
  CONSTRAINT "inventory_po_charges_amount_check" CHECK ("amount_cents" >= 0),
  CONSTRAINT "inventory_po_charges_allocated_check" CHECK (
    "allocated_cents" >= 0 AND "allocated_cents" <= "amount_cents"
  )
);

CREATE INDEX "inventory_po_charges_tenant_po_idx"
  ON "inventory_purchase_order_charges" ("tenant_id", "purchase_order_id");

ALTER TABLE "inventory_purchase_order_charges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_purchase_order_charges" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_purchase_order_charges"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Charges on a delivery — the actual
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "inventory_goods_receipt_charges" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"         UUID         NOT NULL,
  "goods_receipt_id"  UUID         NOT NULL,

  "kind"              VARCHAR(20)  NOT NULL,
  "description"       VARCHAR(255),

  "amount_cents"      INTEGER      NOT NULL,
  "allocation_basis"  VARCHAR(10)  NOT NULL DEFAULT 'value',

  -- Read only under the `manual` basis: { [goodsReceiptLineId]: cents }.
  "manual_allocation" JSONB        NOT NULL DEFAULT '{}',

  "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_gr_charges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_gr_charges_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_gr_charges_receipt_fk"
    FOREIGN KEY ("goods_receipt_id") REFERENCES "inventory_goods_receipts" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_gr_charges_kind_check" CHECK (
    "kind" IN ('freight','duty','insurance','broker','handling','other')
  ),
  CONSTRAINT "inventory_gr_charges_basis_check" CHECK (
    "allocation_basis" IN ('value','quantity','weight','manual')
  ),
  CONSTRAINT "inventory_gr_charges_amount_check" CHECK ("amount_cents" >= 0)
);

CREATE INDEX "inventory_gr_charges_tenant_receipt_idx"
  ON "inventory_goods_receipt_charges" ("tenant_id", "goods_receipt_id");

ALTER TABLE "inventory_goods_receipt_charges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_goods_receipt_charges" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_goods_receipt_charges"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Cost layers — which units, bought when, at what price
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "inventory_cost_layers" (
  "id"                     UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"              UUID         NOT NULL,
  "variant_id"             UUID         NOT NULL,
  "warehouse_id"           UUID         NOT NULL,

  "quantity"               INTEGER      NOT NULL,
  "quantity_remaining"     INTEGER      NOT NULL,

  -- Landed unit cost in the tenant's BASE currency: goods + allocated charges,
  -- after FX. The number FIFO reports.
  "unit_cost_cents"        INTEGER      NOT NULL,
  -- The goods alone, so a breakdown can separate the freight from the part.
  "goods_unit_cost_cents"  INTEGER      NOT NULL,

  "source_type"            VARCHAR(20)  NOT NULL,
  "source_id"              UUID,
  "movement_id"            UUID,

  -- The FIFO sort key: when the units ARRIVED, which a back-dated receipt makes
  -- different from when the row was typed.
  "acquired_at"            TIMESTAMPTZ  NOT NULL DEFAULT now(),

  "created_at"             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"             TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_cost_layers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_cost_layers_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_cost_layers_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_cost_layers_warehouse_fk"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_cost_layers_source_check" CHECK (
    "source_type" IN ('receipt','adjustment','return','transfer_in','opening','count')
  ),
  CONSTRAINT "inventory_cost_layers_quantity_check" CHECK ("quantity" > 0),
  -- Remaining can never exceed what arrived, and never go below zero — the two
  -- ways a consumption bug would otherwise quietly corrupt the cost ledger.
  CONSTRAINT "inventory_cost_layers_remaining_check" CHECK (
    "quantity_remaining" >= 0 AND "quantity_remaining" <= "quantity"
  )
);

-- The hot query: open layers for one (variant, location), oldest first. Partial,
-- so a decade of exhausted layers costs the consumption path nothing.
CREATE INDEX "inventory_cost_layers_open_idx"
  ON "inventory_cost_layers" ("tenant_id", "variant_id", "warehouse_id", "acquired_at", "id")
  WHERE "quantity_remaining" > 0;
CREATE INDEX "inventory_cost_layers_tenant_variant_idx"
  ON "inventory_cost_layers" ("tenant_id", "variant_id", "acquired_at" DESC);
CREATE INDEX "inventory_cost_layers_tenant_movement_idx"
  ON "inventory_cost_layers" ("tenant_id", "movement_id");
CREATE INDEX "inventory_cost_layers_tenant_source_idx"
  ON "inventory_cost_layers" ("tenant_id", "source_type", "source_id");

ALTER TABLE "inventory_cost_layers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_cost_layers" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_cost_layers"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 4. Consumptions — what each movement took off which layer
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "inventory_cost_consumptions" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"       UUID         NOT NULL,

  -- Soft pointer: the movement ledger is append-only and never deleted.
  "movement_id"     UUID         NOT NULL,
  "layer_id"        UUID         NOT NULL,

  -- SIGNED. Positive = taken off the layer. Negative = given back by a reversal,
  -- recorded as its own row rather than by editing the original: the sale did
  -- happen and was later reversed, and both are facts.
  "quantity"        INTEGER      NOT NULL,

  -- The layer's cost at the moment it was consumed. A revaluation of that layer
  -- later must not silently restate what a sale six weeks ago cost.
  "unit_cost_cents" INTEGER      NOT NULL,

  "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_cost_consumptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_cost_consumptions_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_cost_consumptions_layer_fk"
    FOREIGN KEY ("layer_id") REFERENCES "inventory_cost_layers" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_cost_consumptions_quantity_check" CHECK ("quantity" <> 0)
);

CREATE INDEX "inventory_cost_consumptions_tenant_movement_idx"
  ON "inventory_cost_consumptions" ("tenant_id", "movement_id");
CREATE INDEX "inventory_cost_consumptions_tenant_layer_idx"
  ON "inventory_cost_consumptions" ("tenant_id", "layer_id");

ALTER TABLE "inventory_cost_consumptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_cost_consumptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_cost_consumptions"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 5. Costing policy — how this business values stock
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "inventory_costing_policies" (
  "tenant_id"                UUID         NOT NULL,

  "method"                   VARCHAR(20)  NOT NULL DEFAULT 'moving_average',
  "default_allocation_basis" VARCHAR(10)  NOT NULL DEFAULT 'value',
  "base_currency"            VARCHAR(3)   NOT NULL DEFAULT 'USD',

  "created_at"               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"               TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_costing_policies_pkey" PRIMARY KEY ("tenant_id"),
  CONSTRAINT "inventory_costing_policies_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_costing_policies_method_check" CHECK (
    "method" IN ('moving_average','fifo','standard')
  ),
  CONSTRAINT "inventory_costing_policies_basis_check" CHECK (
    "default_allocation_basis" IN ('value','quantity','weight','manual')
  )
);

ALTER TABLE "inventory_costing_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_costing_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_costing_policies"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 6. Columns on what already exists
-- ══════════════════════════════════════════════════════════════════════════

-- The estimate captured when a foreign-currency order is raised. Null on a
-- same-currency order, where a rate of 1 would be a fact about arithmetic
-- rather than about the business.
ALTER TABLE "inventory_purchase_orders"
  ADD COLUMN "fx_rate" DECIMAL(18,8),
  ADD COLUMN "base_currency_total_cents" INTEGER;

-- FX captured AT RECEIPT: the rate on the day the goods landed is the one that
-- decides what they cost. Defaults describe a domestic delivery truthfully.
ALTER TABLE "inventory_goods_receipts"
  ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN "base_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN "fx_rate" DECIMAL(18,8) NOT NULL DEFAULT 1;

ALTER TABLE "inventory_goods_receipts"
  ADD CONSTRAINT "inventory_goods_receipts_fx_rate_check" CHECK ("fx_rate" > 0);

-- The landed-cost result per line, in base currency. `allocated_charge_cents` is
-- the LINE total, not per unit; `landed_unit_cost_cents` is what feeds the
-- moving average and the cost layer. Nullable because deliveries booked before
-- this shipped never had a landed cost worked out, and writing one now would be
-- inventing the freight bill.
ALTER TABLE "inventory_goods_receipt_lines"
  ADD COLUMN "allocated_charge_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "base_unit_cost_cents" INTEGER,
  ADD COLUMN "landed_unit_cost_cents" INTEGER;

-- What the goods on this movement cost. Signed: a reversal credits COGS, so
-- summing the column over a period is period cost of goods sold with no cases.
ALTER TABLE "inventory_movements"
  ADD COLUMN "cost_consumed_cents" INTEGER;

-- Per-variant override of the tenant's method. Null = follow the tenant policy.
ALTER TABLE "commerce_product_variants"
  ADD COLUMN "costing_method" VARCHAR(20);

ALTER TABLE "commerce_product_variants"
  ADD CONSTRAINT "commerce_product_variants_costing_method_check" CHECK (
    "costing_method" IS NULL OR "costing_method" IN ('moving_average','fifo','standard')
  );

-- ══════════════════════════════════════════════════════════════════════════
-- 7. Backfill
-- ══════════════════════════════════════════════════════════════════════════
--
-- Two facts, neither invented.
--
-- (a) A delivery was billed in the currency of the order it was booked against.
--     There is no historical FX rate to recover, so base currency is set to the
--     same code and the rate stays 1 — which says "we did not convert this",
--     rather than pretending we know what the rate was that Tuesday.
--
-- (b) Every stocked (variant, location) gets an OPENING cost layer at the
--     moving average the platform was already reporting. This is not a new
--     number: it is the one valuation, margin and shrinkage have all been using.
--     Writing it down makes Σ(open layers) == on_hand true from the first day,
--     so FIFO and as-of valuation work immediately instead of after a year of
--     sell-through. `acquired_at` is the level's own `as_of`, so the opening
--     layer sorts before anything received after it, which is what FIFO means.

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, false);

        UPDATE "inventory_goods_receipts" r
           SET "currency"      = po."currency",
               "base_currency" = po."currency"
          FROM "inventory_purchase_orders" po
         WHERE po."id" = r."purchase_order_id"
           AND r."tenant_id" = t.id;

        INSERT INTO "inventory_cost_layers"
            ("tenant_id", "variant_id", "warehouse_id", "quantity", "quantity_remaining",
             "unit_cost_cents", "goods_unit_cost_cents", "source_type", "acquired_at")
        SELECT l."tenant_id", l."variant_id", l."warehouse_id", l."on_hand", l."on_hand",
               COALESCE(l."avg_cost_cents", l."unit_cost_cents", v."cost_cents", 0),
               COALESCE(l."avg_cost_cents", l."unit_cost_cents", v."cost_cents", 0),
               'opening', l."as_of"
          FROM "inventory_levels" l
          JOIN "commerce_product_variants" v ON v."id" = l."variant_id"
         WHERE l."tenant_id" = t.id
           AND l."on_hand" > 0;
    END LOOP;
END $$;
