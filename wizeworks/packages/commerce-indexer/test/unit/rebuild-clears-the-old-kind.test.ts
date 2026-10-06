// A rebuild clears a quote's old entry under "Invoices" (sparx persona issue
// 086).
//
// Before quotes had their own kind in search, each one was indexed as a
// `billing_document`. The search box's "Put them back" rebuild keeps old
// entries, so without this every quote would show twice: once under Quotes,
// and once still filed under Invoices.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const bulkUpsertEntities = vi.fn();
const deleteEntity = vi.fn();
const dropTenantFromCollection = vi.fn();

const tenantId = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const quoteId = '45444b29-fe1d-43bb-8e84-92b0493ace1d';
const QUOTE_DOC = {
  id: `${tenantId}:quote:${quoteId}`,
  entity_type: 'quote',
  record_id: quoteId,
};

vi.mock('@wizeworks/commerce', () => ({}));
vi.mock('@wizeworks/search', () => ({
  bulkUpsertEntities,
  deleteEntity,
  dropTenantFromCollection,
  CUSTOMERS_COLLECTION: 'customers',
  ENTITIES_COLLECTION: 'entities',
  ORDERS_COLLECTION: 'orders',
  PRODUCTS_COLLECTION: 'products',
}));
vi.mock('../../src/registry.js', () => ({
  REGISTRY: new Map([
    [
      'quote',
      {
        entityType: 'quote',
        listIdsForTenant: () => Promise.resolve([quoteId]),
        project: () => Promise.resolve(QUOTE_DOC),
      },
    ],
  ]),
}));

const { runReindex } = await import('../../src/reindex.js');

const logger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

function rebuild(dropStale: boolean) {
  return runReindex(
    {
      type: 'search.reindex.requested',
      tenantId,
      data: { collections: ['entities'], dropStale },
    },
    logger
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  bulkUpsertEntities.mockResolvedValue({ successCount: 1, errors: [] });
  dropTenantFromCollection.mockResolvedValue({ deleted: 0 });
});

describe('rebuilding search without starting from empty', () => {
  it('indexes the quote and removes its old invoice entry', async () => {
    await rebuild(false);

    expect(bulkUpsertEntities).toHaveBeenCalledWith([QUOTE_DOC]);
    expect(deleteEntity).toHaveBeenCalledWith(tenantId, 'billing_document', quoteId);
    expect(deleteEntity).not.toHaveBeenCalledWith(tenantId, 'quote', quoteId);
  });
});

describe('rebuilding from empty', () => {
  it('has nothing old to remove', async () => {
    await rebuild(true);

    expect(deleteEntity).not.toHaveBeenCalled();
  });
});
