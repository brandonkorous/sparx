// What a DARK site says to a machine.
//
// When a tenant's billing lapses past its grace window the storefront serves a
// neutral "back soon" overlay instead of the site (components/site-suspended).
// Every crawler-facing surface has to say the same thing, and the thing it has
// to say is narrow: **ask again later**. Not "there is nothing here", not
// "remove this from search" — later. The business is coming back, usually
// within the hour, and its listings have to survive the gap.
//
// The first version of this file said "stay out" instead, in two ways that both
// mean REMOVE ME, and that cancelled each other out:
//
//   robots.txt   200 `Disallow: /`          a RULE, cached for as long as the
//                                           crawler holds robots.txt, which
//                                           stops the crawl outright
//   every page   <meta robots="noindex">    which the stopped crawl never
//                                           fetches, and which asks for the
//                                           page to be DELETED when it does
//
// A crawler reads robots.txt before anything else, so the page-level guard only
// ever reached crawlers that had ignored the disallow — and the moment it did
// reach one, it asked for the listing to be dropped. Both halves punished the
// business for a late invoice, and the punishment outlived the invoice: the
// shop pays, the site returns, and the listings have to be earned again.
//
// `sitemap.xml` and `llms.txt` had the same shape of mistake one step smaller.
// They answered 404, and the comment explaining the 404 said a missing sitemap
// "reads as 'ask again later', which is the truth". It does not. 404 reads as
// "there is nothing at this address". There is exactly one status that means
// ask again later, and it is the one below.
//
// So every dark answer is now **503 with `Retry-After`**, which is the signal a
// search engine is built to receive for a site that is temporarily down: it
// pauses, it holds what it already has, and it comes back. Nothing is
// cacheable, because suspension lifts the moment a payment goes through and a
// cached "stay out" would keep the shop dark to a crawler after the business
// has already paid to be visible.
//
// Nothing here names the tenant, the platform, or the reason. A visitor and a
// crawler get the same neutral sentence the overlay gives: temporarily
// unavailable. Why it is dark is between the business and its bill.
//
// ── AND THE PAGES, WHICH WERE NOT ON THE FIRST LIST ────────────────────────
//
// The three functions below were written from the crawler's FILE NAMES, and the
// pages were left answering 200 (issue 844). One outage then gave a crawler two
// answers: robots.txt said "pause, I am down", and the home page said "200 OK,
// here is the shop, and it says Back soon".
//
// A 200 with no `robots` directive is the one combination that lets the DARK
// page be indexed in place of the shop — which is the outcome the paragraph
// above says this whole file exists to prevent, reached by the other road.
//
// A Next layout cannot set a status code, so the page's 503 is served from the
// edge proxy. That is the only place in the request that can both know the
// phase and choose the status. The document it returns is below, and it shares
// its sentences with `components/site-suspended` so the two cannot drift.

import type { Metadata } from 'next';

/**
 * The only two sentences on a dark site, and the tab it sits in.
 *
 * Shared, because a dark page is rendered in two places — the edge proxy, which
 * can set a 503, and the root layout, which cannot but still catches anything
 * the proxy's lookup could not answer. Two renderers of one screen is how one
 * gets a copy edit and the other keeps the old words.
 */
export const SUSPENDED_TITLE = 'Temporarily unavailable';
export const SUSPENDED_HEADING = 'Back soon';
export const SUSPENDED_BODY =
  'This site is taking a short break. Thanks for your patience, and please check again a little later.';

/**
 * How long a crawler is asked to wait. Ten minutes: long enough that a crawler
 * is not hammering a shop that is down, short enough that the first retry after
 * a payment lands within the same visit to the console.
 */
const RETRY_AFTER_SECONDS = '600';

/**
 * The headers on every dark answer.
 *
 * `no-store` and not a short max-age: the five-minute cache this used to carry
 * was already reasoning toward the right answer ("a crawler holding a stale
 * 'stay out' costs the business re-crawling it has already paid for") and then
 * stopping five minutes short of it. A dark answer is true for exactly as long
 * as the invoice is unpaid, which nothing downstream can predict, so nothing
 * downstream should keep a copy.
 */
