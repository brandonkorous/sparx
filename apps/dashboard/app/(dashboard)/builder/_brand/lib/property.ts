import 'server-only';

// Origin of the tenant's live web property (its public site), used as the src of
// preview iframes in the Builder editors.
//
// Tenant sites run at <slug>.sparx.zone in prod (the same convention the CMS
// preview link uses). `SPARX_STOREFRONT_URL` is a LOCAL-DEV override — set it
// when the site app runs somewhere other than the default dev port. In local dev
// (NODE_ENV !== 'production') we otherwise point the preview at the local site
// automatically, so the editor reflects DRAFT changes BEFORE publishing without
// every dev having to wire the env var. It is never used in prod, where a
// localhost iframe would trip the browser's "access other apps on this device"
// prompt and refuse to connect.
//
// The local site app resolves the tenant from the `?tenant=<slug>` query the
// editor shell already appends to the iframe src (no *.sparx.zone DNS needed).
const ZONE_DOMAIN = process.env.NEXT_PUBLIC_SPARX_ZONE_DOMAIN ?? 'sparx.zone';
const DEV_PROPERTY_URL = 'http://localhost:3004'; // apps/site: next dev --port 3004

export function propertyOrigin(
  tenantSlug: string,
  property?: { slug: string; isPrimary: boolean } | null
): string {
  const devOverride = process.env.SPARX_STOREFRONT_URL;
  if (devOverride) return devOverride;
  if (process.env.NODE_ENV !== 'production') return DEV_PROPERTY_URL;
  // Multi-site (docs/49): a SECONDARY site lives at <property>.<tenant>.sparx.zone;
  // the primary (or a single-site tenant) at <tenant>.sparx.zone. zoneSiteRoute in
  // apps/site decodes both shapes straight from the host, so the preview tab lands
  // on the right site without per-site DNS.
  const host =
    property && !property.isPrimary
      ? `${property.slug}.${tenantSlug}.${ZONE_DOMAIN}`
      : `${tenantSlug}.${ZONE_DOMAIN}`;
  return `https://${host}`;
}
