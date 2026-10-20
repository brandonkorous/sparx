// A PATH NO SITE CAN HAVE, answered before the site is built.
//
// Scanners ask every host for `/.env`, `/.git/config`, `/.aws/credentials` and
// a hundred cousins. On a tenant site each one used to render the whole page
// before it reached the 404: the layout, its chrome, ten api-rest calls and
// about sixty database queries, to say "not found" to a bot. WizeLens counted
// 540 queries for 26 of them in one week, and the `/.env` family is asked for
// thousands of times.
//
// ── WHY ONLY DOT SEGMENTS ──────────────────────────────────────────────────
//
// A segment that starts with a dot is a hidden file. No page, product, post or
// category slug can start with one, so nothing a tenant built is ever behind it.
//
// The other common probes are NOT answered here, on purpose. `/wp-login.php`,
// `/wp-content/uploads/…` and `/index.php?p=12` are also the old addresses of a
// shop that moved here from WordPress, and a tenant's redirects (lib/redirects)
// are keyed by exactly those paths. Those redirects resolve on the page's 404
// path, so a probe filter that caught them at the edge would break every
// migrated link on a custom domain, and the edge cannot tell which tenant a
// custom domain belongs to without the lookup this file exists to avoid.
//
// `/.well-known/` is the one dot segment the web defines a meaning for (ACME,
// security.txt, OAuth discovery), so it is let through.

const WELL_KNOWN = '.well-known';

/** Is this a hidden-file path that no tenant page can answer? */
export function isProbePath(pathname: string): boolean {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // A malformed escape is a probe's habit, not a shopper's; judge it as sent.
  }
  return decoded.split('/').some((segment) => segment.startsWith('.') && segment !== WELL_KNOWN);
}

/** The answer to a probe: a small, cacheable 404 with no page behind it. */
export function probeNotFound(): Response {
  return new Response('Not found\n', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=86400',
      'x-robots-tag': 'noindex',
    },
  });
}
