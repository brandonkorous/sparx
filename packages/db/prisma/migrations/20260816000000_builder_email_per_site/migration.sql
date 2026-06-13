-- Per-site email (docs/49 Phase 7b / docs/91 §6). A BuilderEmail optionally carries
-- a `key` (a provisioned built-in's identity — welcome-customer, …) and a
-- `property_id` (the site it belongs to). NULL property_id = tenant-wide: the 13
-- provisioned defaults and any tenant-level custom email. A non-null property_id is
-- a per-site override (a site's fork of a default) or a per-site custom email. The
-- override join the dispatch resolves is (tenant, property, key) → (tenant, key).
--
-- Purely additive: NULLABLE columns, no backfill, no NOT NULL — so no RLS loop.
-- SetNull FK: an override outlives its site, falling back to the tenant-wide default
-- rather than vanishing mid-flight. property_id is NOT a security boundary; tenant_id
-- + the unchanged builder_emails tenant_isolation policy are.

ALTER TABLE "builder_emails" ADD COLUMN "property_id" UUID;
ALTER TABLE "builder_emails" ADD COLUMN "key" VARCHAR(63);

ALTER TABLE "builder_emails"
    ADD CONSTRAINT "builder_emails_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial uniques (hand-SQL — Prisma can't express the WHERE predicate; cf.
-- properties_one_primary_per_tenant). One tenant-wide default per key, and one
-- per-site override per key; custom emails (key IS NULL) are unconstrained. These
-- also serve the getPublishedByKey reads (a query whose WHERE implies the predicate
-- uses the partial index).
CREATE UNIQUE INDEX "builder_emails_tenant_default_key"
    ON "builder_emails" ("tenant_id", "key")
    WHERE "key" IS NOT NULL AND "property_id" IS NULL;

CREATE UNIQUE INDEX "builder_emails_tenant_site_key"
    ON "builder_emails" ("tenant_id", "property_id", "key")
    WHERE "key" IS NOT NULL AND "property_id" IS NOT NULL;
