-- Per-SITE redirects (docs/131 §3.8) and cookie consent (§3.9).
--
-- Two small models, two very different reasons, and the difference decides
-- whether the column is nullable.
--
-- REDIRECTS are addressed to a PATH, and two sites have entirely unrelated path
-- spaces — `/specials` means one thing on a donut site and another on a parts
-- site — so a tenant-wide 301 fired on domains it was never written for.
-- Nullable, because a genuinely shared rule exists: retiring `/old-contact`
-- across every site is one intent, not N. Most-specific-wins.
--
-- CONSENT is not a scoping preference. Permission granted on one storefront was
-- silently honoured on the other, which means tracking a person on a site they
-- never agreed to be tracked on — the precise thing consent law exists to
-- prevent. So property_id is NOT NULL with no tenant-wide tier: "which business
-- did this person agree to?" always has an answer, and inheriting a sibling's is
-- the defect rather than a convenience.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. redirects
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "redirects" ADD COLUMN "property_id" UUID;

-- Cascade: a rule about one site's URLs is meaningless once that site is gone,
-- and SetNull would PROMOTE it to every remaining domain — firing a redirect
-- written for a closed business on live ones.
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- Existing rows stay NULL (tenant-wide), which is the honest reading: they were
-- authored when there was one site, and they still apply to it. No backfill, so
-- no FORCE-RLS loop needed here.

-- NULLS NOT DISTINCT is load-bearing: without it two tenant-wide rules could
-- claim the same from_path, and "which redirect wins" would be decided by row
-- order. Postgres treats NULLs as distinct by default, so the plain compound
-- unique silently permits exactly the ambiguity this constraint exists to stop.
DROP INDEX IF EXISTS "redirects_tenant_id_from_path_key";
CREATE UNIQUE INDEX "redirects_tenant_id_property_id_from_path_key"
    ON "redirects"("tenant_id", "property_id", "from_path") NULLS NOT DISTINCT;

CREATE INDEX "redirects_tenant_property_idx" ON "redirects"("tenant_id", "property_id");

-- ─────────────────────────────────────────────────────────────────────────
-- 2. consent_settings → (tenant_id, property_id)
--
-- The loop + set_config is mandatory: both consent tables are ENABLE+FORCE RLS
-- and `sparx_owner` is a NON-SUPERUSER in production, so a bare UPDATE sees zero
-- rows, backfills nothing, and the SET NOT NULL below fails the migration in
-- prod after passing clean locally.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "consent_settings" ADD COLUMN "property_id" UUID;
ALTER TABLE "consent_records"  ADD COLUMN "property_id" UUID;

DO $$
DECLARE
    t RECORD;
    primary_id UUID;
BEGIN
    FOR t IN SELECT id FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        SELECT p.id INTO primary_id
          FROM "properties" p
         WHERE p.tenant_id = t.id AND p.is_primary
         LIMIT 1;

        UPDATE "consent_settings" SET "property_id" = primary_id WHERE tenant_id = t.id;
        UPDATE "consent_records"  SET "property_id" = primary_id WHERE tenant_id = t.id;
    END LOOP;

    PERFORM set_config('app.tenant_id', '', true);
END $$;

-- A consent row whose tenant has no primary site describes permission given to
-- no business. It cannot be assigned an owner and cannot be honoured, so it is
-- dropped rather than carried forward as an unattributable record.
DELETE FROM "consent_settings" WHERE "property_id" IS NULL;
DELETE FROM "consent_records"  WHERE "property_id" IS NULL;

ALTER TABLE "consent_settings" ALTER COLUMN "property_id" SET NOT NULL;
ALTER TABLE "consent_records"  ALTER COLUMN "property_id" SET NOT NULL;

ALTER TABLE "consent_settings" DROP CONSTRAINT "consent_settings_pkey";
ALTER TABLE "consent_settings" ADD CONSTRAINT "consent_settings_pkey"
    PRIMARY KEY ("tenant_id", "property_id");

-- One settings row per site (makes Property→settings a real one-to-one).
CREATE UNIQUE INDEX "consent_settings_property_id_key"
    ON "consent_settings"("property_id");

-- Cascade on BOTH, unlike chat conversations — and the contrast is deliberate.
-- A conversation is a record worth keeping after its site closes. A consent
-- record is only meaningful AS PERMISSION FOR a specific business: once that
-- business is gone the permission has no subject, and retaining personal data
-- (ip_address, user_agent) whose sole purpose has ended is the wrong default
-- under the very regimes that require the record in the first place.
ALTER TABLE "consent_settings" ADD CONSTRAINT "consent_settings_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- The lookup is now "what did this visitor agree to ON THIS SITE", so
-- property_id leads rather than trails.
DROP INDEX IF EXISTS "consent_records_tenant_id_visitor_id_created_at_idx";
CREATE INDEX "consent_records_tenant_property_visitor_idx"
    ON "consent_records"("tenant_id", "property_id", "visitor_id", "created_at" DESC);
