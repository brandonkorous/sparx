-- Tenant business details — the LEGAL ENTITY behind the account.
--
-- Creates the one place a business's own facts can live: its business name, its
-- registered address, its tax id and company number, its phone. Before this
-- there was nowhere to put any of it — `BillingRenderBrand.addressLines` had
-- been declared since the invoice renderer was written and was populated by
-- NOTHING, so the seller block on every invoice and every purchase order
-- rendered empty.
--
-- A satellite of tenants (1:1, PK = tenant_id), mirroring tenant_brands rather
-- than adding columns to `tenants`: that row is the non-RLS dispatch table
-- carrying platform concerns (Stripe, Better Auth org fields, acquisition), and
-- these are tenant DATA that belongs behind ENABLE+FORCE RLS.
--
-- ADDITIVE. `tenant_brands.business_name` is READ here to backfill and is then
-- LEFT IN PLACE — the repo's deploy-small convention: additive first, the drop
-- only after every reader is cut over, so no deployed image ever reads a column
-- that has gone away.
--
-- Backfill note: tenant_brands is FORCE RLS, so even the migration role cannot
-- read it with app.tenant_id unset (current_tenant_id() → NULL → no rows). The
-- backfill therefore loops per tenant and sets the GUC locally before each read,
-- exactly as 20260610000000_tenant_brand does. `tenants` itself has no RLS.

-- CreateTable
CREATE TABLE "tenant_businesses" (
    "tenant_id" UUID NOT NULL,
    "business_name" VARCHAR(255),
    "entity_type" VARCHAR(40),
    "registration_number" VARCHAR(64),
    "tax_id" VARCHAR(64),
    "tax_registered" BOOLEAN NOT NULL DEFAULT false,
    "phone" VARCHAR(40),
    "support_email" VARCHAR(255),
    "address_line1" VARCHAR(255),
    "address_line2" VARCHAR(255),
    "city" VARCHAR(120),
    "region" VARCHAR(120),
    "postal_code" VARCHAR(20),
    "country" VARCHAR(2),
    "timezone" VARCHAR(64),
    "default_currency" VARCHAR(3),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_businesses_pkey" PRIMARY KEY ("tenant_id")
);

-- AddForeignKey
ALTER TABLE "tenant_businesses" ADD CONSTRAINT "tenant_businesses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Backfill — one row per tenant.
--
-- business_name comes from tenant_brands.business_name, which is where this
-- fact has been living (mislabelled as brand identity), falling back to the
-- tenant's legal name so every business starts with a printable name rather
-- than a blank invoice masthead.
--
-- Runs BEFORE RLS is enabled here (so the INSERT is unconstrained) but sets
-- app.tenant_id per tenant so the FORCE-RLS source table is visible.
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id, name FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        INSERT INTO "tenant_businesses" (
            "tenant_id", "business_name", "created_at", "updated_at"
        )
        SELECT
            t.id,
            COALESCE(NULLIF(TRIM(tb.business_name), ''), t.name),
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM (SELECT 1) AS _one
        LEFT JOIN "tenant_brands" tb ON tb.tenant_id = t.id;
    END LOOP;

    PERFORM set_config('app.tenant_id', '', true);
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — tenant isolation (ENABLE + FORCE). Mirrors
-- 20260527000100_rls / 20260610000000_tenant_brand.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "tenant_businesses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_businesses" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_businesses_tenant_isolation ON "tenant_businesses"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Align updated_at with Prisma's @updatedAt convention (drop the table-level
-- DEFAULT; the client sets updated_at on every write). Without this,
-- `prisma migrate diff` flags drift.
ALTER TABLE "tenant_businesses" ALTER COLUMN "updated_at" DROP DEFAULT;
