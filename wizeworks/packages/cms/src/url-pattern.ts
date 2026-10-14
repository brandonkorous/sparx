// What a content kind's "Web address pattern" may say.
//
// The pattern is a promise: the kind editor says it is "where these appear on your
// site", and the sitemap, the RSS feed and site search all print links from it. A
// pattern the website cannot serve turns every one of those into a dead link, so it is
// refused at the one door every write goes through (`createContentTypeTx` /
// `updateContentTypeTx`, used by the console and by the MCP tools alike).
//
// THE SAME RULE AS THE STOREFRONT'S. `@wizeworks/silica-catalog`'s
// `kindAddressFromPattern` decides which patterns the website serves; this decides which
// it accepts. This package cannot import that one, so `kind-address-agreement.test.ts`
// in api-rest (which depends on both) checks the two answer alike, word for word.

/** First words the website already uses for its own pages. Mirrors
 *  `RESERVED_KIND_SEGMENTS`; the agreement test keeps them in step. */
export const RESERVED_ADDRESS_WORDS: readonly string[] = [
  'account',
  'api',
  'authors',
  'blog',
  'book',
  'booking',
  'cart',
  'category',
  'checkout',
  'collections',
  'meet',
  'products',
  'search',
  'sign',
  '_next',
  'favicon.ico',
  'feed.xml',
  'llms.txt',
  'robots.txt',
  'sitemap.xml',
];

const WORD = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MARKER = '{slug}';

/** A pattern's words before `{slug}` — `/articles/{slug}` → `['articles']`. */
function wordsOf(pattern: string): string[] {
  return pattern
    .slice(1, -(MARKER.length + 1))
    .split('/')
    .filter((w) => w !== '');
}

/**
 * Why this pattern cannot be saved, in words for the person who typed it, or null when
 * it can. Blank means "no web address" and is always allowed.
 *
 * `/{slug}` is refused for a kind somebody makes: those addresses belong to the site's
 * own pages, and a kind there would fight every one of them for its address.
 */
export function urlPatternProblem(pattern: string | null | undefined): string | null {
  const value = (pattern ?? '').trim();
  if (value === '') return null;
  const example = 'Write it like /articles/{slug}.';
  if (!value.startsWith('/')) return `A web address starts with "/". ${example}`;
  if (value.includes('//')) return `A web address has one "/" between words. ${example}`;
  if (!value.endsWith(`/${MARKER}`)) {
    return `A web address ends with /{slug}, which is where each one's own name goes. ${example}`;
  }
  const words = wordsOf(value);
  if (words.length === 0) {
    return `Put a word before {slug}, so these do not take the addresses of your pages. ${example}`;
  }
  const bad = words.find((w) => !WORD.test(w));
  if (bad !== undefined) {
    return `"${bad}" cannot be part of a web address. Use lowercase letters, numbers and hyphens. ${example}`;
  }
  if (RESERVED_ADDRESS_WORDS.includes(words[0]!)) {
    return `Your website already uses /${words[0]} for its own pages. Pick another word.`;
  }
  return null;
}

/** `/articles/{slug}` and `/articles/{slug}/` compare alike. */
export function samePatternAddress(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const norm = (p: string | null | undefined) => (p ?? '').trim().replace(/\/+$/, '');
  return norm(a) !== '' && norm(a) === norm(b);
}
