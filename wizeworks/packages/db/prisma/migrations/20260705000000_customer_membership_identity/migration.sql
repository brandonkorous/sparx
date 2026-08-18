-- docs/58 D2/D6 — Customer identity / membership split.
--
-- Splits shopper auth into two layers: a tenant-wide IDENTITY (the login, owns
-- the credential + password resets) and a per-property MEMBERSHIP (the existing
-- `customers` row, now scoped to a site + linked to an identity). Sessions stay
-- per-membership (a login to a specific site's customer). Lets the same person
-- shop multiple of the tenant's sites under one login while keeping each site's
-- customer record, consent, and orders separate (cars-John ≠ dogs-John).
--
-- Strategy: add columns nullable → backfill per tenant (FORCE-RLS tables need the
-- set_config('app.tenant_id') loop; sparx_owner is non-superuser in prod) → drop
-- the old customer-keyed columns → enforce the new identity-keyed shape.
-- No data loss: every existing (tenant, email) becomes one identity; existing
-- customers are stamped onto the tenant's PRIMARY site (where they shopped).

-- ── 1. Tenant-wide IDENTITY table (the login). ──
CREATE TABLE "customer_identities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "customer_identities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_identities_tenant_email_unique" ON "customer_identities"("tenant_id", "email");
ALTER TABLE "customer_identities" ADD CONSTRAINT "customer_identities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: tenant_id is the only boundary (docs/49 §2). ENABLE + FORCE + isolation policy.
ALTER TABLE "customer_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_identities" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_identities_tenant_isolation" ON "customer_identities"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

-- ── 2. Add columns (nullable for backfill): membership scope on customers,
--    identity link on the auth tables. ──
ALTER TABLE "customers" ADD COLUMN "property_id" UUID;
ALTER TABLE "customers" ADD COLUMN "identity_id" UUID;
ALTER TABLE "customer_credentials" ADD COLUMN "identity_id" UUID;
ALTER TABLE "customer_password_resets" ADD COLUMN "identity_id" UUID;

-- ── 3. Backfill. FORCE-RLS tables → loop tenants + set_config('app.tenant_id')
--    (sparx_owner is non-superuser in prod; without the GUC it sees 0 rows). ──
DO $$
DECLARE
  t RECORD;
  primary_prop UUID;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    -- One identity per (tenant, email) from existing customers that have an email.
    INSERT INTO "customer_identities" ("tenant_id", "email", "updated_at")
      SELECT DISTINCT c."tenant_id", c."email", CURRENT_TIMESTAMP
        FROM "customers" c
       WHERE c."tenant_id" = t.id AND c."email" IS NOT NULL
      ON CONFLICT ("tenant_id", "email") DO NOTHING;

    -- Link each customer membership to its identity.
    UPDATE "customers" c
       SET "identity_id" = ci."id"
      FROM "customer_identities" ci
     WHERE c."tenant_id" = t.id
       AND ci."tenant_id" = t.id
       AND c."email" IS NOT NULL
       AND ci."email" = c."email";

    -- Existing customers were "on" the tenant's PRIMARY site → stamp property_id.
    SELECT p."id" INTO primary_prop
      FROM "properties" p
     WHERE p."tenant_id" = t.id AND p."is_primary" = true
     LIMIT 1;
    IF primary_prop IS NOT NULL THEN
      UPDATE "customers"
         SET "property_id" = primary_prop
       WHERE "tenant_id" = t.id AND "property_id" IS NULL;
    END IF;

    -- Re-home credentials + reset tokens onto the identity (via the customer link).
    UPDATE "customer_credentials" cc
       SET "identity_id" = c."identity_id"
      FROM "customers" c
     WHERE cc."tenant_id" = t.id AND c."id" = cc."customer_id" AND c."identity_id" IS NOT NULL;

    UPDATE "customer_password_resets" pr
       SET "identity_id" = c."identity_id"
      FROM "customers" c
     WHERE pr."tenant_id" = t.id AND c."id" = pr."customer_id" AND c."identity_id" IS NOT NULL;
  END LOOP;
END $$;

-- ── 4. Drop the old customer-keyed columns/constraints on the auth tables. ──
ALTER TABLE "customer_credentials" DROP CONSTRAINT "customer_credentials_customer_id_fkey";
DROP INDEX "customer_credentials_customer_id_key";
ALTER TABLE "customer_credentials" DROP COLUMN "customer_id";
ALTER TABLE "customer_credentials" ALTER COLUMN "identity_id" SET NOT NULL;

ALTER TABLE "customer_password_resets" DROP CONSTRAINT "customer_password_resets_customer_id_fkey";
DROP INDEX "customer_password_resets_tenant_id_customer_id_idx";
ALTER TABLE "customer_password_resets" DROP COLUMN "customer_id";
ALTER TABLE "customer_password_resets" ALTER COLUMN "identity_id" SET NOT NULL;

-- ── 5. New identity-keyed constraints/indexes on the auth tables. ──
CREATE UNIQUE INDEX "customer_credentials_identity_id_key" ON "customer_credentials"("identity_id");
ALTER TABLE "customer_credentials" ADD CONSTRAINT "customer_credentials_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "customer_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "customer_password_resets_tenant_id_identity_id_idx" ON "customer_password_resets"("tenant_id", "identity_id");
ALTER TABLE "customer_password_resets" ADD CONSTRAINT "customer_password_resets_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "customer_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 6. customers: swap the unique to (tenant, property, email), add scoping
--    indexes + the property / identity FKs. ──
DROP INDEX "customers_tenant_email_unique";
CREATE UNIQUE INDEX "customers_tenant_property_email_unique" ON "customers"("tenant_id", "property_id", "email");
CREATE INDEX "customers_tenant_id_property_id_idx" ON "customers"("tenant_id", "property_id");
CREATE INDEX "customers_identity_id_idx" ON "customers"("identity_id");
ALTER TABLE "customers" ADD CONSTRAINT "customers_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "customer_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
