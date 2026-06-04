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

export function propertyOrigin(slug: string): string {
  const devOverride = process.env.SPARX_STOREFRONT_URL;
  if (devOverride) return devOverride;
  if (process.env.NODE_ENV !== 'production') return DEV_PROPERTY_URL;
  return `https://${slug}.${ZONE_DOMAIN}`;
}
