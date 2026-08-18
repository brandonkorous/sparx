-- Platform billing (docs/67) — WizeWorks charges tenants per active module via
-- one Stripe subscription, one item per module.
--
-- The Stripe customer + subscription identity lives on the (non-RLS) tenants
-- dispatch row, which already carried stripe_customer_id + trial_ends_at; this
-- adds the remaining subscription columns there. Only the per-module item rows
-- are a new tenant-scoped (RLS) table.

-- AlterTable — subscription state on the tenant row (additive; tenants is non-RLS).
ALTER TABLE "tenants"
    ADD COLUMN "stripe_subscription_id" VARCHAR(255),
    ADD COLUMN "subscription_status"    VARCHAR(20),
    ADD COLUMN "current_period_end"     TIMESTAMPTZ,
    ADD COLUMN "cancel_at_period_end"   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "billing_interval"       VARCHAR(10) NOT NULL DEFAULT 'monthly';

-- One platform Stripe customer per tenant. Existing rows are all NULL (billing
-- not yet wired); a unique index over a nullable column allows many NULLs.
CREATE UNIQUE INDEX "tenants_stripe_customer_id_key" ON "tenants"("stripe_customer_id");

-- CreateTable — per-(tenant, module) Stripe subscription item.
CREATE TABLE "billing_subscription_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "stripe_subscription_item_id" VARCHAR(255) NOT NULL,
    "module_key" VARCHAR(50) NOT NULL,
    "stripe_price_id" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "billing_subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscription_items_stripe_item_unique" ON "billing_subscription_items"("stripe_subscription_item_id");
CREATE UNIQUE INDEX "billing_subscription_items_tenant_module_unique" ON "billing_subscription_items"("tenant_id", "module_key");
CREATE INDEX "billing_subscription_items_tenant_idx" ON "billing_subscription_items"("tenant_id");

-- AddForeignKey
ALTER TABLE "billing_subscription_items" ADD CONSTRAINT "billing_subscription_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security (tenant-scoped table — ENABLE + FORCE + isolation policy).
ALTER TABLE "billing_subscription_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_subscription_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "billing_subscription_items"
  USING ("tenant_id" = current_tenant_id());
