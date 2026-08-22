import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@wizeworks/auth';

// Signing out, from the account side.
//
// getpiggles.com is the auth authority — it is where the session is minted and
// where the cookie lives — so it is also where a person looks for the way out.
// Until issue #004 the only Sign out in Piggles was in the CONSOLE's topbar,
// which meant leaving getpiggles.com required entering the business first.
//
// Both domains' cookies address ONE Better Auth session row (@piggles/auth-handoff),
// so revoking here ends the console's session too — the same property the
// console's own route relies on, running the other way.
//
// Better Auth's handler already knows how to clear its own cookie correctly,
// including the signed variant and the __Secure- prefix in production. Rather
// than reconstruct that here and drift from it, `asResponse: true` hands back
// the real response and its Set-Cookie headers are copied onto the redirect.
// Rebuilding the cookie by hand is how a sign-out ends up clearing a cookie with
// the wrong name and leaving the person signed in.
//
// POST, not GET. A sign-out on GET is one prefetch or one <img> away from being
// triggered by a page somebody merely visited.

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Best-effort: if revocation fails, the cookie must STILL be cleared. Somebody
  // who asked to be signed out and was left signed in because a database call
  // hiccuped is the worst outcome available here.
  const signedOut = await auth.api
    .signOut({ headers: request.headers, asResponse: true })
    .catch(() => null);

  const response = NextResponse.redirect(new URL('/sign-in', request.url), 303);
  for (const cookie of signedOut?.headers.getSetCookie() ?? []) {
    response.headers.append('set-cookie', cookie);
  }
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return response;
}
