// A TASK A SYSTEM AUTOMATION OPENS CLOSES ITSELF WHEN ITS REASON IS GONE,
// through the real engine, the real CRM services and the database.
//
// Measured on Gillett: "Set up prices and terms for Wasatch Front Utility
// Contractors, LLC" stayed open while Wasatch had the Fleet price tier, a
// $25,000 credit limit and Net 30. Each test runs the SHIPPED seed (its trigger,
// conditions and step), so what is proven is what tenants run:
//
//   1. The set-up task is opened linked to its account, stays open while the
//      account is half set up, and closes, done, on the save that finishes it,
//      saying what was set and by whom.
//   2. It is not opened at all for an account set up between the event and the
//      run.
//   3. The daily check closes one whose account was set up by a write that
//      never asked (the state every task opened before this shipped is in).
//   4. "Follow up" closes when its deal is won.
//   5. "<number> was approved: take it to the next step" is done when the
//      document is taken to the next stage.

import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  createAutomation,
  handleTrigger,
  installBuiltins,
  runAutomationTick,
  setAutomationStatus,
  type EngineDeps,
  type SystemAutomationSpec,
  type TriggerEnvelope,
} from '@wizeworks/automation';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  billingDocumentStageService,
  companyService,
  dealService,
  taskService,
} from '@wizeworks/crm/services';

import { installModuleActions } from '../../src/index.js';
import { B2B_NEW_ACCOUNT_TASK } from '../../src/seeds/b2b.js';
import { CRM_NEW_LEAD_FOLLOW_UP_TASK } from '../../src/seeds/crm.js';
import { INVOICING_ESTIMATE_APPROVED_TASK } from '../../src/seeds/invoicing.js';

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

async function seedTenant(): Promise<{ tenantId: string; userId: string }> {
  const slug = `close-${crypto.randomBytes(5).toString('hex')}`;
  const tenant = await ownerDb.tenant.create({
    data: {
      slug,
      name: slug,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      settings: {
        modules: { crm: { enabled: true }, b2b: { enabled: true }, invoicing: { enabled: true } },
      },
    },
    select: { id: true },
  });
  createdTenants.push(tenant.id);
  const user = await ownerDb.user.create({
    data: { tenantId: tenant.id, email: `${slug}-kim@sparx.test`, name: 'Kim Lee', role: 'owner' },
    select: { id: true },
  });
  return { tenantId: tenant.id, userId: user.id };
}

/** The shipped seed, installed active in this tenant. */
async function install(tenantId: string, spec: SystemAutomationSpec): Promise<string> {
  const a = await createAutomation(
    { tenantId },
    {
      name: spec.name,
      trigger: spec.trigger,
      conditions: spec.conditions,
      actions: spec.actions,
    }
  );
  await setAutomationStatus({ tenantId }, a.id, 'active');
  return a.id;
}

function event(tenantId: string, type: string, data: Record<string, unknown>): TriggerEnvelope {
  return { type, tenantId, actorId: null, occurredAt: new Date().toISOString(), data };
}

