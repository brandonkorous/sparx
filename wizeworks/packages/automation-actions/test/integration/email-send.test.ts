// Email executors — END-TO-END on the unified engine (docs/84 Slice F1).
//
// Drives the EVENT path: an active automation on `crm.customer.subscribed` with an
// `email.send_campaign` action → handleTrigger (enqueue a run) → runAutomationTick
// (resolve customer.email, run the gated dispatcher, execute the executor →
// enqueueSend → a ScheduledSend row). Proves recipient resolution off the trigger
// entity, the do-not-contact skip, and that the executor reaches the real enqueue.
//
// Ticks run on the sparx_app client (the worker's prod identity, FORCE RLS);
// seeding/asserts use a sparx_owner client. The engine publisher is a noop — these
// executors enqueue a send, they don't publish events.

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

import { installEmailActions } from '../../src/index.js';

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

async function seedCustomerAutomation(opts: { doNotContact?: boolean } = {}): Promise<{
  tenantId: string;
  customerId: string;
  email: string;
}> {
  const slug = `esx-${crypto.randomBytes(4).toString('hex')}`;
  const tenant = await ownerDb.tenant.create({
    data: {
      slug,
      name: slug,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      // The module-active gate reads settings.modules.email.enabled directly.
      settings: { modules: { email: { enabled: true } } },
    },
    select: { id: true },
  });
  createdTenants.push(tenant.id);

  const email = `buyer-${slug}@example.com`;
  const customer = await ownerDb.customer.create({
    data: {
      tenantId: tenant.id,
      type: 'retail',
      email,
      doNotContact: opts.doNotContact ?? false,
    },
    select: { id: true },
  });

  await ownerDb.automation.create({
    data: {
      tenantId: tenant.id,
      name: 'Welcome campaign',
      status: 'active',
      triggerType: 'crm.customer.subscribed',
      triggerConfig: {},
      conditions: { logic: 'AND', conditions: [] },
      actions: [{ type: 'email.send_campaign', config: { template: 'welcome-series', props: {} } }],
      origin: 'user',
      maxDepth: 3,
    },
  });

  return { tenantId: tenant.id, customerId: customer.id, email };
}

function subscribedEvent(tenantId: string, customerId: string): TriggerEnvelope {
  return {
    type: 'crm.customer.subscribed',
    tenantId,
    actorId: null,
    occurredAt: new Date().toISOString(),
    data: { customerId },
  };
}

beforeAll(() => {
  installBuiltins();
  installEmailActions();
});

afterAll(async () => {
  for (const id of createdTenants) {
    await ownerDb.tenant.delete({ where: { id } }).catch(() => undefined);
  }
  await ownerDb.$disconnect();
  await appDb.$disconnect();
});

describe('email.send_campaign on the automation engine', () => {
  it('enqueues a campaign send addressed to the trigger customer', async () => {
    const { tenantId, customerId, email } = await seedCustomerAutomation();

    await handleTrigger(subscribedEvent(tenantId, customerId), deps, appDb);
    await runAutomationTick(deps, appDb);

    const rows = await ownerDb.scheduledSend.findMany({ where: { tenantId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.recipient).toBe(email);
    expect(rows[0]!.customerId).toBe(customerId);
    expect(rows[0]!.payload).toMatchObject({ template: 'welcome-series' });
  });

  it('skips the send when the customer is flagged do-not-contact', async () => {
    const { tenantId, customerId } = await seedCustomerAutomation({ doNotContact: true });

    await handleTrigger(subscribedEvent(tenantId, customerId), deps, appDb);
    await runAutomationTick(deps, appDb);

    expect(await ownerDb.scheduledSend.count({ where: { tenantId } })).toBe(0);
  });
});
