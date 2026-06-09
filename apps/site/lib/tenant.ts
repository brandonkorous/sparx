// Tenant + site resolution from the incoming Host header.
//
// Resolution order (resolveSiteRoute):
//   1. Dev-fallback headers (`x-tenant-slug` / `x-property-slug`, set by the proxy
//      from `?tenant=` / `?property=` in local dev — no per-tenant DNS needed).
//   2. Our own `*.sparx.zone` subdomains, decoded STRUCTURALLY from the host
//      (zoneSiteRoute): `<tenant>.sparx.zone` → primary, `<property>.<tenant>.
//      sparx.zone` → that site. Self-describing, so no API round-trip.
//   3. Arbitrary CUSTOM domains → the domains table via api-rest (fetchSiteByHost).
//
// The tenant payload also carries the tenant's storefront THEME and commerce
// DEFAULTS so the root layout resolves colors/fonts/currency in a single fetch
// (see app/layout.tsx + lib/theme.ts).

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
  colorBorder: string | null;
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

/** The site a request routes to: which TENANT and which of its web PROPERTIES
 *  (sites). `propertySlug` is null for the tenant's primary site (api-rest then
 *  defaults to it), so single-site tenants need no property at all. */
export interface SiteRoute {
  tenantSlug: string;
  propertySlug: string | null;
}

/** Decode one of OUR `*.sparx.zone` subdomains into its tenant + property.
 *
 *  These hosts are SELF-DESCRIBING — api-rest's `mintZoneHost` encodes the tenant
 *  (and property) directly in the hostname — so we resolve them from the host
 *  alone, with no API round-trip. That makes zone hosts immune to a stale or
 *  unreachable `site-by-host` lookup (the domains table is just a mirror of this
 *  deterministic minting). Custom domains, whose mapping is arbitrary, return null
 *  here and fall through to the domains table.
 *
 *    `<tenant>.sparx.zone`            → primary site            (propertySlug null)
 *    `<property>.<tenant>.sparx.zone` → that tenant's named site
 *
 *  A legacy flat `<tenant>-<property>` host is a single label here, so it decodes
 *  as a (usually non-existent) tenant slug and 404s — deprecated in favour of the
 *  dotted form (migration 20260707000000); the dotted host is now canonical. */
export function zoneSiteRoute(host: string | null | undefined): SiteRoute | null {
  if (!host) return null;
  const noPort = host.split(':')[0]?.toLowerCase();
  if (!noPort) return null;
  const suffix = `.${ZONE_DOMAIN}`;
  if (noPort === ZONE_DOMAIN || !noPort.endsWith(suffix)) return null;
  const labels = noPort.slice(0, -suffix.length).split('.');
  if (labels.length === 1 && labels[0]) {
    return { tenantSlug: labels[0], propertySlug: null };
  }
  if (labels.length === 2 && labels[0] && labels[1]) {
    return { tenantSlug: labels[1], propertySlug: labels[0] };
  }
  // Three+ labels aren't a shape we mint.
  return null;
}

// Ask api-rest to map a CUSTOM-domain Host header → { tenantSlug, propertySlug }
// via the non-RLS domains table (docs/49 §5). Only reached for hosts that are NOT
// our own `*.sparx.zone` subdomains (those are decoded structurally by
// zoneSiteRoute, with no API round-trip) — a custom domain's mapping is arbitrary,
// so the domains table is its only source of truth. Null on miss/unreachable.
//
// `cache: 'no-store'`: host→site routing is correctness-critical and cheap (one
// indexed unique lookup), so read it live rather than risk the data cache serving
// a stale negative that would 404 a live custom domain.
async function fetchSiteByHost(host: string): Promise<SiteRoute | null> {
  try {
    const res = await fetch(`${BASE_URL}/v1/public/site-by-host?host=${encodeURIComponent(host)}`, {
      cache: 'no-store',
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

// Resolves the active site (tenant + property). Order: dev-fallback headers (set
// by the proxy from `?tenant=` / `?property=`), then our self-describing
// `*.sparx.zone` subdomains decoded straight from the host, then the domains-table
// lookup for arbitrary custom domains.
export const resolveSiteRoute = cache(async (): Promise<SiteRoute | null> => {
  const hdrs = await headers();
  // The proxy stashes the dev-fallback slugs here so Server Components can read
  // them without re-parsing searchParams on every page.
  const devTenant = hdrs.get('x-tenant-slug');
  if (devTenant) {
    return { tenantSlug: devTenant, propertySlug: hdrs.get('x-property-slug') };
  }
  // The real public host can arrive on EITHER header: behind Caddy (GKE) the
  // original `Host` is preserved, while a proxy that rewrites Host (e.g. Cloud Run)
  // carries the public host on `x-forwarded-host`. Consider both — for OUR
  // self-describing `*.sparx.zone` subdomains only the real host parses to a valid
  // tenant/property structure, so trying both is unambiguous and immune to whichever
  // header the ingress populates.
  const candidates = [hdrs.get('x-forwarded-host'), hdrs.get('host')].filter(
    (h): h is string => !!h
  );
  const primaryHost = candidates[0];
  if (!primaryHost) return null;

  // Our own subdomains are self-describing — decode tenant + property straight
  // from the host. No API round-trip, so a stale/unreachable site-by-host can
  // never 404 a live tenant site.
  for (const cand of candidates) {
    const zoneRoute = zoneSiteRoute(cand);
    if (zoneRoute) return zoneRoute;
  }

  // Custom domain: the domains table is the only source of truth.
  return fetchSiteByHost(primaryHost);
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
