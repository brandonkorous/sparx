-- Tenant blueprint installs (docs/54 §9) — one row per marketplace template a
-- tenant installs into one of its web properties. Idempotency key + audit trail
-- + id map (for "Review & go live") + status (installed → live → failed).
--
-- One tenant-scoped table, ENABLE + FORCE RLS with a tenant_isolation policy on
-- current_tenant_id() (defined in 20260527000100_rls). Mirrors
-- 20260626000000_properties. No backfill (new, empty). property_id is app-tier
-- scoping (which site), NOT a security boundary — no FK, no policy (docs/49 §2).

-- CreateTable
CREATE TABLE "tenant_blueprint_installs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "blueprint_key" VARCHAR(63) NOT NULL,
    "blueprint_version" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'installed',
    "result" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "installed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "live_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_blueprint_installs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — one install per blueprint per property (idempotency).
CREATE UNIQUE INDEX "tenant_blueprint_installs_tenant_property_key_key"
    ON "tenant_blueprint_installs"("tenant_id", "property_id", "blueprint_key");
CREATE INDEX "tenant_blueprint_installs_tenant_id_idx"
    ON "tenant_blueprint_installs"("tenant_id");

-- AddForeignKey — tenant only (property_id is app-tier, no FK; docs/49 §2).
ALTER TABLE "tenant_blueprint_installs"
    ADD CONSTRAINT "tenant_blueprint_installs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — tenant isolation (ENABLE + FORCE). Mirrors
-- 20260626000000_properties.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "tenant_blueprint_installs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_blueprint_installs" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_blueprint_installs_tenant_isolation ON "tenant_blueprint_installs"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Align updated_at with Prisma's @updatedAt convention (client sets it on every
-- write; no DB default). Keeps `prisma migrate diff` clean.
ALTER TABLE "tenant_blueprint_installs" ALTER COLUMN "updated_at" DROP DEFAULT;
