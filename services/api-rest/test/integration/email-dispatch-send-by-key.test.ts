// Send-by-key dispatch + the CAN-SPAM compliance gate, end-to-end on the real
// email-dispatch tick (docs/90 Step 4, docs/91 §6, §8). The enqueue side (a seed
// writing a `defer.builderEmailKey` ScheduledSend) lives in automation-actions'
// seeds-email test; THIS proves the DISPATCH half — that the tick resolves a send's
// builder-email by `key` via getPublishedByKey and enforces the gate:
//
//   • a transactional send keyed to a published default → delivered (status 'sent').
//   • a send declared MARKETING whose resolved tree has no unsubscribe node →
//     REFUSED ('failed', compliance reason). Contrast with a marketing send keyed
//     to a tree that DOES carry one → delivered: proves the gate inspects the
//     resolved tree, i.e. the key actually resolved.
//   • an unknown key → 'failed' (not published).
//
// Activation provisions the 13 keyed defaults through the real route (the in-process
// provisioning consumer this process registers); we then enqueue ScheduledSend rows
// directly and run the tick. Pub/Sub is the dev (log-only) publisher, so a delivered
// send simply stays 'sent'; the gate's refusals flip it to 'failed'.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@sparx/db';
import { invalidateModuleCache } from '@sparx/auth';
import { resetPlatformBusForTesting } from '@sparx/crm';
import { createApp } from '../../src/app.js';
import { registerEmailProvisioningConsumer } from '../../src/lib/email-provisioning.js';
import { runEmailDispatchTick } from '../../src/lib/email-dispatch.js';
import { authHeader, signToken, createTestTenant, dropTestTenant } from '../helpers.js';

interface SendSpec {
  key?: string;
  emailType: 'transactional' | 'marketing';
  customerId: string;
}

describe('email-dispatch — send by key + compliance gate', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
    resetPlatformBusForTesting();
    registerEmailProvisioningConsumer();
  });

  afterAll(async () => {
    await app.close();
  });

  /** A tenant with email active + the 13 defaults provisioned, plus one customer. */
  async function setup(): Promise<{ tenantId: string; customerId: string }> {
    const t = await createTestTenant('owner');
    const token = signToken(app, t);
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/tenant/modules',
      headers: authHeader(token),
      payload: { modules: { builder: true, email: true } },
    });
    expect(res.statusCode).toBe(200);
    invalidateModuleCache();

    const customerId = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${t.tenantId}'`);
      const c = await tx.customer.create({
        data: { tenantId: t.tenantId, type: 'retail', email: 'buyer@sparx.test', firstName: 'Ada' },
        select: { id: true },
      });
      return c.id;
    });
    return { tenantId: t.tenantId, customerId };
  }

  /** Enqueue a due `defer` send and return its id. `key: undefined` ⇒ a bogus key. */
  async function enqueue(tenantId: string, spec: SendSpec): Promise<string> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      const send = await tx.scheduledSend.create({
        data: {
          tenantId,
          recipient: 'buyer@sparx.test',
          customerId: spec.customerId,
          payload: {
            defer: { builderEmailKey: spec.key ?? 'does-not-exist', emailType: spec.emailType },
          },
          entityRefs: { customerId: spec.customerId },
          dueAt: new Date(Date.now() - 1_000),
          status: 'pending',
        },
        select: { id: true },
      });
      return send.id;
    });
  }

  /** Run the tick until none of `ids` are still pending (the cross-tenant scan is
   *  batched at 100; loop so a busy test DB doesn't starve our rows). The pending
   *  count is read RLS-scoped — the bare client (sparx_app, FORCE RLS) sees nothing
   *  without a tenant context. */
  async function drain(tenantId: string, ids: string[]): Promise<void> {
    for (let i = 0; i < 12; i += 1) {
      const pending = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
        return tx.scheduledSend.count({ where: { id: { in: ids }, status: 'pending' } });
      });
      if (pending === 0) return;
      await runEmailDispatchTick(app.log);
    }
  }

  async function statusOf(
    tenantId: string,
    id: string
  ): Promise<{ status: string; lastError: string | null }> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      return tx.scheduledSend.findUniqueOrThrow({
        where: { id },
        select: { status: true, lastError: true },
      });
    });
  }

  it('delivers a transactional key send, refuses marketing without unsubscribe, and fails an unknown key', async () => {
    const { tenantId, customerId } = await setup();
    try {
      // welcome-customer is a TRANSACTIONAL default (no unsubscribe node).
      const transactional = await enqueue(tenantId, {
        key: 'welcome-customer',
        emailType: 'transactional',
        customerId,
      });
      // win-back is a MARKETING default (carries unsubscribe + physical address).
      const marketingOk = await enqueue(tenantId, {
        key: 'win-back',
        emailType: 'marketing',
        customerId,
      });
      // welcome-customer declared as MARKETING — its tree has no unsubscribe node,
      // so the compliance gate must refuse it.
      const marketingBad = await enqueue(tenantId, {
        key: 'welcome-customer',
        emailType: 'marketing',
        customerId,
      });
      // An unknown key resolves to nothing → not published.
      const unknownKey = await enqueue(tenantId, {
        key: undefined,
        emailType: 'transactional',
        customerId,
      });

      await drain(tenantId, [transactional, marketingOk, marketingBad, unknownKey]);

      // Transactional + marketing-with-unsubscribe → delivered (resolved by key).
      expect((await statusOf(tenantId, transactional)).status).toBe('sent');
      expect((await statusOf(tenantId, marketingOk)).status).toBe('sent');

      // Marketing-without-unsubscribe → refused on compliance grounds.
      const bad = await statusOf(tenantId, marketingBad);
      expect(bad.status).toBe('failed');
      expect(bad.lastError).toContain('compliance');

      // Unknown key → failed (not published).
      const missing = await statusOf(tenantId, unknownKey);
      expect(missing.status).toBe('failed');
      expect(missing.lastError).toContain('not published');
    } finally {
      await dropTestTenant(tenantId);
    }
  });
});
