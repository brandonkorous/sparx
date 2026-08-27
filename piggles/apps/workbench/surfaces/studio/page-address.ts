// How a page's address reads, and which pages collide on one.

import type { PageSummary } from '../../lib/studio/page-data';

/** A record template is addressed by its record, so it holds no address of its own. */
export function isTemplate(page: PageSummary): boolean {
  return page.kind === 'collection' || page.recordType !== null;
}

/**
 * What a page's address reads as.
 *
 * The home page's address is the site itself, and it used to read "No address
 * yet" — a page telling its owner nobody can reach it while the column beside it
 * said "Home page". A slugless page IS the front door; `routeOf` is the one rule
 * for that and this follows it rather than restating it.
 */
export function addressOf(page: PageSummary): string {
  if (page.kind === 'collection') return 'One page per record';
  const route = routeOf(page);
  return route === '/' ? 'Your front page' : route;
}

/** Where a visitor lands. A page with no slug IS the home page (site-lint's rule). */
export function routeOf(page: PageSummary): string {
  const slug = (page.slug ?? '').trim();
  if (!slug || slug === '/') return '/';
  return slug.startsWith('/') ? slug : `/${slug}`;
}

/** What kind of page this is, in a word an owner uses. */
export function kindOf(page: PageSummary): string {
  if (isTemplate(page)) return 'Record template';
  return routeOf(page) === '/' ? 'Home page' : 'Standard page';
}

/**
 * What the list should say about whether visitors can see this page.
 *
 * A page that has never been saved is NOT necessarily invisible, and the server is
 * what knows: `page.live` is true wherever the platform draws a standard design at
 * this address. Two kinds do. A record template — `/blog/<slug>`,
 * `/collections/<handle>`, `/category/<handle>` — is drawn by the code composite;
 * saying "Not live yet" about those told an owner three of her page types were missing
 * from a site serving every one of them (issue 270). An ORDINARY starter address —
 * `/blog`, `/about` — is drawn by the storefront's per-slug fallback, which is why her
 * Journal was live and wearing the platform's words (issue 274).
 *
 * The editor one click away has always said it in plain words: "This is the page your
 * visitors see. Save it to make it yours."
 *
 * Same shape as the bug `addressOf` above was written to fix — the home page reading
 * "No address yet" beside a column saying "Home page".
 */
export function statusOf(page: PageSummary): {
  label: string;
  tone: 'success' | 'info' | 'warning';
} {
  if (page.published) return { label: 'Live', tone: 'success' };
  if (page.live) return { label: 'Live · standard design', tone: 'info' };
  return { label: 'Not live yet', tone: 'warning' };
}

/**
 * The other pages answering to this one's address — the site check's finding,
 * said where it can be acted on.
 */
export function addressPeers(page: PageSummary, all: readonly PageSummary[]): string[] {
  if (isTemplate(page)) return [];
  const route = routeOf(page);
  return all
    .filter((other) => other.id !== page.id && !isTemplate(other) && routeOf(other) === route)
    .map((other) => other.name);
}

/** A page name as the address it suggests. Empty means no address — the page is
 *  reachable only by a link the author places. */
export function slugify(name: string): string | null {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug ? `/${slug}` : null;
}
