-- Remove the platform-global Vehicle fitment domain and close the "global
-- fitment" door for good.
--
-- Background: 20260606000000_fitment_generalize seeded a sentinel global
-- Vehicle domain (id 00000000-0000-0000-0000-000000000001, tenant_id NULL)
-- visible to every tenant, and made the four reference tables ENABLE-only RLS
-- with a `tenant_id IS NULL OR tenant_id = current_tenant_id()` policy. That
-- made Sparx read as auto-parts software for a bakery or a publisher.
--
-- The platform no longer ships ANY global fitment data. "Vehicle" is now one of
-- many installable dictionaries (packages/commerce-schemas/src/fitment-dictionaries.ts)
-- a tenant stamps as their own tenant-scoped copy. So: delete the global rows,
-- then tighten the reference tables to tenant_id NOT NULL + FORCE RLS + strict
-- tenant_isolation, exactly like every other tenant-scoped table.

-- ─── 1. Delete tenant product-fitment rows that point at the global domain ───
--
-- commerce_product_fitments is FORCE-RLS, so the prod migration role
-- (sparx_owner, a NON-superuser) sees ZERO rows without a tenant context and a
-- bare DELETE would silently no-op while the FK RESTRICT on the domain delete
-- (step 2) still fires against the invisible rows — blocking the migration in
-- prod only. Enter each tenant's context to actually remove them. (See
-- packages/db/CLAUDE.md "Backfilling a FORCE-RLS table inside a migration".)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', r.id::text, true);
    DELETE FROM "commerce_product_fitments"
      WHERE "domain_id" = '00000000-0000-0000-0000-000000000001';
  END LOOP;
  PERFORM set_config('app.tenant_id', '', true);
END $$;

-- ─── 2. Delete the sentinel global domain (cascades its category/item/variant tree) ───
--
-- The reference tables are still ENABLE-only here, so the table owner bypasses
-- RLS and sees the tenant_id IS NULL rows. Deleting the domain cascades to its
-- categories → items → variants (FK ON DELETE CASCADE); the product_fitments
-- that RESTRICT it are already gone (step 1).
DELETE FROM "commerce_fitment_domains"
  WHERE "id" = '00000000-0000-0000-0000-000000000001';

-- ─── 3. Defensive: drop any remaining global (tenant_id IS NULL) rows ───
-- Normally a no-op after step 2; guarantees the SET NOT NULL below can't fail.
DELETE FROM "commerce_fitment_variants" WHERE "tenant_id" IS NULL;
DELETE FROM "commerce_fitment_items" WHERE "tenant_id" IS NULL;
DELETE FROM "commerce_fitment_categories" WHERE "tenant_id" IS NULL;
DELETE FROM "commerce_fitment_domains" WHERE "tenant_id" IS NULL;

-- ─── 4. tenant_id NOT NULL (no more global rows possible) ───
ALTER TABLE "commerce_fitment_domains" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "commerce_fitment_categories" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "commerce_fitment_items" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "commerce_fitment_variants" ALTER COLUMN "tenant_id" SET NOT NULL;

-- ─── 5. Swap the OR-global policy for strict tenant isolation + FORCE ───
-- The four reference tables are now ordinary tenant-scoped tables.
DROP POLICY "tenant_isolation_or_global" ON "commerce_fitment_domains";
ALTER TABLE "commerce_fitment_domains" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "commerce_fitment_domains"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());

DROP POLICY "tenant_isolation_or_global" ON "commerce_fitment_categories";
ALTER TABLE "commerce_fitment_categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "commerce_fitment_categories"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());

DROP POLICY "tenant_isolation_or_global" ON "commerce_fitment_items";
ALTER TABLE "commerce_fitment_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "commerce_fitment_items"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());

DROP POLICY "tenant_isolation_or_global" ON "commerce_fitment_variants";
ALTER TABLE "commerce_fitment_variants" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "commerce_fitment_variants"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());
