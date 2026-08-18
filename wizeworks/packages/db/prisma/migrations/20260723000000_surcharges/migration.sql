-- Product Markup & Surcharges — Surcharges (docs/48 §6).
--
-- A document-level fee that passes through a transaction cost the merchant
-- incurs (chiefly the credit-card processing fee). Computed at checkout
-- completion AFTER tax, snapshotted onto the order, and reversed proportionally
-- on refund. Platform default OFF; surcharging is legally constrained.
--
-- RLS: tenant-scoped → ENABLE + FORCE + tenant_isolation on current_tenant_id().

-- ─── surcharge_rules ──────────────────────────────────────────────────────────

CREATE TABLE "surcharge_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(10) NOT NULL DEFAULT 'percentage',
    "value" DECIMAL(8,4) NOT NULL,
    "basis" VARCHAR(25) NOT NULL DEFAULT 'total',
    "payment_methods" VARCHAR(20)[] NOT NULL DEFAULT ARRAY['card']::VARCHAR(20)[],
    "applies_to" VARCHAR(10) NOT NULL DEFAULT 'both',
    "label" VARCHAR(120) NOT NULL,
    "cap_cents" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "surcharge_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "surcharge_rules_tenant_id_is_active_idx" ON "surcharge_rules"("tenant_id", "is_active");

-- ─── orders — surcharge snapshot ──────────────────────────────────────────────

ALTER TABLE "orders"
    ADD COLUMN "surcharge_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "applied_surcharges" JSONB NOT NULL DEFAULT '[]';

-- ─── commerce_checkout_sessions — cached surcharge total ──────────────────────

ALTER TABLE "commerce_checkout_sessions"
    ADD COLUMN "surcharge_total_cents" INTEGER NOT NULL DEFAULT 0;

-- ─── Foreign keys ─────────────────────────────────────────────────────────────

ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Row-level security (hand-edited; Prisma does not generate RLS) ────────────

ALTER TABLE "surcharge_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "surcharge_rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "surcharge_rules"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());
