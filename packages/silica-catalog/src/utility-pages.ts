// The starter's UTILITY pages — the ones sparx builds because a site needs them to
// work, not because anyone should ever arrive at them from a search result.
//
// `/cart`, `/search` and the four account pages are authored by `starterPages` on every
// new site. They are real pages at real addresses, so nothing about them is patterned or
// exempt the way a record address is — but they are not CONTENT. Nobody writes a search
// description for "Reset password", nobody wants Google indexing a cart, and an owner
// opening Check on day one should not be handed six findings about pages they did not
// write and would gain nothing by editing.
//
// ── Why a slug list rather than the `noindex` column ─────────────────────────
// `BuilderPage.noindex` already exists and is already honoured — the sitemap skips any
// row carrying it, and site-lint suppresses every SEO finding on it. The gap is that
// nothing ever SETS it: `sync` writes `noindex` only when the caller passes one
// (`p.noindex !== undefined`), and the code-authored starter has no field to pass. So
// every new tenant's cart and login pages are indexable, and Check reports 30 findings
// on a site whose owner has not touched a thing — 15 `seo-description-missing` warnings
// and 15 `seo-title-missing` suggestions, six of each on pages that should never have
// been graded.
//
// This is the same shape as `isRecordAddress`: a closed, platform-authored set matched
// by exact slug, so a consumer gets the right answer from the slug alone without a
// column having been populated correctly first. Seeding `noindex: true` on these rows is
// the belt to this braces and remains worth doing — but it only helps sites created
// AFTER it lands, and this one is retroactive.
//
// A tenant may still deliberately mark any other page `noindex`; that column stays the
// author's control and is unaffected. This list is only about what sparx itself ships.

/** Starter-authored addresses that exist to make the site work, not to be found.
 *  Leading slash included, matching what `starterPages` authors. */
export const UTILITY_PAGE_SLUGS: readonly string[] = [
  '/cart',
  '/search',
  '/account/login',
  '/account/register',
  '/account/forgot',
  '/account/reset',
];

/** Normalize the several spellings a slug arrives in — `about`, `/about` and a trailing
 *  slash are the same page, and every caller should not have to remember that. */
function normalize(slug: string | null | undefined): string {
  if (!slug) return '';
  const trimmed = slug.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed === '/') return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Is this one of the starter's utility pages — a page that should be excluded from the
 * sitemap and never graded for search copy?
 *
 * Exact match against the closed set, never a prefix: `/searchlight` and
 * `/account/login-help` are ordinary pages an author may well have written, and a
 * `startsWith` check would silently stop grading them.
 */
export function isUtilityPage(slug: string | null | undefined): boolean {
  const target = normalize(slug);
  return target !== '' && UTILITY_PAGE_SLUGS.includes(target);
}
