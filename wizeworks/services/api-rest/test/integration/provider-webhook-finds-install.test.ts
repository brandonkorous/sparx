// A provider webhook reaches the business that installed the provider.
//
// MEASURED 2026-10-06: POST /v1/webhooks/providers/:slug/:installationId read
// the installation with the bare client, and commerce_provider_installations
// forces row-level security. As sparx_app with no tenant set, the table looked
// empty, so every webhook was acknowledged as "no matching installation" and
// dropped: Shippo tracking updates never reached any business (sparx persona
// issue 125). Migration 20270530000030 adds the owner-side lookup.

import { describe, expect, it } from 'vitest';
import { withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import { createTestTenant, dropTestTenant } from '../helpers.js';

describe('POST /v1/webhooks/providers/:slug/:installationId', () => {
  it('records the event against the installation it was sent to', async () => {
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      const install = await withTenant({ tenantId: t.tenantId }, (tx) =>
        tx.providerInstallation.create({
          data: {
            tenantId: t.tenantId,
            providerSlug: 'shippo',
            kind: 'shipping',
            enabled: true,
            status: 'active',
          },
          select: { id: true },
        })
      );

      const response = await app.inject({
        method: 'POST',
        url: `/v1/webhooks/providers/shippo/${install.id}`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          event: 'track_updated',
          data: {
            trackingNumber: '1Z999AA10123456784',
            trackingStatus: { status: 'TRANSIT', statusDate: '2026-10-06T18:00:00Z' },
          },
        }),
      });
      expect(response.statusCode, response.body).toBe(200);

      const events = await withTenant({ tenantId: t.tenantId }, (tx) =>
        tx.providerWebhookEvent.findMany({
          where: { installationId: install.id },
          select: { providerEventType: true },
        })
      );
      expect(events).toEqual([{ providerEventType: 'track_updated' }]);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });
});
