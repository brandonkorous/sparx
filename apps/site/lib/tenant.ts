// Tenant resolution from the incoming Host header.
//
// Three lookup orders, in priority:
//   1. Exact match on `tenants.primary_domain`           (e.g. acme.com)
//   2. Subdomain of sparx.zone                           (e.g. acme.sparx.zone → slug=acme)
//   3. Query-param fallback for local dev                (?tenant=foo)
//
// The api-rest endpoint /v1/public/tenants/:slug accepts a slug, so case 1
// would technically need a second endpoint that resolves by primary_domain.
// That's deferred — for now we only handle case 2 (subdomain) and case 3
// (dev fallback). Custom domains land when tenants need them.
//
// The tenant payload now also carries the tenant's storefront THEME and
// commerce DEFAULTS so the root layout resolves colors/fonts/currency in a
// single fetch (see app/layout.tsx + lib/theme.ts).

import { headers } from 'next/headers';
import { cache } from 'react';

const BASE_URL = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';
const ZONE_DOMAIN = process.env.SPARX_ZONE_DOMAIN ?? 'sparx.zone';

/** Per-tenant theme overrides. Every field is nullable — null means "fall
 *  back to the default theme token" (see lib/theme.ts). Mirrors the
 *  StorefrontTheme model. */
export interface TenantTheme {
  colorPrimary: string | null;
  colorPrimaryForeground: string | null;
  colorAccent: string | null;
  colorBackground: string | null;
  colorMuted: string | null;
  fontHeading: string | null;
  fontBody: string | null;
  radiusBase: string | null;
  logoMediaId: string | null;
  logoDarkMediaId: string | null;
  faviconMediaId: string | null;
}

/** Commerce-relevant storefront defaults (currency, locale, gating). */
export interface TenantStorefront {
  defaultCurrency: string;
  defaultLocale: string;
  showStockBelow: number;
  hidePricesWhenSignedOut: boolean;
  requireAuthForCheckout: boolean;
}

/** Cookie-consent config (docs/42 §4) — travels in the tenant payload so the
 *  layout decides off/quiet-notice/banner server-side with no client flash. */
export interface TenantConsent {
  mode: 'off' | 'gdpr' | 'ccpa';
  categories: string[];
  activeCategories: string[];
  bannerEnabled: boolean;
  bannerTitle: string | null;
  bannerBody: string | null;
  policyPageSlug: string;
  policyVersion: string;
}

export interface ResolvedTenant {
  id: string;
  slug: string;
  name: string;
  settings: Record<string, unknown>;
  theme: TenantTheme | null;
  storefront: TenantStorefront;
  consent: TenantConsent;
  // Site-wide social links (a SITE setting on the tenant, not brand/theme —
  // docs/45 §3): an ordered { platform, url }[] the layout chrome binds
  // `site.social` to.
  socials: { platform: string; url: string }[];
}

// The API also returns `businessName` (the tenant-level brand display name,
// docs/30 §6). We collapse it into `name` at this boundary so every storefront
// surface (header, footer, title, hero) shows the brand name with zero extra
// wiring, falling back to the legal tenant name when brand has none set.
interface TenantApiResponse {
  success: boolean;
  data?: ResolvedTenant & { businessName?: string | null };
  error?: { code: string; message: string };
}

const DEFAULT_STOREFRONT: TenantStorefront = {
  defaultCurrency: 'USD',
  defaultLocale: 'en-US',
  showStockBelow: 10,
  hidePricesWhenSignedOut: false,
  requireAuthForCheckout: false,
};

// Consent defaults to 'off' (no banner, no consent cookie) so storefronts
// served by an older api-rest that doesn't yet return `consent` behave exactly
// as before.
const DEFAULT_CONSENT: TenantConsent = {
  mode: 'off',
  categories: ['strictly_necessary', 'preferences', 'analytics', 'marketing'],
  activeCategories: [],
  bannerEnabled: false,
  bannerTitle: null,
  bannerBody: null,
  policyPageSlug: 'cookie-policy',
  policyVersion: '1',
};

