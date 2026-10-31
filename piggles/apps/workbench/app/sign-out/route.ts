import { NextResponse, type NextRequest } from 'next/server';
import { signOutSession } from '@wizeworks/auth-client-server';
import { accountOrigin } from '@piggles/auth-handoff';

// Signing out, from the console side.
//
// Both domains' cookies address ONE session row — that is the property the
// handoff was built to preserve — so signing out has exactly two jobs, and doing
// only one of them is the bug worth naming:
//
//   1. REVOKE THE SESSION. api-rest deletes the row. Skipping this and
//      only dropping the cookie would leave a live session that getpiggles still
//      honours: the person "signs out" of the console, goes to their account
//      page, and is still signed in. Worse on a shared machine, where signing out
//      is the whole point.
//
//   2. DROP THIS DOMAIN'S COOKIES. Revoking alone is not enough either — the
//      cookie would survive and address a session that no longer exists, and
//      the cached copy of the session beside it would be trusted for minutes
//      without asking anyone. api-rest names every cookie to clear; clearing
//      them makes the state honest immediately.
//
// Then out to the account app. The console has nowhere to land a signed-out
// visitor: it has no signed-out state, by design.
//
// POST, not GET. A sign-out on GET is a one-pixel image away from being
// triggered by any page the person visits.

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Never throws: if revocation fails, the cookies are STILL dropped. A person
  // who asked to be signed out and was left signed in because a call failed is
  // the worst possible outcome here.
  const cleared = await signOutSession(request.headers);

  const response = NextResponse.redirect(`${accountOrigin()}/sign-in?signedOut=1`, 303);
  for (const cookie of cleared) {
    response.cookies.set({ name: cookie.name, value: cookie.value, ...cookie.options });
  }
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return response;
}
