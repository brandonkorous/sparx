-- sparx.market merchant identity → a site-chosen global handle (docs/131 §7 DECISION).
--
-- Before: the public merchant URL `/merchants/{slug}` used the TENANT slug, so two
-- sibling businesses under one owner shared a URL namespace and the address bar
-- disclosed the shared owner — the exact coupling this remediation fights.
--
-- After: the merchant is a specific SITE (market_property_id) with a GLOBALLY-UNIQUE,
-- site-chosen handle. The profile carries both; the projection writer copies the handle
-- into market_merchants.slug and market_listings.merchant_slug (their column names are
-- unchanged for back-compat, only the VALUE source moves off the tenant slug).
--
-- Backfill preserves EVERY existing URL: handle defaults to the tenant slug (already
-- globally unique) and the market site defaults to the primary — so nothing 404s on
-- deploy, and an operator can later claim a cleaner handle. The backfill loops tenants
-- and filters every statement by tenant_id EXPLICITLY: market_merchant_profiles is
-- ENABLE (not FORCE) RLS, so the migration owner bypasses the policy — an unfiltered
-- UPDATE would set every tenant's handle to one slug and collide on the unique index
-- (caught in a rolled-back dry run). Explicit tenant_id is correct whether or not RLS
-- would have scoped it.

ALTER TABLE "market_merchant_profiles" ADD COLUMN "market_property_id" UUID;
ALTER TABLE "market_merchant_profiles" ADD COLUMN "handle" VARCHAR(63);
ALTER TABLE "market_merchant_profiles"
    ADD CONSTRAINT "market_merchant_profiles_market_property_id_fkey"
    FOREIGN KEY ("market_property_id") REFERENCES "properties"("id") ON DELETE SET NULL;
-- Nullable unique: multiple NULLs are allowed (backfill window), non-null handles are
-- globally unique — the /merchants/{handle} namespace.
CREATE UNIQUE INDEX "market_merchant_profiles_handle_unique"
    ON "market_merchant_profiles" ("handle");

ALTER TABLE "market_merchants" ADD COLUMN "property_id" UUID;

DO $$
DECLARE
  t   RECORD;
  pid UUID;
BEGIN
  FOR t IN SELECT id, slug FROM tenants LOOP
    SELECT id INTO pid FROM properties WHERE tenant_id = t.id AND is_primary = true LIMIT 1;

    -- Market site = the primary; handle = the tenant slug (preserves existing URLs).
    UPDATE market_merchant_profiles
       SET market_property_id = pid,
           handle = t.slug
     WHERE tenant_id = t.id AND market_property_id IS NULL;

    UPDATE market_merchants
       SET property_id = pid
     WHERE tenant_id = t.id AND property_id IS NULL;
  END LOOP;
END $$;
