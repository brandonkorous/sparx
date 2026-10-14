// Path ⇄ surface, in both directions.
//
// Deliberately hand-rolled and dependency-free. This module is imported by
// Node services, an edge-adjacent Next route, and the browser bundle alike, so
// a router library — even a small one — would be a dependency in three places to
// do string splitting. The whole matcher is a segment compare.

import { ROUTES } from './routes';
import type { AppRoute, LinkOptions, MatchedLink } from './types';

/**
 * The query parameter naming the site (business) a link belongs to.
 *
 * It is a NAVIGATION concern, not surface state: the workbench uses it to decide
 * whether it must switch workspaces before opening, and it never reaches a
 * surface as a param. Held here as a constant so the emitters, the matcher and
 * the arrival gate cannot disagree about its spelling.
 */
export const SITE_PARAM = 'site';

/**
 * Reserved for addressing state INSIDE a surface — which tab of a product, which
 * section of a settings pane. Nothing consumes it yet; it is named here so the
 * pass that wires it cannot pick a different word per surface, and so nobody
 * spends it on something else in the meantime.
 */
export const TAB_PARAM = 'tab';

interface CompiledRoute {
  readonly route: AppRoute;
  /** The literal path this compiled form came from — canonical or an alias. */
  readonly pattern: string;
  readonly segments: readonly string[];
  /** True where the segment is literal, false where it is `:name`. */
  readonly mask: readonly boolean[];
}

function compile(route: AppRoute, pattern: string): CompiledRoute {
  const segments = pattern.split('/').filter(Boolean);
  return { route, pattern, segments, mask: segments.map((s) => !s.startsWith(':')) };
}

/**
 * The concrete patterns one authored path stands for.
 *
 * Every `:name?` is a parameter the address may leave out, so a path carrying
 * one names two real addresses — the surface with the thing that narrows it, and
 * the surface on its own. Both are first-class: the pane is the thing, and the
 * parameter is a fact about which record it is showing.
 */
function expand(pattern: string): string[] {
  let forms: string[][] = [[]];
  for (const segment of pattern.split('/').filter(Boolean)) {
    if (segment.startsWith(':') && segment.endsWith('?')) {
      const required = segment.slice(0, -1);
      forms = forms.flatMap((form) => [[...form, required], form]);
    } else {
      forms = forms.map((form) => [...form, segment]);
    }
  }
  return forms.map((form) => `/${form.join('/')}`);
}

/**
 * Every matchable form, canonical and alias alike, bucketed by segment count and
 * ordered so the most literal pattern wins.
 *
 * The ordering is what lets `/automations/recipes` and `/automations/:id`
 * coexist: candidates are compared left to right on their literal/parameter
 * mask, so a pattern that is literal at the first position where they differ
 * sorts first and is tried first. That is the same precedence every router uses,
 * and it makes the result a property of the table rather than of the order
 * somebody happened to author the rows in.
 */
const byLength = new Map<number, CompiledRoute[]>();
for (const route of ROUTES) {
  for (const pattern of [route.path, ...(route.aliases ?? [])].flatMap(expand)) {
    const compiled = compile(route, pattern);
    const bucket = byLength.get(compiled.segments.length);
    if (bucket) bucket.push(compiled);
    else byLength.set(compiled.segments.length, [compiled]);
  }
}
for (const bucket of byLength.values()) {
  bucket.sort((a, b) => {
    for (let i = 0; i < a.mask.length; i += 1) {
      const left = a.mask[i] === true;
      const right = b.mask[i] === true;
      if (left !== right) return left ? -1 : 1;
    }
    return 0;
  });
}

// A surface's address is its shared row when it has one. A branded row may give a
// shared address a second meaning in one product (`/builder` in Piggles), and that
// must never become the screen's own address in buildPath.
const bySurface = new Map<string, AppRoute>(
  [...ROUTES]
    .sort((a, b) => Number(a.brand === undefined) - Number(b.brand === undefined))
    .map((route) => [route.surface, route])
);
const byEntity = new Map<string, AppRoute>(
  ROUTES.filter((route) => route.entity !== undefined).map((route) => [route.entity!, route])
);

