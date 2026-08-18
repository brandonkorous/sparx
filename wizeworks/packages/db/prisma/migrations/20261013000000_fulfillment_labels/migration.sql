-- Purchased outbound carrier labels (docs/09 real Shippo integration). Mirrors
-- ReturnLabel's shape (commerce_return_labels, 20260603000000_commerce_module)
-- for the reverse direction. A fulfillment can carry more than one label over
-- its life (a void + a re-purchase), so this is its own child table rather
-- than columns on order_fulfillments — label_ref/cost_cents need to be
-- queryable per-attempt, and a voided label must stay in the history.
--
-- ADDITIVE for the new table (empty; rows are created at RUNTIME by
-- shippingService.buyLabel under withTenant, so RLS is satisfied — no
-- per-tenant app.tenant_id backfill loop is needed here).

-- CreateTable
CREATE TABLE "fulfillment_labels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "fulfillment_id" UUID NOT NULL,
    "provider_slug" VARCHAR(63) NOT NULL,
    "label_ref" VARCHAR(255) NOT NULL,
    "tracking_number" VARCHAR(127),
    "tracking_url" VARCHAR(2048),
    "label_media_id" UUID,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "voided_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fulfillment_labels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fulfillment_labels_tenant_id_fulfillment_id_idx" ON "fulfillment_labels"("tenant_id", "fulfillment_id");
CREATE INDEX "fulfillment_labels_tenant_id_tracking_number_idx" ON "fulfillment_labels"("tenant_id", "tracking_number");

-- AddForeignKey
ALTER TABLE "fulfillment_labels" ADD CONSTRAINT "fulfillment_labels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fulfillment_labels" ADD CONSTRAINT "fulfillment_labels_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "order_fulfillments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — tenant isolation (ENABLE + FORCE). Mirrors
-- commerce_return_labels / 20261012000000_builder_site_theme_symbols.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "fulfillment_labels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fulfillment_labels" FORCE  ROW LEVEL SECURITY;
CREATE POLICY fulfillment_labels_tenant_isolation ON "fulfillment_labels"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
