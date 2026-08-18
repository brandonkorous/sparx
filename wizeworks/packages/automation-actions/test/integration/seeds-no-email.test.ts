// No-email system seeds (docs/90 Step 3) end-to-end on the real engine. Proves:
//   1. seedSystemAutomations installs the right per-module catalog (counts + names
//      + the locked B2B dunning).
//   2. The new-lead task seed fires on crm.deal.created and the create_task
//      assignee resolves from the deal's rep — and FALLS BACK to the tenant owner
//      when the deal is unassigned (the docs/90 §3b assignee fallback).
//   3. The high-value-order alert (email.send_internal) fires PLATFORM-LEVEL — it
//      enqueues a transactional ScheduledSend to the tenant owner even though the
//      tenant has no email module — with its `{{token}}` subject interpolated.
//
// Ticks run on sparx_app (the worker's identity); seeding/asserts use sparx_owner.

import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  handleTrigger,
  installBuiltins,
  runAutomationTick,
  type EngineDeps,
  type TriggerEnvelope,
} from '@wizeworks/automation';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { installModuleActions, seedSystemAutomations } from '../../src/index.js';

const ownerDb = new PrismaClient({
  datasourceUrl:
    process.env.MIGRATION_DATABASE_URL ??
    'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public',
});
const appDb = new PrismaClient({
  datasourceUrl:
    process.env.DATABASE_URL ??
    'postgresql://sparx_app:devpassword@localhost:5544/sparx?schema=public',
});

const noop = (): void => undefined;
const deps: EngineDeps = {
  publisher: { publish: () => Promise.resolve() },
  logger: { debug: noop, info: noop, warn: noop, error: noop },
};

const createdTenants: string[] = [];

async function seedTenant(modules: string[]): Promise<{ tenantId: string; ownerEmail: string }> {
  const slug = `seed-${crypto.randomBytes(5).toString('hex')}`;
  const ownerEmail = `${slug}-owner@sparx.test`;
  const settings = { modules: Object.fromEntries(modules.map((m) => [m, { enabled: true }])) };
  const tenant = await ownerDb.tenant.create({
    data: {
      slug,
      name: slug,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      settings,
    },
    select: { id: true },
  });
  createdTenants.push(tenant.id);
  await ownerDb.user.create({
    data: { tenantId: tenant.id, email: ownerEmail, name: 'Owner', role: 'owner' },
  });
  return { tenantId: tenant.id, ownerEmail };
}

async function seedOpenDeal(tenantId: string, assignedRepId: string | null): Promise<string> {
  const pipeline = await ownerDb.pipeline.create({
    data: {
      tenantId,
      name: 'Sales',
      slug: `s-${crypto.randomBytes(3).toString('hex')}`,
      isDefault: true,
    },
    select: { id: true },
  });
  const stage = await ownerDb.pipelineStage.create({
    data: { tenantId, pipelineId: pipeline.id, name: 'New', sortOrder: 0, stageType: 'open' },
    select: { id: true },
  });
  const deal = await ownerDb.deal.create({
    data: {
      tenantId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      title: 'Acme retrofit',
      value: 1000,
      assignedRepId,
    },
    select: { id: true },
  });
  return deal.id;
}

function evt(type: string, tenantId: string, data: Record<string, unknown>): TriggerEnvelope {
  return { type, tenantId, actorId: null, occurredAt: new Date().toISOString(), data };
}

beforeAll(() => {
  installBuiltins();
  installModuleActions();
});

afterAll(async () => {
  for (const id of createdTenants) {
    await ownerDb.tenant.delete({ where: { id } }).catch(() => undefined);
  }
  await ownerDb.$disconnect();
  await appDb.$disconnect();
});

describe('per-module seed install', () => {
  it('installs only the activated module’s seeds', async () => {
    const { tenantId } = await seedTenant(['crm']);
    const installed = await seedSystemAutomations({ tenantId }, { module: 'crm' });
    // The full CRM catalog — three no-email defaults (tag + tasks), the two
    // email-sending defaults (welcome, win-back) that reference Builder templates,
    // and the two support-intake defaults (docs/144 §7) that turn inbound mail and
    // live chat into requests — PLUS every always-on (`module: null`) seed, which
    // installs on any module pass by design: form handling isn't owned by a
    // feature module.
    expect(installed.map((a) => a.name).sort()).toEqual([
      'Deal won — create invoice task',
      'Email opens a support request',
      'Handle form submissions',
      'Live chat opens a support request',
      'New lead follow-up task',
      'Tag VIP customers',
      'Welcome new customers',
      'Win back inactive customers',
    ]);
    // Chat intake ships BUILT BUT OFF (docs/144 §7): a chat message is not
    // self-evidently a request, and on-by-default would fill a busy site's queue
    // with small talk from the moment CRM was switched on. Asserted here because
    // it is a product decision, and flipping it should have to break a test.
    const chat = installed.find((a) => a.name === 'Live chat opens a support request');
    expect(chat?.status).toBe('paused');
    const mail = installed.find((a) => a.name === 'Email opens a support request');
    expect(mail?.status).toBe('active');

    // Re-seed is idempotent (upsert by origin+name) — no duplicates.
    const again = await seedSystemAutomations({ tenantId }, { module: 'crm' });
    expect(again).toHaveLength(8);
    const count = await ownerDb.automation.count({ where: { tenantId, origin: 'system' } });
    expect(count).toBe(8);
  });

  it('keeps the B2B dunning ladder locked', async () => {
    const { tenantId } = await seedTenant(['b2b']);
    await seedSystemAutomations({ tenantId }, { module: 'b2b' });
    const dunning = await ownerDb.automation.findFirst({
      where: { tenantId, name: 'B2B overdue escalation' },
    });
    expect(dunning?.locked).toBe(true);
    const task = await ownerDb.automation.findFirst({
      where: { tenantId, name: 'New B2B account onboarding task' },
    });
    expect(task?.locked).toBe(false);
  });
});

