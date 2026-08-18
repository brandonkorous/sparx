-- commerce_storefront_settings → per-property (docs/49 Phase 6b). Each site keeps
-- its own commerce defaults + checkout policy (currency, locale, stock display,
-- hide-prices, require-auth). A site with no row of its own inherits the tenant's
-- PRIMARY site's settings at read time (the services resolve property → primary →
-- code defaults), so this is purely additive at the read layer.
--
-- property_id is NOT a security boundary — tenant_id (the RLS GUC) stays the only
-- one (docs/49 §2). The tenant_isolation policy is unchanged.
--
-- BACKFILL: the single pre-rollout row per tenant belongs to its PRIMARY property.
-- FORCE RLS + the non-superuser prod runner ⇒ loop tenants + set app.tenant_id;
-- filter the UPDATE by tenant_id EXPLICITLY (the migration role is a superuser
-- locally, RLS bypassed, so an unqualified UPDATE would assign the first tenant's
-- primary to every row — caught by the per-property unique). Mirrors
-- 20260809000000_sitebuilder_per_property.

-- ── Add property_id (nullable first, so the backfill can run) ──────────────
ALTER TABLE "commerce_storefront_settings" ADD COLUMN "property_id" UUID;

-- ── Backfill from each tenant's primary property ──────────────────────────
DO $$
DECLARE
    v_tenant UUID;
    v_prop   UUID;
BEGIN
    FOR v_tenant IN SELECT "id" FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', v_tenant::text, true);
        SELECT "id" INTO v_prop FROM "properties" WHERE "tenant_id" = v_tenant AND "is_primary";
        UPDATE "commerce_storefront_settings"
           SET "property_id" = v_prop
         WHERE "property_id" IS NULL AND "tenant_id" = v_tenant;
    END LOOP;
END
$$;

-- ── Enforce NOT NULL once every row is backfilled ─────────────────────────
ALTER TABLE "commerce_storefront_settings" ALTER COLUMN "property_id" SET NOT NULL;

-- ── Swap PK (tenant) → (tenant, property) + property_id unique + FK ────────
ALTER TABLE "commerce_storefront_settings" DROP CONSTRAINT "commerce_storefront_settings_pkey";
ALTER TABLE "commerce_storefront_settings"
    ADD CONSTRAINT "commerce_storefront_settings_pkey" PRIMARY KEY ("tenant_id", "property_id");
-- A property has exactly one settings row (Property↔StorefrontSettings is 1:1).
CREATE UNIQUE INDEX "commerce_storefront_settings_property_id_key"
    ON "commerce_storefront_settings" ("property_id");
ALTER TABLE "commerce_storefront_settings"
    ADD CONSTRAINT "commerce_storefront_settings_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
