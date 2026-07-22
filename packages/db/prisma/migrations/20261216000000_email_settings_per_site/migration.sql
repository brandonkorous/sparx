-- Per-SITE sender identity (docs/131 §3.4).
--
-- `email_settings` was keyed on tenant_id alone — literally one row per tenant —
-- while holding from_name / from_address / reply_to and the CAN-SPAM
-- physical_address rendered in every footer. A tenant running two unrelated
-- businesses therefore sent every Savory Donuts email as
-- "Bob's Parts <sales@bobsparts.com>", with Bob's postal address in the legal
-- footer. That is a compliance defect, not a branding preference: the footer
-- address is a statutory disclosure about WHO SENT THE MESSAGE.
--
-- It was also already internally inconsistent — `broadcasts` and
-- `scheduled_sends` carry property_id, so the send knew which business it was
-- for, and then resolved its identity through a table that did not.
--
-- property_id is REQUIRED with NO tenant-level fallback row. Email TEMPLATES
-- fall back (per-site override → tenant default) and should, because a template
-- is generic markup. An IDENTITY must not: the fallback is precisely the bug,
-- since it is what stamps the other business's name on the envelope. A site with
-- no row resolves to NULL fields and buildFrom() drops to the platform sender —
-- wrong-but-honest, rather than wrong-and-plausible.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. email_settings → (tenant_id, property_id)
--
-- Backfill targets each tenant's PRIMARY site, which is the correct reading of
-- the old data: with one row per tenant, that row WAS the tenant's only
-- business's identity, and the primary site is that business.
--
-- The loop + set_config is mandatory, not defensive. `email_settings` is
-- ENABLE+FORCE RLS and `sparx_owner` is a NON-SUPERUSER in production, so a bare
-- UPDATE sees zero rows, silently backfills nothing, and the NOT NULL below
-- fails the migration in prod after passing locally.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "email_settings" ADD COLUMN "property_id" UUID;

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE "email_settings" es
           SET "property_id" = (
               SELECT p.id FROM "properties" p
                WHERE p.tenant_id = t.id AND p.is_primary
                LIMIT 1
           )
         WHERE es.tenant_id = t.id;
    END LOOP;

    PERFORM set_config('app.tenant_id', '', true);
END $$;

-- A settings row whose tenant somehow has no primary site cannot be given an
-- owner, and a sender identity belonging to no business is exactly the state
-- this migration exists to remove. Dropping it restores the platform sender,
-- which is the same result the row would produce with all-NULL fields.
DELETE FROM "email_settings" WHERE "property_id" IS NULL;

ALTER TABLE "email_settings" ALTER COLUMN "property_id" SET NOT NULL;

ALTER TABLE "email_settings" DROP CONSTRAINT "email_settings_pkey";
ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_pkey"
    PRIMARY KEY ("tenant_id", "property_id");

-- Not redundant with the PK above. The composite key forces every LOOKUP to name
-- a tenant, so a query cannot reach across tenants even before RLS considers it;
-- this unique states the stronger fact the PK leaves open — ONE identity per
-- site, full stop — and is what makes Property→settings a real one-to-one.
CREATE UNIQUE INDEX "email_settings_property_id_key"
    ON "email_settings"("property_id");

-- Cascade, not SetNull: deleting a site deletes ITS sender identity. A NULL
-- property_id is unrepresentable here anyway (it is half the primary key), but
-- the intent matters independently — an orphaned identity row is one that reads
-- as some other business's.
ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Drop email_sending_domains.is_default
--
-- The default sending domain is now expressed once, at the right grain, by
-- email_settings.default_sending_domain_id — which this migration just made
-- per-site. The boolean was the same fact at the WRONG grain (one default per
-- tenant, so a donut domain could become the parts default), and two
-- representations of one fact are worse than either alone because they can
-- disagree with no way to tell which is right.
--
-- The domain rows themselves stay tenant-owned: a verified Mailgun domain is a
-- tenant resource, and more than one site may legitimately send from it.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "email_sending_domains" DROP COLUMN "is_default";
