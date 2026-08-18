-- Product Markup Phase 4 (docs/48 §8/§11) — cost-driven recompute config +
-- the staged price-review queue.
--
-- A markup rule gains a per-rule recompute policy: when a bound variant's cost
-- moves, the markup-recompute-worker re-derives the price and either applies it
-- automatically (within a tolerance band) or stages it for human approval. The
-- review queue holds proposals the worker chose NOT to apply silently.
--
-- NO BACKFILL: `recompute_mode` defaults to 'auto' so existing rules keep the
-- sensible "follow cost within tolerance" behaviour; the new table starts empty.
-- The column adds are additive and `markup_rules` already FORCEs RLS from its
-- creation migration, so no per-tenant backfill loop is needed.

-- AlterTable — recompute policy on the rule (docs/48 §8).
ALTER TABLE "markup_rules" ADD COLUMN "recompute_mode" VARCHAR(10) NOT NULL DEFAULT 'auto';
ALTER TABLE "markup_rules" ADD COLUMN "recompute_tolerance_pct" DECIMAL(6,2);

-- CreateTable — staged price-recompute review queue (docs/48 §8/§11).
CREATE TABLE "markup_recompute_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "markup_rule_id" UUID NOT NULL,
    "old_cost_cents" INTEGER,
    "new_cost_cents" INTEGER NOT NULL,
    "old_price_cents" INTEGER NOT NULL,
    "new_price_cents" INTEGER NOT NULL,
    "applied_markup" JSONB NOT NULL,
    "reason" VARCHAR(30) NOT NULL DEFAULT 'review_mode',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "resolved_at" TIMESTAMPTZ,
    "resolved_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "markup_recompute_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — matches @@index in the Prisma schema.
CREATE INDEX "markup_recompute_reviews_tenant_id_status_idx" ON "markup_recompute_reviews"("tenant_id", "status");
CREATE INDEX "markup_recompute_reviews_tenant_id_variant_id_idx" ON "markup_recompute_reviews"("tenant_id", "variant_id");

-- CreateIndex — at most one PENDING review per variant (partial unique). The
-- worker clears the prior pending proposal before inserting the new one within a
-- single transaction, so a re-trigger replaces (not stacks). Prisma can't express
-- the predicate, so it lives here in SQL only (like the RLS policies); the differ
-- leaves it alone.
CREATE UNIQUE INDEX "markup_recompute_reviews_one_pending_per_variant"
    ON "markup_recompute_reviews" ("variant_id") WHERE "status" = 'pending';

-- AddForeignKey
ALTER TABLE "markup_recompute_reviews" ADD CONSTRAINT "markup_recompute_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "markup_recompute_reviews" ADD CONSTRAINT "markup_recompute_reviews_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "markup_recompute_reviews" ADD CONSTRAINT "markup_recompute_reviews_markup_rule_id_fkey" FOREIGN KEY ("markup_rule_id") REFERENCES "markup_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security (hand-authored; Prisma does not generate it). Tenant-scoped
-- table → ENABLE + FORCE + the standard tenant_isolation policy.
ALTER TABLE "markup_recompute_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "markup_recompute_reviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "markup_recompute_reviews"
  USING ("tenant_id" = current_tenant_id());
