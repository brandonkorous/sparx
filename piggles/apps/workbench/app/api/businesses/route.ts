import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth, listMyMemberships, requireSession } from '@sparx/auth';

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
// existing session row's active organization. There is no credential, no
// callback, no token minted. The authority to say who you are stays on
// getpiggles; this only answers which of your businesses you are looking at.
//
// The membership read goes through `listMyMemberships` rather than the org
// plugin's own `listOrganizations` because it carries the membership EDGE — the
// caller's role in each business — which the switcher will want the moment it
// wants to say "you are a bookkeeper here". It reads through `authPrisma`, is
// scoped to the session's own user id, and cannot widen access on its own.

export const dynamic = 'force-dynamic';

export interface ConsoleBusiness {
  id: string;
  name: string;
  slug: string;
  /** The caller's role in THIS business — owner here, bookkeeper there. */
  role: string;
}

export async function GET(): Promise<NextResponse> {
  const session = await requireSession();
  const memberships = await listMyMemberships(session.user.id);

  const body: ConsoleBusiness[] = memberships.map((membership) => ({
    id: membership.organizationId,
    name: membership.name,
    slug: membership.slug,
    role: membership.role,
  }));

  // Never cached: a membership can be revoked between one page load and the
  // next, and a stale list offers a door that is already locked.
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store, private' } });
}

export async function POST(request: Request): Promise<NextResponse> {
  await requireSession();

  const payload: unknown = await request.json().catch(() => null);
  const organizationId =
    payload && typeof payload === 'object' && 'organizationId' in payload
      ? (payload as { organizationId?: unknown }).organizationId
      : undefined;

  if (typeof organizationId !== 'string' || organizationId.length === 0) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }

  // Membership is re-checked HERE, by Better Auth, against the session — not
  // against the list the browser was handed. That matters: the list is a
  // snapshot and this is the decision. A caller naming a business they do not
  // belong to gets a refusal rather than a switch.
  try {
    await auth.api.setActiveOrganization({
      body: { organizationId },
      headers: await headers(),
    });
  } catch {
    return NextResponse.json({ error: 'not a member of that business' }, { status: 403 });
  }

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store, private' } });
}
