// A person working inside a business they JOINED can save their own settings.
//
// MEASURED 2026-10-06 on Gillett: Mike Van Der Berg, the service manager, signed
// up from his invitation (which gave him a home workspace of his own) and joined
// Gillett as an editor. Every save of his own settings (the welcome tour, the
// consent question, view defaults, notification choices) answered 500, "That
// didn't save". A person's `users` row belongs to their home business, and RLS
// allows writing it only from there; inside Gillett it was readable (members may
// read) and not writable (sparx persona issue 122).

import { describe, expect, it } from 'vitest';
import { prisma } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import { authHeader, createTestTenant, dropTestTenant, signToken } from '../helpers.js';

async function preferencesOf(homeTenantId: string, userId: string): Promise<unknown> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${homeTenantId}'`);
    const row = await tx.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    return row?.preferences ?? null;
  });
}

describe('a member of a business they joined', () => {
  it('saves their own preferences and notification choices from inside it', async () => {
    const home = await createTestTenant('owner'); // Mike's own workspace
    const joined = await createTestTenant('owner'); // Gillett
    const app = await createApp();
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${joined.tenantId}'`);
        await tx.member.create({
          data: { organizationId: joined.tenantId, userId: home.userId, role: 'editor' },
        });
      });
      // His token acts in the business he joined, as its editor.
      const token = signToken(app, { tenantId: joined.tenantId, userId: home.userId }, 'editor');

      const prefs = await app.inject({
        method: 'PATCH',
        url: '/v1/me/preferences',
        headers: authHeader(token),
        payload: { defaultDetailView: 'drawer' },
      });
      expect(prefs.statusCode, prefs.body).toBe(200);

      const notifications = await app.inject({
        method: 'PUT',
        url: '/v1/me/notification-preferences',
        headers: authHeader(token),
        payload: { digest: 'daily' },
      });
      expect(notifications.statusCode, notifications.body).toBe(200);

      // Stored on his own row, in his home business.
      expect(await preferencesOf(home.tenantId, home.userId)).toMatchObject({
        defaultDetailView: 'drawer',
      });
    } finally {
      await app.close();
      await dropTestTenant(joined.tenantId);
      await dropTestTenant(home.tenantId);
    }
  });
});
