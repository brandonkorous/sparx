// Live Chat routes (docs/56, docs/69 A-1) — wiring + module-gate + lifecycle.
//
// Covers: requireModule('chat') fires before handlers (404 envelope), the staff
// conversation lifecycle (create → message → assign → resolve), quick-replies
// CRUD, and the public storefront flow (start → token-guarded message, with a
// 403 on token mismatch).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma, withTenant } from '@wizeworks/db';
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

/** A second website under the same business, so the email match can be shown
 *  answering with the right one of two people who share an address. */
async function createSite(tenantId: string, slug: string, name: string): Promise<string> {
  return withTenant({ tenantId }, async (tx) => {
    const row = await tx.property.create({
      data: { tenantId, slug, name, isPrimary: false },
      select: { id: true },
    });
    return row.id;
  });
}

async function primarySiteId(tenantId: string): Promise<string> {
  return withTenant({ tenantId }, async (tx) => {
    const row = await tx.property.findFirstOrThrow({
      where: { tenantId, isPrimary: true },
      select: { id: true },
    });
    return row.id;
  });
}

async function createCustomer(
  tenantId: string,
  opts: {
    propertyId: string | null;
    email: string;
    firstName: string;
    lastName: string;
    orderCount?: number;
    totalSpent?: number;
  }
): Promise<string> {
  return withTenant({ tenantId }, async (tx) => {
    const row = await tx.customer.create({
      data: {
        tenantId,
        propertyId: opts.propertyId,
        email: opts.email,
        firstName: opts.firstName,
        lastName: opts.lastName,
        orderCount: opts.orderCount ?? 0,
        totalSpent: opts.totalSpent ?? 0,
      },
      select: { id: true },
    });
    return row.id;
  });
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
      expect(context.json().data).toMatchObject({ match: 'none' });
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

  // ── Who am I talking to (issue 864) ──────────────────────────────────────
  //
  // The panel used to ask one question: does `chat_conversations.customer_id`
  // name a customer. Nothing on the platform sets it. The public widget is the
  // only creator of a conversation and passes none, and the staff creator that
  // accepts one has no caller in either console, so the answer was "no" on all 8
  // conversations on the development database and every repeat buyer read
  // "Visitor". The address they typed is the second, weaker way to be somebody.

  it('names the customer behind a typed email, as a match and not as a fact', async () => {
    const t = await createChatTenant(true);
    try {
      const site = await primarySiteId(t.tenantId);
      const rosa = await createCustomer(t.tenantId, {
        propertyId: site,
        email: 'rosa.delgado@example.test',
        firstName: 'Rosa',
        lastName: 'Delgado',
        orderCount: 6,
        totalSpent: 412.5,
      });

      const start = await app.inject({
        method: 'POST',
        url: `/v1/public/chat/conversations?tenant=${t.slug}`,
        // TYPED IN CAPITALS on purpose. Stored emails are lowercase, so a match
        // that forgot to fold the case would answer "Visitor" to the exact
        // address the shop has on file.
        payload: {
          visitorName: 'R',
          visitorEmail: 'ROSA.DELGADO@example.test',
          message: 'Where is my parcel?',
        },
      });
      expect(start.statusCode).toBe(201);
      const conversationId = start.json().data.conversation.id;

      const token = signToken(app, t);
      const context = await app.inject({
        method: 'GET',
        url: `/v1/chat/conversations/${conversationId}/context`,
        headers: authHeader(token),
      });
      expect(context.statusCode).toBe(200);
      expect(context.json().data).toMatchObject({
        // `email`, never `record`: the conversation still names nobody, and the
        // console says so in a sentence rather than stating it as a fact.
        match: 'email',
        customerId: rosa,
        name: 'Rosa Delgado',
        orderCount: 6,
        lifetimeValue: 412.5,
      });

      // AND THE CLAIM IS NOT WRITTEN DOWN. A typed address is not proof, so
      // attaching a stranger's messages to a real person's record for ever is
      // the one thing this must never do.
      const stored = await withTenant({ tenantId: t.tenantId }, (tx) =>
        tx.chatConversation.findUniqueOrThrow({
          where: { id: conversationId },
          select: { customerId: true },
        })
      );
      expect(stored.customerId).toBeNull();
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('answers with the customer on the conversation\u2019s own site', async () => {
    // `customers` is unique on (tenant, property, email) and NOT on
    // (tenant, email), because one owner's two businesses may each know the same
    // person. Measured 2026-09-28: `marguerite.adeyemi@example.com` exists four
    // times under one tenant, on four different sites. An email-only lookup
    // answers with whichever came back first and shows that one's spend.
    const t = await createChatTenant(true);
    try {
      const home = await primarySiteId(t.tenantId);
      const other = await createSite(t.tenantId, 'second-shop', 'Second Shop');
      const shared = 'marguerite@example.test';
      const atHome = await createCustomer(t.tenantId, {
        propertyId: home,
        email: shared,
        firstName: 'Marguerite',
        lastName: 'AtHome',
        orderCount: 2,
        totalSpent: 50,
      });
      const atOther = await createCustomer(t.tenantId, {
        propertyId: other,
        email: shared,
        firstName: 'Marguerite',
        lastName: 'Elsewhere',
        orderCount: 9,
        totalSpent: 900,
      });
      expect(atHome).not.toBe(atOther);

      const start = await app.inject({
        method: 'POST',
        url: `/v1/public/chat/conversations?tenant=${t.slug}&property=second-shop`,
        payload: { visitorEmail: shared, message: 'Hello from the second shop' },
      });
      expect(start.statusCode).toBe(201);

      const token = signToken(app, t);
      const context = await app.inject({
        method: 'GET',
        url: `/v1/chat/conversations/${start.json().data.conversation.id}/context`,
        headers: authHeader(token),
      });
      expect(context.json().data).toMatchObject({
        match: 'email',
        customerId: atOther,
        name: 'Marguerite Elsewhere',
        orderCount: 9,
      });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('falls back to the business-wide customer when the site has nobody', async () => {
    // The site-less tier is a real one: 47 of the 745 customers on the same
    // database carry no property_id. Asking the site first must not mean never
    // asking at all.
    const t = await createChatTenant(true);
    try {
      const everywhere = await createCustomer(t.tenantId, {
        propertyId: null,
        email: 'wide@example.test',
        firstName: 'Wide',
        lastName: 'Reach',
        orderCount: 1,
        totalSpent: 12,
      });
      const start = await app.inject({
        method: 'POST',
        url: `/v1/public/chat/conversations?tenant=${t.slug}`,
        payload: { visitorEmail: 'wide@example.test', message: 'Hi' },
      });
      const token = signToken(app, t);
      const context = await app.inject({
        method: 'GET',
        url: `/v1/chat/conversations/${start.json().data.conversation.id}/context`,
        headers: authHeader(token),
      });
      expect(context.json().data).toMatchObject({ match: 'email', customerId: everywhere });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('stays a visitor when nobody has that address', async () => {
    const t = await createChatTenant(true);
    try {
      const start = await app.inject({
        method: 'POST',
        url: `/v1/public/chat/conversations?tenant=${t.slug}`,
        payload: { visitorName: 'Nobody', visitorEmail: 'stranger@example.test', message: 'Hi' },
      });
      const token = signToken(app, t);
      const context = await app.inject({
        method: 'GET',
        url: `/v1/chat/conversations/${start.json().data.conversation.id}/context`,
        headers: authHeader(token),
      });
      expect(context.json().data).toMatchObject({
        match: 'none',
        customerId: null,
        name: 'Nobody',
        orderCount: 0,
      });
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
