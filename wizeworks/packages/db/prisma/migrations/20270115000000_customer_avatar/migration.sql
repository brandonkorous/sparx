-- Optional customer profile photo — a SOFT reference to a MediaAsset (cms
-- module). Additive and safe to apply live: one nullable column, no FK by
-- design (a cross-module soft ref, like crm_activities.linked_entity_id), no
-- backfill. The existing customers RLS policy covers the new column unchanged.

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "avatar_media_asset_id" UUID;