async function newAccount(tenantId: string): Promise<{ companyId: string; tierId: string }> {
  const tier = await ownerDb.b2bPricingTier.create({
    data: { tenantId, name: 'Fleet', discountType: 'percentage', discountValue: 12 },
    select: { id: true },
  });
  const company = await ownerDb.company.create({
    data: { tenantId, companyName: 'Wasatch Front Utility Contractors, LLC' },
    select: { id: true },
  });
  return { companyId: company.id, tierId: tier.id };
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

describe('the wholesale set-up task', () => {
  it('is opened on its account and closed, done, by the save that sets it up', async () => {
    const { tenantId, userId } = await seedTenant();
    const { companyId, tierId } = await newAccount(tenantId);
    await install(tenantId, B2B_NEW_ACCOUNT_TASK);

    await handleTrigger(event(tenantId, 'crm.b2b_account.created', { companyId }), deps);
    await runAutomationTick(deps, appDb);

    const opened = await ownerDb.task.findFirst({ where: { tenantId, companyId } });
    expect(opened).toMatchObject({
      title: 'Set up prices and terms for Wasatch Front Utility Contractors, LLC',
      status: 'open',
      closesWhenAccountSetUp: true,
    });

    // Half set up: on terms, nothing to order against. Still true, still open.
    await companyService.update({ tenantId, userId }, companyId, { paymentTerms: 'net30' });
    expect((await ownerDb.task.findUnique({ where: { id: opened!.id } }))?.status).toBe('open');

    await companyService.update({ tenantId, userId }, companyId, {
      pricingTierId: tierId,
      creditLimit: 25000,
    });
    const closed = await ownerDb.task.findUnique({ where: { id: opened!.id } });
    expect(closed).toMatchObject({ status: 'completed', completedByUserId: userId });
    expect(closed?.description).toBe(
      'Kim Lee set up Wasatch Front Utility Contractors, LLC: the Fleet price tier, pay within 30 days, and a $25,000.00 credit limit.'
    );
  });

  it('is not opened for an account set up before the rule runs', async () => {
    const { tenantId } = await seedTenant();
    const { companyId } = await newAccount(tenantId);
    const autoId = await install(tenantId, B2B_NEW_ACCOUNT_TASK);

    await handleTrigger(event(tenantId, 'crm.b2b_account.created', { companyId }), deps);
    await ownerDb.company.update({
      where: { id: companyId },
      data: { paymentTerms: 'net30', creditLimit: 25000 },
    });
    await runAutomationTick(deps, appDb);

    expect(await ownerDb.task.count({ where: { tenantId, companyId } })).toBe(0);
    const run = await ownerDb.automationRun.findFirst({
      where: { automationId: autoId },
      include: { steps: true },
    });
    // The rule's own condition already says no: the account is set up.
    expect(run?.status, JSON.stringify(run)).toBe('completed');
  });

  it('is closed by the daily check when the account was set up behind its back', async () => {
    const { tenantId } = await seedTenant();
    const { companyId } = await newAccount(tenantId);
    await install(tenantId, B2B_NEW_ACCOUNT_TASK);
    await handleTrigger(event(tenantId, 'crm.b2b_account.created', { companyId }), deps);
    await runAutomationTick(deps, appDb);
    const opened = await ownerDb.task.findFirstOrThrow({ where: { tenantId, companyId } });

    // A write that never asked: what every task opened before this shipped saw.
    await ownerDb.company.update({
      where: { id: companyId },
      data: { paymentTerms: 'prepay' },
    });
    expect((await ownerDb.task.findUnique({ where: { id: opened.id } }))?.status).toBe('open');

    expect(await taskService.closeTasksWhoseReasonIsGone({ tenantId })).toBe(1);
    const closed = await ownerDb.task.findUnique({ where: { id: opened.id } });
    expect(closed).toMatchObject({ status: 'completed', completedByUserId: null });
    expect(closed?.description).toBe(
      'Wasatch Front Utility Contractors, LLC is set up: normal prices and pay before it ships.'
    );
  });
});

describe('the new lead follow-up task', () => {
  it('closes when the deal is won', async () => {
    const { tenantId, userId } = await seedTenant();
    const pipeline = await ownerDb.pipeline.create({
      data: { tenantId, name: 'Sales', slug: `s-${crypto.randomBytes(3).toString('hex')}` },
      select: { id: true },
    });
    const open = await ownerDb.pipelineStage.create({
      data: { tenantId, pipelineId: pipeline.id, name: 'New', sortOrder: 0, stageType: 'open' },
      select: { id: true },
    });
    const won = await ownerDb.pipelineStage.create({
      data: {
        tenantId,
        pipelineId: pipeline.id,
        name: 'Closed won',
        sortOrder: 1,
        stageType: 'won',
      },
      select: { id: true },
    });
    const deal = await ownerDb.deal.create({
      data: {
        tenantId,
        pipelineId: pipeline.id,
        stageId: open.id,
        title: 'Harbor fit-out',
        value: 1,
      },
      select: { id: true },
    });
    await install(tenantId, CRM_NEW_LEAD_FOLLOW_UP_TASK);

    await handleTrigger(event(tenantId, 'crm.deal.created', { dealId: deal.id }), deps);
    await runAutomationTick(deps, appDb);
    const opened = await ownerDb.task.findFirstOrThrow({ where: { tenantId, dealId: deal.id } });
    expect(opened).toMatchObject({ status: 'open', closesWhenDealLeaves: 'open' });

    await dealService.moveStage({ tenantId, userId }, deal.id, { toStageId: won.id });
    const closed = await ownerDb.task.findUnique({ where: { id: opened.id } });
    expect(closed).toMatchObject({
      status: 'cancelled',
      description:
        'Kim Lee moved the deal “Harbor fit-out” to Closed won, so this no longer needs doing.',
    });
  });
});

describe('the approved document task', () => {
  it('is done once the document is taken to the next stage', async () => {
    const { tenantId, userId } = await seedTenant();
    const property = await ownerDb.property.create({
      data: {
        tenantId,
        slug: `p-${crypto.randomBytes(3).toString('hex')}`,
        name: 'Site',
        isPrimary: true,
      },
      select: { id: true },
    });
    const workflow = await ownerDb.documentWorkflow.create({
      data: {
        tenantId,
        name: 'Estimates',
        slug: `est-${crypto.randomBytes(3).toString('hex')}`,
        sortOrder: 0,
        stages: {
          create: [
            {
              tenantId,
              name: 'Approved',
              customerLabel: 'Estimate',
              stageType: 'committed',
              sortOrder: 0,
            },
            {
              tenantId,
              name: 'Scheduled',
              customerLabel: 'Estimate',
              stageType: 'committed',
              sortOrder: 1,
            },
          ],
        },
      },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });
    const [approved, scheduled] = workflow.stages;
    const doc = await ownerDb.billingDocument.create({
      data: {
        tenantId,
        propertyId: property.id,
        workflowId: workflow.id,
        stageId: approved!.id,
        number: 'EST-000123',
        currency: 'USD',
        subtotal: 500,
        total: 500,
        balance: 500,
        assignedUserId: userId,
      },
      select: { id: true },
    });
    await install(tenantId, INVOICING_ESTIMATE_APPROVED_TASK);

    await handleTrigger(
      event(tenantId, 'crm.billing_document.stage_changed', {
        documentId: doc.id,
        toStageId: approved!.id,
      }),
      deps
    );
    await runAutomationTick(deps, appDb);
    const opened = await ownerDb.task.findFirstOrThrow({
      where: { tenantId, billingDocumentId: doc.id },
    });
    expect(opened).toMatchObject({
      title: 'EST-000123 was approved: take it to the next step',
      status: 'open',
      closesWhenDocumentLeaves: approved!.id,
    });

    await billingDocumentStageService.advance({ tenantId, userId }, doc.id, {
      stageId: scheduled!.id,
    });
    const closed = await ownerDb.task.findUnique({ where: { id: opened.id } });
    expect(closed).toMatchObject({
      status: 'completed',
      completedByUserId: userId,
      description: 'Kim Lee moved EST-000123 to Scheduled.',
    });
  });
});
