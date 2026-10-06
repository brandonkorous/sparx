// The seed re-sync against the REAL catalog, through `seedSystemAutomations` (the
// path module activation, the daily reconcile and the release all take).
//
// Measured on 2026-10-03, before `system_key` and the seeded fingerprint: the
// re-sync matched a tenant's copy by name and wrote the stock rule over it. An
// edited copy was put back, a paused one was switched on, and a renamed one was
// missed, so a second copy went in beside it and both ran (two welcome emails to
// each new contact).
//
// The rows here are put into the state every production row is in when this
// ships (no key, no fingerprint) where that matters, because that is the estate
// the first re-sync after release meets.

import crypto from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import {
  publishAutomation,
  setAutomationStatus,
  updateAutomation,
  type SystemAutomationSpec,
} from '@wizeworks/automation';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { seedSystemAutomations } from '../../src/index.js';
import { B2B_ORDER_HELD_TASK, B2B_OVERDUE_ESCALATION } from '../../src/seeds/b2b.js';
import { CRM_WELCOME_NEW_CUSTOMER } from '../../src/seeds/crm.js';
import { SYSTEM_AUTOMATIONS } from '../../src/seeds/index.js';

const ownerDb = new PrismaClient({
  datasourceUrl:
    process.env.MIGRATION_DATABASE_URL ??
    'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public',
});

const createdTenants: string[] = [];

async function makeTenant(modules: string[]): Promise<string> {
  const slug = `resync-${crypto.randomBytes(5).toString('hex')}`;
  const tenant = await ownerDb.tenant.create({
    data: {
      slug,
      name: slug,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      settings: { modules: Object.fromEntries(modules.map((m) => [m, { enabled: true }])) },
    },
    select: { id: true },
  });
  createdTenants.push(tenant.id);
  return tenant.id;
}

/** The tenant's copy of one seed, found by its key. */
async function copyOf(tenantId: string, spec: SystemAutomationSpec) {
  return ownerDb.automation.findFirstOrThrow({
    where: { tenantId, origin: 'system', systemKey: spec.key },
  });
}

/** What a row installed before this release looks like: no key, no fingerprint. */
async function asInstalledBeforeKeys(id: string): Promise<void> {
  await ownerDb.automation.update({
    where: { id },
    data: { systemKey: null, seededFingerprint: null },
  });
}

/** Yesterday's welcome: the email step declared transactional, so it went to
 *  every new contact whether or not the business had email on or the person had
 *  unsubscribed. Today's seed declares it marketing. */
const YESTERDAYS_WELCOME_ACTIONS = [
  {
    type: 'email.send_campaign',
    config: { builderEmailKey: 'welcome-customer', emailType: 'transactional' },
  },
];

beforeAll(async () => {
  await ownerDb.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  for (const id of createdTenants) {
    await ownerDb.tenant.delete({ where: { id } }).catch(() => undefined);
  }
  await ownerDb.$disconnect();
});

