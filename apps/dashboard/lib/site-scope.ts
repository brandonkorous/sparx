// The ONE place the dashboard's "which site is active" rule lives. Pure — no
// server-only imports — so both the server scope helper (lib/sites) and the
// client switchers (the header breadcrumb, the Sites manager) share the exact
// same fallback instead of each re-deriving it. See docs/49 §6.
//
// `Property` is type-only imported from ./sites (erased under verbatimModuleSyntax),
// so importing this module into a client component never pulls in next/headers.

import type { Property } from './sites';

/** The dashboard's resolved site scope for a single server render. */
export interface SiteScope {
  /** All of the tenant's web properties, primary first. */
  sites: Property[];
  /** The site the dashboard is authoring, or `undefined` for a single-site
   *  tenant — there is no scoping axis there, so list pages never filter. */
  activePropertyId: string | undefined;
  /** True when the tenant runs more than one site. */
  multiSite: boolean;
}

/** Resolve the active property from an already-fetched site list + the switcher
 *  cookie's id: the cookie's site if it still names one, else the primary, else
 *  the first. `undefined` only when the tenant has no sites. */
export function resolveActiveProperty(
  sites: Property[],
  cookieId: string | null | undefined
): Property | undefined {
  if (sites.length === 0) return undefined;
  const byCookie =
    cookieId && sites.some((s) => s.id === cookieId)
      ? sites.find((s) => s.id === cookieId)
      : undefined;
  return byCookie ?? sites.find((s) => s.isPrimary) ?? sites[0];
}

/** Build a SiteScope from a fetched site list + cookie id. Single-site tenants
 *  get `activePropertyId: undefined` so list pages skip property filtering
 *  entirely (no behavior change from the pre-multi-site world). */
export function toSiteScope(sites: Property[], cookieId: string | null | undefined): SiteScope {
  const multiSite = sites.length > 1;
  return {
    sites,
    multiSite,
    activePropertyId: multiSite ? resolveActiveProperty(sites, cookieId)?.id : undefined,
  };
}

/** Translate a list page's optional `?site=` override into an api-rest
 *  `property` filter, given the resolved scope:
 *    - single-site tenant → `undefined` (never filter)
 *    - `?site=all`        → `undefined` (the whole tenant)
 *    - `?site=<id>`       → that id (a per-list override of the global switch)
 *    - absent             → the active site
 */
export function resolvePropertyFilter(
  scope: SiteScope,
  siteParam: string | undefined
): string | undefined {
  if (!scope.multiSite) return undefined;
  if (siteParam === 'all') return undefined;
  return siteParam ?? scope.activePropertyId;
}
