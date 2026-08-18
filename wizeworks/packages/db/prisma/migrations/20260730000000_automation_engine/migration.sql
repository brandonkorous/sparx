-- Automation engine (docs/81, docs/84 Slice B) — the cross-module rule engine.
--
-- Three tenant-scoped tables: automations (the rule document), automation_runs
-- (durable, resumable run state with dedupe + cause-depth), automation_run_steps
-- (per-action history incl. gate decisions). All three get ENABLE + FORCE RLS +
-- tenant_isolation (run_steps carries its own tenant_id — a join can't satisfy
-- FORCE RLS). DDL is Prisma-exact (generated via migrate diff); RLS is hand-added.

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "automations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "trigger_type" VARCHAR(100) NOT NULL,
    "trigger_config" JSONB NOT NULL DEFAULT '{}',
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "ai_prompt" TEXT,
    "origin" VARCHAR(10) NOT NULL DEFAULT 'user',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "cloned_from" UUID,
    "max_depth" SMALLINT NOT NULL DEFAULT 3,
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "last_run_at" TIMESTAMPTZ,
    "last_error_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "automation_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "trigger_event" JSONB NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "cause_depth" SMALLINT NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'running',
    "cursor_index" INTEGER NOT NULL DEFAULT 0,
    "resume_at" TIMESTAMPTZ,
    "actions_total" INTEGER NOT NULL,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_run_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "action_index" INTEGER NOT NULL,
    "action_type" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "gate_log" JSONB,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "automation_run_steps_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- CreateIndex
CREATE INDEX "automations_tenant_id_status_trigger_type_idx" ON "automations"("tenant_id", "status", "trigger_type");

-- CreateIndex
CREATE INDEX "automations_tenant_id_updated_at_idx" ON "automations"("tenant_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "automation_runs_tenant_id_status_idx" ON "automation_runs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "automation_runs_status_resume_at_idx" ON "automation_runs"("status", "resume_at");

-- CreateIndex
CREATE UNIQUE INDEX "automation_runs_automation_dedupe_unique" ON "automation_runs"("automation_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "automation_run_steps_run_id_action_index_idx" ON "automation_run_steps"("run_id", "action_index");

-- CreateIndex
CREATE INDEX "automation_run_steps_tenant_id_idx" ON "automation_run_steps"("tenant_id");

-- ─── Foreign keys ────────────────────────────────────────────────────────────

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_cloned_from_fkey" FOREIGN KEY ("cloned_from") REFERENCES "automations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_run_steps" ADD CONSTRAINT "automation_run_steps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_run_steps" ADD CONSTRAINT "automation_run_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "automation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Row-level security (hand-edited; Prisma does not generate RLS) ────────────
-- Tenant-scoped → ENABLE + FORCE + tenant_isolation on current_tenant_id().

ALTER TABLE "automations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "automations"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "automation_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "automation_runs"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "automation_run_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_run_steps" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "automation_run_steps"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());
