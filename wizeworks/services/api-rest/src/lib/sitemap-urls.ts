// Which addresses a site ADVERTISES — the pure half of `/v1/sitemap.xml`.
//
// Separated from the route because it is a different job: the route reads the
// database, this decides what the readings mean. It is also the half that has been
// wrong twice, both times silently, because a sitemap has no reader who complains.

import { isRecordAddress, isUtilityPage, starterPages } from '@wizeworks/silica-catalog';
import type { SiteChromeOptions } from '@wizeworks/builder';

/**
 * A stored page slug as the URL a visitor actually types.
 *
 * Both spellings are in the store and always have been: a blueprint writes `about`,
 * the code starter writes `/about`. The sitemap used to build its path as
 * `` `/${slug}` ``, so every site seeded by the starter advertised
 * `https://host//shop`, `//about`, `//contact` — and `//` beside its own home page,
 * so the front door appeared twice. The storefront 308s each of them to the
 * single-slash form, which is why nothing broke and nothing said so: a sitemap of
 * redirects is a list of URLs a crawler is told are canonical and then told are not
 * (issue 275).
 */
export function pageAddress(slug: string): string {
  return `/${slug.replace(/^\/+/, '')}`;
}

/** How much of each kind of thing this site has — enough to tell a real index page
 *  from an empty one. */
export interface SiteContent {
  products: number;
  collections: number;
  categories: number;
  posts: number;
  bookable: number;
}

/**
 * The starter addresses this site is SERVING and should advertise.
 *
 * The storefront falls back to the code starter PER SLUG (wizeworks/apps/site
 * lib/silica.ts `getPublishedSilicaPage` → `starterPageDtoForSlug`), so a site is
 * live at every starter address whether or not anyone published a page there. A
 * sitemap built only from `builder_pages` describes a smaller site than the one being
 * served, and the gap is invisible because both halves work on their own.
 *
 * Juniper Row is what it costs. Her Journal at `/blog` was live and listed her three
 * articles, and was the only page on the site missing from its own sitemap: three
 * articles advertised with no index to reach them from (issue 274). A tenant who has
 * published nothing at all is the extreme case — a whole live site advertised as one
 * URL.
 *
 * @param published addresses a published page already covers — deduped by the caller,
 *   but passed in so this can be read on its own.
 * @param declined addresses whose author has ticked "keep this out of search". Read
 *   from every row, published or not: the tick is about the ADDRESS, and the starter
 *   is what answers there whether or not the page behind it was ever published.
 */
export function starterAddresses(
  modules: SiteChromeOptions,
  content: SiteContent,
  published: ReadonlySet<string>,
  declined: ReadonlySet<string>
): string[] {
  const out: string[] = [];
  for (const page of starterPages(modules)) {
    const path = pageAddress(page.slug ?? '');
    // The home page is pushed by the caller first and unconditionally — a site always
    // has a front door. A record address is a template, not a URL. Utility pages
    // (cart, search, the four account pages) are deliberately out of every index.
    if (path === '/' || isRecordAddress(path) || isUtilityPage(path)) continue;
    if (published.has(path) || declined.has(path)) continue;
    if (isEmptyIndex(path, content)) continue;
    out.push(path);
  }
  return out;
}

/**
 * A starter address that is an INDEX of something this site has none of.
 *
 * The same rule the route already applies to `/products` and `/collections`, extended
 * to the starter pages that are indexes in their own right. Advertising `/blog` to a
 * shop with no journal asks a crawler to index the words "No posts yet"; `/book` to a
 * clothing label says "No services are bookable yet" — and Juniper Row has every
 * module switched on, so both were being offered.
 */
function isEmptyIndex(path: string, content: SiteContent): boolean {
  switch (path) {
    case '/shop':
    case '/products':
      return content.products === 0;
    case '/collections':
      return content.collections === 0;
    case '/category':
      return content.categories === 0;
    case '/blog':
      return content.posts === 0;
    case '/book':
      return content.bookable === 0;
    default:
      return false;
  }
}
