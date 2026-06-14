-- Chat conversation source 'storefront' → 'site' (store→site rename).
-- Context-aware: a chat can start on a CMS-only site with no store, so 'storefront'
-- wrongly implied commerce. (The commerce sales CHANNEL keeps 'storefront' — that
-- value is commerce-only by definition; this migration is ONLY the chat source.)

ALTER TABLE "chat_conversations" ALTER COLUMN "source" SET DEFAULT 'site';

-- Backfill existing rows. FORCE-RLS table → loop tenants + set_config so the
-- non-superuser prod owner actually sees the rows (memory: sparx_db_rls).
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);
        UPDATE "chat_conversations" SET "source" = 'site' WHERE "source" = 'storefront';
    END LOOP;
    PERFORM set_config('app.tenant_id', '', true);
END $$;
