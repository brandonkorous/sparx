import { headers } from 'next/headers';
import { callAccountOperation } from '@wizeworks/auth-client-server';

// The businesses this person may act as, and the act of moving between them.
//
// ── WHY THIS ROUTE HAS TO EXIST ─────────────────────────────────────────────
//
// The shared auth CLIENT (`organization.list()` / `organization.setActive()`)
// talks to `/api/auth/*` on whatever origin it is running on. The console mounts
// no Better Auth handler and never will — getpiggles.com is the auth authority,
// and a second thing on a second domain that can mint sessions is exactly what
// the three-domain split exists to prevent (piggles/CLAUDE.md, "Cross-domain
// auth").
//
// So on this origin those calls fell through to the catch-all page route, came
// back as an HTML document with a 200, and the client turned that into "no
// businesses". The switcher renders plain text when there is nothing to switch
// to — which is the correct design and made the failure INVISIBLE. A person
// belonging to three businesses saw one name and no control, with no error
// anywhere. (Absent behaves exactly like fine; that is why this is a route and
// not a bug report.)
//
// ── AND WHY THIS IS NOT "MOUNTING AUTH ANYWAY" ──────────────────────────────
//
// Neither verb here can create a session. Both REQUIRE one and act within it:
// the GET is a read of the caller's own memberships, and the POST moves an
// existing session row's active organization. The work happens in api-rest
// (`/auth/piggles/platform/account/businesses`), which re-checks membership
// against the session, not against the list the browser was handed: the list is
// a snapshot and the switch is the decision. A caller naming a business they do
// not belong to gets a 403 rather than a switch.
//
// Never cached: a membership can be revoked between one page load and the next,
// and a stale list offers a door that is already locked.

export const dynamic = 'force-dynamic';

export interface ConsoleBusiness {
  id: string;
  name: string;
  slug: string;
  /** The caller's role in THIS business — owner here, bookkeeper there. */
  role: string;
}

export async function GET(): Promise<Response> {
  return callAccountOperation('businesses', { method: 'GET', requestHeaders: await headers() });
}

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  return callAccountOperation('businesses', {
    method: 'POST',
    requestHeaders: request.headers,
    body,
  });
}
