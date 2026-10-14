import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * THE OTHER "ONLY YOU" PROMISES ON CUSTOMER SCREENS (persona issue 264).
 *
 * A saved paragraph says "Let the whole team use it ... off for something only
 * you would ever send", a saved email the same by default, and a saved view
 * "Everyone sees it and can use it; only you can delete it". Each is driven here
 * against an in-memory table that applies the `where` the service sends.
 */

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

function matches(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, want]) => {
    if (key === 'OR') return (want as Where[]).some((w) => matches(row, w));
    if (key === 'AND') return (want as Where[]).every((w) => matches(row, w));
    if (want === null) return row[key] === null || row[key] === undefined;
    if (typeof want === 'object') {
      const op = want as { not?: unknown };
      return 'not' in op ? row[key] !== op.not : true;
    }
    return row[key] === want;
  });
}

const DOTY = '0d07a000-0000-4000-8000-000000000001';
const MIKE = '0d07a000-0000-4000-8000-000000000002';
const TENANT = '0d07a000-0000-4000-8000-0000000000aa';

const PRIVATE_PARAGRAPH = '5a1e0000-0000-4000-8000-000000000001';
const TEAM_PARAGRAPH = '5a1e0000-0000-4000-8000-000000000002';
const PRIVATE_TEMPLATE = '7e3a0000-0000-4000-8000-000000000001';
const PRIVATE_VIEW = '0e1e0000-0000-4000-8000-000000000001';
const TEAM_VIEW = '0e1e0000-0000-4000-8000-000000000002';

let tables: Record<string, Row[]>;

/** One fake model: reads apply `where`, writes record what they were asked. */
function model(name: string) {
  const rows = () => tables[name] ?? [];
  return {
    findMany: vi.fn((args: { where?: Where }) =>
      Promise.resolve(rows().filter((r) => matches(r, args.where)))
    ),
    findFirst: vi.fn((args: { where?: Where }) =>
      Promise.resolve(rows().find((r) => matches(r, args.where)) ?? null)
    ),
    findUnique: vi.fn((args: { where: { id: string } }) =>
      Promise.resolve(rows().find((r) => r.id === args.where.id) ?? null)
    ),
    update: vi.fn((args: { where: { id: string }; data: Row }) =>
      Promise.resolve({ ...rows().find((r) => r.id === args.where.id), ...args.data })
    ),
    updateMany: vi.fn((args: { where?: Where }) =>
      Promise.resolve({ count: rows().filter((r) => matches(r, args.where)).length })
    ),
    delete: vi.fn(() => Promise.resolve({})),
  };
}

const tx = {
  salesSnippet: model('salesSnippet'),
  salesTemplate: model('salesTemplate'),
  crmSavedView: model('crmSavedView'),
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => fn(tx),
}));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }));

const sales = await import('./sales-template-service');
const views = await import('./saved-view-service');
const { CrmNotFoundError, CrmValidationError } = await import('../errors');

const asDoty = { tenantId: TENANT, userId: DOTY };
const asMike = { tenantId: TENANT, userId: MIKE };
const asKey = { tenantId: TENANT };

