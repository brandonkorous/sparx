// The Security screen's device list.
//
// Better Auth 1.7 put `listSessions` behind its "fresh session" rule (signed in
// within the last day). The list failed with SESSION_NOT_FRESH for anybody who
// had stayed signed in. Measured 2026-10-31 on app.sparx.works. Seeing your own
// devices changes nothing, so the list must not need a fresh sign-in.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession, listSessionsEndpoint, listSessionsStore } = vi.hoisted(() => ({
  getSession: vi.fn(),
  listSessionsEndpoint: vi.fn(),
  listSessionsStore: vi.fn(),
}));

vi.mock('./server', () => ({
  auth: {
    api: { getSession, listSessions: listSessionsEndpoint },
    $context: Promise.resolve({ internalAdapter: { listSessions: listSessionsStore } }),
  },
}));
vi.mock('./organizations', () => ({ listMyMemberships: vi.fn() }));

const { runAccountOperation } = await import('./account-operations');

const DAY = 24 * 60 * 60 * 1000;
const row = (token: string, expiresIn: number) => ({
  token,
  createdAt: new Date(Date.now() - 10 * DAY),
  updatedAt: new Date(),
  expiresAt: new Date(Date.now() + expiresIn),
  ipAddress: '203.0.113.7',
  userAgent: 'Mozilla/5.0',
});

describe('GET sessions', () => {
  beforeEach(() => {
    getSession.mockReset();
    listSessionsEndpoint.mockReset();
    listSessionsStore.mockReset();
    // The endpoint refuses a session older than a day, as Better Auth 1.7 does.
    listSessionsEndpoint.mockRejectedValue(
      Object.assign(new Error('Session is not fresh'), {
        statusCode: 403,
        body: { message: 'Session is not fresh' },
      })
    );
  });

  it('lists the devices of a person signed in ten days ago', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' }, session: { token: 'here' } });
    listSessionsStore.mockResolvedValue([row('here', DAY), row('laptop', DAY)]);

    const result = await runAccountOperation('GET', 'sessions', new Headers(), {});

    expect(result.status).toBe(200);
    expect(listSessionsStore).toHaveBeenCalledWith('user-1', { onlyActiveSessions: true });
    expect(result.body).toEqual([
      expect.objectContaining({ token: 'here', current: true }),
      expect.objectContaining({ token: 'laptop', current: false }),
    ]);
  });

  it('leaves out a device whose session has expired', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' }, session: { token: 'here' } });
    listSessionsStore.mockResolvedValue([row('here', DAY), row('old', -1000)]);

    const result = await runAccountOperation('GET', 'sessions', new Headers(), {});

    expect((result.body as { token: string }[]).map((r) => r.token)).toEqual(['here']);
  });

  it('answers a signed-out caller with 401 and reads nothing', async () => {
    getSession.mockResolvedValue(null);

    const result = await runAccountOperation('GET', 'sessions', new Headers(), {});

    expect(result.status).toBe(401);
    expect(listSessionsStore).not.toHaveBeenCalled();
  });
});
