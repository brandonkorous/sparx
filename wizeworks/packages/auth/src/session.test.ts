// A PERSON'S OWN ROW STAYS IN THEIR HOME BUSINESS.
//
// Measured 2026-10-06 on Gillett Diesel: Mike Van Der Berg signed up from his
// invitation (which gave him a home workspace of his own) and joined Gillett as an
// editor. Inside Gillett, every save of his own settings failed: the consent
// question answered "That did not save" and came back on every page load. His
// `users` row belongs to his home business; RLS lets a member READ it from the
// joined business and never write it. The session reported only the business he
// was acting in, so nothing that wrote his row could name the right one
// (sparx persona issue 122).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const authGetSession = vi.fn();
const memberFindUnique = vi.fn();

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('./server', () => ({ auth: { api: { getSession: authGetSession } } }));
vi.mock('./prisma', () => ({ authPrisma: { member: { findUnique: memberFindUnique } } }));

const { getSession } = await import('./session');

const HOME = '305ad459-0000-4000-8000-000000000001';
const JOINED = '5944fe23-be83-4ce5-aafc-ef56b8594508';

function signedIn(activeOrganizationId: string | null) {
  authGetSession.mockResolvedValue({
    user: {
      id: 'user-mike',
      email: 'mike.vanderberg@gillettdiesel.test',
      emailVerified: true,
      tenantId: HOME,
      role: 'owner',
    },
    session: {
      id: 'session-1',
      userId: 'user-mike',
      expiresAt: new Date('2026-10-07T00:00:00Z'),
      activeOrganizationId,
    },
  });
}

describe('getSession', () => {
  beforeEach(() => {
    authGetSession.mockReset();
    memberFindUnique.mockReset();
  });

  it('acts in the business they joined, and still names their home one', async () => {
    signedIn(JOINED);
    memberFindUnique.mockResolvedValue({ role: 'editor', status: 'active' });

    const session = await getSession();

    expect(session?.user.tenantId).toBe(JOINED);
    expect(session?.user.role).toBe('editor');
    expect(session?.user.homeTenantId).toBe(HOME);
  });

  it('is the same business twice for someone working in their own', async () => {
    signedIn(null);

    const session = await getSession();

    expect(session?.user.tenantId).toBe(HOME);
    expect(session?.user.homeTenantId).toBe(HOME);
    expect(memberFindUnique).not.toHaveBeenCalled();
  });

  it('falls back home, both ways, when the membership is gone', async () => {
    signedIn(JOINED);
    memberFindUnique.mockResolvedValue(null);

    const session = await getSession();

    expect(session?.user.tenantId).toBe(HOME);
    expect(session?.user.homeTenantId).toBe(HOME);
  });
});
