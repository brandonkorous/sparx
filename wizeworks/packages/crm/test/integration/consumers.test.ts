// Consumer integration tests.
//
// The consumers subscribe to platform events (order.*, email.*, quote.*,
// user.*) and turn them into CrmActivity rows — the customer's timeline.
// Tests here:
//
//   1. order.created / order.refunded → the activity row lands.
//   2. Neither one touches total_spent or order_count. Those are money, they
//      are derived from the orders inside the order write path, and a consumer
//      whose failure is swallowed has no business writing them. See
//      src/services/customer-rollup.ts and customer-rollup.test.ts.
//   3. An event for a tenant where CRM is DISABLED lands nothing at all —
//      locked decision #6.
//   4. email.unsubscribed flips do_not_contact.
//   5. user.login keyed by authUserId lands on the right customer via the FK.

import crypto from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma, withTenant } from '@wizeworks/db';
import { invalidateModuleCache } from '@wizeworks/modules';
import {
  customerService,
  registerCrmConsumers,
  resetDedupeForTesting,
  resetPlatformBusForTesting,
  type PlatformEventBus,
} from '../../src/index.js';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

describe('CRM consumers', () => {
  let bus: PlatformEventBus;
  let teardown: () => void;
  let alice: TestTenant;
  let aliceCtx: { tenantId: string; userId: string };
  let aliceCustomerId: string;
  let aliceCustomerAuthId: string;

  beforeAll(async () => {
    bus = resetPlatformBusForTesting();
    resetDedupeForTesting();
    const registration = registerCrmConsumers({ bus });
    teardown = () => registration.unregister();

    alice = await createTestTenant('owner');
    aliceCtx = { tenantId: alice.tenantId, userId: alice.userId };

    // One customer to receive everything. Set authUserId so the auth-event
    // consumer can find them by FK.
    const created = await customerService.create(aliceCtx, {
      type: 'retail',
      email: 'kira@example.test',
      firstName: 'Kira',
    });
    aliceCustomerId = created.id;
    // authUserId FKs to CustomerUser (Layer 2 shopper login) — a real row is
    // required, not just a random UUID. Set via a tenant-scoped raw update —
    // service-layer create doesn't expose it on the Zod schema (the field is
    // internal to the customer↔auth link).
    await withTenant(aliceCtx, async (tx) => {
      const authUser = await tx.customerUser.create({
        data: { email: 'kira@example.test', name: 'Kira' },
      });
      aliceCustomerAuthId = authUser.id;
      await tx.customer.update({
        where: { id: created.id },
        data: { authUserId: aliceCustomerAuthId },
      });
    });
  });

  afterAll(async () => {
    teardown();
    await dropTestTenant(alice.tenantId);
  });

  beforeEach(() => {
    resetDedupeForTesting();
  });

  it('order.created writes the timeline entry', async () => {
    const orderId = crypto.randomUUID();
    const placedAt = new Date();

    await bus.publish({
      id: crypto.randomUUID(),
      topic: 'order.created',
      tenantId: alice.tenantId,
      occurredAt: placedAt,
      payload: {
        orderId,
        customerId: aliceCustomerId,
        total: 250,
        currency: 'USD',
        placedAt: placedAt.toISOString(),
      },
    });
    await bus.drain();

    const activities = await withTenant(aliceCtx, (tx) =>
      tx.crmActivity.findMany({
        where: { customerId: aliceCustomerId, type: 'order.placed' },
      })
    );
    expect(activities).toHaveLength(1);
    expect(activities[0]?.linkedEntityId).toBe(orderId);
  });

  it('names the order in the sentence, from the payload', async () => {
    // The number travels in the event because the producer holds it. Reading it
    // back here is a lookup that can fail, and when it did — checkout announces
    // the order from inside its own still-open transaction — four of five orders
    // on one shop appeared as "An order was placed", naming none of them.
    const orderId = crypto.randomUUID();
    await bus.publish({
      id: crypto.randomUUID(),
      topic: 'order.created',
      tenantId: alice.tenantId,
      occurredAt: new Date(),
      payload: {
        orderId,
        orderNumber: 'O-000123',
        customerId: aliceCustomerId,
        total: 42,
        currency: 'USD',
        placedAt: new Date().toISOString(),
      },
    });
    await bus.drain();

    const [activity] = await withTenant(aliceCtx, (tx) =>
      tx.crmActivity.findMany({ where: { linkedEntityId: orderId, type: 'order.placed' } })
    );
    expect(activity?.description).toContain('O-000123');
  });

  it('writes a shipped row that belongs to somebody, and refuses one that does not', async () => {
    // Both halves are the same defect. `order.fulfilled` carried no customerId
    // at all and the column is nullable, so every shipped and delivered row was
    // created against NOBODY — six of them on the shop this was found on, in no
    // customer's history and reachable from nowhere. The write succeeded every
    // time, which is why nothing noticed.
    const shipped = crypto.randomUUID();
    await bus.publish({
      id: crypto.randomUUID(),
      topic: 'order.fulfilled',
      tenantId: alice.tenantId,
      occurredAt: new Date(),
      payload: {
        orderId: shipped,
        orderNumber: 'O-000124',
        customerId: aliceCustomerId,
        fulfillmentId: crypto.randomUUID(),
      },
    });

    const orphan = crypto.randomUUID();
    await bus.publish({
      id: crypto.randomUUID(),
      topic: 'order.fulfilled',
      tenantId: alice.tenantId,
      occurredAt: new Date(),
      payload: { orderId: orphan, fulfillmentId: crypto.randomUUID() },
    });
    await bus.drain();

    const rows = await withTenant(aliceCtx, (tx) =>
      tx.crmActivity.findMany({ where: { linkedEntityId: { in: [shipped, orphan] } } })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.linkedEntityId).toBe(shipped);
    expect(rows[0]?.customerId).toBe(aliceCustomerId);
    expect(rows[0]?.description).toBe('Order O-000124 shipped');
  });

  it('leaves the money columns alone — they belong to the order write path', async () => {
    // The consumer used to increment total_spent here, and an increment is only
    // as reliable as its delivery: a swallowed handler failure corrupted the
    // figure permanently, and once one increment was lost the refund decrement
    // drove a customer's lifetime spend below zero. A synthetic event for an
    // order that does not exist must now move nothing.
    const before = await customerService.get(aliceCtx, aliceCustomerId);

    await bus.publish({
      id: crypto.randomUUID(),
      topic: 'order.created',
      tenantId: alice.tenantId,
      occurredAt: new Date(),
      payload: {
        orderId: crypto.randomUUID(),
        customerId: aliceCustomerId,
        total: 100,
        currency: 'USD',
        placedAt: new Date().toISOString(),
      },
    });
    await bus.publish({
      id: crypto.randomUUID(),
      topic: 'order.refunded',
      tenantId: alice.tenantId,
      occurredAt: new Date(),
      payload: {
        orderId: crypto.randomUUID(),
        customerId: aliceCustomerId,
        refundAmount: 50,
        currency: 'USD',
      },
    });
    await bus.drain();

    const after = await customerService.get(aliceCtx, aliceCustomerId);
    expect(Number(after.totalSpent)).toBe(Number(before.totalSpent));
    expect(after.orderCount).toBe(before.orderCount);
  });

  it('order.refunded writes the timeline entry', async () => {
    await bus.publish({
      id: crypto.randomUUID(),
      topic: 'order.refunded',
      tenantId: alice.tenantId,
      occurredAt: new Date(),
      payload: {
        orderId: crypto.randomUUID(),
        customerId: aliceCustomerId,
        refundAmount: 50,
        currency: 'USD',
      },
    });
    await bus.drain();

    const refund = await withTenant(aliceCtx, (tx) =>
      tx.crmActivity.findFirst({
        where: { customerId: aliceCustomerId, type: 'order.refunded' },
      })
    );
    expect(refund).not.toBeNull();
  });

  it('email.unsubscribed flips do_not_contact', async () => {
    await bus.publish({
      id: crypto.randomUUID(),
      topic: 'email.unsubscribed',
      tenantId: alice.tenantId,
      occurredAt: new Date(),
      payload: {
        customerId: aliceCustomerId,
        messageId: crypto.randomUUID(),
      },
    });
    await bus.drain();

    const after = await customerService.get(aliceCtx, aliceCustomerId);
    expect(after.doNotContact).toBe(true);

    const activity = await withTenant(aliceCtx, (tx) =>
      tx.crmActivity.findFirst({
        where: { customerId: aliceCustomerId, type: 'email.unsubscribed' },
      })
    );
    expect(activity).not.toBeNull();
  });

  it('user.login resolves to the customer via authUserId FK', async () => {
    await bus.publish({
      id: crypto.randomUUID(),
      topic: 'user.login',
      tenantId: alice.tenantId,
      occurredAt: new Date(),
      payload: {
        authUserId: aliceCustomerAuthId,
        ipAddress: '203.0.113.7',
      },
    });
    await bus.drain();

    const activity = await withTenant(aliceCtx, (tx) =>
      tx.crmActivity.findFirst({
        where: { customerId: aliceCustomerId, type: 'login' },
        orderBy: { createdAt: 'desc' },
      })
    );
    expect(activity).not.toBeNull();
    const metadata = activity!.metadata as Record<string, unknown>;
    expect(metadata.ipAddress).toBe('203.0.113.7');
  });

  it('zero side effects for a CRM-disabled tenant (locked decision #6)', async () => {
    // Make a separate tenant without enabling the CRM module.
    const disabledSlug = `crm-disabled-${crypto.randomBytes(4).toString('hex')}`;
    const disabled = await prisma.tenant.create({
      data: {
        slug: disabledSlug,
        name: `Disabled ${disabledSlug}`,
        email: `${disabledSlug}@sparx.test`,
        plan: 'starter',
        status: 'active',
        settings: {}, // no modules block → CRM disabled
      },
    });
    invalidateModuleCache(disabled.id, 'crm');

    // Need a customer-shaped row to target. RLS would let us insert one
    // anyway because the test bypasses module-gate at the service layer —
    // the gate is what's under test. Insert via raw to bypass the service.
    const fakeCustomerId = crypto.randomUUID();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${disabled.id}'`);
      await tx.customer.create({
        data: {
          id: fakeCustomerId,
          tenantId: disabled.id,
          type: 'retail',
          email: 'ignored@example.test',
        },
      });
    });

    await bus.publish({
      id: crypto.randomUUID(),
      topic: 'order.created',
      tenantId: disabled.id,
      occurredAt: new Date(),
      payload: {
        orderId: crypto.randomUUID(),
        customerId: fakeCustomerId,
        total: 999,
        currency: 'USD',
        placedAt: new Date().toISOString(),
      },
    });
    await bus.drain();

    // No activity recorded, no stats moved.
    const activities = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${disabled.id}'`);
      return tx.crmActivity.findMany({ where: { customerId: fakeCustomerId } });
    });
    expect(activities).toHaveLength(0);

    const customer = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${disabled.id}'`);
      return tx.customer.findUniqueOrThrow({ where: { id: fakeCustomerId } });
    });
    expect(Number(customer.totalSpent)).toBe(0);
    expect(customer.orderCount).toBe(0);

    await dropTestTenant(disabled.id);
    invalidateModuleCache(disabled.id, 'crm');
  });
});
