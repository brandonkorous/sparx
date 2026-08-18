-- Commerce subscription billing (docs/142) — the money movement that
-- 41-commerce-subscriptions never had.
--
-- A subscription could be created, paused, skipped and cancelled, but nothing
-- ever charged anyone: there was no stored payment method, so there was nothing
-- to charge. This migration adds the vault, plus the two columns on
-- commerce_subscriptions that say HOW a subscription collects and WHICH method
-- it collects with.
--
-- No card data is stored here. `method_ref` is the gateway's own token, minted
-- when the customer's card was captured by the gateway's hosted element; it is
-- meaningless to any other gateway and cannot be turned back into a card. The
-- brand / last4 / expiry columns are display only, so a person can recognise
-- which of their cards a subscription renews on.
--
-- Nothing is backfilled. Existing subscriptions default to `billing_mode =
-- 'card'` with a NULL payment_method_id — the state the API now refuses to
-- CREATE, but the one every pre-existing row is already in. They will not
-- charge (they never could); the tick reports them as unbillable rather than
-- failing them, and they are fixed by attaching a method or switching them to
-- invoice mode. There is deliberately no tenant-loop backfill here: inventing a
-- billing mode for someone else's live subscription is not a migration's call.

-- ─── Table ───────────────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "commerce_customer_payment_methods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "gateway_id" VARCHAR(50) NOT NULL,
    "method_ref" VARCHAR(255) NOT NULL,
    "customer_ref" VARCHAR(255),
    "brand" VARCHAR(20),
    "last4" VARCHAR(4),
    "exp_month" INTEGER,
    "exp_year" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "last_used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "commerce_customer_payment_methods_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- CreateIndex
CREATE UNIQUE INDEX "customer_payment_methods_token_unique" ON "commerce_customer_payment_methods"("tenant_id", "gateway_id", "method_ref");

-- CreateIndex
CREATE INDEX "commerce_customer_payment_methods_tenant_id_customer_id_stat_idx" ON "commerce_customer_payment_methods"("tenant_id", "customer_id", "status");

-- ─── Foreign keys ────────────────────────────────────────────────────────────

-- AddForeignKey
ALTER TABLE "commerce_customer_payment_methods" ADD CONSTRAINT "commerce_customer_payment_methods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_customer_payment_methods" ADD CONSTRAINT "commerce_customer_payment_methods_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Subscription columns ────────────────────────────────────────────────────

-- AlterTable
ALTER TABLE "commerce_subscriptions" ADD COLUMN "billing_mode" VARCHAR(10) NOT NULL DEFAULT 'card';
ALTER TABLE "commerce_subscriptions" ADD COLUMN "payment_method_id" UUID;

-- RESTRICT, not SET NULL. Deleting the card an active subscription renews on
-- has to fail at the point of deletion, where someone is watching and can be
-- told why — rather than succeeding quietly and surfacing a month later as a
-- renewal that could not be charged.
-- AddForeignKey
ALTER TABLE "commerce_subscriptions" ADD CONSTRAINT "commerce_subscriptions_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "commerce_customer_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "commerce_subscriptions_payment_method_id_idx" ON "commerce_subscriptions"("payment_method_id");

-- The tick's second query: subscriptions whose dunning retry has come due
-- (docs/142 §6). Without this it is a sequential scan of every past_due
-- subscription on every 15-minute pass.
-- CreateIndex
CREATE INDEX "commerce_dunning_attempts_next_retry_idx" ON "commerce_dunning_attempts"("tenant_id", "next_retry_at") WHERE "next_retry_at" IS NOT NULL;

-- ─── Row-level security (hand-edited; Prisma does not generate RLS) ──────────
-- Tenant-scoped → ENABLE + FORCE + tenant_isolation on current_tenant_id().
-- A vaulted payment token is the single most sensitive row in the commerce
-- schema, so the database-level backstop matters more here than anywhere.

ALTER TABLE "commerce_customer_payment_methods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce_customer_payment_methods" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "commerce_customer_payment_methods"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());