function darkHeaders(contentType: string): Record<string, string> {
  return {
    'content-type': contentType,
    'retry-after': RETRY_AFTER_SECONDS,
    'cache-control': 'no-store',
  };
}

/**
 * Every page of a suspended site, to a crawler.
 *
 * A neutral title, so the shop's real title and description do not sit above a
 * blank page under its own name — and **no `robots` directive at all**. That
 * absence is the point, not an oversight: `noindex` is the instruction to
 * remove a URL from search, which is the one outcome this whole file exists to
 * prevent. Holding the listing while the shop is dark is the goal, and 503 is
 * what asks for it.
 */
export const SUSPENDED_METADATA: Metadata = {
  title: SUSPENDED_TITLE,
};

/**
 * robots.txt for a dark site.
 *
 * 503 rather than `Disallow: /`. A disallow is a rule a crawler stores and
 * obeys until it re-reads the file, so serving one during an outage can outlast
 * the outage; and while it is held, every other guard below it is unreachable,
 * because a crawler that has been told not to crawl does not fetch the pages
 * that carry them. A 5xx on robots.txt is the documented way to say "do not
 * crawl me right now" without leaving a rule behind: the crawler pauses and
 * asks again.
 */
export function suspendedRobotsTxt(): Response {
  return new Response('# Temporarily unavailable\n', {
    status: 503,
    headers: darkHeaders('text/plain; charset=utf-8'),
  });
}

/**
 * sitemap.xml for a dark site.
 *
 * Not an empty `<urlset>`, which reads as "this shop has no pages" and can be
 * acted on, and not a 404, which reads as "there is no sitemap here" and gets
 * the sitemap dropped. 503 says the sitemap exists and cannot be served yet.
 */
export function suspendedSitemapXml(): Response {
  return new Response('Temporarily unavailable', {
    status: 503,
    headers: darkHeaders('text/plain; charset=utf-8'),
  });
}

/** llms.txt for a dark site: no identity, no entry points, no product map. */
export function suspendedLlmsTxt(): Response {
  return new Response('# Temporarily unavailable\n', {
    status: 503,
    headers: darkHeaders('text/plain; charset=utf-8'),
  });
}

/**
 * The overlay a dark site's PAGES answer with, as a whole document.
 *
 * Self-contained, which is the same constraint `components/site-suspended`
 * already states for itself and now actually meets: no Tailwind bundle, no font
 * package, no tenant theme. It has to be, because this is returned from the edge
 * proxy, where none of the app's CSS exists.
 *
 * The look is the component's, written out: the neutral background, the real ink
 * (there is nothing on this page that is not meant to be read), and the heading
 * that steps up on a wider screen.
 */
function suspendedDocument(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${SUSPENDED_TITLE}</title>
<style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:0 1.5rem;
background:#fafafa;color:#171717;
font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
main{width:100%;max-width:28rem;text-align:center}
h1{margin:0;font-size:1.5rem;font-weight:600;letter-spacing:-0.025em}
p{margin:0.75rem 0 0;font-size:1rem;line-height:1.625}
@media (min-width:640px){h1{font-size:1.875rem}}
</style>
</head>
<body>
<main>
<h1>${SUSPENDED_HEADING}</h1>
<p>${SUSPENDED_BODY}</p>
</main>
</body>
</html>
`;
}

/**
 * Every PAGE of a suspended site, to anyone.
 *
 * 503, the same status and the same `Retry-After` the three machine files above
 * already answer with, so one outage gives one answer. A visitor sees exactly
 * what they saw before — a browser renders a 503 body normally — and a crawler
 * now hears "ask again later" from the page as well as from robots.txt.
 *
 * Still NO `noindex`, for the reason `SUSPENDED_METADATA` gives: 503 asks the
 * listing to be HELD, and `noindex` asks for it to be deleted.
 */
export function suspendedPage(): Response {
  return new Response(suspendedDocument(), {
    status: 503,
    headers: darkHeaders('text/html; charset=utf-8'),
  });
}
