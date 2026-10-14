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
// The route, since 2026-10-08
// ---------------------------------------------------------------------------
//
// The site now serves any kind at the address its own pattern gives it
// (`app/[...slug]` → `getKindPiece` → `/v1/public/content/entries/by-path`), when
// that pattern is one it can serve: `/<words>/{slug}`, whose first word is not one
// of the site's own routes. `kindAddressFromPattern` is that rule, and the console
// asks the same function the site does, so the two cannot disagree. Landing pages
// (`/{slug}`) are still not served, and keep the warning.
//
// The two hard-coded kinds stay a copied list, held by `scripts/check-cms-routes.mjs`:
// it reads the real types out of `wizeworks/apps/site/lib/content.ts`, and fails if
// the site stops reading kinds by their pattern.

import { kindAddressFromPattern } from '@wizeworks/silica-catalog';

/** The `typeKey`s the site has a route of their own for. Kept honest by
 *  `check:cms-routes`. */
export const SITE_SERVED_TYPES = ['blog_post', 'page'] as const;

/** Whether a published entry of this kind is reachable on the site at all: one of the
 *  two with a route of their own, or a kind whose pattern the site serves. */
export function siteServesType(typeKey: string, urlPattern: string | null = null): boolean {
  if ((SITE_SERVED_TYPES as readonly string[]).includes(typeKey)) return true;
  return kindAddressFromPattern(urlPattern) !== null;
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
  if (siteServesType(typeKey, urlPattern)) {
    return {
      served: true,
      text: `This will live at ${address}. Leave it and we'll make one from the title.`,
    };
  }
  return {
    served: false,
    text: `Your site cannot show this kind at ${address}, so a visitor following that address will not find it. What you write is kept here and is yours to use elsewhere. To give it a page, set its web address pattern to something like /articles/{slug} in this kind's settings.`,
  };
}

/** The address an entry lives at (or will, once published), or null when the site
 *  shows its kind nowhere. The Link box and the content list both print it. */
export function entryHref(
  entry: { type_key: string; slug: string | null },
  type: { url_pattern: string | null } | undefined
): string | null {
  const slug = entry.slug?.trim();
  if (!slug || !siteServesType(entry.type_key, type?.url_pattern ?? null)) return null;
  return (type?.url_pattern ?? '/{slug}').replace('{slug}', slug);
}
