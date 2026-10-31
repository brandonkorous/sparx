// THE CONSENT ANSWER IS WRITTEN WHERE THE PERSON'S ROW LIVES.
//
// Measured 2026-10-06 on Gillett Diesel: Mike Van Der Berg, invited as an editor,
// answered "No thanks" to the analytics question and got "That did not save". The
// question came back on every page load. His `users` row belongs to his home
// business, and RLS refuses a write to it from a business he joined. The route ran
// under the business he was acting in (sparx persona issue 122).
//
// The write moved from the workbench to this route (docs/154), and the rule
// moved with it.

import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as PlatformScope from './platform-scope.js';

const HOME = '305ad459-0000-4000-8000-000000000001';
const JOINED = '5944fe23-be83-4ce5-aafc-ef56b8594508';

const tenantsWritten: string[] = [];
const platformSession = vi.fn();

vi.mock('@wizeworks/db', () => ({
  prisma: {},
  SAMPLE_DATA_PACKS: {},
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
// Furnishing is a large graph no consent case reaches.
vi.mock('../../lib/furnish-tenant.js', () => ({ furnishTenant: vi.fn() }));
vi.mock('./platform-scope.js', async (original) => ({
  ...(await original<typeof PlatformScope>()),
  platformSession,
}));

const { default: platformBusinessRoutes } = await import('./platform-business.js');

async function answer(analytics: boolean) {
  const app = Fastify();
  await app.register(platformBusinessRoutes);
  return app.inject({
    method: 'POST',
    url: '/auth/sparx/platform/consent',
    payload: { analytics },
  });
}

describe('POST /auth/<brand>/platform/consent', () => {
  beforeEach(() => {
    tenantsWritten.length = 0;
    platformSession.mockReset();
  });

  it('writes an invited member answer under their home business', async () => {
    platformSession.mockResolvedValue({
      brand: 'sparx',
      session: {
        user: { id: 'user-mike', tenantId: JOINED, homeTenantId: HOME, role: 'editor' },
      },
    });

    const response = await answer(false);

    expect(response.statusCode).toBe(200);
    expect(tenantsWritten).toEqual([HOME]);
  });

  it('refuses a caller with no session and writes nothing', async () => {
    platformSession.mockResolvedValue(null);

    const response = await answer(true);

    expect(response.statusCode).toBe(401);
    expect(tenantsWritten).toEqual([]);
  });
});
