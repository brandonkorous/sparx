// CRM action executors end-to-end (docs/84 Slice F1) — drives each executor
// through the REAL engine (handleTrigger → runAutomationTick) against docker, so
// the proof is the full path: trigger → match → resolve fields → gated dispatch →
// executor → REAL CRM service → DB effect. The tick runs on the sparx_app client
// (the worker's prod identity); seeding/asserts use a sparx_owner client.
//
// CRM events from the services go to @wizeworks/crm's default LoggingPublisher here
// (no Pub/Sub in tests) — we assert the DB effect, which is what the executor
// owns. The worker installs the real Pub/Sub publisher at boot (runtime.ts).

import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  createAutomation,
  handleTrigger,
  installBuiltins,
  runAutomationTick,
  setAutomationStatus,
  type EngineDeps,
  type TriggerEnvelope,
} from '@wizeworks/automation';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { installCrmActions } from '../../src/index.js';

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

async function seedTenant(): Promise<string> {
  const slug = `aa-test-${crypto.randomBytes(5).toString('hex')}`;
  const tenant = await ownerDb.tenant.create({
    data: {
      slug,
      name: `AA Test ${slug}`,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      settings: { modules: { crm: { enabled: true } } },
    },
    select: { id: true },
  });
  createdTenants.push(tenant.id);
  return tenant.id;
}

async function seedCustomer(tenantId: string, tags: string[] = []): Promise<string> {
  const c = await ownerDb.customer.create({
    data: {
      tenantId,
      type: 'retail',
      email: `cust-${crypto.randomBytes(3).toString('hex')}@sparx.test`,
      tags,
    },
    select: { id: true },
  });
  return c.id;
}

async function seedUser(tenantId: string): Promise<string> {
  const u = await ownerDb.user.create({
    data: {
      tenantId,
      email: `user-${crypto.randomBytes(3).toString('hex')}@sparx.test`,
      name: 'Rep',
      role: 'owner',
    },
    select: { id: true },
  });
  return u.id;
}

async function seedDealAtFirstStage(
  tenantId: string,
  customerId: string
): Promise<{ dealId: string; stage1: string; stage2: string }> {
  const pipeline = await ownerDb.pipeline.create({
    data: {
      tenantId,
      name: 'Sales',
      slug: `sales-${crypto.randomBytes(3).toString('hex')}`,
      isDefault: true,
    },
    select: { id: true },
  });
  const stage1 = await ownerDb.pipelineStage.create({
    data: { tenantId, pipelineId: pipeline.id, name: 'New', sortOrder: 0, stageType: 'open' },
    select: { id: true },
  });
  const stage2 = await ownerDb.pipelineStage.create({
    data: { tenantId, pipelineId: pipeline.id, name: 'Qualified', sortOrder: 1, stageType: 'open' },
    select: { id: true },
  });
  const deal = await ownerDb.deal.create({
    data: {
      tenantId,
      pipelineId: pipeline.id,
      stageId: stage1.id,
      customerId,
      title: 'Big deal',
      value: 1000,
    },
    select: { id: true },
  });
  return { dealId: deal.id, stage1: stage1.id, stage2: stage2.id };
}

async function activeAutomation(
  tenantId: string,
  spec: Parameters<typeof createAutomation>[1]
): Promise<string> {
  const ctx = { tenantId };
  const a = await createAutomation(ctx, spec);
  await setAutomationStatus(ctx, a.id, 'active');
  return a.id;
}

function customerEvt(tenantId: string, customerId: string): TriggerEnvelope {
  return {
    type: 'crm.customer.created',
    tenantId,
    actorId: null,
    occurredAt: new Date().toISOString(),
    data: { customerId },
  };
}

function dealEvt(tenantId: string, dealId: string): TriggerEnvelope {
  return {
    type: 'crm.deal.updated',
    tenantId,
    actorId: null,
    occurredAt: new Date().toISOString(),
    data: { dealId },
  };
}

const customerTrigger = { kind: 'event' as const, eventType: 'crm.customer.created' };

beforeAll(() => {
  installBuiltins();
  installCrmActions();
});

afterAll(async () => {
  for (const id of createdTenants) {
    await ownerDb.tenant.delete({ where: { id } }).catch(() => undefined);
  }
  await ownerDb.$disconnect();
  await appDb.$disconnect();
});

