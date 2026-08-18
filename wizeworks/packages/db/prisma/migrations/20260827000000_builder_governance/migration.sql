-- Builder — tenant-wide GOVERNANCE singleton (docs/61 §8, Phase 6b).
--
-- One config row per tenant for the brand-designer's builder safety/governance
-- policy. `utility_allowlist` holds the tenant's ADDITIONAL block rules (tighten-
-- only); the platform base denylist (fixed / url( / content-[ / arbitrary z-[) is
-- hardcoded in @sparx/surface-compile and is NEVER relaxable. Null = inherit base.
--
-- Deliberately its OWN table (not a TenantBrand column): the allowlist is a
-- governance policy, not brand IDENTITY (which is drifting per-site via
-- Property.brandOverride). PK = tenant_id (one row per tenant), upserted lazily on
-- first write — no row exists until a tenant tightens.
--
-- Tenant-scoped + ENABLE/FORCE RLS with the standard tenant_isolation policy on
-- current_tenant_id() (defined in 20260527000100_rls), like every builder_* table.
-- Additive — no backfill (nullable; no existing rows reference it).

-- CreateTable
CREATE TABLE "builder_governance" (
    "tenant_id" UUID NOT NULL,
    "utility_allowlist" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "builder_governance_pkey" PRIMARY KEY ("tenant_id")
);

-- AddForeignKey
ALTER TABLE "builder_governance"
    ADD CONSTRAINT "builder_governance_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security — tenant isolation (ENABLE + FORCE), mirroring the other
-- builder_* tables. current_tenant_id() is defined in 20260527000100_rls.
ALTER TABLE "builder_governance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_governance" FORCE ROW LEVEL SECURITY;
CREATE POLICY builder_governance_tenant_isolation ON "builder_governance"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
