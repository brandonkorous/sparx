// Where a published content entry lives on the tenant's website — the one answer the
// sitemap, the RSS feed and site search all print links from.
//
// Each of them used to read the kind's `urlPattern` and substitute the slug, which
// trusted the pattern to be an address the website serves. Most were not: nothing served
// any kind but pages and blog posts, so every Event, Job posting or Article link those
// three printed was a 404. The website now serves a kind's pieces at the address its
// pattern gives (`kindAddressFromPattern`, the storefront's own rule), so this asks the
// same rule, and a pattern the website cannot serve gets no link at all.

import { kindAddressFromPattern, kindPath } from '@wizeworks/silica-catalog';

/**
 * The path a published entry is served at, or null when it has none.
 *
 * - A `page` lives at `/<slug>`: the catch-all's page read.
 * - A `blog_post` lives at `/blog/<slug>`, a route the website always has, whatever the
 *   kind's pattern says. A pattern of its own is also served (the catch-all serves any
 *   kind at its pattern) but `/blog/` is the address that cannot go away.
 * - Any other kind lives where its pattern puts it, when the website can serve it.
 */
export function entryPublicPath(
  typeKey: string,
  urlPattern: string | null | undefined,
  slug: string | null | undefined
): string | null {
  if (!slug) return null;
  if (typeKey === 'page') return `/${slug}`;
  if (typeKey === 'blog_post') return `/blog/${slug}`;
  const address = kindAddressFromPattern(urlPattern);
  return address ? kindPath(address, slug) : null;
}
