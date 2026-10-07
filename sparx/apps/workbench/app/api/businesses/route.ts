import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth, listMyMemberships, requireSession } from '@wizeworks/auth';

// The businesses this person may act as, and the act of moving between them.
//
// MEASURED 2026-10-06 on Gillett Diesel: Mike Van Der Berg and Kendra Ruiz each
// belong to two businesses, Gillett and the empty workspace their sign-up made.
// The toolbar printed one name and called it "a fact of the session; there is
// nothing to switch it to from here". There was no way between them at all; the
// other console has had this route and a switcher for months (persona issue 124).
//
// Neither verb can create a session. Both need one and act within it: GET reads
// the caller's own memberships, with their role in each, and POST moves the
// existing session to another business. Better Auth re-checks membership on the
// move, so a business the caller has left cannot be entered by naming it.

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
