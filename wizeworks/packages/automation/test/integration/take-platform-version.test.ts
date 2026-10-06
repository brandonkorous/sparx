// Taking the platform's newer version of a seeded rule, against docker Postgres.
//
// The re-sync never writes over a rule the business changed. It flags the row and
// keeps the newer document beside it. This is the business asking for that newer
// version: what is replaced, what is kept, and what is refused.

import type { Trigger } from '@wizeworks/automation-schemas';
import { afterAll, describe, expect, it } from 'vitest';

import {
  createAutomation,
  listAutomationVersions,
  LockedAutomationError,
  PlatformVersionUnavailableError,
  publishAutomation,
  restoreAutomationVersion,
  setAutomationStatus,
  takePlatformVersion,
  updateAutomation,
  upsertSystemAutomation,
  type ServiceCtx,
} from '../../src/service/automation-service';
import { createTenant, dropTenant, ownerDb } from '../helpers';

const createdTenants: string[] = [];
async function tenant(): Promise<ServiceCtx> {
  const id = await createTenant({ modules: ['crm'] });
  createdTenants.push(id);
  return { tenantId: id };
}

afterAll(async () => {
  for (const id of createdTenants) await dropTenant(id);
});

const welcome = {
  key: 'test.take-welcome',
  name: 'Welcome new customers',
  description: 'Send a welcome email',
  trigger: { kind: 'event', eventType: 'customer.created' } as Trigger,
  conditions: { logic: 'AND' as const, conditions: [] },
  actions: [{ type: 'crm.add_tag' as const, config: { tag: 'new' } }],
  status: 'active' as const,
};
// The platform's next version: a new condition, a new step, new words.
const welcomeV2 = {
  ...welcome,
  description: 'Send a welcome email to people who said yes to email',
  conditions: {
    logic: 'AND' as const,
    conditions: [{ field: 'customer.accepts_marketing', operator: 'eq' as const, value: true }],
  },
  actions: [
    { type: 'crm.add_tag' as const, config: { tag: 'new' } },
    { type: 'crm.add_tag' as const, config: { tag: 'welcomed' } },
  ],
};

/** A seeded rule the business renamed, reworded and paused, then the platform
 *  shipped welcomeV2: the newer version is waiting beside theirs. */
async function heldBack(ctx: ServiceCtx) {
  const seeded = await upsertSystemAutomation(ctx, welcome);
  await updateAutomation(ctx, seeded.id, {
    name: 'Say hi to new people',
    description: 'Our own hello',
  });
  await publishAutomation(ctx, seeded.id, { note: 'Our words' });
  await setAutomationStatus(ctx, seeded.id, 'paused');
  return upsertSystemAutomation(ctx, welcomeV2);
}

describe('the re-sync keeps the newer version beside the business’s own', () => {
  it('writes the platform document with the flag, and leaves the live rule alone', async () => {
    const ctx = await tenant();
    const row = await heldBack(ctx);
    expect(row.platformUpdateAt).toBeInstanceOf(Date);
    expect(row.description).toBe('Our own hello');
    expect(row.platformDocument).toMatchObject({
      description: welcomeV2.description,
      conditions: welcomeV2.conditions,
      actions: welcomeV2.actions,
    });
  });

  it('follows the platform when it changes again before anyone takes it', async () => {
    const ctx = await tenant();
    const row = await heldBack(ctx);
    const v3 = await upsertSystemAutomation(ctx, { ...welcomeV2, description: 'Third take' });
    expect(v3.platformUpdateAt?.getTime()).toBe(row.platformUpdateAt?.getTime());
    expect(v3.platformDocument).toMatchObject({ description: 'Third take' });
  });

  it('clears it with the flag when the business’s rule matches the platform again', async () => {
    const ctx = await tenant();
    const row = await heldBack(ctx);
    await updateAutomation(ctx, row.id, {
      description: welcomeV2.description,
      conditions: welcomeV2.conditions,
      actions: welcomeV2.actions,
    });
    await publishAutomation(ctx, row.id);
    const after = await upsertSystemAutomation(ctx, welcomeV2);
    expect(after.platformUpdateAt).toBeNull();
    expect(after.platformDocument).toBeNull();
  });
});

