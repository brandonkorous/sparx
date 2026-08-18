// Property (multi-site) resolution helpers (docs/49).
//
// A tenant has one-or-more web PROPERTIES (sites). Authoring + storefront reads
// scope to ONE property. Until host→property routing (Phase 2) and the dashboard
// site switcher (Phase 3) are everywhere, the default is always the tenant's
// PRIMARY property — so single-site tenants behave exactly as before.
//
// `properties` is FORCE RLS, so these lookups go through withTenant. property_id
// is application-tier scoping, not a security boundary (docs/49 §2).

import { withTenant } from '@wizeworks/db';
import type { AuthContext } from '@wizeworks/api-core/auth';
import { forbidden, notFound } from '@wizeworks/api-core/errors';
import { memberCanReachProperty } from '@wizeworks/auth';
import { createTtlCache } from './ttl-cache.js';

/**
 * The actor a site resolution is for.
 *
 * These helpers took a bare `tenantId` until per-member and per-key site access
 * arrived (docs/131 §3.2–3.3). They take the AUTH CONTEXT now because a tenant
 * no longer decides on its own which sites a caller may see — a donut-shop
 * employee and the owner are the same tenant and must get different answers.
 *
 * Widened to a structural subset rather than `AuthContext` itself so the
 * storefront/public paths, which have no authenticated actor, can pass a bare
 * `{ tenantId }` and read exactly as before.
 */
export type SiteActor = Pick<AuthContext, 'tenantId'> &
  Partial<Pick<AuthContext, 'role' | 'propertyAccess'>>;

/** The sites this actor may reach, or null when unrestricted. Null is NOT the
 *  same as "every current site is granted" — an unrestricted actor also reaches
 *  a site created tomorrow, a restricted one does not. */
function grantedIds(actor: SiteActor): string[] | null {
  const access = actor.propertyAccess;
  if (!access) return null;
  return access.granted;
}

/**
 * The sites a member is restricted to for a DASHBOARD LIST read (docs/131 §3.3
 * read-scoping), or `undefined` when unrestricted (sees every site).
 *
 * Unlike `resolveListScopeIds`, this is not driven by a `?property=all` param —
 * a management list is ALWAYS bounded by what the member may reach, with no way
 * to ask for more. Callers pass the result as a list-filter; the service ORs it
 * with tenant-wide (null-property) rows so a restricted member still sees shared
 * records, matching every other scoped read in this doc.
 *
 * Returns `undefined` (not `[]`) for an unrestricted member: an empty array
 * would filter to nothing, the opposite of "no restriction".
 */
export function reachableSiteIds(actor: SiteActor): string[] | undefined {
  return grantedIds(actor) ?? undefined;
}

/** Whether `propertyId` is within this actor's reach. */
function canReach(actor: SiteActor, propertyId: string): boolean {
  const access = actor.propertyAccess;
  if (!access) return true;
  return memberCanReachProperty(
    { role: actor.role ?? 'viewer', mode: access.mode, granted: access.granted },
    propertyId
  );
}

// Property-id resolution runs on EVERY public storefront read (host→propertyId) and
// each miss opens a withTenant interactive transaction — a scarce PgBouncer server
// slot — for a single-row lookup. The (tenant, slug|id)→propertyId mapping is stable,
// so a short per-pod TTL collapses that per-request transaction to ~one per key per
// window (the same P2028 relief as lib/domain.ts's host cache). Keys embed tenantId,
// so this is never a cross-tenant path — a stale id only ever names one of the SAME
// tenant's properties, and RLS still scopes the underlying reads regardless.
const propertyIdCache = createTtlCache<string>({ hitTtlMs: 60_000 });

// ── Model B per-site scoping (docs/49 §3) ──────────────────────────────────
// A product / content entry / media asset is visible on a site if it has NO scope
// rows (global — the default) OR a scope row for that site. The storefront resolves
// `propertyId` for EVERY public read (primary included), so the primary site shows
// only global + primary-scoped items, never another site's exclusive items.
// Single-site tenants have no scope rows → everything matches.
//
// The fragments themselves MOVED to `@wizeworks/db` (`src/site-scope.ts`) once the builder
// needed the same question answered when resolving a record page's preview target —
// a visibility filter with two spellings is one drift away from leaking another site's
// rows. Re-exported here so every existing `lib/property.js` import is untouched.
export {
  productSiteVisibilityWhere,
  contentSiteVisibilityWhere,
  collectionSiteVisibilityWhere,
  categorySiteVisibilityWhere,
  mediaSiteVisibilityWhere,
} from '@wizeworks/db';

