import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveSession, type SparxSession } from './session-core';

export type { SparxSession } from './session-core';

// Server-side helper for Next.js server components / server actions.
//
// `getSession()` returns the session or null; `requireSession()` redirects to
// /sign-in if there is no session, otherwise returns a narrowed shape that
// guarantees `tenantId` is present. Every page or server action that touches
// tenant-scoped data should pull the context from here so we never hand-roll
// the `auth.api.getSession({ headers })` boilerplate ad hoc. The resolution
// itself (active organization, membership check) lives in ./session-core.

export async function getSession(): Promise<SparxSession | null> {
  return resolveSession(await headers());
}

export async function requireSession(): Promise<SparxSession> {
  const session = await getSession();
  if (!session) {
    redirect('/sign-in');
  }
  return session;
}
