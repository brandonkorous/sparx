// THE CONSENT ANSWER IS WRITTEN WHERE THE PERSON'S ROW LIVES.
//
// Measured 2026-10-06 on Gillett Diesel: Mike Van Der Berg, invited as an editor,
// answered "No thanks" to the analytics question and got "That did not save". The
// question came back on every page load. His `users` row belongs to his home
// business, and RLS refuses a write to it from a business he joined. The route ran
// under the business he was acting in (sparx persona issue 122).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const tenantsWritten: string[] = [];

vi.mock('@wizeworks/auth', () => ({ getSession }));
vi.mock('@wizeworks/db', () => ({
  withTenant: (ctx: { tenantId: string }, fn: (tx: unknown) => Promise<unknown>) => {
    tenantsWritten.push(ctx.tenantId);
    return fn({
      user: {
        findUnique: () => Promise.resolve({ preferences: { defaultDetailView: 'drawer' } }),
        update: () => Promise.resolve({}),
      },
    });
  },
}));

const { POST } = await import('./route');

const HOME = '305ad459-0000-4000-8000-000000000001';
const JOINED = '5944fe23-be83-4ce5-aafc-ef56b8594508';

function answer(analytics: boolean): Request {
  return new Request('http://localhost:3011/api/consent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ analytics }),
  });
}

describe('POST /api/consent', () => {
  beforeEach(() => {
    tenantsWritten.length = 0;
  });

  it('writes an invited member answer under their home business', async () => {
    getSession.mockResolvedValue({
      user: { id: 'user-mike', tenantId: JOINED, homeTenantId: HOME, role: 'editor' },
    });

    const response = await POST(answer(false));

    expect(response.status).toBe(200);
    expect(tenantsWritten).toEqual([HOME]);
  });
});
