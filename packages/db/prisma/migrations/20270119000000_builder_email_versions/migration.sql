-- A restorable snapshot of a PUBLISHED email — one row per publish (docs/impl
-- transactional-email Slice 5). The email twin of builder_releases.
--
-- publishSilica used to be a one-way overwrite: silica_published_document held exactly the
-- last publish, so there was no way back from a bad publish except re-authoring by hand. For
-- a non-technical owner who just published a mistake to a LIVE transactional email, that's
-- the worst moment to have no undo.
--
-- Simpler than the site release/manifest tables: an email is ONE self-contained document, so
-- there's no multi-tree manifest — the whole silica EmailDocument is the unit, hashed
-- directly (content-addressed by `hash`) so a no-op republish doesn't add a duplicate row.
--
-- Additive only. Nothing outside the studio reads it, so there is no backfill here and none
-- of the FORCE-RLS backfill footgun. History simply begins accumulating from the next publish.

CREATE TABLE "builder_email_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "email_id" UUID NOT NULL,
    "document" JSONB NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "subject" VARCHAR(255) NOT NULL DEFAULT '',
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "builder_email_versions_pkey" PRIMARY KEY ("id")
);

-- The history list, newest first, scoped to one email.
CREATE INDEX "builder_email_versions_tenant_id_email_id_created_at_idx"
    ON "builder_email_versions" ("tenant_id", "email_id", "created_at");

ALTER TABLE "builder_email_versions"
    ADD CONSTRAINT "builder_email_versions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "builder_email_versions"
    ADD CONSTRAINT "builder_email_versions_email_id_fkey"
    FOREIGN KEY ("email_id") REFERENCES "builder_emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation. FORCE so a callsite that forgets withTenant() reads nothing rather than
-- leaking another tenant's email history.
ALTER TABLE "builder_email_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_email_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY builder_email_versions_tenant_isolation ON "builder_email_versions"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());
