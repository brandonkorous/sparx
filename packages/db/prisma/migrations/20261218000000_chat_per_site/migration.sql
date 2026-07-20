-- Per-SITE live chat (docs/131 §3.7).
--
-- `chat_conversations.source` knew that A site was involved (site | sparx_market
-- | dashboard) but never WHICH. Three consequences, all live:
--
--   · the staff inbox merged every business into one queue behind one unread
--     badge, so a donut-shop employee triaged machine-shop threads;
--   · canned replies are business COPY, and a reply about fresh-baked donuts
--     surfaced in a parts conversation;
--   · the AI first responder had no site to answer AS, which is the other half
--     of the persona defect fixed in 20261217000000 — a per-site persona is
--     useless if the conversation cannot say which site it is on.
--
-- property_id is NULLABLE, but only for a genuine reason: a `dashboard`-sourced
-- conversation is staff talking to staff and has no customer-facing site. Every
-- `site`-sourced row must carry one, and the CHECK below enforces that rather
-- than trusting each caller to remember.

ALTER TABLE "chat_conversations" ADD COLUMN "property_id" UUID;
ALTER TABLE "chat_quick_replies" ADD COLUMN "property_id" UUID;

-- ─────────────────────────────────────────────────────────────────────────
-- Backfill: existing site conversations belong to the primary site.
--
-- The loop + set_config is mandatory — `chat_conversations` is FORCE RLS and
-- `sparx_owner` is a NON-SUPERUSER in production, so a bare UPDATE would see
-- zero rows, backfill nothing, and leave the CHECK below to fail the migration
-- in prod after passing locally.
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE "chat_conversations" c
           SET "property_id" = (
               SELECT p.id FROM "properties" p
                WHERE p.tenant_id = t.id AND p.is_primary
                LIMIT 1
           )
         WHERE c.tenant_id = t.id
           AND c.source <> 'dashboard';
    END LOOP;

    PERFORM set_config('app.tenant_id', '', true);
END $$;

-- SetNull, NOT Cascade — the opposite of the choice made for automations, API
-- keys, and AI policies, and deliberately so. Those are RULES: deleting a site
-- must narrow what they reach. A conversation is a RECORD OF SOMETHING THAT
-- HAPPENED — a real customer said real words to this business — and deleting the
-- site must not erase the support history. Same reasoning as orders and carts
-- (docs/58 D1).
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL;

-- Cascade here, because a quick reply is AUTHORED COPY for one business rather
-- than a record of an event. A tenant-wide reply (property_id NULL) is untouched.
ALTER TABLE "chat_quick_replies" ADD CONSTRAINT "chat_quick_replies_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- A customer-facing conversation with no site is the state this migration
-- exists to remove, so make it unrepresentable rather than merely unusual.
-- Written to tolerate the SetNull above: once a site is deleted its threads
-- legitimately hold NULL, so the constraint binds at INSERT time on the source,
-- not forever on the row.
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_site_has_property"
    CHECK ("source" = 'dashboard' OR "property_id" IS NOT NULL) NOT VALID;

-- NOT VALID + VALIDATE: checks existing rows without holding an ACCESS EXCLUSIVE
-- lock across the scan. Trivial at today's row counts, but the chat table is a
-- write-hot path and this is the cheap habit.
ALTER TABLE "chat_conversations" VALIDATE CONSTRAINT "chat_conversations_site_has_property";

-- The staff inbox now filters by site on its default query, so the composite it
-- already relied on needs property_id in front of the status/recency pair.
CREATE INDEX "chat_conversations_tenant_property_status_idx"
    ON "chat_conversations"("tenant_id", "property_id", "status", "last_message_at" DESC);

CREATE INDEX "chat_quick_replies_tenant_property_idx"
    ON "chat_quick_replies"("tenant_id", "property_id");
