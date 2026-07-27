// Send-time link tracking (docs/impl transactional-email Slice 10) — the pass that
// makes an email's clicks MEASURABLE in the tenant's own analytics.
//
// Every email a tenant sends carries links (a "View your order" button, a product
// CTA, a "Read more"). Left bare, a click on one lands on the storefront with no
// referrer (mail clients strip it) and the tenant's analytics record it as "direct"
// — the email gets zero credit. This module rewrites every ON-SITE link in the
// rendered send to carry UTM params, so the storefront's capture (which learns to
// read `utm_medium=email` in the same slice) attributes the visit — and any order
// or form that follows — to the specific email.
//
// It is deliberately INVISIBLE to the author: a business owner never types "UTM".
// The email's own name is the campaign; the tagging happens here, at send, on the
// final URLs.
//
// ON-SITE ONLY, on purpose. A click that leaves the tenant's site (a carrier's
// shipment-tracking page, a social profile, a partner) can't be measured by the
// tenant's own analytics, so tagging it would be noise — those links are left
// exactly as authored. So are `mailto:`/`tel:`, bare anchors, and any URL an author
// deliberately gave its own `utm_source` (we never overwrite an explicit choice).
//
// Applied to BOTH the HTML and the plain-text body, over the SAME concrete URLs, so
// a plain-text reader's click is attributed identically. Runs AFTER token
// interpolation (render step 3/4), when every href is a resolved absolute URL.

/** utm_medium for every sparx email link — the channel class the tenant analytics
 *  capture keys on to bucket a visit as "Email". A fixed constant, not per-tenant. */
export const EMAIL_UTM_MEDIUM = 'email';

export interface EmailLinkTracking {
  /** `utm_campaign` — the author-facing campaign, defaulting to the email's name
   *  (e.g. "Welcome email"). What the tenant sees broken out in their reports. */
  campaign: string;
  /** `utm_source` — the specific email's stable identity (its key or a slug of its
   *  name, e.g. `welcome-customer`), for per-email drill-down under the Email bucket. */
  source: string;
  /** The tenant site host(s) whose links get tagged — lower-cased, `www.`-stripped
   *  (e.g. `["acme.com", "shop.acme.com"]`). A link to any other host is off-site and
   *  left untouched. Empty → nothing is tagged (no site context; a no-op). */
  hosts: readonly string[];
}

/** Normalize a host for comparison: lower-case, strip a leading `www.`. */
function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

/** True when `url`'s host is one of the tenant's tracked site hosts. */
function isOnSite(url: URL, hosts: readonly string[]): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = normalizeHost(url.hostname);
  return hosts.some((h) => normalizeHost(h) === host);
}

/**
 * Append the tracking params to ONE URL, or return it unchanged when it shouldn't be
 * tagged: a non-absolute/relative URL (no host to compare — email links are
 * absolute), an off-site link, a non-http(s) scheme, or a URL that already carries a
 * `utm_source` (an author's explicit choice we never clobber). Existing query params
 * and the fragment are preserved; the params are set, not blindly appended, so a
 * re-run is idempotent.
 */
export function tagTrackedUrl(raw: string, tracking: EmailLinkTracking): string {
  if (tracking.hosts.length === 0) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Relative, `mailto:`, `tel:`, `#anchor`, or a still-unresolved `{{token}}` —
    // nothing we can attribute to the tenant's site.
    return raw;
  }
  if (!isOnSite(url, tracking.hosts)) return raw;
  if (url.searchParams.has('utm_source')) return raw; // author set their own — respect it.

  url.searchParams.set('utm_source', tracking.source);
  url.searchParams.set('utm_medium', EMAIL_UTM_MEDIUM);
  url.searchParams.set('utm_campaign', tracking.campaign);
  return url.toString();
}

/** Every `href="…"` in the send HTML, on-site ones tagged. A tight attribute-level
 *  rewrite (not a full parse): `toEmailHtml` emits well-formed double-quoted `href`
 *  attributes, so matching `href="([^"]*)"` is exact here and can't run away. Both
 *  `<a>` and any other `href` carrier (a linked image maps to an `<a>` wrapper) are
 *  covered uniformly. */
export function tagEmailHtmlLinks(html: string, tracking: EmailLinkTracking): string {
  if (tracking.hosts.length === 0) return html;
  return html.replace(/href="([^"]*)"/g, (whole, href: string) => {
    const tagged = tagTrackedUrl(decodeHtml(href), tracking);
    return tagged === decodeHtml(href) ? whole : `href="${encodeHtml(tagged)}"`;
  });
}

/** Every absolute http(s) URL in the plain-text body, on-site ones tagged — so a
 *  plain-text reader's click is attributed like the HTML. Matches a run of URL-safe
 *  characters after `http`; trailing sentence punctuation is excluded from the match
 *  so "…/sale." tags the URL, not the period. */
export function tagEmailTextLinks(text: string, tracking: EmailLinkTracking): string {
  if (tracking.hosts.length === 0) return text;
  return text.replace(/https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;!?]/g, (url: string) =>
    tagTrackedUrl(url, tracking)
  );
}

// The href attribute in `toEmailHtml` output carries HTML entity encoding (`&` →
// `&amp;`), and a URL with existing query params arrives here already encoded. Decode
// before parsing so `URLSearchParams` sees real `&` separators, then re-encode when
// writing back — otherwise a second `?`/`&` would corrupt the query string.
function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function encodeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
