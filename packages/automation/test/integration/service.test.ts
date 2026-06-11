// Automation service layer (docs/81 §3.1, §5) against docker Postgres — the tier
// invariants the schema can't express: system-managed origin/locked, the locked
// "duplicate to edit" guard, and idempotent system seeding.

import type { Trigger } from '@sparx/automation-schemas';
import { afterAll, describe, expect, it } from 'vitest';

import {
  AutomationNotFoundError,
  cloneAutomation,
  createAutomation,
  deleteAutomation,
  listAutomations,
  LockedAutomationError,
  setAutomationStatus,
  updateAutomation,
  upsertSystemAutomation,
  type ServiceCtx,
} from '../../src/service/automation-service';
import { createTenant, dropTenant } from '../helpers';

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

  it('activates + updates an automation', async () => {
    const ctx = await tenant();
    const a = await createAutomation(ctx, { name: 'x', trigger: eventTrigger, actions: oneAction });
    const active = await setAutomationStatus(ctx, a.id, 'active');
    expect(active.status).toBe('active');
    const renamed = await updateAutomation(ctx, a.id, { name: 'renamed' });
    expect(renamed.name).toBe('renamed');
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
    const all = await listAutomations(ctx, { origin: 'system' });
    expect(all).toHaveLength(1);
  });
});
