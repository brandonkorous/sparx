-- Domain — the host→property (site) dispatch table (docs/49 §5, docs/24).
--
-- Every routable hostname for a tenant's web PROPERTIES lives here:
--   · type='subdomain' — the always-on `<tenant-slug>.sparx.zone` host (we own
--                        the zone, so it's status='active' immediately).
--   · type='custom'    — a domain the tenant already owns, connected via DNS.
--   · type='purchased' — a domain registered through Sparx (registrar columns,
--                        inert until the reseller slice lands).
--
-- NON-RLS DISPATCH TABLE — deliberately, exactly like `tenants`. The host→property
-- resolver and the Caddy on-demand-TLS ask endpoint look up `host` BEFORE any
-- tenant is known, so the row must be readable without an app.tenant_id GUC.
-- `host` is GLOBALLY unique (one hostname → one site), which is the cross-tenant
-- guard. The sensitive content a host points at (pages/orders/customers) stays
-- FORCE-RLS on its own tables; management routes filter by tenant_id in the app
-- (cf. the tenants table). No ENABLE/FORCE RLS, no tenant_isolation policy.

-- CreateTable
CREATE TABLE "domains" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "host" VARCHAR(255) NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'custom',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "verification_token" VARCHAR(120),
    "verified_at" TIMESTAMPTZ,
    "is_canonical" BOOLEAN NOT NULL DEFAULT false,
    "registrar" VARCHAR(50),
    "registrar_order_id" VARCHAR(255),
    "registered_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — host is globally unique (the cross-tenant guard).
CREATE UNIQUE INDEX "domains_host_key" ON "domains"("host");
CREATE INDEX "domains_tenant_id_idx" ON "domains"("tenant_id");
CREATE INDEX "domains_property_id_idx" ON "domains"("property_id");

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "domains" ADD CONSTRAINT "domains_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill — one always-on subdomain per existing tenant's PRIMARY property:
-- `<tenant-slug>.sparx.zone`, the host the Caddy ask endpoint already authorizes
-- via the tenants table (so live preview keeps working through this migration).
-- `domains` is NOT RLS, so the INSERT needs no GUC — but `properties` IS FORCE RLS
-- and the prod runner (sparx_owner) is non-superuser, so we set app.tenant_id per
-- tenant to READ each tenant's primary property (cf. 20260628000000_builder_per_property).
DO $$
DECLARE
    v_tenant UUID;
    v_slug   VARCHAR(63);
    v_prop   UUID;
BEGIN
    FOR v_tenant, v_slug IN SELECT "id", "slug" FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', v_tenant::text, true);
        SELECT "id" INTO v_prop FROM "properties" WHERE "tenant_id" = v_tenant AND "is_primary";
        IF v_prop IS NOT NULL THEN
            INSERT INTO "domains" ("tenant_id", "property_id", "host", "type", "status", "is_canonical", "updated_at")
            VALUES (v_tenant, v_prop, v_slug || '.sparx.zone', 'subdomain', 'active', true, CURRENT_TIMESTAMP)
            ON CONFLICT ("host") DO NOTHING;
        END IF;
    END LOOP;
END
$$;

-- Align updated_at with Prisma's @updatedAt convention (client sets it on every
-- write; no DB default). Keeps `prisma migrate diff` clean.
ALTER TABLE "domains" ALTER COLUMN "updated_at" DROP DEFAULT;
