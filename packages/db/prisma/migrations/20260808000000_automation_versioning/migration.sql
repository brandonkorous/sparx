-- Automation versioning (docs/84 Slice G-versioning) — Builder-style draft →
-- publish + immutable history for the rule engine.
--
-- The existing automation columns (trigger_type/trigger_config/conditions/
-- actions/max_depth) REMAIN the currently-PUBLISHED (live) document the engine,
-- ticks, and SECURITY DEFINER scans already read — so this slice is purely
-- ADDITIVE and touches no execution path:
--   • automations.draft          — staged, unpublished edit (NULL = no draft)
--   • automations.version         — live published version (1 = first publish)
--   • automations.published_at/by — when/who last published the live document
--   • automation_versions         — one immutable snapshot per publish (history)
--   • automation_runs.automation_version — stamps which version a run executed
--
-- No DML backfill: `version` lands via a constant DDL DEFAULT (metadata-only,
-- not RLS-row-filtered), so every existing row reads as version 1 with no
-- per-tenant set_config loop (the FORCE-RLS backfill footgun). published_at on
-- pre-existing rows stays NULL — the UI falls back to updated_at. Version
-- history starts accumulating from each automation's NEXT publish.

-- ─── Additive columns ────────────────────────────────────────────────────────

-- AlterTable
ALTER TABLE "automations"
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "published_at" TIMESTAMPTZ,
    ADD COLUMN "published_by" UUID,
    ADD COLUMN "draft" JSONB;

-- AlterTable
ALTER TABLE "automation_runs"
    ADD COLUMN "automation_version" INTEGER;

-- ─── History table ───────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "automation_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "automation_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "trigger_type" VARCHAR(100) NOT NULL,
    "trigger_config" JSONB NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "max_depth" SMALLINT NOT NULL,
    "note" TEXT,
    "published_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_by" UUID,

    CONSTRAINT "automation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_versions_automation_version_unique" ON "automation_versions"("automation_id", "version");

-- CreateIndex
CREATE INDEX "automation_versions_tenant_id_idx" ON "automation_versions"("tenant_id");

-- AddForeignKey
ALTER TABLE "automation_versions" ADD CONSTRAINT "automation_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_versions" ADD CONSTRAINT "automation_versions_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Row-level security (hand-edited; Prisma does not generate RLS) ────────────
-- Tenant-scoped → ENABLE + FORCE + tenant_isolation on current_tenant_id().

ALTER TABLE "automation_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "automation_versions"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());

-- ─── Schedule-scan helper: carry `version` so scheduled runs stamp it ─────────
-- Additive change to the RETURNS clause (run-stamp observability). Adding an OUT
-- column changes the result type, so REPLACE alone is rejected — DROP + CREATE.
-- Same SECURITY DEFINER / grants / comment as 20260731000000.

DROP FUNCTION IF EXISTS find_active_scheduled_automations();

CREATE FUNCTION find_active_scheduled_automations()
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  trigger_type varchar(100),
  trigger_config jsonb,
  conditions jsonb,
  actions jsonb,
  version int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, tenant_id, trigger_type, trigger_config, conditions, actions, version
  FROM automations
  WHERE status = 'active'
    AND trigger_type LIKE 'schedule.%'
  ORDER BY created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION find_active_scheduled_automations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_active_scheduled_automations() TO sparx_app;

COMMENT ON FUNCTION find_active_scheduled_automations IS
  'Returns all active automations whose trigger_type is a schedule.* cadence, including the live published version. SECURITY DEFINER (sparx_owner) so the worker schedule tick can scan across tenants without sparx_app holding RLS bypass; the worker runs each predicate + enqueue under withTenant.';
