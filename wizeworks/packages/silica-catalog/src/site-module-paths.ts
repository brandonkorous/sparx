// Which module owns which part of a tenant site — the table a site's "What this site
// shows" switches read.
//
// Here rather than in the site app because two places must agree on it: the site,
// which answers 404 for a path whose module a site switched off (`site-modules.ts`
// in the site app), and the console's page list, which says "Off on this site" about
// the same pages. It lived only in the site app, and the list guessed from the
// starter set instead: it called a journal's sign-in pages off while the site served
// them. One table, read by both.

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
export function sitePathOf(href: string): string | null {
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
  const path = sitePathOf(href);
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
 * `commerce.auth` is the first exception. It is the sign-in panel, and a visitor
 * still signs in on a site that sells nothing: to ask a question, to look at a
 * quote, to keep an appointment. Hiding it would lock people out of the parts of
 * their account that have nothing to do with buying.
 */
export function moduleForKey(key: string): ScopeableModule | null {
  if (key === 'commerce.auth') return null;
  // Site search is the second exception, for the same reason: it finds the site's pages
  // and articles as well as its products, and a journal that sells nothing still has
  // writing a reader wants to find. On such a site it shows those alone.
  if (key === 'commerce.search') return null;
  const head = key.split('.')[0] ?? '';
  return (SCOPEABLE_MODULES as readonly string[]).includes(head) ? (head as ScopeableModule) : null;
}

/** Every host core key in a tree — `commerce.plp`, `cms.article-body`. A page's cores
 *  say what it is FOR, whatever it is called (see `moduleForKey`). */
export function hostKeysIn(node: unknown, found: string[] = []): string[] {
  if (!node || typeof node !== 'object') return found;
  const n = node as { kind?: string; component?: unknown; children?: unknown[] };
  if (n.kind === 'host' && typeof n.component === 'string') found.push(n.component);
  if (Array.isArray(n.children)) for (const child of n.children) hostKeysIn(child, found);
  return found;
}
