// A SAVED REPLY YOU CANNOT CHANGE IS A SAVED REPLY YOU HAVE TO DELETE.
//
// Quick replies had two verbs: create and delete. The seven this service seeds
// when the chat box is switched on are deliberately generic starting copy, and
// the comment above them says the tenant "edits or replaces" them — one of them
// reads "Business hours: Monday to Friday, 9am to 5pm". A shop open Thursday to
// Sunday had to DELETE that reply and retype it from nothing, re-entering the
// shortcut and the site choice from memory, with the reply missing from her
// team's inbox in between. 102 saved replies on this platform, 0 ever changed,
// because nothing could change one (issue 643).
//
// The identical concept one module over — CRM's saved paragraphs — has had a
// pencil the whole time, and its own note names the case out loud: "a paragraph
// is usually a FACT about the business, the opening hours, the returns policy,
// the lead time". Those are three of the seven seeded here.
//
// These run against real Postgres through the routes the console calls.

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

async function createChatTenant(): Promise<ChatTenant> {
  const slug = `apiqr-${crypto.randomBytes(4).toString('hex')}`;
  const email = `${slug}@sparx.test`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `Quick reply ${slug}`,
      email,
      plan: 'starter',
      status: 'active',
      settings: { modules: { chat: { enabled: true } } },
    },
  });
  const user = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
    await tx.user.create({
      data: { tenantId: tenant.id, email, name: `QR ${slug}`, role: 'owner' },
    });
    return tx.user.findFirstOrThrow({ where: { tenantId: tenant.id, email } });
  });
  await seedPrimaryProperty(tenant.id, `Test ${tenant.slug}`);
  return { tenantId: tenant.id, userId: user.id, slug };
}

