-- Builder — multiple site LAYOUTS per tenant, exactly one ACTIVE (docs/45 §7).
--
-- v1 kept one layout per tenant (a UNIQUE on tenant_id). This lifts that: a
-- tenant now keeps a CATALOG of layouts (like builder_pages), and a single
-- is_active flag marks the live chrome the storefront serves. Publishing a layout
-- snapshots its draft → published (a layout can be published-but-idle); a separate
-- "make active" flips which published layout is live.
--
-- "At most one active per tenant" is enforced in the DB by a PARTIAL UNIQUE index
-- on (tenant_id) WHERE is_active — the canonical, race-safe Postgres idiom. Prisma
-- can't express the predicate, so it lives here in SQL only (like the RLS policies
-- and *_set_updated_at triggers elsewhere); Prisma's differ leaves it alone.
--
-- BACKFILL: every existing tenant has exactly one layout (the old unique
-- guaranteed it). We mark it active so storefronts keep rendering the same chrome.
-- The table is FORCE RLS and the prod migration runner (sparx_owner) is NOT a
-- superuser, so an unqualified UPDATE sees zero rows — we loop tenants and set
-- app.tenant_id per tenant (cf. current_tenant_id() in 20260527000100_rls).

-- AlterTable — additive columns.
ALTER TABLE "builder_layouts"
    ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "position"  INTEGER NOT NULL DEFAULT 0;

-- DropIndex — the v1 "one layout per tenant" unique. Replaced by the partial
-- unique index below (one ACTIVE per tenant; many idle layouts allowed).
DROP INDEX "builder_layouts_tenant_id_key";

-- Backfill — mark each tenant's existing (single) layout active. Per-tenant loop
-- because FORCE RLS hides rows from the non-superuser runner unless app.tenant_id
-- is set. Sourced from the non-RLS tenants table.
DO $$
DECLARE
    v_tenant UUID;
BEGIN
    FOR v_tenant IN SELECT "id" FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', v_tenant::text, true);
        UPDATE "builder_layouts" SET "is_active" = true WHERE "tenant_id" = v_tenant;
    END LOOP;
END
$$;

-- CreateIndex — at most one ACTIVE layout per tenant (partial unique). The
-- service clears the prior active before setting the new one within a single
-- transaction, so the intermediate (zero active) never trips this.
CREATE UNIQUE INDEX "builder_layouts_one_active_per_tenant"
    ON "builder_layouts" ("tenant_id") WHERE "is_active";

-- CreateIndex — catalog ordering (matches @@index([tenantId, position])).
CREATE INDEX "builder_layouts_tenant_id_position_idx"
    ON "builder_layouts" ("tenant_id", "position");
