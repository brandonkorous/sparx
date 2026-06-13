// enqueueSend — the email enqueue primitive, against a live Postgres.
//
// Runs through the DEFAULT @sparx/db client (sparx_app, FORCE RLS) — the same
// identity the automation-worker uses — so the suppression count + ScheduledSend
// write are exercised under real row-level security. Seeding/cleanup use a
// sparx_owner client (docker superuser) to set up tenants/suppressions.

import crypto from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { enqueueSend } from '../../src/index.js';

const ownerDb = new PrismaClient({
  datasourceUrl:
    process.env.MIGRATION_DATABASE_URL ??
    'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public',
});

const createdTenants: string[] = [];

async function makeTenant(): Promise<string> {
  const slug = `esend-${crypto.randomBytes(4).toString('hex')}`;
  const tenant = await ownerDb.tenant.create({
    data: {
      slug,
      name: slug,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      settings: { modules: { email: { enabled: true } } },
    },
    select: { id: true },
  });
  createdTenants.push(tenant.id);
  return tenant.id;
}

beforeAll(async () => {
  // Fail fast with a clear message if docker Postgres isn't up.
  await ownerDb.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  for (const id of createdTenants) {
    await ownerDb.tenant.delete({ where: { id } }).catch(() => undefined);
  }
  await ownerDb.$disconnect();
});

describe('enqueueSend', () => {
  it('writes a pending, system-origin ScheduledSend with the body payload + delayed dueAt', async () => {
    const tenantId = await makeTenant();
    const before = Date.now();

    const result = await enqueueSend(
      { tenantId },
      {
        recipient: 'Ada@Example.com',
        customerId: null,
        scope: 'marketing',
        delaySeconds: 3600,
        body: { template: 'welcome', props: { name: 'Ada' } },
        variables: { source: 'test' },
      }
    );
    expect(result).toEqual({ enqueued: true, suppressed: false });

    const rows = await ownerDb.scheduledSend.findMany({ where: { tenantId } });
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.recipient).toBe('Ada@Example.com');
    expect(row.status).toBe('pending');
    expect(row.payload).toEqual({
      template: 'welcome',
      props: { name: 'Ada' },
      variables: { source: 'test' },
    });
    // dueAt is ~now + delaySeconds (allow tick slack).
    expect(row.dueAt.getTime()).toBeGreaterThanOrEqual(before + 3600 * 1000 - 5000);
  });

  it('skips a recipient suppressed for the scope (suppressed=true, no row)', async () => {
    const tenantId = await makeTenant();
    await ownerDb.emailSuppression.create({
      data: { tenantId, email: 'blocked@example.com', scope: 'marketing', reason: 'unsubscribe' },
    });

    const result = await enqueueSend(
      { tenantId },
      { recipient: 'Blocked@example.com', scope: 'marketing', body: { template: 'welcome' } }
    );
    expect(result).toEqual({ enqueued: false, suppressed: true });
    expect(await ownerDb.scheduledSend.count({ where: { tenantId } })).toBe(0);
  });

  it('lets a transactional send through a marketing-only suppression', async () => {
    const tenantId = await makeTenant();
    await ownerDb.emailSuppression.create({
      data: { tenantId, email: 'partial@example.com', scope: 'marketing', reason: 'unsubscribe' },
    });

    const result = await enqueueSend(
      { tenantId },
      {
        recipient: 'partial@example.com',
        scope: 'transactional',
        body: { raw: { subject: 'Receipt', html: '<p>thanks</p>', text: 'thanks' } },
      }
    );
    expect(result).toEqual({ enqueued: true, suppressed: false });
    expect(await ownerDb.scheduledSend.count({ where: { tenantId } })).toBe(1);
  });

  it('is idempotent on dedupeKey — a repeat enqueue is skipped, not duplicated', async () => {
    const tenantId = await makeTenant();
    const spec = {
      recipient: 'x@example.com',
      body: { raw: { subject: 'Hi', html: '<p>hi</p>', text: 'hi' } },
      dedupeKey: 'welcome:x@example.com',
    } as const;

    const first = await enqueueSend({ tenantId }, spec);
    const second = await enqueueSend({ tenantId }, spec);

    expect(first).toEqual({ enqueued: true, suppressed: false });
    expect(second).toEqual({ enqueued: false, suppressed: false });
    expect(await ownerDb.scheduledSend.count({ where: { tenantId } })).toBe(1);
  });
});