/**
 * Whether a segment can be a RECORD ID, for the parameters that name one.
 *
 * ── WHY A PARAMETER HAS A SHAPE AT ALL ──────────────────────────────────────
 *
 * `:id` used to accept any non-empty segment, and the REST API has sub-resources
 * sitting in the same place a record id does. So `/inventory/suppliers/scorecards`
 * matched `/inventory/suppliers/:id`, opened the SUPPLIER pane with the id
 * "scorecards", fetched `/v1/inventory/suppliers/scorecards` — which is a real
 * endpoint returning the supplier LEAGUE TABLE — and got back 200 with a body
 * that is not a supplier. The pane read `supplier.name.trim()` on it and threw:
 *
 *     Cannot read properties of undefined (reading 'trim')
 *
 * and the person saw "This panel ran into a problem" with a Try again that could
 * never work. MEASURED 2026-09-30: 22 addresses did this, `/crm/customers/top`
 * and `/crm/tasks/today` among them. A supplier that genuinely does not exist
 * has always been handled kindly ("This supplier no longer exists"); it was only
 * a 200 of the wrong SHAPE that fell through the floor.
 *
 * ── WHY THIS IS SAFE ────────────────────────────────────────────────────────
 *
 * The table is already disciplined about this: anything that is not a record id
 * is given a parameter of its own — `:slug`, `:key`, `:objectKey`, `:name`,
 * `:number` — and those are untouched here. Every pane behind an `:id` treats it
 * as a row the server minted, or the literal `new`.
 *
 * The length rule is deliberately generous: a uuid today, and any 16-character
 * machine-minted token if ids ever change format. The longest of the 22 words
 * that must NOT match is "variant-lookup", at fourteen.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MINTED = /^[A-Za-z0-9_-]{16,}$/;

export function looksLikeRecordId(value: string): boolean {
  return value === 'new' || UUID.test(value) || MINTED.test(value);
}

/** Parameters that name a record: `:id`, and `:somethingId`. */
function namesARecord(parameter: string): boolean {
  return parameter === 'id' || /^[a-z][A-Za-z0-9]*Id$/.test(parameter);
}

/** `/a/b/` and `a/b` both become `/a/b`; the root stays `/`. */
export function normalizePath(pathname: string): string {
  const trimmed = pathname.trim();
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (withLeading === '/') return '/';
  return withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading;
}

function readQuery(search: string | URLSearchParams | undefined): URLSearchParams {
  if (search === undefined) return new URLSearchParams();
  return typeof search === 'string' ? new URLSearchParams(search) : search;
}

/** The product this process serves, for a caller that names no brand. */
let appBrand: string | undefined;

/**
 * Say once, at start-up, which product this process is. Piggles' search box resolves
 * a found site page with no brand, so it got the shared answer (sparx's whole-site
 * editor, which Piggles does not have) and dropped the page: "Contributors" found
 * nothing in Ctrl K (persona P09, issue 940). A caller that passes a brand still wins.
 */
export function setLinkBrand(brand: string | undefined): void {
  appBrand = brand;
}

/**
 * Resolve a path (and optional query) to the surface it opens.
 *
 * Returns null for anything the table does not know, INCLUDING `/` — the
 * workbench root is "your layout, as you left it", which is the absence of a
 * destination rather than a destination of its own.
 *
 * `brand` names the product doing the asking, for the handful of addresses that
 * mean something different in each. Omit it and the unbranded route answers,
 * which is every route but one — so a caller that has no brand to give is not
 * choosing wrong, it is choosing the shared answer. A process that called
 * `setLinkBrand` answers as that brand when the caller names none.
 */
