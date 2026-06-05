-- Multi-site host scheme → HIERARCHICAL (docs/49 §5).
--
-- Additional-site subdomains move from the flat, ambiguous `<tenant>-<property>`
-- join to `<property>.<tenant>.sparx.zone`. The flat form can't be split back into
-- tenant + property without a DB lookup (both slugs may contain hyphens), so any
-- resolver that loses the `domains`-table answer mis-reads the whole label as one
-- tenant and 404s a live site. The dotted form splits cleanly on the first dot.
-- (`mintZoneHost` now emits the dotted form; primary sites keep the bare
-- `<tenant>.sparx.zone`, unchanged.)
--
-- For every existing additional-site subdomain row this mints the new dotted host
-- as an ADDITIONAL domain row and transfers canonicality to it; the legacy
-- `<tenant>-<property>` row is kept (demoted to non-canonical) so existing links
-- keep resolving. No DNS change: `<tenant>.sparx.zone` is only a `*.sparx.zone`
-- wildcard match, so wildcard closest-encloser synthesis already covers
-- `<property>.<tenant>.sparx.zone`; per-host TLS is on-demand.
--
-- RLS: `domains` + `tenants` are non-RLS dispatch tables (read/written freely),
-- but `properties` is FORCE RLS — sparx_owner is non-superuser in prod, so it sees
-- ZERO property rows unless app.tenant_id is set. Hence the per-tenant loop +
-- set_config (mirrors 20260706000000_nav_into_builder). The `.sparx.zone` suffix is
-- hardcoded: this migrates real prod data, where the zone is always sparx.zone.

DO $$
DECLARE
  t         RECORD;
  p         RECORD;
  legacy    RECORD;
  old_host  text;
  new_host  text;
BEGIN
  FOR t IN SELECT id, slug FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    FOR p IN
      SELECT id, slug FROM properties
      WHERE tenant_id = t.id AND is_primary = false
    LOOP
      old_host := t.slug || '-' || p.slug || '.sparx.zone';
      new_host := p.slug || '.' || t.slug || '.sparx.zone';

      -- Only re-key the row that holds the exact legacy minted host, and only if
      -- the dotted host doesn't already exist (idempotent re-run / post-deploy
      -- sites that were minted dotted from the start).
      SELECT id, tenant_id, property_id, is_canonical
        INTO legacy
        FROM domains
       WHERE host = old_host AND type = 'subdomain';

      IF FOUND AND NOT EXISTS (SELECT 1 FROM domains WHERE host = new_host) THEN
        INSERT INTO domains (
          id, tenant_id, property_id, host, type, status, is_canonical,
          created_at, updated_at
        )
        VALUES (
          gen_random_uuid(), legacy.tenant_id, legacy.property_id, new_host,
          'subdomain', 'active', legacy.is_canonical, now(), now()
        );

        -- The dotted host inherited canonicality; demote the legacy alias.
        UPDATE domains
           SET is_canonical = false, updated_at = now()
         WHERE host = old_host;
      END IF;
    END LOOP;
  END LOOP;
END $$;
