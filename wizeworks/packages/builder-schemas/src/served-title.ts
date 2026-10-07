// A page's title, once, however the business wrote it, and what it measures.
//
// Lives here rather than in the site so the three places that judge a title read
// the same rule as the one that serves it: the site's <title>, the SEO page check
// (api-rest), and the length hints beside the title box in the console. They used
// to disagree: Gillett Diesel typed a 54-character title, the check called it a
// good length, and the site served 79 characters, "... · Gillett Diesel Service",
// which a search engine cuts (sparx persona issue 134).
//
// The root layout sets `title: { template: '%s · <site>' }`, so every page's own
// title gets the shop's name appended for free. That is right for a title like
// "What we bake". It is wrong for "What we bake — Thistle & Rye", which is what
// a careful owner actually types into the SEO title box, because it is what
// every page on every website she has ever read looks like.
//
// The result was her own name twice, in the browser tab and on every share card:
//
//     What we bake — Thistle & Rye · Thistle & Rye
//
// Measured across the database: 20 pages on 3 tenants, and they are the three
// whose owners filled the box in most carefully.
//
// The same doubling was fixed once before, one layer down — the page code used
// to append the brand itself, and `[...slug]/page.tsx` still carries the comment
// about it. That fix stopped the CODE adding a second name. This one stops the
// AUTHOR's own name being added to twice.

/** Regex-safe, because shop names hold `&`, `(`, `.` and `+`. */
function literal(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Does this title already say whose site it is?
 *
 * Anywhere in the title, not just the end: "Thistle & Rye opening hours" names
 * the shop as surely as "Opening hours — Thistle & Rye" does, and appending to
 * either one says it twice.
 *
 * A name under three characters is not looked for at all. Matching "A" or "Co"
 * inside ordinary words would silently strip the brand off titles that never
 * carried one, which is the worse failure of the two.
 */
export function namesTheSite(title: string, siteName: string): boolean {
  const name = siteName.trim();
  if (name.length < 3) return false;
  // No \b: it is a word boundary only between word characters, and these names
  // end in things like "&" and "Co." where \b sits in the wrong place.
  return new RegExp(`(^|[^\\p{L}\\p{N}])${literal(name)}($|[^\\p{L}\\p{N}])`, 'iu').test(title);
}

/**
 * What to hand Next as `title`. A plain string lets the layout's template
 * append the shop name; `{ absolute }` tells it not to.
 */
export function metadataTitle(title: string, siteName: string): string | { absolute: string } {
  return namesTheSite(title, siteName) ? { absolute: title } : title;
}

/**
 * What to put on a social card. There is no template here, so the brand is
 * appended by hand — a card is seen with none of the site around it, and a
 * headline with no shop on it is a headline nobody can place.
 */
export function socialTitle(title: string, siteName: string): string {
  return namesTheSite(title, siteName) ? title : `${title} · ${siteName}`;
}

/**
 * The title exactly as a search result and the browser tab show it.
 *
 * Every page but the home page sits under the layout's `%s · <site>` template, so
 * the shop name is added unless the title already names it (`metadataTitle`).
 * The home page shares the layout's segment, which the template does not reach,
 * so its title is served as written.
 */
export function servedTitle(
  title: string,
  siteName: string,
  options: { home?: boolean } = {}
): string {
  if (options.home) return title;
  const handed = metadataTitle(title, siteName);
  return typeof handed === 'string' ? `${handed} · ${siteName}` : handed.absolute;
}

/**
 * A site page's title as search shows it, from what the page holds.
 *
 * With a search title: that, served by the rule above. Without one, the two pages
 * differ: an ordinary page falls back to its name ("About · Gillett Diesel
 * Service"), but the home page falls back to the business name alone
 * (`app/page.tsx`). The check used to grade the home page's empty title as "Home",
 * four characters, "a very short title", while search showed "Gillett Diesel
 * Service" (sparx persona issue 134).
 */
export function servedPageTitle(page: {
  seoTitle: string | null | undefined;
  pageName: string;
  siteName: string;
  home: boolean;
}): string {
  const typed = (page.seoTitle ?? '').trim();
  const site = page.siteName.trim();
  if (page.home) return typed || site || page.pageName;
  const base = typed || page.pageName;
  return site ? servedTitle(base, site) : base;
}
