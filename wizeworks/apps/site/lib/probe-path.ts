// A PATH NO SITE CAN HAVE, answered before the site is built.
//
// Scanners ask every host for `/.env`, `/.git/config`, `/.aws/credentials` and
// a hundred cousins. On a tenant site each one used to render the whole page
// before it reached the 404: the layout, its chrome, ten api-rest calls and
// about sixty database queries, to say "not found" to a bot. WizeLens counted
// 540 queries for 26 of them in one week, and the `/.env` family is asked for
// thousands of times.
//
// ── WHY ONLY DOT SEGMENTS (AND BYTES NO SLUG HAS) ─────────────────────────
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
//
// ── AND FILES NO PAGE IS (WW-8) ────────────────────────────────────────────
//
// `/config.json`, `/app-config.js`, `/backup.sql`: a config, script, data,
// archive or key file. No page, product or post address ends in one, and a
// WordPress shop's old addresses end in .php, .html or an image, never these. They
// must stop HERE: Next 16 sends a 200 head before the page can say not found, so
// the catch-all answered every one of them 200. `/api/…` is ours, so a `.php`
// under it is a probe too; the api-rest relay at `/api/sparx/` passes untouched.

const WELL_KNOWN = '.well-known';

// A control character (`%00`, `%1F`) or a broken escape (`%c0`) is never in a slug either;
// before WW-2 a NUL rode on to Postgres and a broken escape crashed the page, both as 500s.
function hasControlChar(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

const PROBE_EXTENSIONS = new Set(
  (
    'json js mjs cjs map ts yml yaml toml ini conf cfg config env properties ' +
    'sql sqlite sqlite3 db mdb bak backup old orig save swp tmp log ' +
    'zip gz tgz tar rar 7z bz2 pem key crt cer p12 pfx jks ' +
    'sh bash ps1 bat cmd py rb pl cgi jsp jspx asp aspx war jar exe dll'
  ).split(' ')
);

const API_RELAY = '/api/sparx/';

function extensionOf(segment: string): string | null {
  const dot = segment.lastIndexOf('.');
  return dot > 0 ? segment.slice(dot + 1).toLowerCase() : null;
}

/** A config, script, data, archive or key file: no page is one (WW-8). */
function isProbeFile(decoded: string): boolean {
  if (decoded.startsWith(API_RELAY)) return false;
  const ext = extensionOf(decoded.slice(decoded.lastIndexOf('/') + 1));
  if (!ext) return false;
  return PROBE_EXTENSIONS.has(ext) || (ext === 'php' && decoded.startsWith('/api/'));
}

/** Is this a path that no tenant page can answer? */
export function isProbePath(pathname: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  if (hasControlChar(decoded) || isProbeFile(decoded)) return true;
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
