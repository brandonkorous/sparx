import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './server';
import { authPrisma } from './prisma';

// Server-side helper for Next.js server components / server actions.
//
// `getSession()` returns the session or null; `requireSession()` redirects to
// /sign-in if there is no session, otherwise returns a narrowed shape that
// guarantees `tenantId` is present. Every dashboard page or server action that
// touches tenant-scoped data should pull the context from here so we never
// hand-roll the `auth.api.getSession({ headers })` boilerplate ad hoc.
//
// Organizations & Teams (docs/114 §A.3): `user.tenantId` is the ACTIVE org's
// tenant id, and `user.role` is the user's role IN THAT org. For a single-tenant
// user both equal their own tenant + home role (a zero-extra-query fast path);
// for a consultant who switched into a client account, they reflect that org.
// The JWT (api-rest-client `signToken`) is minted from these two fields, so the
// entire RLS + role path downstream is unchanged — only the *selection* is new.

export interface SparxSession {
  user: {
    id: string;
    email: string;
    /** Better Auth standard field. Verify-but-don't-block: sign-in never gates
     *  on this, but sensitive actions + the dashboard nudge banner read it. */
    emailVerified: boolean;
    name?: string | null;
    image?: string | null;
    /** The ACTIVE organization's tenant id (docs/114 §A.3). */
    tenantId: string;
    /** The user's role in the active organization. */
    role: string;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    /** The org the session is currently acting in; null → the home tenant. */
    activeOrganizationId: string | null;
  };
}

export async function getSession(): Promise<SparxSession | null> {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result) return null;

  // Cast through unknown: the additionalFields (tenantId/role) aren't in Better
  // Auth's inferred user shape, and enabling the mcp()/organization() plugins
  // narrowed that inference enough that a direct assertion no longer overlaps.
  const user = result.user as unknown as SparxSession['user'];
  if (!user.tenantId) {
    // A user row without a tenantId means something hand-edited the DB or our
    // sign-up hook missed a path. Treat it as unauthenticated rather than
    // letting a query run with an undefined GUC.
    return null;
  }

  const activeOrganizationId =
    (result.session as unknown as { activeOrganizationId?: string | null }).activeOrganizationId ??
    null;

  let tenantId = user.tenantId;
  let role = user.role;

  // Only resolve when the active org differs from the home tenant — single-tenant
  // users take the fast path with no extra query. Authorization invariant: we may
  // only act in an org the user is actually a member of, so a stale/removed
  // membership falls back to the home tenant rather than granting access.
  if (activeOrganizationId && activeOrganizationId !== user.tenantId) {
    const membership = await authPrisma.member.findUnique({
      where: {
        organizationId_userId: { organizationId: activeOrganizationId, userId: user.id },
      },
      select: { role: true, status: true },
    });
    if (membership?.status === 'active') {
      tenantId = activeOrganizationId;
      role = membership.role;
    }
  }

  return {
    user: { ...user, tenantId, role },
    session: {
      id: result.session.id,
      userId: result.session.userId,
      expiresAt: result.session.expiresAt,
      activeOrganizationId,
    },
  };
}

export async function requireSession(): Promise<SparxSession> {
  const session = await getSession();
  if (!session) {
    redirect('/sign-in');
  }
  return session;
}
