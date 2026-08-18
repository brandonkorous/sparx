-- Builder — the silica SITE record (docs/118): the per-property, site-GLOBAL half
-- of a silica `Site` that is neither a page nor the chrome — its `theme` and its
-- saved-component `symbols`.
--
-- silica's `<Builder>` hands the host one `Site = { theme, frame, pages, symbols }`
-- per edit. Each part is stored by its rightful owner:
--   · pages   → builder_pages rows   (each owns a slug / SEO / recordType / publish)
--   · frame   → the ACTIVE builder_layouts row's silica tree
--   · theme   → HERE  (was DROPPED on the floor — the author's edit was discarded)
--   · symbols → HERE  (was builder_layouts.silica_symbols — wrong scope: a tenant
--               keeps many layouts and flips which is active, so a saved component
--               would move or vanish with the active chrome)
--
-- `silica_*_theme` holds a silica `Theme` ({ name, tokens, dark?, mode? } — the
-- `--*` custom properties verbatim), so an author's saved theme renders on the
-- storefront exactly as it previewed on the canvas. NULL until an author edits the
-- theme, in which case the storefront keeps rendering the brand-DERIVED theme.
--
-- Draft/published mirrors builder_pages + builder_layouts: `sync` writes draft,
-- `publish` snapshots draft → published, the storefront reads only published.
--
-- Tenant-scoped, ENABLE + FORCE RLS with a tenant_isolation policy on
-- current_tenant_id() (defined in 20260527000100_rls). Mirrors
-- 20260618000000_builder_pages / 20260621000000_builder_layouts.
--
-- ADDITIVE for the new table (empty; rows are created at RUNTIME by the service
-- under withTenant, so RLS is satisfied — no per-tenant app.tenant_id backfill loop
-- is needed here). The one DESTRUCTIVE step is dropping
-- builder_layouts.silica_symbols, whose data moves to builder_sites. That column
-- was introduced days ago by 20261011000000_builder_silica_native_trees and holds
-- no production data (the silica engine is not live for any tenant), so it is
-- dropped rather than backfilled; a tenant's symbols are re-established on the next
-- builder save/publish.

-- CreateTable
CREATE TABLE "builder_sites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "silica_draft_theme" JSONB,
    "silica_published_theme" JSONB,
    "silica_draft_symbols" JSONB NOT NULL DEFAULT '{}',
    "silica_published_symbols" JSONB,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "builder_sites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — exactly one silica site record per web property.
CREATE UNIQUE INDEX "builder_sites_property_id_key" ON "builder_sites"("property_id");
CREATE INDEX "builder_sites_tenant_id_idx" ON "builder_sites"("tenant_id");

-- AddForeignKey
ALTER TABLE "builder_sites" ADD CONSTRAINT "builder_sites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "builder_sites" ADD CONSTRAINT "builder_sites_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — tenant isolation (ENABLE + FORCE). Mirrors
-- 20260621000000_builder_layouts.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "builder_sites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_sites" FORCE  ROW LEVEL SECURITY;
CREATE POLICY builder_sites_tenant_isolation ON "builder_sites"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────
-- Symbols move to builder_sites (site-global), off the chrome row.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "builder_layouts" DROP COLUMN "silica_symbols";
