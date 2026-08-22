-- A Piggles business's free web address follows its business name.
--
-- Issue #089. A tenant is born with a generated placeholder slug, and
-- provisioning mints its always-on subdomain from that placeholder
-- (`<placeholder>.piggles.site`). Piggles onboarding then renames the tenant to
-- the real business name and claims the matching slug — but for a while it did
-- not rewrite the `domains` row, so a salon called Halo & Hem had a slug of
-- `halo-and-hem` and a stored site address of `swift-horizon-4860.piggles.site`.
--
-- That row is a MIRROR, not the source. A `*.piggles.site` host is
-- self-describing: the renderer decodes the tenant straight out of the hostname
-- and never consults this table for it. So a drifted row does not merely look
-- wrong, it names a host that resolves to nothing — and it is the host the
-- console shows and links to.
--
-- The code half is fixed (piggles/apps/account/lib/business-slug.ts now claims
-- the host in the same transaction as the slug, and does so even when the slug
-- itself did not move). This is the businesses that already drifted.
--
-- ── SCOPE, AND WHY IT STOPS AT PIGGLES ──────────────────────────────────────
--
-- sparx tenants have the same shape of drift in this database. Repairing them
-- is not this migration's to make: their sites are live on those hosts, sparx
-- has its own onboarding Workspace step with its own rules about renaming, and
-- reaching into another product's data is exactly what the brand boundary
-- forbids. Piggles' rows are the ones proven wrong by a Piggles run.
--
-- ── SAFETY ──────────────────────────────────────────────────────────────────
--
--   * `subdomain` rows only. A domain the customer owns is theirs, is not
--     derivable from anything, and is never touched.
--   * Primary sites only — `<business>.<zone>`. A named site's host is
--     `<site>.<business>.<zone>` and gets the same treatment from the code path,
--     but no Piggles business has a second site yet, so this does not guess at
--     one.
--   * The target must be free. `domains.host` is globally unique across both
--     brands; a row whose corrected address is already claimed is left exactly
--     as it is rather than failing the release.
--   * Idempotent: re-running changes nothing, because a row already correct is
--     excluded by the `<>` on the last line.

UPDATE domains d
SET host = t.slug || '.' || substring(d.host FROM position('.' IN d.host) + 1),
    updated_at = now()
FROM tenants t, properties p
WHERE d.tenant_id = t.id
  AND d.property_id = p.id
  AND t.platform_brand = 'piggles'
  AND d.type = 'subdomain'
  AND p.is_primary
  -- One label in front of the zone: this is a primary site's host, not a named
  -- site's `<site>.<business>.<zone>`.
  AND d.host LIKE '%.piggles.site'
  AND position('.' IN replace(d.host, '.piggles.site', '')) = 0
  -- Nobody else already holds the corrected address.
  AND NOT EXISTS (
    SELECT 1 FROM domains other
    WHERE other.host = t.slug || '.' || substring(d.host FROM position('.' IN d.host) + 1)
      AND other.id <> d.id
  )
  AND d.host <> t.slug || '.' || substring(d.host FROM position('.' IN d.host) + 1);
