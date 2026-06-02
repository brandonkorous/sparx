-- Legal documents & cookie consent — docs/42.
--
-- Four concerns land together:
--   • content_entries gains a `legal_kind` discriminator (+ template version /
--     disclaimer-ack) so a `page` entry can BE a tenant policy doc. Set by the
--     seed/instantiate path, never the CMS editor — survives edits, and the
--     Legal checklist groups by it.
--   • storefront_doc_placements — where legal docs surface (footer/checkout/
--     terms gate). Polymorphic source_kind so the integration-published-docs
--     bridge reuses it later.
--   • consent_settings / consent_records — per-tenant cookie-consent config +
--     append-only consent log (timestamp + IP per docs/16 §10).
--   • platform_legal_acceptance — who accepted Sparx's ToS/Privacy/AUP/DPA.
--
-- RLS: the three tenant-scoped storefront/consent tables are ENABLE + FORCE
-- (always read inside withTenant). platform_legal_acceptance is ENABLE only
-- (NO FORCE) — like users/sessions/accounts it is read by the owner connection
-- before any tenant context is set; queries pin tenant_id/user_id explicitly.

-- AlterTable
ALTER TABLE "content_entries" ADD COLUMN     "legal_disclaimer_ack_at" TIMESTAMPTZ,
ADD COLUMN     "legal_kind" VARCHAR(40),
ADD COLUMN     "legal_template_version" INTEGER;

-- CreateTable
CREATE TABLE "storefront_doc_placements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "placement" VARCHAR(40) NOT NULL,
    "source_kind" VARCHAR(30) NOT NULL,
    "entry_id" UUID,
    "legal_kind" VARCHAR(40),
    "provider_slug" VARCHAR(63),
    "label" VARCHAR(120),
    "column_key" VARCHAR(40),
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "storefront_doc_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_settings" (
    "tenant_id" UUID NOT NULL,
    "mode" VARCHAR(10) NOT NULL DEFAULT 'off',
    "active_categories" JSONB NOT NULL DEFAULT '[]',
    "banner_title" VARCHAR(255),
    "banner_body" TEXT,
    "policy_page_slug" VARCHAR(255) NOT NULL DEFAULT 'cookie-policy',
    "policy_version" VARCHAR(20) NOT NULL DEFAULT '1',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "consent_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "visitor_id" UUID NOT NULL,
    "customer_id" UUID,
    "mode" VARCHAR(10) NOT NULL,
    "categories" JSONB NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "policy_version" VARCHAR(20) NOT NULL,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_legal_acceptance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "doc_type" VARCHAR(20) NOT NULL,
    "doc_version" VARCHAR(20) NOT NULL,
    "ip_address" INET,
    "user_agent" TEXT,
    "accepted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_legal_acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "storefront_doc_placements_tenant_id_placement_enabled_posit_idx" ON "storefront_doc_placements"("tenant_id", "placement", "enabled", "position");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_doc_placements_tenant_id_placement_source_kind_e_key" ON "storefront_doc_placements"("tenant_id", "placement", "source_kind", "entry_id");

-- CreateIndex
CREATE INDEX "consent_records_tenant_id_visitor_id_created_at_idx" ON "consent_records"("tenant_id", "visitor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "consent_records_tenant_id_customer_id_idx" ON "consent_records"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "platform_legal_acceptance_tenant_id_user_id_idx" ON "platform_legal_acceptance"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "platform_legal_acceptance_tenant_id_doc_type_doc_version_idx" ON "platform_legal_acceptance"("tenant_id", "doc_type", "doc_version");

-- CreateIndex
CREATE INDEX "content_entries_tenant_id_legal_kind_idx" ON "content_entries"("tenant_id", "legal_kind");

-- AddForeignKey
ALTER TABLE "storefront_doc_placements" ADD CONSTRAINT "storefront_doc_placements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_doc_placements" ADD CONSTRAINT "storefront_doc_placements_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "content_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_settings" ADD CONSTRAINT "consent_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_legal_acceptance" ADD CONSTRAINT "platform_legal_acceptance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_legal_acceptance" ADD CONSTRAINT "platform_legal_acceptance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Tenant-scoped storefront/consent tables: ENABLE + FORCE + tenant_isolation
-- on current_tenant_id() (defined in 20260527000100_rls). Every read/write
-- runs inside withTenant() — there is no pre-tenant read path to exempt.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "storefront_doc_placements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "storefront_doc_placements" FORCE ROW LEVEL SECURITY;
CREATE POLICY storefront_doc_placements_tenant_isolation ON "storefront_doc_placements"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "consent_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY consent_settings_tenant_isolation ON "consent_settings"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY consent_records_tenant_isolation ON "consent_records"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- platform_legal_acceptance: ENABLE only, NO FORCE. Read by the owner
-- connection during sign-up / dashboard boot before tenant context is set
-- (mirrors users/sessions/accounts). Queries pin tenant_id/user_id explicitly.
ALTER TABLE "platform_legal_acceptance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_legal_acceptance_tenant_isolation ON "platform_legal_acceptance"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