export function matchPath(
  pathname: string,
  search?: string | URLSearchParams,
  brand?: string
): MatchedLink | null {
  const path = normalizePath(pathname);
  if (path === '/') return null;
  const asking = brand ?? appBrand;

  const parts = path.split('/').filter(Boolean);
  const candidates = byLength.get(parts.length);
  if (!candidates) return null;

  // A brand-specific route wins over the unbranded one at the same address, and
  // the unbranded one is kept as the answer for every caller that is not it.
  // Held rather than returned immediately so precedence stays a property of the
  // table: an unbranded route that matched FIRST is still the fallback, and a
  // branded route later in the bucket does not get to jump a more literal one.
  let fallback: MatchedLink | null = null;

  for (const candidate of candidates) {
    if (candidate.route.brand !== undefined && candidate.route.brand !== asking) continue;
    const params: Record<string, string> = {};
    let matched = true;

    for (let i = 0; i < candidate.segments.length; i += 1) {
      const segment = candidate.segments[i]!;
      const value = parts[i]!;
      if (candidate.mask[i] === true) {
        if (segment !== value) {
          matched = false;
          break;
        }
      } else {
        // An empty parameter is not a match — `/commerce/orders/` is the list,
        // not an order with a blank id (normalizePath has already dropped the
        // trailing slash, so this only guards a genuinely empty segment).
        if (value.length === 0) {
          matched = false;
          break;
        }
        const parameter = segment.slice(1);
        // A word is not a record id. Without this, an API sub-resource sitting
        // where an id goes opens a detail pane on a body that is not its record.
        if (namesARecord(parameter) && !looksLikeRecordId(value)) {
          matched = false;
          break;
        }
        params[parameter] = safeDecode(value);
      }
    }
    if (!matched) continue;

    const query = readQuery(search);
    let site: string | undefined;
    for (const [key, value] of query) {
      if (key === SITE_PARAM) {
        site = value;
        continue;
      }
      // A path parameter always wins over a same-named query parameter: the
      // address is the truth, the query is the leftovers.
      params[key] ??= value;
    }

    const matchedLink: MatchedLink =
      site === undefined
        ? { surface: candidate.route.surface, params }
        : { surface: candidate.route.surface, params, site };

    if (candidate.route.brand !== undefined) return matchedLink;
    fallback ??= matchedLink;
  }

  return fallback;
}

/** decodeURIComponent, but a malformed escape yields the raw segment rather than throwing. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * The address for a surface, or null when it has none.
 *
 * Parameters the path names become segments; everything else rides as a query
 * parameter, so a filtered list or a seeded composer keeps a working address
 * without inventing a path segment for state that is not what the page is about.
 * Query keys are emitted in sorted order (with `?site=` last) so the same pane
 * always produces the same string — which is what makes it safe to compare an
 * address to the one in the bar before rewriting it.
 */
export function buildPath(
  surface: string,
  params?: Readonly<Record<string, string | undefined>>,
  options?: LinkOptions
): string | null {
  const route = bySurface.get(surface);
  if (!route) return null;

  const used = new Set<string>();
  const segments: string[] = [];

  for (const segment of route.path.split('/').filter(Boolean)) {
    if (!segment.startsWith(':')) {
      segments.push(segment);
      continue;
    }
    const optional = segment.endsWith('?');
    const name = optional ? segment.slice(1, -1) : segment.slice(1);
    const value = params?.[name];
    if (value === undefined || value === '') {
      // An OPTIONAL parameter left out is not a missing address — it is the
      // surface without the record that narrows it, which is a pane someone can
      // legitimately want to open and send.
      if (optional) continue;
      // A detail address with no record IS a missing address. The caller gets
      // null and decides — the copy-link control hides itself, the URL tracker
      // falls back to the workbench root.
      return null;
    }
    used.add(name);
    segments.push(encodeURIComponent(value));
  }

  const query = new URLSearchParams();
  for (const key of Object.keys(params ?? {}).sort()) {
    if (used.has(key) || key === SITE_PARAM) continue;
    const value = params?.[key];
    if (value === undefined || value === '') continue;
    query.set(key, value);
  }
  const site = options?.site;
  if (site !== undefined && site !== '') query.set(SITE_PARAM, site);

  const search = query.toString();
  const path = `/${segments.join('/')}${search ? `?${search}` : ''}`;
  const origin = options?.origin;
  return origin === undefined || origin === '' ? path : `${origin.replace(/\/$/, '')}${path}`;
}

export function routeForSurface(surface: string): AppRoute | undefined {
  return bySurface.get(surface);
}

/** Where an indexed record lives — the entity table universal search resolves through. */
export function routeForEntity(entityType: string): AppRoute | undefined {
  return byEntity.get(entityType);
}

/**
 * Whether a route can carry a record id at all.
 *
 * False for the handful of entity types with no detail surface — a review is
 * worked in a queue, a page is authored in the builder — where the honest answer
 * is the list it lives in, unpreselected. Callers read this so they never hand a
 * surface an id it has no parameter for.
 */
export function routeAcceptsId(route: AppRoute): boolean {
  return route.path.includes('/:');
}

