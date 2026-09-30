// A page's title, once, however the business wrote it.
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
