// Who a server-side api-rest call is FOR.
//
// A page or action built on the server calls api-rest from its pod, so without
// help api-rest sees the pod's address — one address shared by every visitor of
// that app. api-rest's per-IP rate limit then holds them all to one budget: on
// 2026-10-18 a scraper on the marketing site's marketplace spent that budget and
// every real visitor got an empty catalog. Passing the visitor's own chain lets
// api-rest limit (and record) the person who asked, while the pod's address stays
// a hop it trusts and skips (@wizeworks/client-ip).
//
// ── Forward it on UNCACHED calls only ─────────────────────────────────────────
//
// Next.js puts request headers into the data-cache key. A cached read that
// carried this would get one cache entry per visitor, which is no cache at all.
// Cached reads reach api-rest only on a miss and are shared by everyone, so they
// stay anonymous; per-request work — `no-store` reads, POSTs, server actions,
// proxied browser calls — is what forwards.
//
// The chain is passed VERBATIM, never trimmed to one entry. api-rest reads it
// from the right and skips only hops it trusts, so an address the visitor wrote
// at the left is ignored there; picking an entry here would undo that.

/** Anything with a case-insensitive `get` — the `Headers` from `next/headers`,
 *  a `Request`'s headers, or a test double. */
interface HeaderSource {
  get(name: string): string | null;
}

/** The incoming request's client chain as an outgoing `x-forwarded-for`, ready to
 *  spread into a fetch's `headers`. Empty when the request carried none (a build,
 *  a cron).
 *
 *  Caddy always sets X-Forwarded-For. X-Real-IP is the older single-value spelling
 *  some local proxies send instead, and it is carried AS X-Forwarded-For, because
 *  that is the only header api-rest's `trustProxy` reads — sent under its own
 *  name it would arrive and be ignored. */
export function forwardedFor(incoming: HeaderSource): Record<string, string> {
  // The first NON-BLANK of the two: a present-but-blank X-Forwarded-For falls
  // through to X-Real-IP, which `??` would not do (it keeps the empty string).
  const chain = [incoming.get('x-forwarded-for'), incoming.get('x-real-ip')]
    .map((value) => value?.trim())
    .find(Boolean);
  return chain ? { 'x-forwarded-for': chain } : {};
}