/** The path parameters a route cannot be built without, in order. */
function requiredParams(route: AppRoute): string[] {
  return route.path
    .split('/')
    .filter((segment) => segment.startsWith(':') && !segment.endsWith('?'))
    .map((segment) => segment.slice(1));
}

/**
 * The params that open one record on its entity's home, from its id alone.
 *
 * The record id goes under whatever name the route gives its one parameter:
 * `:id` for most, `:key` where a screen is addressed by key (a record type, a
 * content type, a saved piece), `:variantId` for a stock item. Those projectors
 * index the record BY that key, so the id the search entry carries is the value
 * the screen reads. It used to be `{ id }` for every route, which opened a keyed
 * screen blank (persona issue 261).
 *
 * `{}` for a home that is a list. Undefined when the route needs more than one
 * value (a record of a custom type is `:objectKey/:id`): the id alone cannot say,
 * and the caller has to find the rest in the address the projector stored.
 */
function paramsForRecord(route: AppRoute, recordId: string): Record<string, string> | undefined {
  const names = requiredParams(route);
  if (names.length === 0) return {};
  if (names.length === 1) return { [names[0]!]: recordId };
  return undefined;
}

/**
 * The address for an indexed record: `entity_type` + id in, path out.
 *
 * The id is dropped for an entity whose home is a list. Returns null when the
 * platform has no home for that entity type at all, which is the signal to leave
 * the hit unopenable rather than send someone to a dead surface.
 */
export function pathForEntity(
  entityType: string,
  recordId?: string,
  options?: LinkOptions
): string | null {
  const route = byEntity.get(entityType);
  if (!route) return null;
  const params = paramsForRecord(route, recordId ?? '');
  // A two-part address cannot be built from one id; null, never half an address.
  if (params === undefined) return null;
  return buildPath(route.surface, params, options);
}

/**
 * Where a search hit opens: the record's own pane wherever there is one.
 *
 * An entity whose home is a list can still have a detail pane per KIND: an
 * invoice on account opens on the wholesale invoice, any other invoice in the
 * invoice editor, and the type alone cannot say which. The search entry stores
 * the address its projector worked out from the row, so that address is used
 * when it names THIS record on a pane the table knows. Anything else (an old
 * address, a list, another record) falls back to the entity's home, so a stale
 * stored address can never open the wrong record.
 *
 * Gillett's INV-000009 opened the whole wholesale invoices list from the
 * search box, with eight quotes in it, rather than the invoice (sparx persona
 * issue 094).
 */
export function recordDestination(
  entityType: string,
  recordId: string,
  storedUrl?: string,
  brand?: string
): MatchedLink | null {
  const route = byEntity.get(entityType);
  if (!route) return null;
  const own = paramsForRecord(route, recordId);
  // The stored address is read only where the route cannot say on its own: a
  // home that is a list (any pane naming THIS record will do), or a home that
  // needs more than the id (its own pane, naming this record, and nothing else).
  const listHome = own !== undefined && Object.keys(own).length === 0;
  if ((listHome || own === undefined) && storedUrl !== undefined && storedUrl !== '') {
    const [pathname = '', search] = storedUrl.split('?', 2);
    const matched = matchPath(pathname, search, brand);
    if (
      matched &&
      Object.values(matched.params).includes(recordId) &&
      (listHome || matched.surface === route.surface)
    ) {
      return matched;
    }
  }
  // Half an address would open the pane blank, so a two-part home with no usable
  // stored address opens nothing (persona issue 261).
  if (own === undefined) return null;
  return { surface: route.surface, params: own };
}

/**
 * An absolute link for a surface — what a service puts in an email.
 *
 * `origin` is required here (unlike buildPath, where a relative path is the
 * normal case) because the reader of this link is not in the app: a
 * root-relative path in an email body is not a link at all.
 */
export function linkTo(
  origin: string,
  surface: string,
  params?: Readonly<Record<string, string | undefined>>,
  site?: string
): string | null {
  return buildPath(surface, params, { origin, site });
}

/** `linkTo`, addressed by what the record IS rather than by which surface shows it. */
export function linkToEntity(
  origin: string,
  entityType: string,
  recordId?: string,
  site?: string
): string | null {
  return pathForEntity(entityType, recordId, { origin, site });
}
