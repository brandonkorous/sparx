-- Drop the deprecated flat `<tenant>-<property>.sparx.zone` subdomain rows.
--
-- Migration 20260707000000_property_host_hierarchical moved additional sites to
-- the hierarchical `<property>.<tenant>.sparx.zone` host and DEMOTED the old flat
-- alias (kept it as a non-canonical row so existing links still resolved). Product
-- decision 2026-06-06: old flat URLs should 404, not linger as aliases — so remove
-- the flat row entirely.
--
-- This is data hygiene, not a routing change. The flat host already 404s for end
-- users: the site resolver decodes `*.sparx.zone` hosts by SHAPE (apps/site/lib/
-- tenant.ts → zoneSiteRoute) before any domains-table lookup, and a single
-- hyphenated label reads as a bogus one-label tenant that doesn't exist. The
-- demoted row only surfaced a dead URL in the dashboard/API. Deleting it leaves the
-- canonical dotted host (inserted by 20260707000000) as the property's only
-- subdomain row.
--
-- RLS: `domains` is a non-RLS dispatch table (DELETE runs freely), but `properties`
-- is FORCE RLS — sparx_owner is non-superuser in prod and sees ZERO property rows
-- unless app.tenant_id is set. Hence the per-tenant loop + set_config to read the
-- slugs that reconstruct the flat host (mirrors 20260707000000). The `.sparx.zone`
-- suffix is hardcoded: this migrates real prod data, where the zone is sparx.zone.

DO $$
DECLARE
  t         RECORD;
  p         RECORD;
  flat_host text;
BEGIN
  FOR t IN SELECT id, slug FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    FOR p IN
      SELECT id, slug FROM properties
      WHERE tenant_id = t.id AND is_primary = false
    LOOP
      flat_host := t.slug || '-' || p.slug || '.sparx.zone';
      DELETE FROM domains WHERE host = flat_host AND type = 'subdomain';
    END LOOP;
  END LOOP;
END $$;
