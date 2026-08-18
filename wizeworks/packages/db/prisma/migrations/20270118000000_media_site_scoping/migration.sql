-- Media library site-scoping (docs/49). Give each media asset an OPTIONAL site so a
-- multi-site tenant's brand/product media no longer bleeds across unrelated sites in
-- the picker (the "would Bob's Parts and Savory Donuts share this?" test — they would
-- not). NULL = tenant-wide/shared: a group logo used on every site, AND every asset
-- that predates this column, which stays visible everywhere. This migration is
-- deliberately NON-DESTRUCTIVE — no backfill; existing assets remain shared until a
-- tenant reassigns them, and nothing disappears from any picker on deploy.
--
-- A NEW upload is stamped with the site it was uploaded from (the api-rest upload
-- route resolves the active site from `x-sparx-property-id`), so going forward each
-- site's uploads are isolated while shared assets (NULL) still show everywhere.
--
-- ON DELETE SET NULL (not CASCADE): media is a reusable library asset that other
-- records reference FK-lessly (mediaAssetIds String[]), so deleting a site FREES its
-- media back to shared rather than destroying assets still in use elsewhere. Mirrors
-- how orders/authors outlive a site (24-crm-orders, 13-cms-editorial).
--
-- No RLS change: media_assets already has ENABLE + FORCE ROW LEVEL SECURITY with the
-- media_assets_tenant_isolation policy (tenant_id = current_tenant_id()). property_id
-- is app-tier scoping WITHIN a tenant, not an isolation boundary, so the existing
-- policy already covers every row regardless of property_id.

ALTER TABLE "media_assets" ADD COLUMN "property_id" UUID;

ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- The scoped library browse: tenant + (this site OR shared), newest first.
CREATE INDEX "media_assets_tenant_id_property_id_updated_at_idx"
  ON "media_assets" ("tenant_id", "property_id", "updated_at" DESC);
