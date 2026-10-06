// Automation service layer (docs/81 §3.1, §5) against docker Postgres — the tier
// invariants the schema can't express: system-managed origin/locked, the locked
// "duplicate to edit" guard, and idempotent system seeding.

import type { Trigger } from '@wizeworks/automation-schemas';
import { afterAll, describe, expect, it } from 'vitest';

import {
  AutomationNotFoundError,
  AutomationVersionNotFoundError,
  cloneAutomation,
  createAutomation,
  deleteAutomation,
  discardDraft,
  listAutomations,
  listAutomationVersions,
  LockedAutomationError,
  NoDraftError,
  publishAutomation,
  restoreAutomationVersion,
  setAutomationStatus,
  updateAutomation,
  upsertSystemAutomation,
  type ServiceCtx,
} from '../../src/service/automation-service';
import { createTenant, dropTenant, ownerDb } from '../helpers';

/** Read a field off the staged draft JSON blob (typed loosely on the Prisma row). */
function draftField<T = string>(draft: unknown, key: string): T {
  return (draft as Record<string, T>)[key] as T;
}

const eventTrigger: Trigger = { kind: 'event', eventType: 'order.placed' };
const oneAction = [{ type: 'crm.add_tag' as const, config: { tag: 'x' } }];

const createdTenants: string[] = [];
async function tenant(): Promise<ServiceCtx> {
  const id = await createTenant({ modules: ['crm'] });
  createdTenants.push(id);
  return { tenantId: id };
}

afterAll(async () => {
  for (const id of createdTenants) await dropTenant(id);
});

describe('automation service — CRUD', () => {
  it('creates a user-origin draft, never system/locked', async () => {
    const ctx = await tenant();
    const a = await createAutomation(ctx, {
      name: 'welcome',
      trigger: eventTrigger,
      actions: oneAction,
    });
    expect(a.status).toBe('draft');
    expect(a.origin).toBe('user');
    expect(a.locked).toBe(false);
    expect(a.triggerType).toBe('order.placed');
  });

  it('activates an automation; document edits stage in a draft until publish', async () => {
    const ctx = await tenant();
    const a = await createAutomation(ctx, { name: 'x', trigger: eventTrigger, actions: oneAction });
    expect(a.version).toBe(1);
    const active = await setAutomationStatus(ctx, a.id, 'active');
    expect(active.status).toBe('active');
    // A document edit STAGES — the live name/version are unchanged, the draft holds it.
    const staged = await updateAutomation(ctx, a.id, { name: 'renamed' });
    expect(staged.name).toBe('x');
    expect(staged.version).toBe(1);
    expect(draftField(staged.draft, 'name')).toBe('renamed');
    // A status change is NOT a document edit — it applies live without a draft.
    expect(active.draft).toBeNull();
    // Publish promotes the draft → live, bumps the version, clears the draft.
    const published = await publishAutomation(ctx, a.id);
    expect(published.name).toBe('renamed');
    expect(published.version).toBe(2);
    expect(published.draft).toBeNull();
  });

  it('clones with lineage into a new editable draft', async () => {
    const ctx = await tenant();
    const src = await createAutomation(ctx, {
      name: 'source',
      trigger: eventTrigger,
      actions: oneAction,
    });
    const copy = await cloneAutomation(ctx, src.id, {});
    expect(copy.id).not.toBe(src.id);
    expect(copy.clonedFrom).toBe(src.id);
    expect(copy.origin).toBe('user');
    expect(copy.locked).toBe(false);
    expect(copy.status).toBe('draft');
    expect(copy.name).toBe('source (copy)');
  });

  it('throws AutomationNotFoundError for a missing id', async () => {
    const ctx = await tenant();
    await expect(
      updateAutomation(ctx, '00000000-0000-0000-0000-000000000000', { name: 'x' })
    ).rejects.toBeInstanceOf(AutomationNotFoundError);
  });

  it('filters list by origin', async () => {
    const ctx = await tenant();
    await createAutomation(ctx, { name: 'u', trigger: eventTrigger, actions: oneAction });
    await upsertSystemAutomation(ctx, {
      key: 'test.sys',
      name: 'sys',
      trigger: eventTrigger,
      conditions: { logic: 'AND', conditions: [] },
      actions: oneAction,
    });
    const userOnly = await listAutomations(ctx, { origin: 'user' });
    const sysOnly = await listAutomations(ctx, { origin: 'system' });
    expect(userOnly.every((a) => a.origin === 'user')).toBe(true);
    expect(sysOnly.every((a) => a.origin === 'system')).toBe(true);
    expect(sysOnly).toHaveLength(1);
  });
});