// Extracts the tenant slug from a host like `acme.sparx.zone` → `acme`.
// Returns null when the host isn't a sparx.zone subdomain. Strips port.
export function slugFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const noPort = host.split(':')[0]?.toLowerCase();
  if (!noPort) return null;
  const suffix = `.${ZONE_DOMAIN}`;
  if (noPort === ZONE_DOMAIN) return null;
  if (!noPort.endsWith(suffix)) return null;
  const sub = noPort.slice(0, -suffix.length);
  // Reject deeper subdomains (foo.bar.sparx.zone) — only single-level for now.
  if (sub.includes('.') || sub.length === 0) return null;
  return sub;
}

/** The site a request routes to: which TENANT and which of its web PROPERTIES
 *  (sites). `propertySlug` is null for the tenant's primary site (api-rest then
 *  defaults to it), so single-site tenants need no property at all. */
export interface SiteRoute {
  tenantSlug: string;
  propertySlug: string | null;
}

// Ask api-rest to map a Host header → { tenantSlug, propertySlug } via the
// non-RLS domains table (docs/49 §5). Covers connected custom domains AND
// additional-site `<tenant>-<prop>.sparx.zone` subdomains, which a bare slug
// extraction can't. Null on miss → the caller falls back to subdomain parsing.
async function fetchSiteByHost(host: string): Promise<SiteRoute | null> {
  try {
    const res = await fetch(`${BASE_URL}/v1/public/site-by-host?host=${encodeURIComponent(host)}`, {
      next: { revalidate: 300, tags: [`site-host:${host}`] },
    });
    const json = (await res.json()) as
      | { success: true; data: { tenantSlug: string; propertySlug: string } }
      | { success: false };
    if (!res.ok || !json.success) return null;
    return { tenantSlug: json.data.tenantSlug, propertySlug: json.data.propertySlug };
  } catch {
    return null;
  }
}

// Resolves the active site (tenant + property). Order: dev-fallback headers
// (set by the proxy from `?tenant=` / `?property=`), then the host→property
// lookup, then bare `<tenant>.sparx.zone` subdomain parsing (primary site).
export const resolveSiteRoute = cache(async (): Promise<SiteRoute | null> => {
  const hdrs = await headers();
  // The proxy stashes the dev-fallback slugs here so Server Components can read
  // them without re-parsing searchParams on every page.
  const devTenant = hdrs.get('x-tenant-slug');
  if (devTenant) {
    return { tenantSlug: devTenant, propertySlug: hdrs.get('x-property-slug') };
  }
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
  if (host) {
    const byHost = await fetchSiteByHost(host);
    if (byHost) return byHost;
    const slug = slugFromHost(host);
    if (slug) return { tenantSlug: slug, propertySlug: null };
  }
  return null;
});

/** The active web property slug for this request (null = the tenant's primary
 *  site). Threaded into the per-property Builder reads as `?property=`. */
export async function resolveActivePropertySlug(): Promise<string | null> {
  return (await resolveSiteRoute())?.propertySlug ?? null;
}

// Cached per-request so layout + page can both resolve the tenant without a
// double fetch. React.cache() dedupes within a single server render.
export const resolveTenant = cache(async (): Promise<ResolvedTenant | null> => {
  const route = await resolveSiteRoute();
  if (!route) return null;
  const { tenantSlug: slug, propertySlug } = route;

  try {
    // `?property=` makes the payload reflect the active site's brand override
    // (docs/49 §3) — absent for the primary site, so its payload is unchanged.
    const propertyParam = propertySlug ? `?property=${encodeURIComponent(propertySlug)}` : '';
    const res = await fetch(
      `${BASE_URL}/v1/public/tenants/${encodeURIComponent(slug)}${propertyParam}`,
      {
        next: {
          revalidate: 300,
          tags: propertySlug
            ? [`tenant:${slug}`, `tenant:${slug}:${propertySlug}`]
            : [`tenant:${slug}`],
        },
      }
    );
    const json = (await res.json()) as TenantApiResponse;
    if (!res.ok || !json.success || !json.data) return null;
    const { businessName, ...data } = json.data;
    const display = businessName?.trim();
    return {
      ...data,
      name: display && display.length > 0 ? display : data.name,
      storefront: data.storefront ?? DEFAULT_STOREFRONT,
      consent: data.consent ?? DEFAULT_CONSENT,
      // Defaults to [] so a storefront served by an older api-rest that doesn't
      // yet return `socials` behaves exactly as before (no links).
      socials: data.socials ?? [],
    };
  } catch {
    return null;
  }
});
