-- Blueprint install artifacts (docs/55 §4) — one row per artifact a blueprint
-- install created (or brought under management on a later update), carrying the
-- stamped BASELINE (the three-way-merge ancestor) + the per-artifact
-- managed/detached lifecycle. The merge SUBSTRATE layered alongside
-- tenant_blueprint_installs.result (the id-map): `result` says WHAT exists, this
-- says WHAT IT ORIGINALLY WAS — which is what lets a blueprint update tell a tenant
-- edit from a blueprint change and so never clobber the tenant (docs/55 U1/U6).
--
-- One tenant-scoped table, ENABLE + FORCE RLS with a tenant_isolation policy on
-- current_tenant_id() (defined in 20260527000100_rls). Mirrors
-- 20260703000000_tenant_blueprint_installs. install_id FKs the install row
-- (cascade), so deleting/uninstalling an install drops its artifact rows. New +
-- empty: no backfill (so no per-tenant set_config loop needed).

-- CreateTable
CREATE TABLE "tenant_blueprint_install_artifacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "install_id" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "ref_id" UUID,
    "natural_key" VARCHAR(255) NOT NULL,
    "baseline" JSONB NOT NULL DEFAULT '{}',
    "baseline_version" VARCHAR(20) NOT NULL,
    "managed" BOOLEAN NOT NULL DEFAULT true,
    "detached" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_blueprint_install_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — one artifact row per (install, kind, natural key).
CREATE UNIQUE INDEX "tenant_blueprint_install_artifacts_install_kind_key_key"
    ON "tenant_blueprint_install_artifacts"("install_id", "kind", "natural_key");
CREATE INDEX "tenant_blueprint_install_artifacts_tenant_id_idx"
    ON "tenant_blueprint_install_artifacts"("tenant_id");
CREATE INDEX "tenant_blueprint_install_artifacts_install_id_idx"
    ON "tenant_blueprint_install_artifacts"("install_id");

-- AddForeignKey — the parent install (cascade on uninstall). tenant_id is the RLS
-- key; the install already FKs tenants, so no separate tenants FK is needed here.
ALTER TABLE "tenant_blueprint_install_artifacts"
    ADD CONSTRAINT "tenant_blueprint_install_artifacts_install_id_fkey"
    FOREIGN KEY ("install_id") REFERENCES "tenant_blueprint_installs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — tenant isolation (ENABLE + FORCE). Mirrors
-- 20260703000000_tenant_blueprint_installs.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "tenant_blueprint_install_artifacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_blueprint_install_artifacts" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_blueprint_install_artifacts_tenant_isolation ON "tenant_blueprint_install_artifacts"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Align updated_at with Prisma's @updatedAt convention (client sets it on every
-- write; no DB default). Keeps `prisma migrate diff` clean.
ALTER TABLE "tenant_blueprint_install_artifacts" ALTER COLUMN "updated_at" DROP DEFAULT;