describe('new-lead task — assignee resolution', () => {
  it('assigns the task to the deal’s rep', async () => {
    const { tenantId } = await seedTenant(['crm']);
    const rep = await ownerDb.user.create({
      data: {
        tenantId,
        email: `rep-${crypto.randomBytes(3).toString('hex')}@sparx.test`,
        name: 'Rep',
        role: 'admin',
      },
      select: { id: true },
    });
    await seedSystemAutomations({ tenantId }, { module: 'crm' });
    const dealId = await seedOpenDeal(tenantId, rep.id);

    await handleTrigger(evt('crm.deal.created', tenantId, { dealId }), deps);
    await runAutomationTick(deps, appDb);

    const task = await ownerDb.task.findFirst({ where: { tenantId, dealId } });
    expect(task?.title).toBe('Follow up — Acme retrofit');
    expect(task?.assignedToUserId).toBe(rep.id);
  });

  it('falls back to the tenant owner when the deal is unassigned', async () => {
    const { tenantId, ownerEmail } = await seedTenant(['crm']);
    await seedSystemAutomations({ tenantId }, { module: 'crm' });
    const dealId = await seedOpenDeal(tenantId, null);

    await handleTrigger(evt('crm.deal.created', tenantId, { dealId }), deps);
    await runAutomationTick(deps, appDb);

    const task = await ownerDb.task.findFirstOrThrow({ where: { tenantId, dealId } });
    const owner = await ownerDb.user.findUniqueOrThrow({ where: { id: task.assignedToUserId } });
    expect(owner.email).toBe(ownerEmail);
  });
});

describe('high-value order alert — platform-level internal send', () => {
  it('enqueues a transactional send to the owner even without the email module', async () => {
    const { tenantId, ownerEmail } = await seedTenant(['commerce']); // no email module
    await seedSystemAutomations({ tenantId }, { module: 'commerce' });
    const customer = await ownerDb.customer.create({
      data: { tenantId, type: 'retail', email: 'buyer@sparx.test' },
      select: { id: true },
    });
    const order = await ownerDb.order.create({
      data: {
        tenantId,
        customerId: customer.id,
        orderNumber: 'SO-500',
        status: 'placed',
        total: 750,
        subtotal: 750,
        placedAt: new Date(),
      },
      select: { id: true },
    });

    await handleTrigger(evt('order.paid', tenantId, { orderId: order.id }), deps);
    await runAutomationTick(deps, appDb);

    const run = await ownerDb.automationRun.findFirst({
      where: { tenantId },
      include: { steps: true },
    });
    expect(run?.status, JSON.stringify(run?.steps)).toBe('completed');
    const send = await ownerDb.scheduledSend.findFirst({ where: { tenantId } });
    expect(send?.recipient).toBe(ownerEmail);
    const payload = send?.payload as { raw?: { subject?: string } } | null;
    expect(payload?.raw?.subject).toContain('SO-500');
    expect(payload?.raw?.subject).toContain('750');
  });

  it('does NOT alert for an order under the $500 threshold', async () => {
    const { tenantId } = await seedTenant(['commerce']);
    await seedSystemAutomations({ tenantId }, { module: 'commerce' });
    const customer = await ownerDb.customer.create({
      data: { tenantId, type: 'retail', email: 'small@sparx.test' },
      select: { id: true },
    });
    const order = await ownerDb.order.create({
      data: {
        tenantId,
        customerId: customer.id,
        orderNumber: 'SO-100',
        status: 'placed',
        total: 100,
        subtotal: 100,
        placedAt: new Date(),
      },
      select: { id: true },
    });

    await handleTrigger(evt('order.paid', tenantId, { orderId: order.id }), deps);
    await runAutomationTick(deps, appDb);

    const send = await ownerDb.scheduledSend.count({ where: { tenantId } });
    expect(send).toBe(0);
  });
});
