-- Files attached to a customer (contracts, ID scans, spec sheets). The bytes
-- live in the media pipeline; this table is the customer↔asset link + a label.
-- New, empty, tenant-scoped table — no backfill, so the FORCE-RLS backfill
-- footgun does not apply. `media_asset_id` is a soft ref (no FK, cross-module).

-- CreateTable
CREATE TABLE "customer_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "label" VARCHAR(200),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_documents_tenant_id_customer_id_created_at_idx" ON "customer_documents"("tenant_id", "customer_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security — tenant-scoped table, ENABLE + FORCE + tenant_isolation.
ALTER TABLE "customer_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_documents" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "customer_documents"
    USING ("tenant_id" = current_tenant_id());
