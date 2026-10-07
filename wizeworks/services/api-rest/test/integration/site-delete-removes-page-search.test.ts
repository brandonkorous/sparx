// Deleting a site takes its pages out of search (sparx persona issue 130).
//
// Each page has its own search entry, and the database removes a site's pages
// with the site. Nothing would name those pages again afterwards, so an owner
// who closed one of two businesses would still find its About page in the search
// box, opening a site that is gone.

import { describe, expect, it, vi } from 'vitest';
import { invalidateModuleCache } from '@wizeworks/auth';
import type * as Events from '@wizeworks/events';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import { authHeader, createTestTenant, dropTestTenant, signToken } from '../helpers.js';

const signals: { entityType: string; recordId: string; op?: string }[] = [];

vi.mock('@wizeworks/events', async (importOriginal) => ({
  ...(await importOriginal<typeof Events>()),
  indexEntity: (input: { entityType: string; recordId: string; op?: string }) => {
    signals.push({ entityType: input.entityType, recordId: input.recordId, op: input.op });
    return Promise.resolve();
  },
}));

describe('DELETE /v1/properties/:id', () => {
  it('removes each of the site’s pages from search', async () => {
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await prisma.tenant.update({
        where: { id: t.tenantId },
        data: { settings: { modules: { builder: { enabled: true } } } },
      });
      invalidateModuleCache();
      const { siteId, pageIds } = await withTenant({ tenantId: t.tenantId }, async (tx) => {
        const site = await tx.property.create({
          data: { tenantId: t.tenantId, slug: 'savory', name: 'Savory Donuts' },
          select: { id: true },
        });
        const page = (name: string, slug: string | null) =>
          tx.builderPage.create({
            data: { tenantId: t.tenantId, propertyId: site.id, name, slug, draftTree: {} },
            select: { id: true },
          });
        const ids = [(await page('Home', null)).id, (await page('About', 'about')).id];
        return { siteId: site.id, pageIds: ids };
      });

      signals.length = 0;
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/properties/${siteId}`,
        headers: authHeader(signToken(app, { tenantId: t.tenantId, userId: t.userId }, 'owner')),
      });
      expect(res.statusCode, res.body).toBe(200);

      const pageSignals = signals.filter((s) => s.entityType === 'builder_page');
      expect(pageSignals.map((s) => s.recordId).sort()).toEqual([...pageIds].sort());
      expect(pageSignals.every((s) => s.op === 'delete')).toBe(true);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });
});