describe('automation service — locked tier (§3.1)', () => {
  it('a locked system automation rejects edit / status / delete', async () => {
    const ctx = await tenant();
    const sys = await upsertSystemAutomation(ctx, {
      key: 'test.locked-dunning',
      name: 'locked dunning',
      trigger: eventTrigger,
      conditions: { logic: 'AND', conditions: [] },
      actions: oneAction,
      locked: true,
      status: 'active',
    });
    expect(sys.locked).toBe(true);
    await expect(updateAutomation(ctx, sys.id, { name: 'nope' })).rejects.toBeInstanceOf(
      LockedAutomationError
    );
    await expect(setAutomationStatus(ctx, sys.id, 'paused')).rejects.toBeInstanceOf(
      LockedAutomationError
    );
    await expect(deleteAutomation(ctx, sys.id)).rejects.toBeInstanceOf(LockedAutomationError);
  });

  it('a tenant can clone a locked automation into an editable copy', async () => {
    const ctx = await tenant();
    const sys = await upsertSystemAutomation(ctx, {
      key: 'test.locked',
      name: 'locked',
      trigger: eventTrigger,
      conditions: { logic: 'AND', conditions: [] },
      actions: oneAction,
      locked: true,
    });
    const copy = await cloneAutomation(ctx, sys.id);
    expect(copy.locked).toBe(false);
    expect(copy.clonedFrom).toBe(sys.id);
    await expect(updateAutomation(ctx, copy.id, { name: 'now editable' })).resolves.toBeTruthy();
  });

  it('system seeding is idempotent (updates in place, no duplicate)', async () => {
    const ctx = await tenant();
    const spec = {
      key: 'test.seeded',
      name: 'seeded',
      trigger: eventTrigger,
      conditions: { logic: 'AND' as const, conditions: [] },
      actions: oneAction,
      status: 'active' as const,
    };
    const first = await upsertSystemAutomation(ctx, spec);
    const second = await upsertSystemAutomation(ctx, { ...spec, status: 'paused' });
    expect(second.id).toBe(first.id);
    // A spec's status is where a NEW install starts. It is never written onto a
    // row that exists: pausing or resuming one is the business's call.
    expect(second.status).toBe('active');
    expect(second.version).toBe(1); // re-seed doesn't bump the version
    const all = await listAutomations(ctx, { origin: 'system' });
    expect(all).toHaveLength(1);
  });
});

describe('automation service — versioning (Slice G-versioning)', () => {
  it('create records a version-1 history snapshot', async () => {
    const ctx = await tenant();
    const a = await createAutomation(ctx, { name: 'v', trigger: eventTrigger, actions: oneAction });
    const versions = await listAutomationVersions(ctx, a.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.version).toBe(1);
    expect(versions[0]!.name).toBe('v');
  });

  it('publish appends an immutable snapshot and bumps the version', async () => {
    const ctx = await tenant();
    const a = await createAutomation(ctx, {
      name: 'one',
      trigger: eventTrigger,
      actions: oneAction,
    });
    await updateAutomation(ctx, a.id, { name: 'two' });
    const published = await publishAutomation(ctx, a.id, { note: 'rename' });
    expect(published.version).toBe(2);
    const versions = await listAutomationVersions(ctx, a.id);
    expect(versions.map((v) => v.version)).toEqual([2, 1]); // newest-first
    expect(versions[0]!.name).toBe('two');
    expect(versions[0]!.note).toBe('rename');
  });

  it('publish with no staged draft throws NoDraftError', async () => {
    const ctx = await tenant();
    const a = await createAutomation(ctx, {
      name: 'nd',
      trigger: eventTrigger,
      actions: oneAction,
    });
    await expect(publishAutomation(ctx, a.id)).rejects.toBeInstanceOf(NoDraftError);
  });

  it('discardDraft clears the draft; the live document is untouched', async () => {
    const ctx = await tenant();
    const a = await createAutomation(ctx, {
      name: 'keep',
      trigger: eventTrigger,
      actions: oneAction,
    });
    await updateAutomation(ctx, a.id, { name: 'throwaway' });
    const discarded = await discardDraft(ctx, a.id);
    expect(discarded.draft).toBeNull();
    expect(discarded.name).toBe('keep');
    expect(discarded.version).toBe(1);
  });

  it('restore stages a prior version as a draft (live unchanged; history append-only)', async () => {
    const ctx = await tenant();
    const a = await createAutomation(ctx, {
      name: 'orig',
      trigger: eventTrigger,
      actions: oneAction,
    });
    await updateAutomation(ctx, a.id, { name: 'v2name' });
    await publishAutomation(ctx, a.id); // v2 is live
    const restored = await restoreAutomationVersion(ctx, a.id, 1);
    expect(draftField(restored.draft, 'name')).toBe('orig');
    expect(restored.name).toBe('v2name'); // live unchanged until re-publish
    expect(restored.version).toBe(2);
    await expect(restoreAutomationVersion(ctx, a.id, 99)).rejects.toBeInstanceOf(
      AutomationVersionNotFoundError
    );
  });

  it('a locked automation rejects publish / discard / restore', async () => {
    const ctx = await tenant();
    const sys = await upsertSystemAutomation(ctx, {
      key: 'test.locked-v',
      name: 'locked v',
      trigger: eventTrigger,
      conditions: { logic: 'AND', conditions: [] },
      actions: oneAction,
      locked: true,
    });
    await expect(publishAutomation(ctx, sys.id)).rejects.toBeInstanceOf(LockedAutomationError);
    await expect(discardDraft(ctx, sys.id)).rejects.toBeInstanceOf(LockedAutomationError);
    await expect(restoreAutomationVersion(ctx, sys.id, 1)).rejects.toBeInstanceOf(
      LockedAutomationError
    );
  });

  it('clone starts its own version-1 history line', async () => {
    const ctx = await tenant();
    const src = await createAutomation(ctx, {
      name: 'src',
      trigger: eventTrigger,
      actions: oneAction,
    });
    const copy = await cloneAutomation(ctx, src.id);
    expect(copy.version).toBe(1);
    const versions = await listAutomationVersions(ctx, copy.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.version).toBe(1);
  });
});

