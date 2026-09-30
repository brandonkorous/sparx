// REMOVING A SPENDING LIMIT HAS TO REMOVE IT.
//
// `deleteRule` set `isActive = false` and described itself as a soft delete
// "preserving its audit history". Nothing in the schema points at a rule id and
// an approval decision is logged against the ORDER, so there was no history to
// preserve — what it preserved was the row, on the screen, forever.
//
// MEASURED 2026-09-20 through the console: a $2,500 limit added, removed with
// its own bin, and back on the list marked Off a second later. In the database,
// `is_active = f` and the row still there. `listRules` returns every rule
// whatever its switch, so nothing could ever leave that list, and the bin did
// exactly what the on/off switch beside it does. [[feedback_a_promise_in_copy_is_a_contract]]

import { describe, expect, it, vi } from 'vitest';

const rule = {
  findFirst: vi.fn((): Promise<{ id: string } | null> => Promise.resolve({ id: 'rule-1' })),
  delete: vi.fn(() => Promise.resolve({ id: 'rule-1' })),
  update: vi.fn(() => Promise.resolve({ id: 'rule-1' })),
};

vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, run: (tx: unknown) => unknown) => run({ purchaseApprovalRule: rule }),
  nameSearchClauses: () => [],
}));
vi.mock('@wizeworks/auth', () => ({ isModuleEnabled: () => Promise.resolve(true) }));
vi.mock('@wizeworks/crm', () => ({ b2bArService: {} }));
vi.mock('@wizeworks/inventory', () => ({ inventoryService: {} }));
vi.mock('@wizeworks/api-core/errors', () => ({
  notFound: (message: string) => new Error(message),
}));

const { deleteRule } = await import('./approval.js');

const ctx = { tenantId: 'tenant-1', userId: 'user-1' } as never;

describe('deleteRule', () => {
  it('deletes the row rather than switching it off', async () => {
    rule.delete.mockClear();
    rule.update.mockClear();

    await deleteRule(ctx, 'rule-1');

    expect(rule.delete).toHaveBeenCalledWith({ where: { id: 'rule-1' } });
    // The on/off switch is the PATCH. If removing a limit writes isActive the
    // two controls are the same button again, and one of them is lying.
    expect(rule.update).not.toHaveBeenCalled();
  });

  it('refuses an id that is not this tenant’s', async () => {
    rule.findFirst.mockResolvedValueOnce(null);
    rule.delete.mockClear();

    await expect(deleteRule(ctx, 'someone-elses')).rejects.toThrow('Approval rule not found');
    expect(rule.delete).not.toHaveBeenCalled();
  });
});
