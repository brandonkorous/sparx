// Campaign goals, end to end: an event arrives on the worker's push door, and a
// running campaign the person is in records its converting step. Before this,
// nothing in the platform ever evaluated a campaign's goal, so a campaign run
// from the console never finished anybody.

import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pino from 'pino';
import { scanCampaigns } from '../../src/runtime';
import { createWorkerServer } from '../../src/server';

const ownerDb = new PrismaClient({
  datasourceUrl:
    process.env.MIGRATION_DATABASE_URL ??
    'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public',
});

const server = createWorkerServer();
let base = '';
const createdTenants: string[] = [];

const LADDER = [
  { key: 'entered', name: 'Entered', kind: 'capture' },
  { key: 'converted', name: 'Converted', kind: 'convert' },
];
const BECAME_CUSTOMER = {
  logic: 'AND',
  conditions: [{ field: 'customer.lifecycleStage', operator: 'eq', value: 'customer' }],
};

interface World {
  tenantId: string;
  siteA: string;
  siteB: string;
  customerId: string;
  email: string;
}

async function seedWorld(): Promise<World> {
  const slug = `cg-test-${crypto.randomBytes(5).toString('hex')}`;
  const tenant = await ownerDb.tenant.create({
    data: {
      slug,
      name: `Campaign goals ${slug}`,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      settings: { modules: { crm: { enabled: true }, funnels: { enabled: true } } },
    },
    select: { id: true },
  });
  createdTenants.push(tenant.id);
  const site = (n: string, isPrimary: boolean) =>
    ownerDb.property.create({
      data: { tenantId: tenant.id, slug: `${slug}-${n}`, name: n, isPrimary },
      select: { id: true },
    });
  const siteA = (await site('a', true)).id;
  const siteB = (await site('b', false)).id;
  const email = `lead-${crypto.randomBytes(3).toString('hex')}@sparx.test`;
  const customer = await ownerDb.customer.create({
    data: { tenantId: tenant.id, email, propertyId: siteA },
    select: { id: true },
  });
  return { tenantId: tenant.id, siteA, siteB, customerId: customer.id, email };
}

async function campaign(
  w: World,
  propertyId: string,
  goalValueCents?: number,
  stages: unknown[] = LADDER
): Promise<string> {
  const f = await ownerDb.funnel.create({
    data: {
      tenantId: w.tenantId,
      propertyId,
      name: `Campaign ${crypto.randomBytes(2).toString('hex')}`,
      kind: 'custom',
      status: 'active',
      stages: stages as object[],
      goal: BECAME_CUSTOMER,
      ...(goalValueCents ? { goalValueCents } : {}),
    },
    select: { id: true },
  });
  return f.id;
}

/** They left their email on a form an hour ago: the capture row forms write. */
async function entered(w: World, funnelId: string, propertyId: string): Promise<void> {
  await ownerDb.funnelStageEvent.create({
    data: {
      tenantId: w.tenantId,
      funnelId,
      propertyId,
      stageKey: 'entered',
      subjectEmail: w.email.toUpperCase(),
      entrySource: 'search',
      occurredAt: new Date(Date.now() - 3_600_000),
    },
  });
}

async function push(
  w: World,
  occurredAt = new Date(),
  type = 'crm.customer.updated'
): Promise<void> {
  const envelope = {
    type,
    tenantId: w.tenantId,
    actorId: null,
    occurredAt: occurredAt.toISOString(),
    data: { customerId: w.customerId },
  };
  const res = await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        data: Buffer.from(JSON.stringify(envelope)).toString('base64'),
        messageId: crypto.randomUUID(),
        publishTime: new Date().toISOString(),
      },
      subscription: 'projects/test/subscriptions/automation.trigger.automation-worker',
    }),
  });
  expect(res.status).toBe(204);
}

const converted = (funnelId: string) =>
  ownerDb.funnelStageEvent.findMany({ where: { funnelId, stageKey: 'converted' } });

const stepsOf = async (funnelId: string) =>
  (
    await ownerDb.funnelStageEvent.findMany({
      where: { funnelId },
      orderBy: { occurredAt: 'asc' },
      select: { stageKey: true },
    })
  ).map((r) => r.stageKey);

const on = (type: string) => ({
  logic: 'AND',
  conditions: [{ field: 'event.type', operator: 'eq', value: type }],
});

/** A ladder where every step is recorded by something that happens. */
const RECOGNIZED = [
  { key: 'joined', name: 'Joined', kind: 'capture', match: on('crm.customer.subscribed') },
  {
    key: 'fit',
    name: 'Looked like a fit',
    kind: 'qualify',
    match: {
      logic: 'AND',
      conditions: [
        { field: 'customer.lifecycleStage', operator: 'eq', value: 'sales_qualified_lead' },
      ],
    },
  },
  { key: 'converted', name: 'Converted', kind: 'convert' },
];

const setStage = (w: World, lifecycleStage: string) =>
  ownerDb.customer.update({ where: { id: w.customerId }, data: { lifecycleStage } });

/** Seconds apart, so each event is clearly after the last. */
const later = (s: number) => new Date(Date.now() + s * 1000);

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const id of createdTenants) {
    await ownerDb.tenant.delete({ where: { id } }).catch(() => undefined);
  }
  await ownerDb.$disconnect();
});

