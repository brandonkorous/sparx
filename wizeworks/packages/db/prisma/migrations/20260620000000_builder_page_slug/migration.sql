-- Builder: a URL slug for published SINGLETON pages (docs/44 §2.1).
-- Additive: a nullable column + a per-tenant unique index. No backfill — every
-- existing row keeps slug = NULL (Postgres treats NULLs as distinct in a unique
-- index, so all the slugless/collection pages coexist). RLS already ENABLE+FORCE
-- on builder_pages; a column add needs no policy change.

ALTER TABLE "builder_pages" ADD COLUMN "slug" VARCHAR(160);

CREATE UNIQUE INDEX "builder_pages_tenant_id_slug_key" ON "builder_pages" ("tenant_id", "slug");
