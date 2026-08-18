-- Move social links OUT of brand identity and onto the tenant as a SITE setting
-- (docs/45 §3). Social links are not brand identity and must not change when the
-- storefront theme changes; they are edited in /settings/general alongside the
-- site name and contact email, and persist on the dispatch `tenants` row (same
-- place those settings already live).
--
-- Shape: an ORDERED array of { platform, url } — the same shape the storefront
-- `site.social` binding renders. `platform` is a known key (instagram, x, …) for
-- icon mapping, or a free-text label for an "Other" link.
--
-- The `tenants` table is RLS-exempt (the dispatch table), so the new column is a
-- plain ADD. The source `tenant_brands` table is ENABLE+FORCE RLS, so the
-- backfill SELECT returns zero rows for the non-superuser migration runner unless
-- a tenant GUC is set — we loop tenants and pin `app.tenant_id` per row before
-- copying (the `tenants` UPDATE itself is unaffected by RLS).

ALTER TABLE "tenants" ADD COLUMN "socials" JSONB NOT NULL DEFAULT '[]';

-- Preserve any social links a tenant already entered in Brand & Theme, converting
-- the old `{ platform: url }` map into the new `[{ platform, url }]` array shape.
DO $$
DECLARE
  t   RECORD;
  src JSONB;
  arr JSONB;
BEGIN
  FOR t IN SELECT id FROM "tenants" LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);
    SELECT "socials" INTO src FROM "tenant_brands" WHERE "tenant_id" = t.id;
    IF src IS NOT NULL AND jsonb_typeof(src) = 'object' AND src <> '{}'::jsonb THEN
      SELECT COALESCE(
               jsonb_agg(jsonb_build_object('platform', k, 'url', v) ORDER BY k),
               '[]'::jsonb
             )
        INTO arr
        FROM jsonb_each_text(src) AS e(k, v)
        WHERE v IS NOT NULL AND v <> '';
      UPDATE "tenants" SET "socials" = arr WHERE "id" = t.id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE "tenant_brands" DROP COLUMN "socials";
