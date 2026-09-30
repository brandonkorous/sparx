// A broadcast must never carry a BUILT-IN email to a whole audience.
//
// A keyed Builder email (`payment-failed`, `order-confirmation`, …) is one the
// platform sends on its own, to one person, when one thing happens to them. Its
// copy is about that event. Before this guard nothing on the API refused one as
// a broadcast body: POST /v1/email/broadcasts took the id, PATCH took it, and
// /send would have mailed "your payment failed" to every member of the list. The
// local database already held a draft broadcast pointing at `welcome-customer`.
//
// The console hides these emails from its picker, but the API is shared with
// the MCP tools and the Piggles console, so the refusal lives in the service and
// is proven here through the real routes: create, update, and send of a draft
// that already points at one (a row saved before the guard existed).
//
// A custom email (key NULL) still creates, so the guard is not a blanket refusal.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@wizeworks/db';
import { invalidateModuleCache } from '@wizeworks/auth';
import { createApp } from '../../src/app.js';
import {
  type TestTenant,
  authHeader,
  createTestTenant,
  dropTestTenant,
  signToken,
} from '../helpers.js';

interface ErrorBody {
  error?: { code?: string; message?: string };
}

describe('broadcasts refuse a built-in (keyed) email', () => {
  let app: FastifyInstance;
  let tenant: TestTenant;
  let token: string;
  let keyedId: string;
  let customId: string;

  async function asTenant<T>(
    fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.tenantId}'`);
      return fn(tx);
    });
  }

  beforeAll(async () => {
    app = await createApp();
    tenant = await createTestTenant('owner');
    token = signToken(app, tenant, 'owner', { emailVerified: true });
    await prisma.tenant.update({
      where: { id: tenant.tenantId },
      data: { settings: { modules: { email: { enabled: true } } } },
    });
    invalidateModuleCache();

    // Both rows are published: the guard must refuse on what the email IS, not
    // on it being unfinished.
    const doc = { type: 'root', children: [] };
    keyedId = await asTenant(async (tx) => {
      const row = await tx.builderEmail.create({
        data: {
          tenantId: tenant.tenantId,
          key: 'payment-failed',
          name: 'Payment failed',
          subject: 'Your payment did not go through',
          draftTree: doc,
          publishedTree: doc,
          publishedAt: new Date(),
        },
        select: { id: true },
      });
      return row.id;
    });
    customId = await asTenant(async (tx) => {
      const row = await tx.builderEmail.create({
        data: {
          tenantId: tenant.tenantId,
          key: null,
          name: 'Autumn newsletter',
          subject: 'What is new this autumn',
          draftTree: doc,
          publishedTree: doc,
          publishedAt: new Date(),
        },
        select: { id: true },
      });
      return row.id;
    });
  });

  afterAll(async () => {
    await dropTestTenant(tenant.tenantId);
    await app.close();
  });

  it('refuses to create a broadcast whose body is a built-in email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/email/broadcasts',
      headers: authHeader(token),
      payload: { name: 'Oops', subject: 'Hello', builderEmailId: keyedId },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json<ErrorBody>();
    expect(body.error?.message).toContain('"Payment failed" is sent automatically');
    const count = await asTenant((tx) =>
      tx.broadcast.count({ where: { tenantId: tenant.tenantId, builderEmailId: keyedId } })
    );
    expect(count).toBe(0);
  });

  it('still creates a broadcast whose body is an email the owner wrote', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/email/broadcasts',
      headers: authHeader(token),
      payload: { name: 'Autumn', subject: 'Hello', builderEmailId: customId },
    });
    expect(res.statusCode).toBe(201);
  });

  it('refuses to switch a draft over to a built-in email', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/email/broadcasts',
      headers: authHeader(token),
      payload: { name: 'Switch', subject: 'Hello', builderEmailId: customId },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json<{ data: { id: string } }>().data.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/email/broadcasts/${id}`,
      headers: authHeader(token),
      payload: { builderEmailId: keyedId },
    });
    expect(res.statusCode).toBe(422);
    const row = await asTenant((tx) => tx.broadcast.findUniqueOrThrow({ where: { id } }));
    expect(row.builderEmailId).toBe(customId);
  });

  it('refuses to send a draft that already points at a built-in email', async () => {
    // Written straight to the table, the way a draft saved before the guard sits.
    const id = await asTenant(async (tx) => {
      const row = await tx.broadcast.create({
        data: {
          tenantId: tenant.tenantId,
          propertyId: tenant.propertyId,
          name: 'Old draft',
          subject: 'Hello',
          builderEmailId: keyedId,
          status: 'draft',
        },
        select: { id: true },
      });
      return row.id;
    });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/email/broadcasts/${id}/send`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<ErrorBody>().error?.message).toContain('is sent automatically');
    const row = await asTenant((tx) => tx.broadcast.findUniqueOrThrow({ where: { id } }));
    expect(row.status).toBe('draft');
    const queued = await asTenant((tx) =>
      tx.scheduledSend.count({ where: { tenantId: tenant.tenantId } })
    );
    expect(queued).toBe(0);
  });
});
