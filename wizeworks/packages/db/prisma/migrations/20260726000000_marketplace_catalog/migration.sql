-- Marketplace catalog spine (docs/60 §6) — the data-driven, dual-app marketplace.
--
-- `marketplace_publishers` is the publisher identity registry (Sparx-core,
-- tenant, partner). The FOUR per-category catalog tables share a common spine
-- (identity, media, publisher, pricing, status) + category columns; a uniform
-- adapter normalizes any row into one MarketplaceListing (D4). Listings are
-- publisher-owned and cross-tenant visible, so they are NOT canonically
-- tenant-scoped.
--
-- RLS (§6.3): catalog tables are ENABLE + FORCE with a `marketplace_visibility`
-- policy that shows published rows to everyone (incl. the public/no-tenant
-- path), a tenant its own drafts too, and lets only the owning tenant write —
-- while the no-tenant seed path (publisher_tenant_id NULL) writes Sparx-core
-- rows (NULL IS NOT DISTINCT FROM NULL → true). `marketplace_publishers` is a
-- NON-RLS registry (public catalog metadata, like the `tenants` dispatch row) —
-- allow-listed in scripts/rls-audit.ts.

-- CreateTable
CREATE TABLE "marketplace_publishers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" VARCHAR(20) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "owner_tenant_id" UUID,
    "website_url" VARCHAR(2048),
    "support_email" VARCHAR(255),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "marketplace_publishers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_blueprints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "tagline" VARCHAR(255),
    "description" TEXT,
    "media" JSONB NOT NULL DEFAULT '[]',
    "icon" VARCHAR(64),
    "accent" VARCHAR(9),
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    "changelog" TEXT,
    "publisher_id" UUID NOT NULL,
    "publisher_tenant_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'published',
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'public',
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "pricing_model" VARCHAR(20) NOT NULL DEFAULT 'free',
    "install_count" INTEGER NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "sort_weight" INTEGER NOT NULL DEFAULT 0,
    "vertical" VARCHAR(20) NOT NULL,
    "required_modules" VARCHAR(20)[],
    "contents" JSONB NOT NULL DEFAULT '{}',
    "definition" JSONB,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "marketplace_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_themes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "tagline" VARCHAR(255),
    "description" TEXT,
    "media" JSONB NOT NULL DEFAULT '[]',
    "icon" VARCHAR(64),
    "accent" VARCHAR(9),
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    "changelog" TEXT,
    "publisher_id" UUID NOT NULL,
    "publisher_tenant_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'published',
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'public',
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "pricing_model" VARCHAR(20) NOT NULL DEFAULT 'free',
    "install_count" INTEGER NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "sort_weight" INTEGER NOT NULL DEFAULT 0,
    "mood" VARCHAR(40),
    "color_family" VARCHAR(40),
    "density" VARCHAR(20),
    "industry" VARCHAR(40),
    "tokens" JSONB,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "marketplace_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_components" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "tagline" VARCHAR(255),
    "description" TEXT,
    "media" JSONB NOT NULL DEFAULT '[]',
    "icon" VARCHAR(64),
    "accent" VARCHAR(9),
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    "changelog" TEXT,
    "publisher_id" UUID NOT NULL,
    "publisher_tenant_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'published',
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'public',
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "pricing_model" VARCHAR(20) NOT NULL DEFAULT 'free',
    "install_count" INTEGER NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "sort_weight" INTEGER NOT NULL DEFAULT 0,
    "group" VARCHAR(20) NOT NULL,
    "kind" VARCHAR(20),
    "surfaces" VARCHAR(20)[],
    "tree" JSONB,
    "prop_spec" JSONB NOT NULL DEFAULT '[]',
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "marketplace_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_integrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "tagline" VARCHAR(255),
    "description" TEXT,
    "media" JSONB NOT NULL DEFAULT '[]',
    "icon" VARCHAR(64),
    "accent" VARCHAR(9),
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    "changelog" TEXT,
    "publisher_id" UUID NOT NULL,
    "publisher_tenant_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'published',
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'public',
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "pricing_model" VARCHAR(20) NOT NULL DEFAULT 'free',
    "install_count" INTEGER NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "sort_weight" INTEGER NOT NULL DEFAULT 0,
    "provider_slug" VARCHAR(80) NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "scopes" VARCHAR(60)[],
    "config_schema" JSONB,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "marketplace_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_publishers_slug_key" ON "marketplace_publishers"("slug");

-- CreateIndex
CREATE INDEX "marketplace_publishers_type_idx" ON "marketplace_publishers"("type");

