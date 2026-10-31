import { headers } from 'next/headers';
import { callAccountOperation } from '@wizeworks/auth-client-server';

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
// existing session to another business. The work happens in api-rest
// (`/auth/sparx/platform/account/businesses`), which re-checks membership
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
