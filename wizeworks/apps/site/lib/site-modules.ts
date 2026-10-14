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

// The table and its matcher live in `@wizeworks/silica-catalog` (`site-module-paths.ts`),
// so the console's page list reads the same answer the routes below enforce.
import {
  SCOPEABLE_MODULES,
  moduleForKey,
  moduleForPath,
  sitePathOf as pathOf,
  type ScopeableModule,
} from '@wizeworks/silica-catalog';

export { SCOPEABLE_MODULES, moduleForKey, moduleForPath, type ScopeableModule };

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
