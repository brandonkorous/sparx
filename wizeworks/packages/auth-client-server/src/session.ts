// The signed-in person, for a server render or a server action, read from
// api-rest instead of from a database this app no longer holds.
//
// Same names and the same shape as `@wizeworks/auth`'s getSession() and
// requireSession(), so a call site switches its import and nothing else.
// api-rest resolves it with the same code (`resolveSession`), including the
// active-organization membership check.

import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { brandAuthUrl, forwardedHeaders, PlatformAuthUnavailableError } from './platform-api';

/** The wire shape of `GET /auth/<brand>/session`. Mirrors `@wizeworks/auth`'s SparxSession. */
export interface SparxSession {
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name?: string | null;
    image?: string | null;
    /** The ACTIVE organization's tenant id. */
    tenantId: string;
    /** The tenant the person's own `users` row belongs to. */
    homeTenantId: string;
    /** The person's role in the active organization. */
    role: string;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    /** The org the session is acting in; null means the home tenant. */
    activeOrganizationId: string | null;
  };
}

type WireSession = Omit<SparxSession, 'session'> & {
  session: Omit<SparxSession['session'], 'expiresAt'> & { expiresAt: string };
};

/**
 * The session for these request headers, or null when there is none.
 *
 * Throws when api-rest cannot answer. A network fault or a 500 is not "signed
 * out": treating it as one would bounce a signed-in owner to the sign-in page,
 * where signing in again fails the same way.
 */
export async function readSession(
  requestHeaders: Headers,
  fetchImpl: typeof fetch = fetch
): Promise<SparxSession | null> {
  const path = '/session';
  let res: Response;
  try {
    res = await fetchImpl(brandAuthUrl(path), {
      method: 'GET',
      headers: forwardedHeaders(requestHeaders),
      cache: 'no-store',
    });
  } catch {
    throw new PlatformAuthUnavailableError(path, null);
  }
  if (res.status === 401) return null;
  if (!res.ok) throw new PlatformAuthUnavailableError(path, res.status);
  const { session } = (await res.json()) as { session: WireSession };
  return {
    user: session.user,
    session: { ...session.session, expiresAt: new Date(session.session.expiresAt) },
  };
}

/** One api-rest call per render, however many components ask. */
export const getSession = cache(async (): Promise<SparxSession | null> =>
  readSession(await headers())
);

/** The session, or a redirect to `/sign-in` when there is none. */
export async function requireSession(): Promise<SparxSession> {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  return session;
}
