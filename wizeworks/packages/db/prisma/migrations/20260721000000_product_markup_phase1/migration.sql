-- Product Markup & Surcharges — Phase 1 (docs/48).
--
-- A reusable, tenant-owned `markup_rules` table that turns a variant's COST
-- into a charged price, plus two snapshot columns on commerce_product_variants
-- so a rule-derived price is reproducible after the cost drifts.
--
-- Markup is a cost→list function and sits BEFORE the B2B tier / discount
-- resolution order (docs/48 §4). Money is stored in integer cents to match
-- price_cents / cost_cents; `value` and `floor_margin` are unitless decimals.
--
-- RLS: tenant-scoped → ENABLE + FORCE + tenant_isolation on current_tenant_id()
-- (canonical pattern; reads the `app.tenant_id` GUC set by withTenant/withRequestTenant).

-- ─── markup_rules ─────────────────────────────────────────────────────────────

CREATE TABLE "markup_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "method" VARCHAR(20) NOT NULL,
    "value" DECIMAL(12,4),
    "bands" JSONB NOT NULL DEFAULT '[]',
    "cost_basis" VARCHAR(20) NOT NULL DEFAULT 'variant_cost',
    "rounding" JSONB NOT NULL DEFAULT '{}',
    "floor_profit_cents" INTEGER,
    "floor_margin" DECIMAL(5,2),
    "ceiling_src" VARCHAR(20) NOT NULL DEFAULT 'none',
    "ceiling_value_cents" INTEGER,
    "applies_to" VARCHAR(10) NOT NULL DEFAULT 'catalog',
    "scope" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "markup_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "markup_rules_tenant_id_is_active_idx" ON "markup_rules"("tenant_id", "is_active");

-- ─── commerce_product_variants — markup binding + snapshot ─────────────────────

ALTER TABLE "commerce_product_variants"
    ADD COLUMN "markup_rule_id" UUID,
    ADD COLUMN "applied_markup" JSONB;

CREATE INDEX "commerce_product_variants_tenant_id_markup_rule_id_idx" ON "commerce_product_variants"("tenant_id", "markup_rule_id");

-- ─── Foreign keys ─────────────────────────────────────────────────────────────

ALTER TABLE "markup_rules" ADD CONSTRAINT "markup_rules_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commerce_product_variants" ADD CONSTRAINT "commerce_product_variants_markup_rule_id_fkey"
    FOREIGN KEY ("markup_rule_id") REFERENCES "markup_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Row-level security (hand-edited; Prisma does not generate RLS) ────────────

ALTER TABLE "markup_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "markup_rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "markup_rules"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());
