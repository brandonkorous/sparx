import { NextResponse } from 'next/server';

/**
 * A redirect to another path on THIS app.
 *
 * ── WHY THIS EXISTS, AND WHY IT DOES NOT TAKE AN ORIGIN ─────────────────────
 *
 * The obvious spelling is `NextResponse.redirect(new URL('/sign-in', request.url))`,
 * and it shipped, and it sent every visitor to:
 *
 *     https://0.0.0.0:3000/sign-in?next=%2Fhandoff
 *
 * `request.url` is built from the address the server is BOUND to, and a pod binds
 * to `HOSTNAME=0.0.0.0` on `PORT=3000`. Behind Caddy that is invisible in
 * development (where the bind address and the public address are the same
 * machine) and total in production: getpiggles.com answered, correctly, with a
 * redirect to an address that exists nowhere. Nothing logged an error — a 307 is
 * a success, and the failure happened in the browser afterwards.
 *
 * The fix is not to reach for `BETTER_AUTH_URL` or any other configured origin.
 * It is to name no origin at all. A relative `Location` is valid HTTP
 * (RFC 7231 §7.1.2), every browser resolves it against the URL it actually
 * requested, and it is therefore correct behind any proxy, on any hostname, in
 * every environment — with no variable to set and none to get wrong. It is what
 * sparx's workbench has always done (`redirect('/sign-in?callbackURL=…')`),
 * which is why this bug never reached it.
 *
 * CROSS-ORIGIN REDIRECTS MUST NOT USE THIS. Sending somebody from getpiggles to
 * mypiggles is a different act with a different rule: it names another host, so
 * it has to be absolute and it has to come from configuration
 * (`PIGGLES_CONSOLE_ORIGIN`), never from the request.
 */
export function sameOriginRedirect(path: string, status: 303 | 307 = 307): NextResponse {
  // NOT NextResponse.redirect(): it parses its argument as an absolute URL and
  // rejects a bare path, which is the whole reason the broken spelling looked
  // like the only one available.
  return new NextResponse(null, { status, headers: { location: path } });
}

/** `/<path>?next=<where they were going>`, encoded once, in one place. */
export function sameOriginRedirectWithNext(
  path: string,
  next: string,
  status: 303 | 307 = 307
): NextResponse {
  const search = new URLSearchParams({ next });
  return sameOriginRedirect(`${path}?${search.toString()}`, status);
}
