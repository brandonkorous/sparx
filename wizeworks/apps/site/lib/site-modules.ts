// What a site has switched off, and what that switches off.
//
// ── The thing this file exists for ──────────────────────────────────────────
//
// A site's settings screen carries a card called "What this site shows", with a
// switch per module and the sentence "Switch off anything this site has no use
// for. It stays available on your other sites."
//
// That sentence was not true. `moduleScope` was written by that screen, stored
// on the property, projected into the public tenant payload on EVERY page load,
// and read by exactly one thing: the site's MCP tool catalog. `ResolvedSite` did
// not declare the field, so it was dropped at the storefront's own boundary.
// Switching Selling off on a journal site left the cart, the checkout, every
// product page and a "Shop" link in the header exactly where they were — and the
// public payload's own comment said "the storefront uses this to gate
// module-specific routes". Nothing did.
// [[feedback_screen_over_a_function_nobody_calls]] [[feedback_a_promise_in_copy_is_a_contract]]
//
// ── One table, because a second one drifts ──────────────────────────────────
//
// Which module owns which part of a site is stated ONCE, here. The route gate,
// the chrome link filter, the sitemap and the account nav all read it, so a new
// route cannot be gated in one of those places and open in the others.
//
// ── Absent is NOT off ───────────────────────────────────────────────────────
//
// A missing or unreadable `disabledModules` means "nothing is switched off",
// never "hide everything". A field that fails to arrive must not dark a shop.

import { notFound } from 'next/navigation';

/** Every module a site can be told not to show. `builder` is deliberately absent:
 *  it is what BUILDS the site, so hiding it from one site means nothing. Kept in
 *  step with `SCOPEABLE` in the console's site settings pane. */
export const SCOPEABLE_MODULES = [
  'commerce',
  'cms',
  'crm',
  'scheduling',
  'email',
  'b2b',
  'dropship',
  'inventory',
  'ai',
] as const;

export type ScopeableModule = (typeof SCOPEABLE_MODULES)[number];

/**
 * Which module owns which paths on a tenant site.
 *
 * Longest prefix wins, so `/account/b2b` belongs to Wholesale even though
 * `/account/orders` belongs to Selling — the table is sorted at module load
 * rather than relying on the order somebody happened to type it in.
 *
 * Bookings became a switch with Piggles persona issue 944: a journal that takes
 * no bookings could switch off its shop and still carried "Book" in its header.
 * `/book` and `/meet` belong to it. `/booking/<token>` does not, on purpose: that
 * is a customer's own link to a booking already made, from an email, and a
 * switch on the site must not strand somebody holding one. A path with no owner
 * is always reachable.
 */
const OWNED_PATHS: { module: ScopeableModule; prefix: string }[] = [
  // Selling. The shop itself, plus the parts of a customer's account that only
  // exist because there were orders.
  { module: 'commerce', prefix: '/cart' },
  { module: 'commerce', prefix: '/checkout' },
  { module: 'commerce', prefix: '/products' },
  { module: 'commerce', prefix: '/category' },
  { module: 'commerce', prefix: '/collections' },
  { module: 'commerce', prefix: '/search' },
  { module: 'commerce', prefix: '/account/orders' },
  { module: 'commerce', prefix: '/account/returns' },
  { module: 'commerce', prefix: '/account/wishlist' },
  { module: 'commerce', prefix: '/account/payment-methods' },
  { module: 'commerce', prefix: '/account/repeat-orders' },
  // Content.
  { module: 'cms', prefix: '/blog' },
  // Customers: the things a visitor asks for rather than buys.
  { module: 'crm', prefix: '/account/requests' },
  { module: 'crm', prefix: '/account/estimates' },
  { module: 'crm', prefix: '/sign' },
  // Wholesale. Longer than `/account/orders`, so it is matched first.
  { module: 'b2b', prefix: '/account/b2b' },
  // Bookings: where a visitor picks something to book, and a meeting link.
  { module: 'scheduling', prefix: '/book' },
  { module: 'scheduling', prefix: '/meet' },
];