describe('crm action executors', () => {
  it('crm.add_tag adds the tag to the triggering customer', async () => {
    const t = await seedTenant();
    const customerId = await seedCustomer(t);
    const autoId = await activeAutomation(t, {
      name: 'tag vip',
      trigger: customerTrigger,
      actions: [{ type: 'crm.add_tag', config: { tags: ['vip'] } }],
    });

    await handleTrigger(customerEvt(t, customerId), deps);
    await runAutomationTick(deps, appDb);

    const customer = await ownerDb.customer.findUnique({ where: { id: customerId } });
    expect(customer?.tags).toContain('vip');
    const run = await ownerDb.automationRun.findFirst({ where: { automationId: autoId } });
    expect(run?.status).toBe('completed');
  });

  it('crm.remove_tag removes the tag', async () => {
    const t = await seedTenant();
    const customerId = await seedCustomer(t, ['vip', 'stale']);
    await activeAutomation(t, {
      name: 'untag stale',
      trigger: customerTrigger,
      actions: [{ type: 'crm.remove_tag', config: { tags: ['stale'] } }],
    });

    await handleTrigger(customerEvt(t, customerId), deps);
    await runAutomationTick(deps, appDb);

    const customer = await ownerDb.customer.findUnique({ where: { id: customerId } });
    expect(customer?.tags).toEqual(['vip']);
  });

  it('crm.add_note records a system note activity', async () => {
    const t = await seedTenant();
    const customerId = await seedCustomer(t);
    await activeAutomation(t, {
      name: 'note',
      trigger: customerTrigger,
      actions: [{ type: 'crm.add_note', config: { note: 'auto follow-up' } }],
    });

    await handleTrigger(customerEvt(t, customerId), deps);
    await runAutomationTick(deps, appDb);

    const activity = await ownerDb.crmActivity.findFirst({
      where: { tenantId: t, customerId, type: 'note' },
    });
    expect(activity?.description).toBe('auto follow-up');
    expect(activity?.actorType).toBe('system');
  });

  it('crm.update_field updates a customer column', async () => {
    const t = await seedTenant();
    const customerId = await seedCustomer(t);
    await activeAutomation(t, {
      name: 'set company',
      trigger: customerTrigger,
      actions: [{ type: 'crm.update_field', config: { field: 'company', value: 'Acme Fleet' } }],
    });

    await handleTrigger(customerEvt(t, customerId), deps);
    await runAutomationTick(deps, appDb);

    const customer = await ownerDb.customer.findUnique({ where: { id: customerId } });
    expect(customer?.companyName).toBe('Acme Fleet');
  });

  it('crm.create_task creates a task assigned to the configured user', async () => {
    const t = await seedTenant();
    const customerId = await seedCustomer(t);
    const userId = await seedUser(t);
    await activeAutomation(t, {
      name: 'follow-up task',
      trigger: customerTrigger,
      actions: [
        {
          type: 'crm.create_task',
          config: { title: 'Call new customer', assignedToUserId: userId, dueInDays: 3 },
        },
      ],
    });

    await handleTrigger(customerEvt(t, customerId), deps);
    await runAutomationTick(deps, appDb);

    const task = await ownerDb.task.findFirst({ where: { tenantId: t, customerId } });
    expect(task?.title).toBe('Call new customer');
    expect(task?.assignedToUserId).toBe(userId);
    expect(task?.createdByUserId).toBe(userId);
    expect(task?.dueAt).not.toBeNull();
  });

  it('crm.update_deal_stage moves the deal to the configured stage', async () => {
    const t = await seedTenant();
    const customerId = await seedCustomer(t);
    const { dealId, stage2 } = await seedDealAtFirstStage(t, customerId);
    await activeAutomation(t, {
      name: 'advance deal',
      trigger: { kind: 'event', eventType: 'crm.deal.updated' },
      actions: [{ type: 'crm.update_deal_stage', config: { toStageId: stage2 } }],
    });

    await handleTrigger(dealEvt(t, dealId), deps);
    await runAutomationTick(deps, appDb);

    const deal = await ownerDb.deal.findUnique({ where: { id: dealId } });
    expect(deal?.stageId).toBe(stage2);
  });

  it('an action whose required entity field is absent fails the step (loud)', async () => {
    const t = await seedTenant();
    // A deal trigger with no customer linked → crm.add_tag has no customer.id.
    const customerId = await seedCustomer(t);
    const { dealId } = await seedDealAtFirstStage(t, customerId);
    // Detach the customer so deal resolution yields no customer.id.
    await ownerDb.deal.update({ where: { id: dealId }, data: { customerId: null } });
    const autoId = await activeAutomation(t, {
      name: 'bad tag',
      trigger: { kind: 'event', eventType: 'crm.deal.updated' },
      actions: [{ type: 'crm.add_tag', config: { tags: ['x'] } }],
    });

    await handleTrigger(dealEvt(t, dealId), deps);
    await runAutomationTick(deps, appDb);

    const run = await ownerDb.automationRun.findFirst({
      where: { automationId: autoId },
      include: { steps: true },
    });
    expect(run?.status).toBe('failed');
    expect(run?.steps[0]?.status).toBe('failed');
  });
});