/** Make a row look like one installed before `system_key` and the seeded
 *  fingerprint existed: the state every production row is in when this ships. */
async function asInstalledBeforeKeys(id: string): Promise<void> {
  await ownerDb.automation.update({
    where: { id },
    data: { systemKey: null, seededFingerprint: null },
  });
}

async function systemRows(ctx: ServiceCtx) {
  return listAutomations(ctx, { origin: 'system' });
}

describe('automation service: a seed the platform renamed', () => {
  // Rows installed before `system_key` existed can only be found by name, and a
  // platform reword of the name used to miss them: a second row was created, the
  // first stayed active, and the tenant held two copies of one rule. `previousNames`
  // is how such a row is still found, and once found it is keyed for good.
  const seed = (name: string, previousNames?: readonly string[]) => ({
    key: 'test.renamed-seed',
    name,
    ...(previousNames ? { previousNames } : {}),
    trigger: eventTrigger,
    conditions: { logic: 'AND' as const, conditions: [] },
    actions: oneAction,
  });

  it('adopts, keys and renames the existing row instead of adding a second one', async () => {
    const ctx = await tenant();
    const before = await upsertSystemAutomation(ctx, seed('Order delivered — email'));
    await asInstalledBeforeKeys(before.id);

    await upsertSystemAutomation(ctx, seed('Order delivered: email', ['Order delivered — email']));

    const rows = await systemRows(ctx);
    // Remove `previousNames` from the seed above and this is 2, not 1.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(before.id);
    expect(rows[0]!.name).toBe('Order delivered: email');
    expect(rows[0]!.systemKey).toBe('test.renamed-seed');
  });

  it('matches by key once keyed, so a re-run after the rename is a no-op', async () => {
    const ctx = await tenant();
    const spec = seed('Payment failed: email', ['Payment failed — email']);
    const first = await upsertSystemAutomation(ctx, spec);
    const again = await upsertSystemAutomation(ctx, spec);
    await upsertSystemAutomation(ctx, spec);

    const rows = await systemRows(ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(first.id);
    // Nothing differed, so nothing was written.
    expect(again.updatedAt.getTime()).toBe(first.updatedAt.getTime());
  });

  it('leaves a tenant-authored rule of the same old name alone', async () => {
    // Adoption is scoped to origin='system'. A rule the business wrote itself is
    // theirs, even if it happens to carry the name a seed used to use.
    const ctx = await tenant();
    const mine = await createAutomation(ctx, {
      name: 'Order delivered — email',
      trigger: eventTrigger,
      actions: oneAction,
    });

    await upsertSystemAutomation(ctx, seed('Order delivered: email', ['Order delivered — email']));

    const user = await listAutomations(ctx, { origin: 'user' });
    expect(user).toHaveLength(1);
    expect(user[0]!.id).toBe(mine.id);
    expect(user[0]!.name).toBe('Order delivered — email');
    expect(user[0]!.systemKey).toBeNull();
    expect(await systemRows(ctx)).toHaveLength(1);
  });
});

describe('automation service: a re-sync keeps what the business chose', () => {
  // The re-sync runs on module activation, every day, and at release. It used to
  // write the stock rule over the tenant's copy every time: an edit was put back,
  // a paused rule was switched on, and a renamed one was missed and duplicated.
  const welcome = {
    key: 'test.welcome',
    name: 'Welcome new customers',
    description: 'Send a welcome email',
    trigger: { kind: 'event', eventType: 'customer.created' } as Trigger,
    conditions: { logic: 'AND' as const, conditions: [] },
    actions: oneAction,
    status: 'active' as const,
  };
  // The platform's next version of the same seed: a new condition, the way
  // today's fixes reach a seed.
  const welcomeV2 = {
    ...welcome,
    conditions: {
      logic: 'AND' as const,
      conditions: [{ field: 'customer.accepts_marketing', operator: 'eq' as const, value: true }],
    },
  };

  it('an untouched copy takes the platform version', async () => {
    const ctx = await tenant();
    const v1 = await upsertSystemAutomation(ctx, welcome);
    const v2 = await upsertSystemAutomation(ctx, welcomeV2);

    expect(v2.id).toBe(v1.id);
    expect(v2.conditions).toEqual(welcomeV2.conditions);
    expect(v2.seededFingerprint).not.toBe(v1.seededFingerprint);
    expect(v2.platformUpdateAt).toBeNull();
    expect(v2.version).toBe(1);
  });

  it('an edited copy keeps the edit and records that a newer version exists', async () => {
    const ctx = await tenant();
    const v1 = await upsertSystemAutomation(ctx, welcome);
    await updateAutomation(ctx, v1.id, { description: 'Our own hello' });
    await publishAutomation(ctx, v1.id);

    const after = await upsertSystemAutomation(ctx, welcomeV2);
    expect(after.description).toBe('Our own hello');
    expect(after.conditions).toEqual(welcome.conditions);
    expect(after.seededFingerprint).toBe(v1.seededFingerprint);
    expect(after.platformUpdateAt).toBeInstanceOf(Date);

    // The next pass keeps the time it was first held back.
    const later = await upsertSystemAutomation(ctx, welcomeV2);
    expect(later.platformUpdateAt?.getTime()).toBe(after.platformUpdateAt?.getTime());
    expect(later.description).toBe('Our own hello');
  });

  it('an edited copy is not flagged while the platform version has not changed', async () => {
    const ctx = await tenant();
    const v1 = await upsertSystemAutomation(ctx, welcome);
    await updateAutomation(ctx, v1.id, { description: 'Our own hello' });
    await publishAutomation(ctx, v1.id);

    const after = await upsertSystemAutomation(ctx, welcome);
    expect(after.description).toBe('Our own hello');
    expect(after.platformUpdateAt).toBeNull();
  });

  it('a paused copy stays paused, and still takes the platform fix', async () => {
    const ctx = await tenant();
    const v1 = await upsertSystemAutomation(ctx, welcome);
    await setAutomationStatus(ctx, v1.id, 'paused');

    const after = await upsertSystemAutomation(ctx, welcomeV2);
    expect(after.status).toBe('paused');
    expect(after.conditions).toEqual(welcomeV2.conditions);
  });

  it('a renamed copy keeps its name, takes the platform fix, and is never duplicated', async () => {
    const ctx = await tenant();
    const v1 = await upsertSystemAutomation(ctx, welcome);
    await updateAutomation(ctx, v1.id, { name: 'Say hi to new people' });
    await publishAutomation(ctx, v1.id);

    const after = await upsertSystemAutomation(ctx, welcomeV2);
    expect(after.id).toBe(v1.id);
    expect(after.name).toBe('Say hi to new people');
    expect(after.conditions).toEqual(welcomeV2.conditions);
    expect(await systemRows(ctx)).toHaveLength(1);
  });

  it('a renamed copy may take the name another seed uses, and that seed still installs', async () => {
    // Once a row is keyed its name is a label. Holding names unique would make
    // the other seed's install fail for this tenant forever.
    const ctx = await tenant();
    const v1 = await upsertSystemAutomation(ctx, welcome);
    await updateAutomation(ctx, v1.id, { name: 'Tag VIP customers' });
    await publishAutomation(ctx, v1.id);

    const other = await upsertSystemAutomation(ctx, {
      ...welcome,
      key: 'test.tag-vip',
      name: 'Tag VIP customers',
    });
    expect(other.id).not.toBe(v1.id);
    expect(await systemRows(ctx)).toHaveLength(2);
  });

  it('a duplicate-to-edit copy is the business’s own rule and is never adopted', async () => {
    const ctx = await tenant();
    const v1 = await upsertSystemAutomation(ctx, welcome);
    const copy = await cloneAutomation(ctx, v1.id, { name: welcome.name });
    expect(copy.systemKey).toBeNull();

    await upsertSystemAutomation(ctx, welcomeV2);
    const mine = await listAutomations(ctx, { origin: 'user' });
    expect(mine).toHaveLength(1);
    expect(mine[0]!.conditions).toEqual(welcome.conditions);
  });

  it('a locked seed always takes the platform version, status included', async () => {
    const ctx = await tenant();
    const locked = { ...welcome, key: 'test.locked-resync', locked: true };
    const v1 = await upsertSystemAutomation(ctx, locked);
    // The business cannot change a locked rule, so stand in for drift directly.
    await ownerDb.automation.update({
      where: { id: v1.id },
      data: { description: 'drifted', status: 'paused' },
    });

    const after = await upsertSystemAutomation(ctx, {
      ...locked,
      conditions: welcomeV2.conditions,
    });
    expect(after.description).toBe(welcome.description);
    expect(after.conditions).toEqual(welcomeV2.conditions);
    expect(after.status).toBe('active');
  });

  it('overlapping first installs leave exactly one row, and none of them fails', async () => {
    // The lookup is check-then-insert. `automations_system_key_key` refuses the
    // loser's INSERT, and the loser re-reads the winner's row inside a savepoint
    // (an error in a Postgres transaction otherwise aborts the rest of it).
    const ctx = await tenant();
    const runs = await Promise.all(
      Array.from({ length: 8 }, () => upsertSystemAutomation(ctx, welcome))
    );
    expect(new Set(runs.map((r) => r.id)).size).toBe(1);
    expect(await systemRows(ctx)).toHaveLength(1);
  });

  describe('a row installed before keys and fingerprints', () => {
    it('never published by the business: takes the platform version and is keyed', async () => {
      const ctx = await tenant();
      const v1 = await upsertSystemAutomation(ctx, welcome);
      await setAutomationStatus(ctx, v1.id, 'paused');
      await asInstalledBeforeKeys(v1.id);

      const after = await upsertSystemAutomation(ctx, welcomeV2);
      expect(after.id).toBe(v1.id);
      expect(after.systemKey).toBe(welcome.key);
      expect(after.conditions).toEqual(welcomeV2.conditions);
      expect(after.status).toBe('paused');
      expect(after.seededFingerprint).toMatch(/^[0-9a-f]{64}$/);
    });

    it('their published edit is what runs: kept, keyed and flagged', async () => {
      const ctx = await tenant();
      const v1 = await upsertSystemAutomation(ctx, welcome);
      await updateAutomation(ctx, v1.id, { description: 'Our own hello' });
      await publishAutomation(ctx, v1.id);
      await asInstalledBeforeKeys(v1.id);

      const after = await upsertSystemAutomation(ctx, welcomeV2);
      expect(after.systemKey).toBe(welcome.key);
      expect(after.description).toBe('Our own hello');
      expect(after.conditions).toEqual(welcome.conditions);
      expect(after.platformUpdateAt).toBeInstanceOf(Date);
      expect(after.seededFingerprint).toBeNull();
    });

    it('a re-sync already put the stock rule back over their edit: treated as untouched', async () => {
      const ctx = await tenant();
      const v1 = await upsertSystemAutomation(ctx, welcome);
      await updateAutomation(ctx, v1.id, { description: 'Our own hello' });
      await publishAutomation(ctx, v1.id);
      // What the old re-sync did the next day: the stock document, version untouched.
      await ownerDb.automation.update({
        where: { id: v1.id },
        data: { description: welcome.description },
      });
      await asInstalledBeforeKeys(v1.id);

      const after = await upsertSystemAutomation(ctx, welcomeV2);
      expect(after.conditions).toEqual(welcomeV2.conditions);
      expect(after.platformUpdateAt).toBeNull();
    });
  });
});