const BY_LENGTH = [...OWNED_PATHS].sort((a, b) => b.prefix.length - a.prefix.length);

/** Normalizes a URL or href to a leading-slash path with no trailing slash. */
function pathOf(href: string): string | null {
  if (href === '') return null;
  let path = href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
    // An absolute URL. Only OUR paths can be owned by a module — an outbound
    // link to someone else's site is never hidden by our own settings.
    try {
      path = new URL(path).pathname;
    } catch {
      return null;
    }
  }
  if (!path.startsWith('/')) return null;
  const cut = path.search(/[?#]/);
  if (cut !== -1) path = path.slice(0, cut);
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

/**
 * The module that owns this path, or null when nothing does.
 *
 * A prefix matches the path itself and anything under it, and ONLY at a segment
 * boundary: `/cart` owns `/cart` and `/cart/whatever`, and does not own
 * `/cartography`, which would otherwise disappear the day a shop wrote a page
 * about maps.
 */
export function moduleForPath(href: string): ScopeableModule | null {
  const path = pathOf(href);
  if (path === null) return null;
  for (const owned of BY_LENGTH) {
    if (path === owned.prefix || path.startsWith(`${owned.prefix}/`)) return owned.module;
  }
  return null;
}

/**
 * The module that owns a host core or a page's record type, from its own key.
 *
 * Both are already namespaced by module — `commerce.cart`, `commerce.plp`,
 * `cms.article-body`, `commerce.product`, `scheduling.services` — so the owner
 * is the first segment and there is no second table to keep in step with the
 * first. A prefix nothing scopes (`site.`) owns nothing here; `scheduling.` does
 * since issue 944, so the booking list block goes with the switch.
 *
 * `commerce.auth` is the ONE exception. It is the sign-in panel, and a visitor
 * still signs in on a site that sells nothing: to ask a question, to look at a
 * quote, to keep an appointment. Hiding it would lock people out of the parts of
 * their account that have nothing to do with buying.
 */
export function moduleForKey(key: string): ScopeableModule | null {
  if (key === 'commerce.auth') return null;
  const head = key.split('.')[0] ?? '';
  return (SCOPEABLE_MODULES as readonly string[]).includes(head) ? (head as ScopeableModule) : null;
}

/**
 * Whether an authored page still belongs on this site.
 *
 * A page is refused when the thing it EXISTS for is switched off: a page whose
 * record type is a switched-off module's (every product page), or one carrying
 * that module's live core (the page a tenant called "Shop", which is a product
 * grid with a heading on it). A page that merely LINKS to the shop is untouched
 * — a link is not the page's reason to exist, and the link itself is dropped by
 * `siteShowsLink`.
 */
export function siteShowsPage(
  site: { disabledModules?: readonly string[] } | null | undefined,
  page: { recordType?: string | null; hostKeys?: readonly string[] }
): boolean {
  const owners: (ScopeableModule | null)[] = [
    page.recordType ? moduleForKey(page.recordType) : null,
    ...(page.hostKeys ?? []).map(moduleForKey),
  ];
  return owners.every((owner) => owner === null || siteShowsModule(site, owner));
}

/** What this site has switched off, as a set. Anything unreadable reads as
 *  nothing switched off. */
function offFor(site: { disabledModules?: readonly string[] } | null | undefined): Set<string> {
  const list = site?.disabledModules;
  return new Set<string>(Array.isArray(list) ? list : []);
}

/** Whether this site still shows the given module. A site we could not resolve
 *  is not a site whose modules are off — the caller has already refused it. */
export function siteShowsModule(
  site: { disabledModules?: readonly string[] } | null | undefined,
  slug: string
): boolean {
  return !offFor(site).has(slug);
}

/**
 * Refuse the request when this site has the module switched off.
 *
 * `notFound()` rather than a message, because from a visitor's side the page
 * genuinely does not exist on this site — and a "switched off" page would tell
 * the internet which modules a business pays for.
 */
export function requireSiteModule(
  site: { disabledModules?: readonly string[] } | null | undefined,
  slug: ScopeableModule
): void {
  if (!siteShowsModule(site, slug)) notFound();
}

/** Refuse the request when the module that owns this PATH is switched off. For
 *  routes that stand for several modules at once, like the account area. */
export function requireSiteModuleForPath(
  site: { disabledModules?: readonly string[] } | null | undefined,
  path: string
): void {
  const owner = moduleForPath(path);
  if (owner && !siteShowsModule(site, owner)) notFound();
}

/**
 * Whether a link should be drawn at all.
 *
 * A gated route with a live link to it is a 404 the business put in its own
 * header, so the chrome, the account nav and the sitemap all ask this before
 * drawing anything. A link nothing owns is always drawn.
 */
export function siteShowsLink(
  site: { disabledModules?: readonly string[] } | null | undefined,
  href: string
): boolean {
  const owner = moduleForPath(href);
  return owner === null || siteShowsModule(site, owner);
}

/* ── Links in the site's own chrome ───────────────────────────────────────── */

/** A structural view of a silica node. Deliberately loose: this walks the tree
 *  to DROP nodes, and a shape it does not recognize must pass through it whole
 *  rather than be dropped on a guess. */
interface LinkishNode {
  kind?: string;
  tag?: string;
  attrs?: Record<string, unknown>;
  props?: Record<string, unknown>;
  data?: { kind?: string };
  children?: unknown[];
}

/** The href a node navigates to, or null when it does not navigate, or when
 *  something else decides its href at render time. */
function hrefOf(node: LinkishNode): string | null {
  // A bound href is resolved by the host from live data, so the authored value
  // says nothing about where it goes. Never guessed at, never dropped.
  if (node.data?.kind === 'value' || node.data?.kind === 'collection') return null;
  const raw =
    node.kind === 'element' && node.tag === 'a'
      ? node.attrs?.href
      : node.kind === 'component'
        ? node.props?.href
        : undefined;
  return typeof raw === 'string' ? raw : null;
}

/**
 * Drop the links this site refuses, from its header and footer.
 *
 * A gated route with a live link to it is a 404 the business put in its own
 * chrome, which is a worse outcome than the page simply being gone. Devi's
 * journal kept a "Shop" link in its header and "Orders / Returns / Cart" in its
 * footer with Selling switched off.
 *
 * `hiddenPaths` carries the site's OWN page paths that its switches refuse —
 * api-rest works those out, because only it can see what a page called "Shop"
 * actually contains.
 *
 * A list item left holding nothing is dropped with its link. A bullet with no
 * words in it is not a smaller nav, it is a broken one.
 */
export function pruneHiddenLinks<T>(
  node: T,
  site: { disabledModules?: readonly string[] } | null | undefined,
  hiddenPaths: readonly string[] = []
): T | null {
  if (!node || typeof node !== 'object') return node;
  const n = node as LinkishNode;

  const href = hrefOf(n);
  if (href !== null) {
    const path = pathOf(href);
    if (!siteShowsLink(site, href)) return null;
    if (path !== null && hiddenPaths.includes(path)) return null;
  }

  if (!Array.isArray(n.children)) return node;

  // CHANGED, not "a direct child was dropped". Tracking only the latter returns
  // the ORIGINAL node whenever the drop happened further down, throwing away the
  // rebuilt children with it — so a link three levels inside a header survived
  // every prune while the unit tests, all one level deep, stayed green.
  // [[feedback_a_test_that_cannot_go_red]]
  const kept: unknown[] = [];
  let changed = false;
  for (const child of n.children) {
    const next = pruneHiddenLinks(child, site, hiddenPaths);
    if (next === null) {
      changed = true;
      continue;
    }
    if (next !== child) changed = true;
    kept.push(next);
  }
  if (!changed) return node;

  // A list item, or anything else, that held ONLY the link we just removed goes
  // with it — but only if it held something to begin with.
  const hasContent = kept.some((child) => typeof child !== 'string' || child.trim() !== '');
  if (!hasContent && n.children.length > 0 && (n.tag === 'li' || n.tag === 'dd')) return null;

  return { ...n, children: kept } as T;
}
