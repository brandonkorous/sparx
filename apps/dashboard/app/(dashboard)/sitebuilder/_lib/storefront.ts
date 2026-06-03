import 'server-only';

// Origin of the tenant's live storefront, used as the src of preview iframes in
// the customizer and the page builders.
//
// Tenant storefronts run at <slug>.sparx.zone in prod (the same convention the
// CMS preview link uses). `SPARX_STOREFRONT_URL` is a LOCAL-DEV override — set
// it when the storefront runs somewhere other than the default dev port. In
// local dev (NODE_ENV !== 'production') we otherwise point the preview at the
// local storefront automatically, so the customizer reflects DRAFT changes
// BEFORE publishing without every dev having to wire the env var. It is never
// used in prod, where a localhost iframe would trip the browser's "access other
// apps on this device" prompt and refuse to connect.
//
// The local storefront resolves the tenant from the `?tenant=<slug>` query the
// editor shell already appends to the iframe src (no *.sparx.zone DNS needed).
const ZONE_DOMAIN = process.env.NEXT_PUBLIC_SPARX_ZONE_DOMAIN ?? 'sparx.zone';
const DEV_STOREFRONT_URL = 'http://localhost:3004'; // apps/site: next dev --port 3004

export function storefrontOrigin(slug: string): string {
  const devOverride = process.env.SPARX_STOREFRONT_URL;
  if (devOverride) return devOverride;
  if (process.env.NODE_ENV !== 'production') return DEV_STOREFRONT_URL;
  return `https://${slug}.${ZONE_DOMAIN}`;
}