describe('campaign goals', () => {
  it('records the converting step once the goal comes true, once', async () => {
    const w = await seedWorld();
    const funnelId = await campaign(w, w.siteA, 4_500);
    await entered(w, funnelId, w.siteA);

    await push(w); // still a lead: nothing yet
    expect(await converted(funnelId)).toHaveLength(0);

    await ownerDb.customer.update({
      where: { id: w.customerId },
      data: { lifecycleStage: 'customer' },
    });
    await push(w);
    await push(w); // a redelivery must not count them twice

    const rows = await converted(funnelId);
    expect(rows).toHaveLength(1);
    // The identity they entered under, and the attribution they arrived with.
    expect(rows[0]!.subjectEmail).toBe(w.email.toUpperCase());
    expect(rows[0]!.customerId).toBeNull();
    expect(rows[0]!.entrySource).toBe('search');
    expect(Number(rows[0]!.valueCents)).toBe(4_500);
  });

  it('never converts someone who did not enter, or on another site', async () => {
    const w = await seedWorld();
    const notIn = await campaign(w, w.siteA);
    const otherSite = await campaign(w, w.siteB);
    await entered(w, otherSite, w.siteB);
    await ownerDb.customer.update({
      where: { id: w.customerId },
      data: { lifecycleStage: 'customer' },
    });

    await push(w); // the customer belongs to site A

    expect(await converted(notIn)).toHaveLength(0);
    expect(await converted(otherSite)).toHaveLength(0);
  });

  it('does not credit the campaign with something that happened before they entered', async () => {
    const w = await seedWorld();
    const funnelId = await campaign(w, w.siteA);
    await entered(w, funnelId, w.siteA);
    await ownerDb.customer.update({
      where: { id: w.customerId },
      data: { lifecycleStage: 'customer' },
    });

    await push(w, new Date(Date.now() - 86_400_000));

    expect(await converted(funnelId)).toHaveLength(0);
  });

  it('puts people in, moves them along and finishes them on events alone', async () => {
    const w = await seedWorld();
    const funnelId = await campaign(w, w.siteA, undefined, RECOGNIZED);

    await push(w, later(1), 'crm.customer.subscribed');
    await push(w, later(2)); // still a plain lead: no step
    await setStage(w, 'sales_qualified_lead');
    await push(w, later(3));
    await push(w, later(4)); // already recorded this round
    await setStage(w, 'customer');
    await push(w, later(5));

    expect(await stepsOf(funnelId)).toEqual(['joined', 'fit', 'converted']);
    const [joined] = await ownerDb.funnelStageEvent.findMany({ where: { funnelId } });
    expect(joined!.customerId).toBe(w.customerId);
  });

  it('starts a second round only after the first one finished', async () => {
    const w = await seedWorld();
    const funnelId = await campaign(w, w.siteA, undefined, RECOGNIZED);

    await push(w, later(1), 'crm.customer.subscribed');
    await push(w, later(2), 'crm.customer.subscribed'); // still in round one
    await setStage(w, 'customer');
    await push(w, later(3));
    await setStage(w, 'lead');
    await push(w, later(4), 'crm.customer.subscribed'); // round two

    expect(await stepsOf(funnelId)).toEqual(['joined', 'converted', 'joined']);
  });

  it('never puts somebody in from another site', async () => {
    const w = await seedWorld();
    const otherSite = await campaign(w, w.siteB, undefined, RECOGNIZED);

    await push(w, later(1), 'crm.customer.subscribed'); // the customer is on site A

    expect(await stepsOf(otherSite)).toEqual([]);
  });

  it('a basket left behind puts its owner in basket recovery', async () => {
    const w = await seedWorld();
    const funnelId = await campaign(w, w.siteA, undefined, [
      { key: 'basket', name: 'Left a basket behind', kind: 'capture', match: on('cart.abandoned') },
      { key: 'paid', name: 'Paid', kind: 'convert' },
    ]);
    const cart = await ownerDb.cart.create({
      data: {
        tenantId: w.tenantId,
        customerId: w.customerId,
        propertyId: w.siteA,
        channel: 'storefront',
        currency: 'USD',
      },
      select: { id: true },
    });

    const envelope = {
      type: 'cart.abandoned',
      tenantId: w.tenantId,
      actorId: null,
      occurredAt: new Date().toISOString(),
      data: { cartId: cart.id },
    };
    const res = await fetch(`${base}/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          data: Buffer.from(JSON.stringify(envelope)).toString('base64'),
          messageId: crypto.randomUUID(),
        },
      }),
    });
    expect(res.status).toBe(204);

    const rows = await ownerDb.funnelStageEvent.findMany({ where: { funnelId } });
    expect(rows.map((r) => r.stageKey)).toEqual(['basket']);
    expect(rows[0]!.refs).toMatchObject({ cartId: cart.id });
  });

  it('never puts somebody in from an event with no site at all', async () => {
    const w = await seedWorld();
    const funnelId = await campaign(w, w.siteA, undefined, RECOGNIZED);
    await ownerDb.customer.update({ where: { id: w.customerId }, data: { propertyId: null } });

    await push(w, later(1), 'crm.customer.subscribed');

    expect(await stepsOf(funnelId)).toEqual([]);
  });

  it('the daily scan puts in customers who went quiet, once', async () => {
    const w = await seedWorld();
    const lapsed = {
      logic: 'AND',
      conditions: [
        { field: 'customer.hasOrdered', operator: 'eq', value: true },
        { field: 'customer.daysSinceLastOrder', operator: 'gte', value: 120 },
      ],
    };
    const funnelId = await campaign(w, w.siteA, undefined, [
      { key: 'lapsed', name: 'Went quiet', kind: 'capture', match: lapsed },
      { key: 'converted', name: 'Came back', kind: 'convert' },
    ]);
    await ownerDb.customer.update({
      where: { id: w.customerId },
      data: { orderCount: 3, lastOrderAt: new Date(Date.now() - 200 * 86_400_000) },
    });

    const log = pino({ level: 'silent' });
    await scanCampaigns(log);
    await scanCampaigns(log); // the next night: still in, not in twice

    expect(await stepsOf(funnelId)).toEqual(['lapsed']);
  });
});
