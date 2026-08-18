-- Site forms (docs/115). Two tenant-scoped tables: the durable submission inbox,
-- and the server-side routing config (recipient addresses) that is deliberately
-- kept out of the client-delivered published Builder tree. A visitor submits a
-- Builder contact/lead form (POST /v1/public/forms/submit); the row is always
-- stored (the backbone), and fan-out (owner email + autoresponder + CRM lead)
-- happens off `form.submitted` / `email.send`.
-- Both are FORCE RLS + tenant_isolation (current_tenant_id() defined in
-- 20260527000100_rls). New empty tables → no backfill, so no FORCE-RLS loop.

-- CreateTable
CREATE TABLE "form_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID,
    "form_node_id" VARCHAR(255) NOT NULL,
    "page_slug" VARCHAR(255),
    "form_name" VARCHAR(160),
    "name" VARCHAR(200),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "message" TEXT,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "context" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(20) NOT NULL DEFAULT 'new',
    "customer_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "form_node_id" VARCHAR(255) NOT NULL,
    "page_slug" VARCHAR(255),
    "recipients" VARCHAR(255)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(255)[],
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "form_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_submissions_tenant_id_created_at_idx" ON "form_submissions"("tenant_id", "created_at" DESC);
CREATE INDEX "form_submissions_tenant_id_status_created_at_idx" ON "form_submissions"("tenant_id", "status", "created_at" DESC);
CREATE INDEX "form_submissions_tenant_id_form_node_id_created_at_idx" ON "form_submissions"("tenant_id", "form_node_id", "created_at" DESC);
CREATE UNIQUE INDEX "form_definitions_property_node_unique" ON "form_definitions"("property_id", "form_node_id");
CREATE INDEX "form_definitions_tenant_id_idx" ON "form_definitions"("tenant_id");

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "form_definitions" ADD CONSTRAINT "form_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_definitions" ADD CONSTRAINT "form_definitions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security — hand-edited (Prisma does not generate RLS). Both tables
-- are tenant-scoped → ENABLE + FORCE + tenant_isolation. The public submit
-- endpoint writes these under withTenant() (SET LOCAL app.tenant_id), so the
-- tenant id is always server-derived from the slug, never client-supplied.
ALTER TABLE "form_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "form_submissions" FORCE  ROW LEVEL SECURITY;
CREATE POLICY form_submissions_tenant_isolation ON "form_submissions"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "form_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "form_definitions" FORCE  ROW LEVEL SECURITY;
CREATE POLICY form_definitions_tenant_isolation ON "form_definitions"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
