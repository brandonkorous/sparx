-- Storefront → Site (store→site rename, docs/34 §5).
-- Data-preserving renames of the commerce per-site settings/theme tables and the
-- legal doc-placement table, plus their constraints, indexes, and RLS policies.
-- No data backfill: the persisted 'storefront' channel default is handled by the
-- channel migration (rename_channel_storefront_to_web).

-- ── commerce_storefront_settings → commerce_site_settings ──────────────────
ALTER TABLE "commerce_storefront_settings" RENAME TO "commerce_site_settings";
ALTER TABLE "commerce_site_settings" RENAME CONSTRAINT "commerce_storefront_settings_pkey" TO "commerce_site_settings_pkey";
ALTER TABLE "commerce_site_settings" RENAME CONSTRAINT "commerce_storefront_settings_tenant_id_fkey" TO "commerce_site_settings_tenant_id_fkey";
ALTER TABLE "commerce_site_settings" RENAME CONSTRAINT "commerce_storefront_settings_property_id_fkey" TO "commerce_site_settings_property_id_fkey";
ALTER INDEX "commerce_storefront_settings_property_id_key" RENAME TO "commerce_site_settings_property_id_key";
ALTER POLICY "commerce_storefront_settings_tenant_isolation" ON "commerce_site_settings" RENAME TO "commerce_site_settings_tenant_isolation";

-- ── commerce_storefront_themes → commerce_site_themes ──────────────────────
ALTER TABLE "commerce_storefront_themes" RENAME TO "commerce_site_themes";
ALTER TABLE "commerce_site_themes" RENAME CONSTRAINT "commerce_storefront_themes_pkey" TO "commerce_site_themes_pkey";
ALTER TABLE "commerce_site_themes" RENAME CONSTRAINT "commerce_storefront_themes_tenant_id_fkey" TO "commerce_site_themes_tenant_id_fkey";
ALTER TABLE "commerce_site_themes" RENAME CONSTRAINT "commerce_storefront_themes_property_id_fkey" TO "commerce_site_themes_property_id_fkey";
ALTER INDEX "commerce_storefront_themes_property_id_key" RENAME TO "commerce_site_themes_property_id_key";
ALTER POLICY "commerce_storefront_themes_tenant_isolation" ON "commerce_site_themes" RENAME TO "commerce_site_themes_tenant_isolation";

-- ── storefront_doc_placements → site_doc_placements ────────────────────────
ALTER TABLE "storefront_doc_placements" RENAME TO "site_doc_placements";
ALTER TABLE "site_doc_placements" RENAME CONSTRAINT "storefront_doc_placements_pkey" TO "site_doc_placements_pkey";
ALTER TABLE "site_doc_placements" RENAME CONSTRAINT "storefront_doc_placements_tenant_id_fkey" TO "site_doc_placements_tenant_id_fkey";
ALTER TABLE "site_doc_placements" RENAME CONSTRAINT "storefront_doc_placements_property_id_fkey" TO "site_doc_placements_property_id_fkey";
ALTER TABLE "site_doc_placements" RENAME CONSTRAINT "storefront_doc_placements_entry_id_fkey" TO "site_doc_placements_entry_id_fkey";
ALTER INDEX "storefront_doc_placements_prop_placement_source_entry_key" RENAME TO "site_doc_placements_prop_placement_source_entry_key";
ALTER INDEX "storefront_doc_placements_tenant_id_placement_enabled_posit_idx" RENAME TO "site_doc_placements_tenant_id_placement_enabled_position_idx";
ALTER POLICY "storefront_doc_placements_tenant_isolation" ON "site_doc_placements" RENAME TO "site_doc_placements_tenant_isolation";
