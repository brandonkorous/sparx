-- Platform COMPONENT CATALOG (docs/98 §5) — the DB-backed home for the
-- platform's component library. A global table (no tenant_id): every tenant
-- can read published rows; only platform admins write.
--
-- A persisted catalog entry: key/name/category/kind/icon/description/surfaces/
-- tags/tree mirror the data-as-code `PlatformCatalogEntry`, so a published row
-- is palette-renderable. `category` and `surfaces` are validated STRINGS (the
-- shared CatalogCategory / ComponentSurface vocabulary in @sparx/builder-schemas)
-- rather than DB enums — category slugs are hyphenated ('data-display'), invalid
-- as Postgres enum identifiers, and this matches the package's "validated by
-- builder-schemas, never the DB" convention (cf. the `tree` JSON column).
--
-- RLS approach (deliberate, non-standard):
--   • This table is GLOBAL, not per-tenant. FORCE RLS is still applied so
--     the sparx_app role cannot bypass it.
--   • policy 1 (select_published) — PERMISSIVE, FOR SELECT, TO sparx_app:
--     the app role can only see rows WHERE status = 'published'.
--   • policy 2 (owner_all) — PERMISSIVE, FOR ALL, TO sparx_owner:
--     the owner/migration role is unrestricted (used by migrations and the
--     seed pipeline). The platform-admin JWT tier (docs/16 §2.4, deferred)
--     will extend this when it ships.
--   • API layer enforces: requireRole(request, 'owner') for writes and
--     non-published reads; requireRole(request, 'viewer') for published GET.
--   • This is documented in packages/db/CLAUDE.md §Global tables.
--
-- No backfill needed — the static data-as-code catalog in
-- packages/builder-schemas/src/catalog/ remains the published source until
-- seed rows are inserted through the pipeline.

-- Enums
CREATE TYPE "platform_component_kind" AS ENUM ('common', 'comprehensive');
CREATE TYPE "platform_component_status" AS ENUM ('draft', 'submitted', 'in_review', 'approved', 'published', 'archived', 'rejected');
CREATE TYPE "platform_component_visibility" AS ENUM ('public', 'private');

-- CreateTable
CREATE TABLE "platform_components" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "kind" "platform_component_kind" NOT NULL,
    "icon" VARCHAR(64) NOT NULL,
    "description" VARCHAR(280) NOT NULL,
    "surfaces" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "tree" JSONB NOT NULL,
    "behaviors" JSONB,
    "thumbnail" VARCHAR(2048),
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "platform_component_status" NOT NULL DEFAULT 'draft',
    "author_id" VARCHAR(255) NOT NULL,
    "reviewer_id" VARCHAR(255),
    "version" INTEGER NOT NULL DEFAULT 1,
    "visibility" "platform_component_visibility" NOT NULL DEFAULT 'public',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "platform_components_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_components_key_key" ON "platform_components" ("key");
CREATE INDEX "platform_components_status_idx" ON "platform_components" ("status");
CREATE INDEX "platform_components_kind_idx" ON "platform_components" ("kind");
CREATE INDEX "platform_components_category_idx" ON "platform_components" ("category");

-- Row Level Security (GLOBAL table — see comment above for rationale)
ALTER TABLE "platform_components" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_components" FORCE ROW LEVEL SECURITY;

-- The application role (sparx_app) can only SELECT published rows.
CREATE POLICY platform_components_select_published ON "platform_components"
    AS PERMISSIVE FOR SELECT
    TO sparx_app
    USING (status = 'published');

-- The owner/migration role (sparx_owner) is unrestricted.
CREATE POLICY platform_components_owner_all ON "platform_components"
    AS PERMISSIVE FOR ALL
    TO sparx_owner
    USING (true)
    WITH CHECK (true);
