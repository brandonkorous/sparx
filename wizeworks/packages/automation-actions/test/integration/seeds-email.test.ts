// Email system seeds (docs/90 Step 4) on the real engine — the ENQUEUE side of the
// send-by-key contract. Proves:
//   1. The welcome seed fires on crm.customer.created and writes a ScheduledSend
//      whose body is a `defer` reference to the 'welcome-customer' template by KEY
//      (resolved to the tenant's published tree at DISPATCH — that half lives in
//      api-rest's email-dispatch send-by-key test), carrying the firing customer's
//      entityRefs + the declared transactional emailType.
//   2. The email MODULE gate — a CRM-only tenant records the send as `gated`
//      (docs/90 §4) and enqueues nothing until email activates.
//   3. The suppression SCOPE follows emailType — a `transactional` campaign
//      (welcome) is NOT withheld by a marketing-scope unsubscribe; a `marketing`
//      campaign (win-back) is.
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

async function seedTenant(modules: string[]): Promise<string> {
  const slug = `seedmail-${crypto.randomBytes(5).toString('hex')}`;
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
  return tenant.id;
}

async function makeCustomer(
  tenantId: string,
  email: string
): Promise<{ id: string; email: string }> {
  const c = await ownerDb.customer.create({
    data: { tenantId, type: 'retail', email },
    select: { id: true },
  });
  return { id: c.id, email };
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

describe('welcome seed — send by key', () => {
  it('fires on crm.customer.created and enqueues a defer.builderEmailKey send', async () => {
    const tenantId = await seedTenant(['crm', 'email']);
    await seedSystemAutomations({ tenantId }, { module: 'crm' });
    const { id: customerId, email } = await makeCustomer(tenantId, 'buyer@sparx.test');

    await handleTrigger(evt('crm.customer.created', tenantId, { customerId }), deps, appDb);
    await runAutomationTick(deps, appDb);

    const send = await ownerDb.scheduledSend.findFirst({ where: { tenantId } });
    expect(send?.recipient).toBe(email);
    expect(send?.customerId).toBe(customerId);
    // The body references the template by KEY (not a per-tenant id) + declares its
    // transactional intent — resolved + gate-checked at dispatch.
    const payload = send?.payload as {
      defer?: { builderEmailKey?: string; emailType?: string };
    } | null;
    expect(payload?.defer?.builderEmailKey).toBe('welcome-customer');
    expect(payload?.defer?.emailType).toBe('transactional');
    // entityRefs name the firing customer for the deferred per-recipient render.
    const refs = send?.entityRefs as { customerId?: string } | null;
    expect(refs?.customerId).toBe(customerId);
  });
});

describe('email module gate', () => {
  it('records the send as gated (enqueues nothing) when email is inactive', async () => {
    const tenantId = await seedTenant(['crm']); // email NOT active
    await seedSystemAutomations({ tenantId }, { module: 'crm' });
    const { id: customerId } = await makeCustomer(tenantId, 'nobody@sparx.test');

    await handleTrigger(evt('crm.customer.created', tenantId, { customerId }), deps, appDb);
    await runAutomationTick(deps, appDb);

    // Nothing enqueued — but the run COMPLETES with the send step recorded `gated`
    // (the conversion nudge in run history, docs/90 §4), not failed.
    expect(await ownerDb.scheduledSend.count({ where: { tenantId } })).toBe(0);
    const run = await ownerDb.automationRun.findFirst({
      where: { tenantId },
      include: { steps: true },
    });
    expect(run?.status).toBe('completed');
    expect(run?.steps.some((s) => s.status === 'gated')).toBe(true);
  });
});

describe('suppression scope follows emailType', () => {
  it('a transactional campaign ignores a marketing unsubscribe; a marketing one honors it', async () => {
    const tenantId = await seedTenant(['crm', 'email']);
    await seedSystemAutomations({ tenantId }, { module: 'crm' });
    const { id: customerId, email } = await makeCustomer(tenantId, 'optout@sparx.test');
    // The recipient unsubscribed from MARKETING only.
    await ownerDb.emailSuppression.create({
      data: { tenantId, email: email.toLowerCase(), scope: 'marketing', reason: 'unsubscribe' },
    });

    // welcome (transactional) → still enqueues despite the marketing opt-out.
    await handleTrigger(evt('crm.customer.created', tenantId, { customerId }), deps, appDb);
    await runAutomationTick(deps, appDb);
    expect(await ownerDb.scheduledSend.count({ where: { tenantId } })).toBe(1);

    // An ad-hoc MARKETING campaign to the same recipient → suppressed (no row).
    await ownerDb.automation.create({
      data: {
        tenantId,
        name: 'Promo',
        status: 'active',
        triggerType: 'crm.customer.subscribed',
        triggerConfig: {},
        conditions: { logic: 'AND', conditions: [] },
        actions: [
          {
            type: 'email.send_campaign',
            config: { builderEmailKey: 'win-back', emailType: 'marketing' },
          },
        ],
        origin: 'user',
        maxDepth: 3,
      },
    });
    await handleTrigger(evt('crm.customer.subscribed', tenantId, { customerId }), deps, appDb);
    await runAutomationTick(deps, appDb);

    // Still just the one welcome send — the marketing promo was suppressed.
    expect(await ownerDb.scheduledSend.count({ where: { tenantId } })).toBe(1);
  });
});
