-- Remove the widget-shaped built-in content types (docs/51 §7).
--
-- feature / faq_item / editorial_section / module were never true "content
-- items" — they are page content, so they have been reclassified into builder
-- components (FAQ / FeatureGrid / EditorialSection in the builder registry), and
-- apps/web reads its marketing copy from hand-coded TS again. The TS source of
-- truth (packages/cms-schemas/src/builtins/*) and the marketing seed that
-- created the only live entries are removed in the same change.
--
-- Two steps:
--   1. Delete every ENTRY of these types across ALL tenants. content_entries is
--      FORCE RLS and sparx_owner is a non-superuser in prod (a blanket DELETE
--      would match 0 rows), so we loop tenants and set app.tenant_id per tenant
--      — the same RLS-aware pattern the tenant backfills use. Child
--      content_revisions / content_references rows follow via ON DELETE CASCADE.
--   2. Delete the platform built-in content_types rows (under the platform tenant
--      context, which the content_types RLS policy permits).
--
-- Irreversible: there is no down migration for a data deletion.

-- 1. Entries (+ cascading revisions / references) across every tenant.
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);
    DELETE FROM "content_entries"
    WHERE "type_key" IN ('feature', 'faq_item', 'editorial_section', 'module');
  END LOOP;
END $$;

-- 2. The platform built-in type definitions.
SET LOCAL app.tenant_id = '00000000-0000-0000-0000-000000000000';

DELETE FROM "content_types"
WHERE "tenant_id" = '00000000-0000-0000-0000-000000000000'
  AND "key" IN ('feature', 'faq_item', 'editorial_section', 'module');