/** Model B (docs/49 §3): default a NEW catalog item (product / collection / category)
 *  to the ACTIVE site, so "different catalogs per site" is the default the moment a
 *  tenant runs more than one. Mutates `body.propertyIds` in place ONLY when the caller
 *  left it undefined AND the tenant has >1 site; an explicit value (including `[]` =
 *  all sites) is honored verbatim, and single-site tenants stay unscoped. Shared by
 *  every create route so the default can't drift between products and collections/
 *  categories. `countSites` + `resolveActiveSite` are injected so this stays free of
 *  the Fastify request type AND unit-testable without a database. */
export async function defaultPropertyIdsToActiveSite(
  body: Record<string, unknown>,
  countSites: () => Promise<number>,
  resolveActiveSite: () => Promise<string>
): Promise<void> {
  if (body.propertyIds !== undefined) return;
  const siteCount = await countSites();
  if (siteCount <= 1) return;
  body.propertyIds = [await resolveActiveSite()];
}

/** The tenant's PRIMARY property id. Every tenant has exactly one (guaranteed by
 *  migration 20260626000000_properties + the partial-unique index). */
export async function resolvePrimaryPropertyId(tenantId: string): Promise<string> {
  return propertyIdCache.get(`primary:${tenantId}`, async () => {
    const row = await withTenant({ tenantId }, (tx) =>
      tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } })
    );
    if (!row) throw notFound('Property', `primary for tenant ${tenantId}`);
    return row.id;
  });
}

/** Resolve the property a request is scoped to. `requested` (e.g. the
 *  `x-sparx-property-id` header the dashboard site switcher sets, docs/49 Phase 3)
 *  wins when it names one of the tenant's OWN properties; otherwise the primary.
 *  RLS already scopes the lookup to the tenant, and an unknown id fails closed to
 *  the primary — a header can never reach another tenant's property. */
export async function resolvePropertyId(
  actor: SiteActor,
  requested?: string | null
): Promise<string> {
  const { tenantId } = actor;
  const granted = grantedIds(actor);

  if (requested) {
    const resolved = await propertyIdCache.get(`id:${tenantId}:${requested}`, async () => {
      const row = await withTenant({ tenantId }, (tx) =>
        tx.property.findUnique({ where: { id: requested }, select: { id: true } })
      );
      return row ? row.id : '';
    });
    // A site the actor may reach — the ordinary path.
    if (resolved && canReach(actor, resolved)) return resolved;
    // Either the id is not this tenant's, or it is a site this actor may not
    // reach. Both fall through to the default below rather than erroring: this
    // resolver serves a HEADER (the site switcher), and a stale header after a
    // grant is revoked should quietly land somewhere valid, not 403 the whole
    // dashboard. `requireTenantProperty` is the strict form for explicit targets.
  }

  // The default. For a restricted actor this is their FIRST GRANTED SITE, never
  // the tenant's primary — falling back to the primary is precisely how a donut
  // shop employee ends up looking at the machine shop, reached by sending no
  // header at all.
  if (granted) {
    if (granted.length === 0) throw forbidden('You do not have access to any site.');
    return granted[0]!;
  }
  return resolvePrimaryPropertyId(tenantId);
}

/** The explicit "every site" opt-out on a list's `?property=`. A word rather than
 *  an absent parameter because ABSENCE now means "the site I am working in" —
 *  see `resolveListScope`. */
export const ALL_SITES = 'all';

/**
 * Which site an ADMIN list is scoped to. Returns `undefined` for "every site".
 *
 * The rule, in one place because it must not drift between products, content and
 * customers:
 *
 *   ?property=<id>  → that site (falling back to primary if the id is not ours)
 *   ?property=all   → every site, unscoped
 *   (absent)        → `x-sparx-property-id`, else the tenant's primary
 *
 * ABSENCE MEANING "MY ACTIVE SITE" IS THE POINT. It used to mean "every site",
 * which put the burden on each caller to remember a parameter: the dashboard did,
 * the workbench and MCP did not, so switching sites changed the chrome while every
 * list kept showing the whole tenant. A default that depends on every present and
 * future caller remembering something is not a default. Cross-site reads are still
 * available — they are now just asked for out loud.
 *
 * `header` is passed in rather than read from a request so this stays free of the
 * Fastify types and unit-testable without a server.
 */
