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
import { createTenant, dropTenant } from '../helpers';

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
      name: 'seeded',
      trigger: eventTrigger,
      conditions: { logic: 'AND' as const, conditions: [] },
      actions: oneAction,
      status: 'active' as const,
    };
    const first = await upsertSystemAutomation(ctx, spec);
    const second = await upsertSystemAutomation(ctx, { ...spec, status: 'paused' });
    expect(second.id).toBe(first.id);
    expect(second.status).toBe('paused');
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
