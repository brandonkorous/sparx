import { NextResponse, type NextRequest } from 'next/server';
import { ATTR_COOKIES, newVisitorId } from '@sparx/attribution';

// Edge attribution seed (docs/80 §5.3, §7.2). Next 16 renamed the `middleware`
// file convention to `proxy` (same Edge-runtime behaviour). Mints a first-party
// visitor id on the first response so capture survives even if the client bundle
// is blocked — the client component (attribution-capture.tsx) enriches with
// referrer + UTMs. Scoped to `.sparx.works` in prod so app.sparx.works reads it
// at signup; host-only on localhost / preview hosts where a registrable-domain
// cookie won't set.
export function proxy(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  if (!request.cookies.has(ATTR_COOKIES.visitor)) {
    const host = request.nextUrl.hostname;
    const onSparx = host === 'sparx.works' || host.endsWith('.sparx.works');
    response.cookies.set(ATTR_COOKIES.visitor, newVisitorId(), {
      domain: onSparx ? '.sparx.works' : undefined,
      path: '/',
      maxAge: 400 * 86_400, // Chrome's cap
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
    });
  }

  return response;
}

// Run on pages, not on static assets, the image optimizer, or files with an
// extension (`.png`, `.svg`, …) — they don't need an attribution touch.
//
// `opengraph-image` / `twitter-image` are excluded explicitly because Next's
// metadata-image routes are EXTENSIONLESS (`/pricing/opengraph-image`), so the
// `\.[\w]+$` rule above never caught them and this proxy was attaching a
// Set-Cookie to a PNG. Two things broke as a result: crawlers treat a
// cookie-setting image response as suspect, and Cloudflare refuses to cache any
// response carrying Set-Cookie — so every social card was a cold origin hit.
// Anchored with `$` so only the metadata route itself is excluded, not an
// ordinary page whose path happens to contain the word.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*(?:opengraph-image|twitter-image)$|.*\\.[\\w]+$).*)',
  ],
};
