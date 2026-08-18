// Live Chat routes (docs/56, docs/69 A-1) — wiring + module-gate + lifecycle.
//
// Covers: requireModule('chat') fires before handlers (404 envelope), the staff
// conversation lifecycle (create → message → assign → resolve), quick-replies
// CRUD, and the public storefront flow (start → token-guarded message, with a
// 403 on token mismatch).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@wizeworks/db';
import { invalidateModuleCache } from '@wizeworks/auth';
import { createApp } from '../../src/app.js';
import { authHeader, seedPrimaryProperty, signToken } from '../helpers.js';

interface ChatTenant {
  tenantId: string;
  userId: string;
  slug: string;
}

async function createChatTenant(chatEnabled: boolean): Promise<ChatTenant> {
  const slug = `apichat-${crypto.randomBytes(4).toString('hex')}`;
  const email = `${slug}@sparx.test`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `Chat API ${slug}`,
      email,
      plan: 'starter',
      status: 'active',
      settings: chatEnabled ? { modules: { chat: { enabled: true } } } : {},
    },
  });
  const user = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
    await tx.user.create({
      data: { tenantId: tenant.id, email, name: `API ${slug}`, role: 'owner' },
    });
    return tx.user.findFirstOrThrow({ where: { tenantId: tenant.id, email } });
  });
  // Real provisioning gives every tenant a PRIMARY site, so a fixture without
  // one builds a tenant that cannot exist — and every site-resolving read 404s.
  await seedPrimaryProperty(tenant.id, `Test ${tenant.slug}`);
  return { tenantId: tenant.id, userId: user.id, slug };
}

describe('Live Chat routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    invalidateModuleCache();
  });

  it('returns MODULE_DISABLED (404) when chat is off', async () => {
    const t = await createChatTenant(false);
    try {
      const token = signToken(app, t);
      const res = await app.inject({
        method: 'GET',
        url: '/v1/chat/conversations',
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MODULE_DISABLED');
      expect(body.error.details).toMatchObject({ module: 'chat' });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('runs the staff conversation lifecycle when chat is on', async () => {
    const t = await createChatTenant(true);
    try {
      const token = signToken(app, t);

      const empty = await app.inject({
        method: 'GET',
        url: '/v1/chat/conversations',
        headers: authHeader(token),
      });
      expect(empty.statusCode).toBe(200);
      expect(empty.json()).toMatchObject({ success: true, data: [], meta: { total: 0 } });

      const created = await app.inject({
        method: 'POST',
        url: '/v1/chat/conversations',
        headers: authHeader(token),
        payload: { subject: 'Order question', message: 'Hi, where is my order?' },
      });
      expect(created.statusCode).toBe(201);
      const conv = created.json().data;
      expect(conv).toMatchObject({
        status: 'open',
        source: 'dashboard',
        subject: 'Order question',
      });
      expect(conv.messages).toHaveLength(1);
      expect(conv.messages[0]).toMatchObject({
        senderType: 'staff',
        body: 'Hi, where is my order?',
      });

      const message = await app.inject({
        method: 'POST',
        url: `/v1/chat/conversations/${conv.id}/messages`,
        headers: authHeader(token),
        payload: { body: 'Following up here.' },
      });
      expect(message.statusCode).toBe(201);
      expect(message.json().data).toMatchObject({
        senderType: 'staff',
        body: 'Following up here.',
      });

      const assigned = await app.inject({
        method: 'PATCH',
        url: `/v1/chat/conversations/${conv.id}`,
        headers: authHeader(token),
        payload: { assignedToId: t.userId, status: 'resolved' },
      });
      expect(assigned.statusCode).toBe(200);
      expect(assigned.json().data).toMatchObject({ status: 'resolved', assignedToId: t.userId });

      const context = await app.inject({
        method: 'GET',
        url: `/v1/chat/conversations/${conv.id}/context`,
        headers: authHeader(token),
      });
      expect(context.statusCode).toBe(200);
      expect(context.json().data).toMatchObject({ linked: false });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('manages quick replies', async () => {
    const t = await createChatTenant(true);
    try {
      const token = signToken(app, t);
      const created = await app.inject({
        method: 'POST',
        url: '/v1/chat/quick-replies',
        headers: authHeader(token),
        payload: { title: 'Greeting', body: 'Hi there! How can I help?', shortcut: 'hi' },
      });
      expect(created.statusCode).toBe(201);
      const id = created.json().data.id;

      const list = await app.inject({
        method: 'GET',
        url: '/v1/chat/quick-replies',
        headers: authHeader(token),
      });
      expect(list.json().data).toHaveLength(1);

      const removed = await app.inject({
        method: 'DELETE',
        url: `/v1/chat/quick-replies/${id}`,
        headers: authHeader(token),
      });
      expect(removed.statusCode).toBe(204);
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('runs the public widget flow and enforces the visitor token', async () => {
    const t = await createChatTenant(true);
    try {
      const start = await app.inject({
        method: 'POST',
        url: `/v1/public/chat/conversations?tenant=${t.slug}`,
        payload: { visitorName: 'Pat', visitorEmail: 'pat@example.test', message: 'Hello!' },
      });
      expect(start.statusCode).toBe(201);
      const { conversation, visitorToken } = start.json().data;
      expect(visitorToken).toBeTruthy();
      expect(conversation.messages[0]).toMatchObject({ senderType: 'customer', body: 'Hello!' });

      // Correct token → message accepted.
      const ok = await app.inject({
        method: 'POST',
        url: `/v1/public/chat/conversations/${conversation.id}/messages?tenant=${t.slug}`,
        headers: { 'x-chat-token': visitorToken },
        payload: { body: 'Still there?' },
      });
      expect(ok.statusCode).toBe(201);

      // Missing/wrong token → 403.
      const forbidden = await app.inject({
        method: 'POST',
        url: `/v1/public/chat/conversations/${conversation.id}/messages?tenant=${t.slug}`,
        headers: { 'x-chat-token': 'not-the-token' },
        payload: { body: 'sneaky' },
      });
      expect(forbidden.statusCode).toBe(403);

      // The staff inbox should now show the conversation with 2 inbound unread.
      const token = signToken(app, t);
      const list = await app.inject({
        method: 'GET',
        url: '/v1/chat/conversations',
        headers: authHeader(token),
      });
      const items = list.json().data;
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ unreadStaff: 2, customerName: 'Pat' });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('rejects a public start when chat is disabled', async () => {
    const t = await createChatTenant(false);
    try {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/public/chat/conversations?tenant=${t.slug}`,
        payload: { message: 'Hello!' },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('MODULE_DISABLED');
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });
});