export async function resolveListScope(
  actor: SiteActor,
  requested: string | undefined,
  header: string | string[] | undefined
): Promise<string | undefined> {
  if (requested === ALL_SITES) {
    // "Every site" means every site THIS ACTOR MAY SEE, not every site the
    // tenant owns (docs/131 §3.3). Unrestricted callers still get undefined —
    // genuinely unscoped, exactly as before.
    //
    // This is the single most important line in the file. `?property=all` was
    // the documented way to read across sites, so without this a restricted
    // member reaches the other business's entire customer list by appending one
    // query parameter — no header to forge, no id to guess.
    const granted = grantedIds(actor);
    if (!granted) return undefined;
    if (granted.length === 0) throw forbidden('You do not have access to any site.');
    // A restricted actor with exactly one site collapses to that site, which is
    // both correct and the overwhelmingly common case.
    if (granted.length === 1) return granted[0];
    // More than one granted site cannot be expressed as a single id. Callers
    // that must support this take the multi-site path below rather than being
    // silently narrowed to one — see resolveListScopeIds.
    throw forbidden(
      'Reading across sites is not available on this endpoint for an account limited to specific sites.'
    );
  }
  if (requested) return resolvePropertyId(actor, requested);
  const active = Array.isArray(header) ? header[0] : header;
  return resolvePropertyId(actor, active ?? null);
}

/**
 * The multi-site form of `resolveListScope`, for endpoints that can filter on a
 * SET of sites rather than one.
 *
 * Returns `undefined` for genuinely unscoped, a one-element array for a single
 * site, or the actor's granted set when they asked for "all" and may see
 * several. Endpoints adopt this as their service layer learns `propertyId IN
 * (…)`; until then `resolveListScope` refuses that case rather than guessing,
 * because silently picking one of a member's three sites is a wrong answer
 * presented as a complete one.
 */
export async function resolveListScopeIds(
  actor: SiteActor,
  requested: string | undefined,
  header: string | string[] | undefined
): Promise<string[] | undefined> {
  if (requested === ALL_SITES) {
    const granted = grantedIds(actor);
    if (!granted) return undefined;
    if (granted.length === 0) throw forbidden('You do not have access to any site.');
    return granted;
  }
  const one = await resolveListScope(actor, requested, header);
  return one === undefined ? undefined : [one];
}

/** Validate that `propertyId` names one of the tenant's OWN properties, returning
 *  it; 404 otherwise. For an EXPLICIT target — e.g. the `property_id` in a
 *  blueprint-install body (docs/49 Phase 8) where the caller named a specific site
 *  — a silent fall-back to the primary (as `resolvePropertyId` does for a header)
 *  would quietly install into the wrong site and hide the mistake. RLS scopes the
 *  lookup, so a foreign-tenant id is indistinguishable from a non-existent one. */
export async function requireTenantProperty(actor: SiteActor, propertyId: string): Promise<string> {
  const row = await withTenant({ tenantId: actor.tenantId }, (tx) =>
    tx.property.findUnique({ where: { id: propertyId }, select: { id: true } })
  );
  if (!row) throw notFound('Property', propertyId);
  // A site the tenant owns but THIS ACTOR may not reach is reported as
  // not-found, not forbidden — deliberately indistinguishable from a
  // non-existent id, so the error cannot be used to enumerate which sites the
  // business runs. Same reasoning as the cross-tenant case above.
  if (!canReach(actor, row.id)) throw notFound('Property', propertyId);
  return row.id;
}

/** Storefront-side resolution: by stable property SLUG (the host→property mapping
 *  in Phase 2 passes it as `?property=`), else the tenant's primary. Keeps the
 *  public Builder reads single-site today (no `property` param → primary) while
 *  being forward-compatible with per-site hostnames. */
export async function resolvePublicPropertyId(
  tenantId: string,
  slug?: string | null
): Promise<string> {
  if (slug) {
    return propertyIdCache.get(`slug:${tenantId}:${slug}`, async () => {
      const row = await withTenant({ tenantId }, (tx) =>
        tx.property.findFirst({ where: { slug }, select: { id: true } })
      );
      return row ? row.id : resolvePrimaryPropertyId(tenantId);
    });
  }
  return resolvePrimaryPropertyId(tenantId);
}

/** The customer-facing SITE name (`Property.name`) a public/email read is scoped
 *  to: the active property (by id) when given, else the tenant's PRIMARY property.
 *  This is the ONLY name shown to customers (storefront chrome, email wordmark/
 *  footer, `{{site.name}}` copy) — NEVER the tenant's legal/org name (`Tenant.name`
 *  is billing/ownership only). The default site's name is seeded from the tenant
 *  name at provisioning, so a single-site tenant still reads a sensible name here.
 *  Returns '' only if the resolved property somehow has a blank name (NOT NULL in
 *  the schema, so effectively unreachable). */
export async function resolveActivePropertyName(
  tenantId: string,
  propertyId?: string | null
): Promise<string> {
  const row = await withTenant({ tenantId }, (tx) =>
    propertyId
      ? tx.property.findUnique({ where: { id: propertyId }, select: { name: true } })
      : tx.property.findFirst({ where: { isPrimary: true }, select: { name: true } })
  );
  return row?.name?.trim() ?? '';
}
