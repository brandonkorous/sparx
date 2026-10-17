// A kind new to search reaches the records that already exist (sparx persona
// issue 261).
//
// Gillett had a board called "Monday numbers" before boards were searchable.
// After the release that made them searchable, "Monday" still found nothing:
// the board was written before its projector existed, and only a write indexes.
// The indexer's boot pass fills in a kind a tenant has rows of and no entries for.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const bulkUpsertEntities = vi.fn();
const deleteEntity = vi.fn();
const indexedKindsForTenant = vi.fn();
const findMany = vi.fn();

const gillett = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const marrow = 'a4a12945-5721-4599-a0ca-631a9e9a8afe';
const boardId = '30c2f8ac-6403-499e-8198-809b546e0542';
const BOARD_DOC = {
  id: `${gillett}:dashboard:${boardId}`,
  entity_type: 'dashboard',
  record_id: boardId,
};

const boardIds = vi.fn();
const reportIds = vi.fn();
const projectBoard = vi.fn();
const projectReport = vi.fn();

vi.mock('@wizeworks/db', () => ({ prisma: { tenant: { findMany } } }));
vi.mock('@wizeworks/commerce', () => ({}));
vi.mock('@wizeworks/search', () => ({
  bulkUpsertEntities,
  deleteEntity,
  indexedKindsForTenant,
  dropTenantFromCollection: vi.fn(),
  CUSTOMERS_COLLECTION: 'customers',
  ENTITIES_COLLECTION: 'entities',
  ORDERS_COLLECTION: 'orders',
  PRODUCTS_COLLECTION: 'products',
}));
vi.mock('../../src/registry.js', () => ({
  REGISTRY: new Map([
    [
      'dashboard',
      {
        entityType: 'dashboard',
        listIdsForTenant: boardIds,
        project: projectBoard,
      },
    ],
    [
      'report',
      {
        entityType: 'report',
        listIdsForTenant: reportIds,
        project: projectReport,
      },
    ],
  ]),
}));

const { fillNewKinds } = await import('../../src/new-kinds.js');

const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() } as unknown as Logger;

beforeEach(() => {
  vi.clearAllMocks();
  bulkUpsertEntities.mockResolvedValue({ successCount: 1, errors: [] });
  findMany.mockResolvedValue([{ id: gillett }]);
  boardIds.mockResolvedValue([boardId]);
  reportIds.mockResolvedValue([]);
  projectBoard.mockResolvedValue(BOARD_DOC);
  projectReport.mockResolvedValue(null);
});

describe('a board written before boards were searchable', () => {
  it('is indexed on the next boot', async () => {
    indexedKindsForTenant.mockResolvedValue(new Set(['product']));

    const summary = await fillNewKinds(logger);

    expect(bulkUpsertEntities).toHaveBeenCalledWith([BOARD_DOC]);
    expect(summary.filled).toEqual([
      { tenantId: gillett, entityType: 'dashboard', indexed: 1, errors: 0 },
    ]);
  });

  it('is left alone once boards have entries', async () => {
    indexedKindsForTenant.mockResolvedValue(new Set(['dashboard']));

    const summary = await fillNewKinds(logger);

    expect(boardIds).not.toHaveBeenCalled();
    expect(bulkUpsertEntities).not.toHaveBeenCalled();
    expect(summary.filled).toEqual([]);
  });
});

describe('a kind the business has no rows of', () => {
  it('writes nothing', async () => {
    indexedKindsForTenant.mockResolvedValue(new Set(['dashboard']));

    await fillNewKinds(logger);

    expect(reportIds).toHaveBeenCalledWith({ tenantId: gillett });
    expect(bulkUpsertEntities).not.toHaveBeenCalled();
  });
});

describe('one business whose pass fails', () => {
  it('does not stop the next one', async () => {
    findMany.mockResolvedValue([{ id: marrow }, { id: gillett }]);
    indexedKindsForTenant.mockImplementation((tenantId: string) =>
      tenantId === marrow
        ? Promise.reject(new Error('search is not answering'))
        : Promise.resolve(new Set<string>())
    );

    const summary = await fillNewKinds(logger);

    expect(summary.skipped).toBe(1);
    expect(summary.filled.map((f) => f.tenantId)).toEqual([gillett]);
  });
});

describe('a row that cannot be read', () => {
  // Measured 2026-10-14: five pages whose site belonged to another tenant threw
  // on read, and the throw stopped that tenant's whole pass.
  it('is counted, and the rows and kinds after it are still indexed', async () => {
    const reportId = '8e1d1a52-4b7f-4c43-9f3e-2f6b1c0d9a11';
    const REPORT_DOC = { id: `${gillett}:report:${reportId}`, entity_type: 'report' };
    indexedKindsForTenant.mockResolvedValue(new Set<string>());
    boardIds.mockResolvedValue(['unreadable-board', boardId]);
    projectBoard.mockImplementation((_ctx: unknown, id: string) =>
      id === 'unreadable-board'
        ? Promise.reject(new Error('Field property is required to return data'))
        : Promise.resolve(BOARD_DOC)
    );
    reportIds.mockResolvedValue([reportId]);
    projectReport.mockResolvedValue(REPORT_DOC);

    const summary = await fillNewKinds(logger);

    expect(summary.skipped).toBe(0);
    expect(bulkUpsertEntities).toHaveBeenCalledWith([BOARD_DOC]);
    expect(bulkUpsertEntities).toHaveBeenCalledWith([REPORT_DOC]);
    expect(summary.filled).toEqual([
      { tenantId: gillett, entityType: 'dashboard', indexed: 1, errors: 1 },
      { tenantId: gillett, entityType: 'report', indexed: 1, errors: 0 },
    ]);
  });
});