describe('changing a saved reply', () => {
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

  /** The seeded "Business hours" reply, as a shop finds it on day one. */
  async function seedHours(
    t: ChatTenant,
    token: string
  ): Promise<{ id: string; propertyId: string | null }> {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/chat/quick-replies',
      headers: authHeader(token),
      payload: {
        title: 'Business hours',
        body: 'Our team is here Monday to Friday, 9am to 5pm.',
        shortcut: 'hours',
      },
    });
    expect(created.statusCode).toBe(201);
    const row = created.json().data as { id: string; propertyId: string | null };
    return row;
  }

  it('fixes the hours without touching the shortcut or the site', async () => {
    const t = await createChatTenant();
    try {
      const token = signToken(app, t);
      const seeded = await seedHours(t, token);

      const saved = await app.inject({
        method: 'PATCH',
        url: `/v1/chat/quick-replies/${seeded.id}`,
        headers: authHeader(token),
        payload: { body: 'We are open Thursday to Sunday, 10am to 6pm.' },
      });

      expect(saved.statusCode).toBe(200);
      expect(saved.json().data).toMatchObject({
        title: 'Business hours',
        body: 'We are open Thursday to Sunday, 10am to 6pm.',
        // The two she did not send stay exactly where they were. An omitted
        // propertyId means "leave it", never "stamp the site I am in".
        shortcut: 'hours',
        propertyId: seeded.propertyId,
      });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('refuses to re-point a shortcut her team already types', async () => {
    const t = await createChatTenant();
    try {
      const token = signToken(app, t);
      const seeded = await seedHours(t, token);

      const refused = await app.inject({
        method: 'PATCH',
        url: `/v1/chat/quick-replies/${seeded.id}`,
        headers: authHeader(token),
        payload: { shortcut: 'opening' },
      });

      expect(refused.statusCode).toBe(409);
      expect(refused.json().error.message).toContain('already what people type');

      // And nothing moved. A refused write that half-applied would be worse than
      // the gap it replaced.
      const after = await app.inject({
        method: 'GET',
        url: '/v1/chat/quick-replies',
        headers: authHeader(token),
      });
      expect(after.json().data[0]).toMatchObject({ shortcut: 'hours' });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('lets a reply that never had a shortcut be given its first', async () => {
    // Nobody is typing anything yet, so there is no habit to break. This is the
    // whole reason the rule is not simply "shortcuts can never change" — without
    // it, adding a word to an existing reply means deleting and retyping, which
    // is the bug.
    const t = await createChatTenant();
    try {
      const token = signToken(app, t);
      const created = await app.inject({
        method: 'POST',
        url: '/v1/chat/quick-replies',
        headers: authHeader(token),
        payload: { title: 'Linen care', body: 'Cool machine wash, line dry.' },
      });
      const id = created.json().data.id as string;
      expect(created.json().data.shortcut).toBe(null);

      const given = await app.inject({
        method: 'PATCH',
        url: `/v1/chat/quick-replies/${id}`,
        headers: authHeader(token),
        payload: { shortcut: 'linen' },
      });
      expect(given.statusCode).toBe(200);
      expect(given.json().data).toMatchObject({ shortcut: 'linen' });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('refuses a first shortcut another reply is already holding', async () => {
    const t = await createChatTenant();
    try {
      const token = signToken(app, t);
      await seedHours(t, token);
      const other = await app.inject({
        method: 'POST',
        url: '/v1/chat/quick-replies',
        headers: authHeader(token),
        payload: { title: 'Opening times', body: 'See our hours below.' },
      });
      const id = other.json().data.id as string;

      const clash = await app.inject({
        method: 'PATCH',
        url: `/v1/chat/quick-replies/${id}`,
        headers: authHeader(token),
        payload: { shortcut: 'hours' },
      });
      expect(clash.statusCode).toBe(409);
      expect(clash.json().error.message).toContain('already in use');
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('does not re-stamp a reply nobody changed', async () => {
    // The rule the review queue learnt the hard way: a decision that changes
    // nothing is not recorded as a decision. Here that keeps `updatedAt` meaning
    // "when the wording last moved" rather than "when somebody last pressed
    // Save", which is the only thing that can ever tell her which of her replies
    // are still the starter copy.
    const t = await createChatTenant();
    try {
      const token = signToken(app, t);
      const seeded = await seedHours(t, token);
      const stampOf = () =>
        withTenant({ tenantId: t.tenantId }, (tx) =>
          tx.chatQuickReply.findUniqueOrThrow({
            where: { id: seeded.id },
            select: { updatedAt: true },
          })
        );
      const before = await stampOf();

      const again = await app.inject({
        method: 'PATCH',
        url: `/v1/chat/quick-replies/${seeded.id}`,
        headers: authHeader(token),
        payload: {
          title: 'Business hours',
          body: 'Our team is here Monday to Friday, 9am to 5pm.',
        },
      });
      expect(again.statusCode).toBe(200);

      const after = await stampOf();
      expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('moves a reply to every site only when asked, and back again', async () => {
    const t = await createChatTenant();
    try {
      const token = signToken(app, t);
      const seeded = await seedHours(t, token);
      expect(seeded.propertyId).not.toBe(null);

      const shared = await app.inject({
        method: 'PATCH',
        url: `/v1/chat/quick-replies/${seeded.id}`,
        headers: authHeader(token),
        payload: { propertyId: null },
      });
      expect(shared.json().data.propertyId).toBe(null);

      // And a later edit that says nothing about sites leaves it shared. This is
      // the leak the route comment names: defaulting the site on a PATCH would
      // drag a reply offered across every business back to one of them the first
      // time somebody fixed a typo in it.
      const typo = await app.inject({
        method: 'PATCH',
        url: `/v1/chat/quick-replies/${seeded.id}`,
        headers: authHeader(token),
        payload: { title: 'Our hours' },
      });
      expect(typo.json().data).toMatchObject({ title: 'Our hours', propertyId: null });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('is refused when the chat module is off', async () => {
    const t = await createChatTenant();
    try {
      await prisma.tenant.update({ where: { id: t.tenantId }, data: { settings: {} } });
      invalidateModuleCache();
      const token = signToken(app, t);
      const blocked = await app.inject({
        method: 'PATCH',
        url: `/v1/chat/quick-replies/${crypto.randomUUID()}`,
        headers: authHeader(token),
        payload: { title: 'Anything' },
      });
      expect(blocked.statusCode).toBe(404);
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });
});
