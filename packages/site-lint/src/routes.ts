// What a link on a sparx storefront is allowed to point at.
//
// Two halves. The BUILT-IN half is the storefront's own route table (`apps/site/app`)
// — cart, checkout, search, the account area, and the dynamic record routes. It is
// knowledge about this platform, not about any tenant, so it lives in code and is
// checked into a test that walks the real route files (`routes.test.ts`) rather than
// being remembered. The AUTHORED half — pages, product handles, collection handles —
// comes from the caller, because only the caller can look it up.
//
// The bias throughout is against false positives. Telling an owner that a page that
// works is broken is worse than missing one that is: the first makes them distrust
// every finding, the second only costs them the one they already had. So anything
// this file cannot resolve with certainty resolves as FINE.

/** Routes the storefront serves that take no parameter. */
export const BUILTIN_PATHS: readonly string[] = [
  '/',
  '/cart',
  '/checkout',
  '/search',
  '/products',
  '/collections',
  '/category',
  '/book',
  '/account',
  '/sitemap.xml',
  '/robots.txt',
  '/llms.txt',
];

/**
 * Subtrees served in full, where enumerating every leaf would be more likely to be
 * wrong than useful.
 *
 * `/account/*` is the signed-in area — a dozen routes today (orders, addresses,
 * wishlist, bookings, estimates, the whole B2B section with its own nested pages),
 * several of them two parameters deep. Listing them here would mean this file
 * silently going stale every time the account area grows, and the failure mode of
 * staleness is the bad one: flagging a link to a route that exists.
 *
 * `/api/*` is served by route handlers, never by the page router.
 */
export const OPEN_SUBTREES: readonly string[] = ['/account/', '/api/'];

/** Which caller-supplied roster backs each parameterized route. */
export type RosterKey =
  | 'productHandles'
  | 'collectionHandles'
  | 'categoryHandles'
  | 'postSlugs'
  | 'serviceIds';

export interface DynamicRoute {
  /** Always with a trailing slash — `/products/`. */
  prefix: string;
  roster: RosterKey;
  /** What the parameter IS, in an owner's words, for the finding text. */
  noun: string;
}

/** The parameterized storefront routes, each paired with the roster that decides
 *  whether a given parameter resolves. `/blog/[slug]` reads posts; the rest read
 *  commerce records. */
export const DYNAMIC_ROUTES: readonly DynamicRoute[] = [
  { prefix: '/products/', roster: 'productHandles', noun: 'product' },
  { prefix: '/collections/', roster: 'collectionHandles', noun: 'collection' },
  { prefix: '/category/', roster: 'categoryHandles', noun: 'category' },
  { prefix: '/blog/', roster: 'postSlugs', noun: 'blog post' },
  { prefix: '/book/', roster: 'serviceIds', noun: 'bookable service' },
];

/** Is this path inside a subtree served wholesale? */
export function inOpenSubtree(path: string): boolean {
  return OPEN_SUBTREES.some((prefix) => path.startsWith(prefix));
}

/**
 * Normalize an authored path to the one spelling everything else compares against:
 * a leading slash, no trailing slash (except the root), no query and no hash.
 *
 * Page slugs are authored inconsistently — silica's `makePage` takes `/pricing`,
 * the sparx page editor stores `pricing`, and a hand-typed href may carry a trailing
 * slash — so all four spellings of the same page have to collapse to one before any
 * comparison, or every link to the home page reads as broken.
 */
export function normalizePath(raw: string): string {
  let path = raw.trim();
  const cut = Math.min(
    ...[path.indexOf('?'), path.indexOf('#')].filter((i) => i >= 0).concat([path.length])
  );
  path = path.slice(0, cut);
  if (!path.startsWith('/')) path = `/${path}`;
  while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path === '' ? '/' : path;
}

/**
 * Resolve a relative href against the page it was authored on.
 *
 * `about` on `/` means `/about`; on `/guides/setup` it means `/guides/about`. An
 * author typing into a builder almost always means the first, but "almost always"
 * is not a basis for calling their link broken — so it is resolved the way a browser
 * resolves it, and judged on that.
 */
export function resolveRelative(href: string, fromPath: string): string {
  const base = normalizePath(fromPath);
  const dir = base.slice(0, base.lastIndexOf('/') + 1);
  const segments: string[] = [];
  for (const part of `${dir}${href}`.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') segments.pop();
    else segments.push(part);
  }
  return normalizePath(`/${segments.join('/')}`);
}
