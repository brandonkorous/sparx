// The pages a site refuses because of its own module switches.
//
// ── Why the storefront cannot work this out by itself ───────────────────────
//
// A site's code routes are named after what they are: `/cart` is the cart on
// every site there has ever been, so the storefront can gate it from a table of
// prefixes. A tenant's OWN pages are not. The page holding the product grid is
// called "Shop" on one site, "Our things" on the next and `/` on the one after,
// so a link reading `/shop` tells a storefront nothing about whether Selling is
// what it is for.
//
// The page's CONTENT does say. A page carries host cores whose keys already name
// their module — `commerce.plp`, `cms.article-body` — and a collection page
// carries a record type that does the same. So this answers the one question the
// storefront cannot: which of this site's own page paths are for a module it has
// switched off, so no link to them is ever drawn.
//
// ── It costs nothing on a site that has switched nothing off ────────────────
//
// Which is almost every site: 3 of 111 on this machine have any module scope at
// all. The caller checks that first and never calls this otherwise, and this
// returns early if it is called anyway.

import { withTenant } from '@wizeworks/db';

/** Every host core key in a published tree. The key's first segment is its
 *  module, which is what makes this answerable without a second table. */
function hostKeysIn(node: unknown, found: string[]): void {
  if (!node || typeof node !== 'object') return;
  const n = node as { kind?: string; component?: unknown; children?: unknown[] };
  if (n.kind === 'host' && typeof n.component === 'string') found.push(n.component);
  if (Array.isArray(n.children)) for (const child of n.children) hostKeysIn(child, found);
}

/** The module a core key or record type belongs to, or null.
 *
 *  `commerce.auth` is excluded deliberately: it is the sign-in panel, and a
 *  visitor still signs in on a site that sells nothing — to ask a question, to
 *  look at a quote, to keep an appointment. The storefront's `moduleForKey`
 *  makes the same exception, and the two must agree. */
function moduleOf(key: string | null | undefined): string | null {
  if (!key || key === 'commerce.auth') return null;
  const head = key.split('.')[0];
  return head && head !== 'site' ? head : null;
}

/** A stored page slug as the path a visitor types. The home page's slug is
 *  empty; collection templates already lead with a slash. */
function pathOf(slug: string | null): string | null {
  if (slug === null) return null;
  const trimmed = slug.trim();
  if (trimmed === '') return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * The paths on this site that its own module switches refuse.
 *
 * Returns [] when the site has switched nothing off, which is the answer for
 * almost every site and costs one comparison rather than a read.
 */
export async function siteHiddenPaths(
  tenantId: string,
  propertyId: string,
  disabledModules: readonly string[]
): Promise<string[]> {
  if (disabledModules.length === 0) return [];
  const off = new Set(disabledModules);

  const rows = await withTenant({ tenantId }, (tx) =>
    tx.builderPage.findMany({
      where: { propertyId, publishedAt: { not: null } },
      // BOTH trees. A page is owned by the silica engine (`silicaPublishedTree`)
      // or by the older sparx builder (`publishedTree`), and reading only one of
      // them finds nothing on a site built with the other — which looks exactly
      // like a site that has nothing to hide. Every page on this machine is
      // silica; the legacy column is read so the answer does not depend on that.
      select: {
        slug: true,
        recordType: true,
        publishedTree: true,
        silicaPublishedTree: true,
      },
    })
  );

  const hidden: string[] = [];
  for (const row of rows) {
    const path = pathOf(row.slug);
    // The home page is never hidden. A site with no home is not a scoped site,
    // it is a broken one, and a visitor arriving at the front door of a real
    // business must never be told it does not exist.
    if (path === null || path === '/') continue;

    const keys: string[] = [];
    hostKeysIn(row.silicaPublishedTree, keys);
    hostKeysIn(row.publishedTree, keys);
    const owners = [moduleOf(row.recordType), ...keys.map(moduleOf)];
    if (owners.some((owner) => owner !== null && off.has(owner))) hidden.push(path);
  }
  return hidden;
}
