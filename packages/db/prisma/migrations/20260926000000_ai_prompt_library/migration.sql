-- AI module persistence (docs/07 §9 + the prompt-template library). Two new
-- tenant-scoped tables + one additive column on api_keys.
--
--   • ai_prompt_templates — the reusable AI prompt library (consumed by the
--     live-chat persona lookup; seeded by the `ai` preset / industry starters).
--   • ai_tool_policies    — per-tenant MCP tool allow/deny overlay (enforced in
--     services/api-mcp dispatch + tools/list).
--   • api_keys.client     — labels an MCP connection by its AI client.
--
-- Both new tables are tenant-scoped → ENABLE + FORCE RLS + tenant_isolation
-- (current_tenant_id() defined in 20260527000100_rls). New EMPTY tables → no
-- backfill, so no FORCE-RLS per-tenant loop. The api_keys column is a nullable
-- additive ALTER on a table that already has its RLS policy.

-- CreateTable
CREATE TABLE "ai_prompt_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(24) NOT NULL,
    "body" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "model" VARCHAR(64),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_tool_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "tool_name" VARCHAR(80) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_tool_policies_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN "client" VARCHAR(24);

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompt_templates_tenant_key_unique" ON "ai_prompt_templates"("tenant_id", "key");
CREATE INDEX "ai_prompt_templates_tenant_id_category_idx" ON "ai_prompt_templates"("tenant_id", "category");
CREATE UNIQUE INDEX "ai_tool_policies_tenant_tool_unique" ON "ai_tool_policies"("tenant_id", "tool_name");
CREATE INDEX "ai_tool_policies_tenant_id_idx" ON "ai_tool_policies"("tenant_id");

-- AddForeignKey
ALTER TABLE "ai_prompt_templates" ADD CONSTRAINT "ai_prompt_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_tool_policies" ADD CONSTRAINT "ai_tool_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security — hand-edited (Prisma does not generate RLS). Both tables are
-- tenant-scoped → ENABLE + FORCE + tenant_isolation. The MCP service reads them
-- under a tenant GUC (withTenant), same as every other tenant-scoped read.
ALTER TABLE "ai_prompt_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_prompt_templates" FORCE  ROW LEVEL SECURITY;
CREATE POLICY ai_prompt_templates_tenant_isolation ON "ai_prompt_templates"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "ai_tool_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_tool_policies" FORCE  ROW LEVEL SECURITY;
CREATE POLICY ai_tool_policies_tenant_isolation ON "ai_tool_policies"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