describe('takePlatformVersion', () => {
  it('replaces the rule with the platform’s current version and clears the flag', async () => {
    const ctx = await tenant();
    const row = await heldBack(ctx);
    const taken = await takePlatformVersion(ctx, row.id);

    expect(taken.description).toBe(welcomeV2.description);
    expect(taken.conditions).toEqual(welcomeV2.conditions);
    expect(taken.actions).toEqual(welcomeV2.actions);
    expect(taken.triggerType).toBe('customer.created');
    expect(taken.platformUpdateAt).toBeNull();
    expect(taken.platformDocument).toBeNull();
    expect(taken.draft).toBeNull();
  });

  it('keeps the business’s name and on/off status exactly as they were', async () => {
    const ctx = await tenant();
    const row = await heldBack(ctx);
    const taken = await takePlatformVersion(ctx, row.id);
    expect(taken.name).toBe('Say hi to new people');
    expect(taken.status).toBe('paused');
  });

  it('publishes it as the next version and keeps theirs in the history, restorable', async () => {
    const ctx = await tenant();
    const row = await heldBack(ctx);
    const taken = await takePlatformVersion(ctx, row.id);
    expect(taken.version).toBe(row.version + 1);

    const history = await listAutomationVersions(ctx, row.id);
    const theirs = history.find((v) => v.version === row.version);
    const newest = history[0]!;
    expect(newest.version).toBe(taken.version);
    expect(newest.description).toBe(welcomeV2.description);
    expect(newest.name).toBe('Say hi to new people');
    expect(theirs?.description).toBe('Our own hello');
    expect(theirs?.note).toBe('Our words');

    const restored = await restoreAutomationVersion(ctx, row.id, row.version);
    expect((restored.draft as { description: string }).description).toBe('Our own hello');
  });

  it('records the platform fingerprint, so the next re-sync keeps it current', async () => {
    const ctx = await tenant();
    const row = await heldBack(ctx);
    await takePlatformVersion(ctx, row.id);

    const v3 = await upsertSystemAutomation(ctx, { ...welcomeV2, description: 'Third take' });
    expect(v3.description).toBe('Third take');
    expect(v3.platformUpdateAt).toBeNull();
    expect(v3.name).toBe('Say hi to new people');
    expect(v3.status).toBe('paused');
  });

  it('saves a live version that was never snapshotted before replacing it', async () => {
    // A seed is installed as version 1 with no snapshot. If the business's edit
    // is what runs and no snapshot of it exists, the switch must still keep it.
    const ctx = await tenant();
    const row = await heldBack(ctx);
    await ownerDb.automationVersion.deleteMany({ where: { automationId: row.id } });

    const taken = await takePlatformVersion(ctx, row.id);
    const history = await listAutomationVersions(ctx, row.id);
    expect(history.map((v) => v.version)).toEqual([taken.version, row.version]);
    expect(history[1]!.description).toBe('Our own hello');
  });

  it('refuses a rule the business made', async () => {
    const ctx = await tenant();
    const mine = await createAutomation(ctx, {
      name: 'Mine',
      trigger: welcome.trigger,
      actions: welcome.actions,
    });
    await expect(takePlatformVersion(ctx, mine.id)).rejects.toMatchObject({
      reason: 'not-seeded',
    });
  });

  it('refuses a seeded rule with no newer version waiting, and a second take', async () => {
    const ctx = await tenant();
    const seeded = await upsertSystemAutomation(ctx, welcome);
    await expect(takePlatformVersion(ctx, seeded.id)).rejects.toBeInstanceOf(
      PlatformVersionUnavailableError
    );

    const row = await heldBack(await tenant());
    await takePlatformVersion({ tenantId: row.tenantId }, row.id);
    await expect(takePlatformVersion({ tenantId: row.tenantId }, row.id)).rejects.toMatchObject({
      reason: 'up-to-date',
    });
  });

  it('refuses while the business has unpublished changes, and changes nothing', async () => {
    const ctx = await tenant();
    const row = await heldBack(ctx);
    await updateAutomation(ctx, row.id, { description: 'Half-written' });

    await expect(takePlatformVersion(ctx, row.id)).rejects.toMatchObject({
      reason: 'has-draft',
    });
    const after = await ownerDb.automation.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.description).toBe('Our own hello');
    expect(after.platformUpdateAt).toBeInstanceOf(Date);
  });

  it('refuses a locked rule like every other write', async () => {
    const ctx = await tenant();
    const locked = await upsertSystemAutomation(ctx, {
      ...welcome,
      key: 'test.take-locked',
      locked: true,
    });
    await expect(takePlatformVersion(ctx, locked.id)).rejects.toBeInstanceOf(LockedAutomationError);
  });
});