-- CreateIndex
CREATE INDEX "marketplace_publishers_owner_tenant_id_idx" ON "marketplace_publishers"("owner_tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_blueprints_slug_key" ON "marketplace_blueprints"("slug");

-- CreateIndex
CREATE INDEX "marketplace_blueprints_status_visibility_idx" ON "marketplace_blueprints"("status", "visibility");

-- CreateIndex
CREATE INDEX "marketplace_blueprints_publisher_tenant_id_idx" ON "marketplace_blueprints"("publisher_tenant_id");

-- CreateIndex
CREATE INDEX "marketplace_blueprints_publisher_id_idx" ON "marketplace_blueprints"("publisher_id");

-- CreateIndex
CREATE INDEX "marketplace_blueprints_vertical_idx" ON "marketplace_blueprints"("vertical");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_themes_slug_key" ON "marketplace_themes"("slug");

-- CreateIndex
CREATE INDEX "marketplace_themes_status_visibility_idx" ON "marketplace_themes"("status", "visibility");

-- CreateIndex
CREATE INDEX "marketplace_themes_publisher_tenant_id_idx" ON "marketplace_themes"("publisher_tenant_id");

-- CreateIndex
CREATE INDEX "marketplace_themes_publisher_id_idx" ON "marketplace_themes"("publisher_id");

-- CreateIndex
CREATE INDEX "marketplace_themes_industry_idx" ON "marketplace_themes"("industry");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_components_slug_key" ON "marketplace_components"("slug");

-- CreateIndex
CREATE INDEX "marketplace_components_status_visibility_idx" ON "marketplace_components"("status", "visibility");

-- CreateIndex
CREATE INDEX "marketplace_components_publisher_tenant_id_idx" ON "marketplace_components"("publisher_tenant_id");

-- CreateIndex
CREATE INDEX "marketplace_components_publisher_id_idx" ON "marketplace_components"("publisher_id");

-- CreateIndex
CREATE INDEX "marketplace_components_group_idx" ON "marketplace_components"("group");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_integrations_slug_key" ON "marketplace_integrations"("slug");

-- CreateIndex
CREATE INDEX "marketplace_integrations_status_visibility_idx" ON "marketplace_integrations"("status", "visibility");

-- CreateIndex
CREATE INDEX "marketplace_integrations_publisher_tenant_id_idx" ON "marketplace_integrations"("publisher_tenant_id");

-- CreateIndex
CREATE INDEX "marketplace_integrations_publisher_id_idx" ON "marketplace_integrations"("publisher_id");

-- CreateIndex
CREATE INDEX "marketplace_integrations_kind_idx" ON "marketplace_integrations"("kind");

-- AddForeignKey
ALTER TABLE "marketplace_publishers" ADD CONSTRAINT "marketplace_publishers_owner_tenant_id_fkey" FOREIGN KEY ("owner_tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_blueprints" ADD CONSTRAINT "marketplace_blueprints_publisher_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "marketplace_publishers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_themes" ADD CONSTRAINT "marketplace_themes_publisher_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "marketplace_publishers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_components" ADD CONSTRAINT "marketplace_components_publisher_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "marketplace_publishers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_integrations" ADD CONSTRAINT "marketplace_integrations_publisher_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "marketplace_publishers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Row-level security (hand-edited; Prisma does not generate RLS) ────────────
--
-- The catalog tables are publisher-owned + cross-tenant visible, NOT canonically
-- tenant-scoped. `marketplace_visibility` (docs/60 §6.3):
--   • USING — a published row is visible to everyone (incl. no-tenant public
--     reads, where current_tenant_id() is NULL); a tenant additionally sees its
--     OWN unpublished drafts (publisher_tenant_id = current_tenant_id()).
--   • WITH CHECK — IS NOT DISTINCT FROM (not `=`) so the no-tenant seed/platform
--     path can write Sparx-core rows (NULL ⇔ NULL) while a tenant can write only
--     listings it owns and never a Sparx (NULL-publisher) row.
-- FORCE so even the table owner is bound (the seed runs as the non-owner
-- sparx_app role and is bound by ENABLE regardless; FORCE closes the owner hole).
--
-- `marketplace_publishers` carries no RLS — publisher identity is public catalog
-- metadata (a published listing names its publisher cross-tenant). Allow-listed
-- in scripts/rls-audit.ts SHARED_REFERENCE_TABLES.

ALTER TABLE "marketplace_blueprints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketplace_blueprints" FORCE ROW LEVEL SECURITY;
CREATE POLICY marketplace_visibility ON "marketplace_blueprints"
    USING ("status" = 'published' OR "publisher_tenant_id" = current_tenant_id())
    WITH CHECK ("publisher_tenant_id" IS NOT DISTINCT FROM current_tenant_id());

ALTER TABLE "marketplace_themes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketplace_themes" FORCE ROW LEVEL SECURITY;
CREATE POLICY marketplace_visibility ON "marketplace_themes"
    USING ("status" = 'published' OR "publisher_tenant_id" = current_tenant_id())
    WITH CHECK ("publisher_tenant_id" IS NOT DISTINCT FROM current_tenant_id());

ALTER TABLE "marketplace_components" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketplace_components" FORCE ROW LEVEL SECURITY;
CREATE POLICY marketplace_visibility ON "marketplace_components"
    USING ("status" = 'published' OR "publisher_tenant_id" = current_tenant_id())
    WITH CHECK ("publisher_tenant_id" IS NOT DISTINCT FROM current_tenant_id());

ALTER TABLE "marketplace_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketplace_integrations" FORCE ROW LEVEL SECURITY;
CREATE POLICY marketplace_visibility ON "marketplace_integrations"
    USING ("status" = 'published' OR "publisher_tenant_id" = current_tenant_id())
    WITH CHECK ("publisher_tenant_id" IS NOT DISTINCT FROM current_tenant_id());
