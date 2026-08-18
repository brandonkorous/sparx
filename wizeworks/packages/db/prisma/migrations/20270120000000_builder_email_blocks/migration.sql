-- A tenant's SAVED EMAIL BLOCKS (docs/impl transactional-email Slice 9) — the
-- account-level, server-backed library that silicaui's EmailBuilder renders via its
-- `savedBlocks` controlled prop, replacing silica's browser-localStorage default.
--
-- Before this, "Save as block" wrote to a fixed localStorage key: the library was
-- trapped in one browser, lost on a device or user change, and unshareable. Making the
-- host own the list (controlled mode) turns it into an account-level library that
-- follows the whole team across devices and is shared tenant-wide.
--
-- Each row is a named, self-contained EmailNode snapshot (a section / card / CTA). The
-- builder deep-clones + re-stamps ids on every insert, so a block is a template, never a
-- live master — this stored copy is never mutated after save.
--
-- Additive only. No backfill (a browser's existing localStorage blocks migrate lazily at
-- runtime: the host reads them once on first mount, uploads them, then clears local), so
-- none of the FORCE-RLS backfill footgun. The library simply begins empty per tenant.

CREATE TABLE "builder_email_blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "node" JSONB NOT NULL,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "builder_email_blocks_pkey" PRIMARY KEY ("id")
);

-- The library list for a tenant, newest first.
CREATE INDEX "builder_email_blocks_tenant_id_created_at_idx"
    ON "builder_email_blocks" ("tenant_id", "created_at");

ALTER TABLE "builder_email_blocks"
    ADD CONSTRAINT "builder_email_blocks_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation. FORCE so a callsite that forgets withTenant() reads nothing rather
-- than leaking another tenant's saved-block library.
ALTER TABLE "builder_email_blocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_email_blocks" FORCE ROW LEVEL SECURITY;
CREATE POLICY builder_email_blocks_tenant_isolation ON "builder_email_blocks"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());
