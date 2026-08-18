-- Per-SITE CRM pipelines + deals (docs/131 §5).
--
-- A Pipeline is one business's SALES PROCESS — the doc's own header cites "Fleet
-- Contract Renewals" — and a machine shop's stages ("Quote → Approved →
-- Fabricating → Invoiced") are meaningless on a donut wholesaler. Same split as
-- scheduling:
--
--   · pipelines      — authored process, Cascade. Nullable (a shared process is
--                      a legitimate default).
--   · pipeline_stages — NO column; a stage exists only under a pipeline and
--                      inherits its site (docs/131 §2 pattern 3).
--   · deals          — denormalized from the pipeline AT CREATION so "this
--                      business's open pipeline value" needs no join and re-
--                      scoping a pipeline can't rewrite past deals. SetNull — a
--                      deal is a RECORD of an opportunity and outlives its site.
--
-- Nullable, no backfill, no FORCE-RLS loop — NULL = tenant-wide, matching today.

ALTER TABLE "pipelines" ADD COLUMN "property_id" UUID;
ALTER TABLE "deals"     ADD COLUMN "property_id" UUID;

ALTER TABLE "pipelines"
    ADD CONSTRAINT "pipelines_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
ALTER TABLE "deals"
    ADD CONSTRAINT "deals_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL;

-- pipelines slug uniqueness → (tenant, property, slug). Bare unique INDEX on this
-- table (verified), so DROP INDEX; NULLS NOT DISTINCT keeps the tenant-wide tier
-- from duplicating a slug.
DROP INDEX "pipelines_tenant_id_slug_key";
CREATE UNIQUE INDEX "pipelines_tenant_id_property_id_slug_key"
    ON "pipelines"("tenant_id", "property_id", "slug") NULLS NOT DISTINCT;

CREATE INDEX "pipelines_tenant_property_archived_idx"
    ON "pipelines"("tenant_id", "property_id", "archived_at");
CREATE INDEX "deals_tenant_property_stage_idx"
    ON "deals"("tenant_id", "property_id", "stage_id");