describe('seed re-sync over the real catalog', () => {
  it('every seed has a key, and a first install stamps it with a fingerprint', async () => {
    const tenantId = await makeTenant(['crm']);
    const installed = await seedSystemAutomations({ tenantId }, { module: 'crm' });
    for (const row of installed) {
      expect(row.systemKey).toMatch(/^[a-z0-9]+\.[a-z0-9-]+$/);
      expect(row.seededFingerprint).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('a second pass over an untouched estate writes nothing', async () => {
    // The fingerprint must survive the jsonb round trip for every real seed, or
    // each pass would read every row as edited (no fixes reach anyone) or
    // rewrite it (every updated_at bumped daily).
    const tenantId = await makeTenant(['crm', 'commerce', 'b2b', 'invoicing', 'chat']);
    const first = await seedSystemAutomations({ tenantId });
    const second = await seedSystemAutomations({ tenantId });
    expect(second.map((r) => r.id)).toEqual(first.map((r) => r.id));
    for (const [i, row] of second.entries()) {
      expect(row.updatedAt.getTime(), row.name).toBe(first[i]!.updatedAt.getTime());
      expect(row.platformUpdateAt, row.name).toBeNull();
    }
    expect(first).toHaveLength(SYSTEM_AUTOMATIONS.length);
  });

  it('an untouched copy from before this release takes today’s fix', async () => {
    const tenantId = await makeTenant(['crm']);
    await seedSystemAutomations({ tenantId }, { module: 'crm' });
    const row = await copyOf(tenantId, CRM_WELCOME_NEW_CUSTOMER);
    await ownerDb.automation.update({
      where: { id: row.id },
      data: { actions: YESTERDAYS_WELCOME_ACTIONS },
    });
    await asInstalledBeforeKeys(row.id);

    await seedSystemAutomations({ tenantId }, { module: 'crm' });

    const after = await copyOf(tenantId, CRM_WELCOME_NEW_CUSTOMER);
    expect(after.id).toBe(row.id);
    expect(after.actions).toEqual(CRM_WELCOME_NEW_CUSTOMER.actions);
    expect(after.platformUpdateAt).toBeNull();
  });

  it('an edited copy keeps the edit, and says a newer version is waiting', async () => {
    const tenantId = await makeTenant(['crm']);
    await seedSystemAutomations({ tenantId }, { module: 'crm' });
    const row = await copyOf(tenantId, CRM_WELCOME_NEW_CUSTOMER);
    // Yesterday's seed, which the business then edited and published.
    await ownerDb.automation.update({
      where: { id: row.id },
      data: { actions: YESTERDAYS_WELCOME_ACTIONS },
    });
    await updateAutomation({ tenantId }, row.id, { description: 'Our hello to new members' });
    await publishAutomation({ tenantId }, row.id);
    await asInstalledBeforeKeys(row.id);

    await seedSystemAutomations({ tenantId }, { module: 'crm' });

    const after = await copyOf(tenantId, CRM_WELCOME_NEW_CUSTOMER);
    expect(after.id).toBe(row.id);
    expect(after.description).toBe('Our hello to new members');
    expect(after.actions).toEqual(YESTERDAYS_WELCOME_ACTIONS);
    expect(after.platformUpdateAt).toBeInstanceOf(Date);
  });

  it('a paused copy stays paused, every pass', async () => {
    const tenantId = await makeTenant(['crm']);
    await seedSystemAutomations({ tenantId }, { module: 'crm' });
    const row = await copyOf(tenantId, CRM_WELCOME_NEW_CUSTOMER);
    await setAutomationStatus({ tenantId }, row.id, 'paused');

    await seedSystemAutomations({ tenantId }, { module: 'crm' });
    await seedSystemAutomations({ tenantId }, { module: 'crm' });

    expect((await copyOf(tenantId, CRM_WELCOME_NEW_CUSTOMER)).status).toBe('paused');
  });

  it('a renamed copy stays the one welcome', async () => {
    const tenantId = await makeTenant(['crm']);
    await seedSystemAutomations({ tenantId }, { module: 'crm' });
    const row = await copyOf(tenantId, CRM_WELCOME_NEW_CUSTOMER);
    await updateAutomation({ tenantId }, row.id, { name: 'Say hello to new members' });
    await publishAutomation({ tenantId }, row.id);

    await seedSystemAutomations({ tenantId }, { module: 'crm' });

    const welcomes = await ownerDb.automation.findMany({
      where: { tenantId, triggerType: 'crm.customer.created', origin: 'system' },
    });
    expect(welcomes.map((w) => w.name)).toEqual(['Say hello to new members']);
  });

  it('the locked dunning ladder is always the platform’s', async () => {
    const tenantId = await makeTenant(['b2b']);
    await seedSystemAutomations({ tenantId }, { module: 'b2b' });
    const row = await copyOf(tenantId, B2B_OVERDUE_ESCALATION);
    await ownerDb.automation.update({
      where: { id: row.id },
      data: { description: 'drifted', status: 'paused' },
    });

    await seedSystemAutomations({ tenantId }, { module: 'b2b' });

    const after = await copyOf(tenantId, B2B_OVERDUE_ESCALATION);
    expect(after.description).toBe(B2B_OVERDUE_ESCALATION.description);
    expect(after.status).toBe('active');
  });

  it('an untouched sign-off task gains today’s condition; an edited one is flagged', async () => {
    const untouched = await makeTenant(['b2b']);
    const edited = await makeTenant(['b2b']);
    for (const tenantId of [untouched, edited]) {
      await seedSystemAutomations({ tenantId }, { module: 'b2b' });
      const row = await copyOf(tenantId, B2B_ORDER_HELD_TASK);
      // Before today the rule had no condition: it opened a task for every held
      // order, including ones only the account's own approver can sign.
      await ownerDb.automation.update({
        where: { id: row.id },
        data: { conditions: { logic: 'AND', conditions: [] } },
      });
      if (tenantId === edited) {
        await updateAutomation({ tenantId }, row.id, { description: 'Ping the counter team' });
        await publishAutomation({ tenantId }, row.id);
      }
      await asInstalledBeforeKeys(row.id);
    }

    await seedSystemAutomations({ tenantId: untouched }, { module: 'b2b' });
    await seedSystemAutomations({ tenantId: edited }, { module: 'b2b' });

    expect((await copyOf(untouched, B2B_ORDER_HELD_TASK)).conditions).toEqual(
      B2B_ORDER_HELD_TASK.conditions
    );
    const kept = await copyOf(edited, B2B_ORDER_HELD_TASK);
    expect(kept.description).toBe('Ping the counter team');
    expect(kept.conditions).toEqual({ logic: 'AND', conditions: [] });
    expect(kept.platformUpdateAt).toBeInstanceOf(Date);
  });
});
