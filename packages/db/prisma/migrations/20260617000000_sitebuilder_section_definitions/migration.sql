-- Merchant-defined custom section TYPES (docs/38 Phase C;
-- docs/handoffs/sitebuilder-custom-section-template-spec.md). The data-defined
-- analogue of a code-first SECTION_REGISTRY entry: field_spec is the editor form
-- spec (SectionField[]) and template is the validated render-template AST the
-- storefront interpreter walks. Merged into the registry as `custom:<slug>`;
-- both JSON halves are validated by @sparx/sitebuilder-schemas, not the DB.
--
-- One tenant-scoped table, ENABLE + FORCE RLS with a tenant_isolation policy on
-- current_tenant_id() (defined in 20260527000100_rls). Mirrors
-- 20260612000000_sitebuilder_saved_themes.
--
-- ADDITIVE + non-destructive: a new empty table only. No backfill, so no
-- per-tenant app.tenant_id loop is needed (cf. 20260610000000_tenant_brand).

-- CreateTable
CREATE TABLE "sitebuilder_section_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "slug" VARCHAR(63) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "icon" VARCHAR(63),
    "binding" VARCHAR(31),
    "field_spec" JSONB NOT NULL DEFAULT '[]',
    "template" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sitebuilder_section_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sitebuilder_section_definitions_tenant_id_slug_key" ON "sitebuilder_section_definitions"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "sitebuilder_section_definitions_tenant_id_idx" ON "sitebuilder_section_definitions"("tenant_id");

-- AddForeignKey
ALTER TABLE "sitebuilder_section_definitions" ADD CONSTRAINT "sitebuilder_section_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable — pin the custom-section definitions a published snapshot references,
-- so `custom:<slug>` sections render deterministically from the template AST as it
-- was at publish (surviving later edits/deletes). Defaults to [] for existing rows.
ALTER TABLE "sitebuilder_versions" ADD COLUMN "definitions_snapshot" JSONB NOT NULL DEFAULT '[]';

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — tenant isolation (ENABLE + FORCE). Mirrors
-- 20260527000100_rls / 20260612000000_sitebuilder_saved_themes.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "sitebuilder_section_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sitebuilder_section_definitions" FORCE  ROW LEVEL SECURITY;
CREATE POLICY sitebuilder_section_definitions_tenant_isolation ON "sitebuilder_section_definitions"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Align updated_at with Prisma's @updatedAt convention (the client sets it on
-- every write; no DB default). Keeps `prisma migrate diff` clean.
ALTER TABLE "sitebuilder_section_definitions" ALTER COLUMN "updated_at" DROP DEFAULT;
