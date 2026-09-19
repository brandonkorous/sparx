// Which kinds of content the customer-facing site actually has a page for.
//
// ---------------------------------------------------------------------------
// The bug this exists for
// ---------------------------------------------------------------------------
//
// "New content" offers eleven kinds: Testimonial, Announcement, Blog post, Case
// study, Event, Help article, Job posting, Landing page, News article, Page and
// Team member. Each carries a `url_pattern`, and the Web address card promises,
// in the console's own words:
//
//     This will live at /events/…. Leave it and we'll make one from the title.
//
// The site serves TWO of them. `wizeworks/apps/site` resolves a slug by asking
// for one hard-coded type at each of its two entry points:
//
//   app/blog/[slug]   → getBlogPostBySlug → type: 'blog_post'
//   app/[...slug]     → getPageBySlug     → type: 'page'
//
// (in `wizeworks/apps/site/lib/content.ts`.) There is no route that resolves a
// slug against a content type's own `url_pattern`, so `/events/autumn-sale`,
// `/careers/seamstress` and `/help/how-to-measure` reach the catch-all, find no
// silica page, no builder page and no `page` entry, and 404.
//
// Nobody has hit it yet — measured 2026-09-16, the platform's 702 entries are
// 545 `page`, 156 `blog_post` and one draft `product_spec_sheet` — but the trap
// is armed, and the console is the thing arming it: it offers the kind, builds
// a complete editor for it, prints the address, and says "Published · Live
// since…" over a dead link.
//
// ---------------------------------------------------------------------------
// Why the list lives here, and how it stays true
// ---------------------------------------------------------------------------
//
// The honest fix is a route. Until there is one, the console must not promise
// an address it knows nothing serves, and the only place that knows is the site
// app — which this app cannot import, and should not.
//
// So the list is copied, and `scripts/check-cms-routes.mjs` reads the real
// types out of `wizeworks/apps/site/lib/content.ts` and fails the build if the
// two disagree. Adding a route to the site reddens the check, and the fix is to
// add the key here; the promise then turns itself back on. A copied list with
// nothing holding it is the thing that rots, so this one has something holding
// it.

/** The `typeKey`s the site has a page for. Kept honest by `check:cms-routes`. */
export const SITE_SERVED_TYPES = ['blog_post', 'page'] as const;

/** Whether a published entry of this kind is reachable on the site at all. */
export function siteServesType(typeKey: string): boolean {
  return (SITE_SERVED_TYPES as readonly string[]).includes(typeKey);
}

/**
 * What to say under the address box for one kind.
 *
 * Both sentences are about the SAME address, because the address is real either
 * way: it is what the entry is filed under, what a future route would use, and
 * what she would type. The difference is only whether anybody can visit it yet,
 * which is the part she cannot find out by looking.
 */
export function addressNote(
  typeKey: string,
  urlPattern: string | null,
  slug: string
): { text: string; served: boolean } {
  const address = (urlPattern ?? '/{slug}').replace('{slug}', slug.trim() || '…');
  if (siteServesType(typeKey)) {
    return {
      served: true,
      text: `This will live at ${address}. Leave it and we'll make one from the title.`,
    };
  }
  return {
    served: false,
    text: `Your site has no page for this kind yet, so nothing is published at ${address} and a visitor following that address will not find it. What you write is kept here and is yours to use elsewhere. Leave the box and we'll make an address from the title, ready for when there is a page.`,
  };
}
