-- Saved themes capture a brand "look" (docs/33 / docs/36 Brand+Theme tier): the
-- theme's own identity colors, fonts, and shape/feel tokens — so a named theme
-- is a self-contained snapshot, not just a presentation overlay. Applying the
-- theme writes these onto the tenant brand (the dashboard does that via /v1/brand;
-- this column only stores the snapshot).
--
-- ADDITIVE + non-destructive: one nullable JSONB column on an existing table. No
-- backfill (legacy rows keep brand = NULL and fall back to the live brand), so no
-- per-tenant app.tenant_id loop is needed. The column inherits the table's
-- existing ENABLE + FORCE RLS tenant_isolation policy (20260612000000).

ALTER TABLE "sitebuilder_themes" ADD COLUMN "brand" JSONB;
