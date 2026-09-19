// "THIS SEQUENCE IS ON" OVER A JOURNEY NOTHING COULD PUT A PERSON INTO.
//
// An email sequence sends nothing by itself. Something has to ENROLL a person,
// and there are exactly two somethings: an automation carrying the action
// `email.sequence_add`, and a hand enrollment. The console's sequence editor
// reported "This sequence is on. It is sending to people as they are enrolled"
// while knowing neither.
//
// Measured 2026-09-18 against the platform database:
//   automations                        2,411
//   automations that enroll anybody        0
//   email sequences                       15   (every one a draft)
//   enrollments, ever                      0
//
// So the screen would have said "it is on" about a journey that reaches nobody,
// for good, and the only sign would have been a count of zero that never moved
// (issue 647). The API now answers the question the screen has to ask.
//
// Runs against real Postgres through the routes the console calls.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma, withTenant } from '@wizeworks/db';
import { invalidateModuleCache } from '@wizeworks/auth';
import { createApp } from '../../src/app.js';
import { authHeader, seedPrimaryProperty, signToken } from '../helpers.js';

interface EmailTenant {
  tenantId: string;
  userId: string;
  slug: string;
}

async function createEmailTenant(): Promise<EmailTenant> {
  const slug = `apiseq-${crypto.randomBytes(4).toString('hex')}`;
  const email = `${slug}@sparx.test`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `Sequence ${slug}`,
      email,
      plan: 'starter',
      status: 'active',
      settings: { modules: { email: { enabled: true }, automation: { enabled: true } } },
    },
  });
  const user = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
    await tx.user.create({
      data: { tenantId: tenant.id, email, name: `Seq ${slug}`, role: 'owner' },
    });
    return tx.user.findFirstOrThrow({ where: { tenantId: tenant.id, email } });
  });
  await seedPrimaryProperty(tenant.id, `Test ${tenant.slug}`);
  return { tenantId: tenant.id, userId: user.id, slug };
}

/** An automation carrying one action, written straight to the table — this test
 *  is about what the READ reports, not about the automation builder. */
async function seedAutomation(
  tenantId: string,
  actions: unknown,
  status: 'active' | 'paused'
): Promise<void> {
  await withTenant({ tenantId }, (tx) =>
    tx.automation.create({
      data: {
        tenantId,
        name: `Greet ${crypto.randomBytes(3).toString('hex')}`,
        status,
        triggerType: 'customer.created',
        triggerConfig: {},
        conditions: {},
        actions: actions as never,
      },
    })
  );
}