beforeEach(() => {
  vi.clearAllMocks();
  tables = {
    salesSnippet: [
      { id: PRIVATE_PARAGRAPH, shortcut: 'mine', ownerUserId: DOTY, isShared: false },
      { id: TEAM_PARAGRAPH, shortcut: 'hours', ownerUserId: DOTY, isShared: true },
    ],
    salesTemplate: [
      { id: PRIVATE_TEMPLATE, name: 'Half written', ownerUserId: DOTY, isShared: false },
    ],
    crmSavedView: [
      { id: PRIVATE_VIEW, name: 'My leads', userId: DOTY, isShared: false, objectKey: 'deal' },
      { id: TEAM_VIEW, name: 'Open leads', userId: DOTY, isShared: true, objectKey: 'deal' },
    ],
  };
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

describe('a saved paragraph kept to its maker', () => {
  it('is in nobody else’s list, a caller with no person included', async () => {
    expect(ids(await sales.listSnippets(asDoty, { userId: DOTY }))).toEqual(
      [PRIVATE_PARAGRAPH, TEAM_PARAGRAPH].sort()
    );
    expect(ids(await sales.listSnippets(asMike, { userId: MIKE }))).toEqual([TEAM_PARAGRAPH]);
    expect(ids(await sales.listSnippets(asKey))).toEqual([TEAM_PARAGRAPH]);
  });

  it('cannot be changed, deleted or counted by a teammate', async () => {
    await expect(
      sales.updateSnippet(asMike, PRIVATE_PARAGRAPH, { body: 'Mine now' })
    ).rejects.toBeInstanceOf(CrmNotFoundError);
    await expect(sales.deleteSnippet(asMike, PRIVATE_PARAGRAPH)).rejects.toBeInstanceOf(
      CrmNotFoundError
    );
    await sales.noteSnippetUsed(asMike, PRIVATE_PARAGRAPH);
    expect(tx.salesSnippet.update).not.toHaveBeenCalled();
    expect(tx.salesSnippet.delete).not.toHaveBeenCalled();
    const counted = tx.salesSnippet.updateMany.mock.results[0]?.value as Promise<{ count: number }>;
    expect((await counted).count).toBe(0);
  });

  it('is changed and deleted by its maker, and a shared one by anyone on the team', async () => {
    await sales.updateSnippet(asDoty, PRIVATE_PARAGRAPH, { body: 'Still mine' });
    await sales.updateSnippet(asMike, TEAM_PARAGRAPH, { body: 'Open 8 to 5 now' });
    await sales.deleteSnippet(asDoty, PRIVATE_PARAGRAPH);
    expect(tx.salesSnippet.update).toHaveBeenCalledTimes(2);
    expect(tx.salesSnippet.delete).toHaveBeenCalledTimes(1);
  });
});

describe('a saved email kept to its maker', () => {
  it('cannot be read, changed, put away or brought back by a teammate', async () => {
    expect(ids(await sales.listTemplates(asMike, { userId: MIKE }))).toEqual([]);
    expect(ids(await sales.listTemplates(asKey))).toEqual([]);
    await expect(sales.getTemplate(asMike, PRIVATE_TEMPLATE)).rejects.toBeInstanceOf(
      CrmNotFoundError
    );
    await expect(
      sales.updateTemplate(asMike, PRIVATE_TEMPLATE, { subject: 'x' })
    ).rejects.toBeInstanceOf(CrmNotFoundError);
    await expect(sales.archiveTemplate(asMike, PRIVATE_TEMPLATE)).rejects.toBeInstanceOf(
      CrmNotFoundError
    );
    await expect(sales.restoreTemplate(asMike, PRIVATE_TEMPLATE)).rejects.toBeInstanceOf(
      CrmNotFoundError
    );
    expect(tx.salesTemplate.update).not.toHaveBeenCalled();
    await expect(sales.getTemplate(asDoty, PRIVATE_TEMPLATE)).resolves.toMatchObject({
      name: 'Half written',
    });
  });
});

describe('a saved view', () => {
  it('kept to its maker answers a teammate as though it did not exist', async () => {
    await expect(views.update(asMike, PRIVATE_VIEW, { name: 'x' })).rejects.toBeInstanceOf(
      CrmNotFoundError
    );
    await expect(views.remove(asMike, PRIVATE_VIEW)).rejects.toBeInstanceOf(CrmNotFoundError);
  });

  it('shared, is still changed and deleted by its maker alone', async () => {
    await expect(views.remove(asMike, TEAM_VIEW)).rejects.toBeInstanceOf(CrmValidationError);
    await expect(views.update(asMike, TEAM_VIEW, { name: 'x' })).rejects.toBeInstanceOf(
      CrmValidationError
    );
    await views.remove(asDoty, TEAM_VIEW);
    expect(tx.crmSavedView.delete).toHaveBeenCalledTimes(1);
  });
});
