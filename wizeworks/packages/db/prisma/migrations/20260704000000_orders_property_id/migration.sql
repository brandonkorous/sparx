-- Origin-site tagging (docs/58 D1): orders + carts gain a nullable property_id —
-- the site the order/cart was placed on. App-tier scoping only (tenant_id stays
-- the RLS boundary, so NO policy change). ON DELETE SET NULL: orders outlive their
-- site (finance / tax / dispute history must survive a site deletion). No backfill
-- of historical rows — they stay null (= "no specific site", shown under All sites).

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "property_id" UUID;

-- AlterTable
ALTER TABLE "commerce_carts" ADD COLUMN "property_id" UUID;

-- CreateIndex
CREATE INDEX "orders_tenant_id_property_id_placed_at_idx" ON "orders"("tenant_id", "property_id", "placed_at" DESC);

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_carts" ADD CONSTRAINT "commerce_carts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