describe('what tells a sequence whether anything can reach a person', () => {
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

  async function seedSequence(token: string, name: string): Promise<string> {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/email/sequences',
      headers: authHeader(token),
      payload: {
        name,
        steps: [
          {
            id: 'step-1',
            delaySeconds: 0,
            emailType: 'transactional',
            source: { kind: 'builtin', builderEmailKey: 'welcome-customer' },
          },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    return (created.json().data as { id: string }).id;
  }

  async function readSequence(
    token: string,
    id: string
  ): Promise<{ enrollers: { total: number; live: number } }> {
    const got = await app.inject({
      method: 'GET',
      url: `/v1/email/sequences/${id}`,
      headers: authHeader(token),
    });
    expect(got.statusCode).toBe(200);
    return got.json().data as { enrollers: { total: number; live: number } };
  }

  it('reports zero for the sequence every tenant actually has', async () => {
    const t = await createEmailTenant();
    try {
      const token = signToken(app, t);
      const id = await seedSequence(token, 'Welcome series');
      expect(await readSequence(token, id)).toMatchObject({ enrollers: { total: 0, live: 0 } });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('counts a rule that enrolls into THIS sequence, and not one that does something else', async () => {
    const t = await createEmailTenant();
    try {
      const token = signToken(app, t);
      const mine = await seedSequence(token, 'Welcome series');
      const other = await seedSequence(token, 'Win-back');

      await seedAutomation(
        t.tenantId,
        [{ type: 'email.sequence_add', config: { sequenceId: mine } }],
        'active'
      );
      await seedAutomation(
        t.tenantId,
        [{ type: 'email.sequence_add', config: { sequenceId: other } }],
        'active'
      );
      // A rule that sends a one-shot email is not a rule that enrolls anybody.
      await seedAutomation(
        t.tenantId,
        [{ type: 'email.send_campaign', config: { builderEmailKey: 'welcome-customer' } }],
        'active'
      );

      expect(await readSequence(token, mine)).toMatchObject({ enrollers: { total: 1, live: 1 } });
      expect(await readSequence(token, other)).toMatchObject({ enrollers: { total: 1, live: 1 } });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('does not count a rule that takes people OUT of this sequence', async () => {
    const t = await createEmailTenant();
    try {
      const token = signToken(app, t);
      const id = await seedSequence(token, 'Welcome series');
      const other = await seedSequence(token, 'Win-back');
      // ONE rule that moves a person from this sequence to another: it adds to
      // `other` and removes from `id`, and BOTH actions name a sequence in the
      // same config field. The row therefore reaches the walk, and only the
      // action TYPE says which of the two ids is being enrolled.
      await seedAutomation(
        t.tenantId,
        [
          { type: 'email.sequence_remove', config: { sequenceId: id } },
          { type: 'email.sequence_add', config: { sequenceId: other } },
        ],
        'active'
      );
      expect(await readSequence(token, id)).toMatchObject({ enrollers: { total: 0, live: 0 } });
      expect(await readSequence(token, other)).toMatchObject({ enrollers: { total: 1, live: 1 } });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('separates the rules that EXIST from the rules that RUN', async () => {
    const t = await createEmailTenant();
    try {
      const token = signToken(app, t);
      const id = await seedSequence(token, 'Welcome series');
      await seedAutomation(
        t.tenantId,
        [{ type: 'email.sequence_add', config: { sequenceId: id } }],
        'paused'
      );
      // A paused rule adds nobody, so the screen has to be able to say that
      // rather than counting it as working.
      expect(await readSequence(token, id)).toMatchObject({ enrollers: { total: 1, live: 0 } });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('counts a rule that names the same sequence twice as one rule', async () => {
    const t = await createEmailTenant();
    try {
      const token = signToken(app, t);
      const id = await seedSequence(token, 'Welcome series');
      await seedAutomation(
        t.tenantId,
        [
          { type: 'email.sequence_add', config: { sequenceId: id } },
          { type: 'crm.add_tag', config: { tag: 'welcomed' } },
          { type: 'email.sequence_add', config: { sequenceId: id } },
        ],
        'active'
      );
      expect(await readSequence(token, id)).toMatchObject({ enrollers: { total: 1, live: 1 } });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('carries the same answer on the list, in one query rather than per row', async () => {
    const t = await createEmailTenant();
    try {
      const token = signToken(app, t);
      const fed = await seedSequence(token, 'Welcome series');
      const starved = await seedSequence(token, 'Win-back');
      await seedAutomation(
        t.tenantId,
        [{ type: 'email.sequence_add', config: { sequenceId: fed } }],
        'active'
      );

      const listed = await app.inject({
        method: 'GET',
        url: '/v1/email/sequences?property=all',
        headers: authHeader(token),
      });
      expect(listed.statusCode).toBe(200);
      const rows = listed.json().data as {
        id: string;
        enrollers: { total: number; live: number };
      }[];
      const byId = new Map(rows.map((r) => [r.id, r.enrollers]));
      expect(byId.get(fed)).toEqual({ total: 1, live: 1 });
      expect(byId.get(starved)).toEqual({ total: 0, live: 0 });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('never counts an automation belonging to another business', async () => {
    const mine = await createEmailTenant();
    const theirs = await createEmailTenant();
    try {
      const token = signToken(app, mine);
      const id = await seedSequence(token, 'Welcome series');
      // The other tenant points a live rule at MY sequence id. RLS has to make
      // that invisible, or one shop's screen reads another shop's wiring.
      await seedAutomation(
        theirs.tenantId,
        [{ type: 'email.sequence_add', config: { sequenceId: id } }],
        'active'
      );
      expect(await readSequence(token, id)).toMatchObject({ enrollers: { total: 0, live: 0 } });
    } finally {
      await prisma.tenant.delete({ where: { id: mine.tenantId } });
      await prisma.tenant.delete({ where: { id: theirs.tenantId } });
    }
  });
});
