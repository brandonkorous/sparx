// A billing event about a quote refreshes the quote (sparx persona issue 086).
//
// A wholesale quote and an invoice are rows in one table, and the billing
// events say `billing_document` whichever one the row is. Quotes now index as
// `quote`, so an event naming `billing_document` has to re-read the row under
// both kinds: the kind it is gets indexed, and the kind it is not loses any
// stale entry. Before, the search box filed quotes under "Invoices".

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const upsertEntity = vi.fn();
const deleteEntity = vi.fn();
const asInvoice = vi.fn();
const asQuote = vi.fn();

vi.mock('@wizeworks/commerce', () => ({
  marketService: {},
  projectAllCollectionRulesForTenant: vi.fn(),
  projectCollectionRules: vi.fn(),
  projectInventoryCollectionRulesForTenant: vi.fn(),
  projectCustomer: vi.fn(),
  projectOrder: vi.fn(),
  projectOrders: vi.fn(() => Promise.resolve([])),
  listOrderIdsForBillingDocument: vi.fn(() => Promise.resolve([])),
  projectProduct: vi.fn(),
  productIdForVariant: vi.fn(),
}));
vi.mock('@wizeworks/search', () => ({
  bulkUpsertOrders: vi.fn(() => Promise.resolve({ successCount: 0, errors: [] })),
  deleteCustomer: vi.fn(),
  deleteEntity,
  deleteOrder: vi.fn(),
  deleteProduct: vi.fn(),
  upsertCustomer: vi.fn(),
  upsertEntity,
  upsertOrder: vi.fn(),
  upsertProduct: vi.fn(),
  ensureSchemas: vi.fn(),
  ensureSynonyms: vi.fn(),
}));
vi.mock('../../src/reindex.js', () => ({ runReindex: vi.fn() }));
vi.mock('../../src/registry.js', () => ({
  REGISTRY: new Map([
    ['billing_document', { entityType: 'billing_document', project: asInvoice }],
    ['quote', { entityType: 'quote', project: asQuote }],
  ]),
}));
vi.mock('../../src/env.js', () => ({ env: { ENSURE_SCHEMAS_ON_BOOT: false } }));

const { handleEvent } = await import('../../src/handler.js');

const logger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;
const tenantId = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const quoteId = '45444b29-fe1d-43bb-8e84-92b0493ace1d';
const QUOTE_DOC = { id: `${tenantId}:quote:${quoteId}`, entity_type: 'quote' };

function changed(entityType: string, op = 'upsert') {
  return {
    type: 'search.entity.changed',
    tenantId,
    data: { entityType, recordId: quoteId, op },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  asInvoice.mockResolvedValue(null);
  asQuote.mockResolvedValue(QUOTE_DOC);
});

describe('an event that names billing_document, about a quote', () => {
  it('indexes the quote and clears the stale invoice entry', async () => {
    const result = await handleEvent(changed('billing_document'), logger);

    expect(upsertEntity).toHaveBeenCalledWith(QUOTE_DOC);
    expect(deleteEntity).toHaveBeenCalledWith(tenantId, 'billing_document', quoteId);
    expect(result).toEqual({
      outcome: 'indexed',
      details: { entityType: 'quote', recordId: quoteId },
    });
  });
});

describe('deleting it', () => {
  it('removes both kinds of entry', async () => {
    const result = await handleEvent(changed('billing_document', 'delete'), logger);

    expect(upsertEntity).not.toHaveBeenCalled();
    expect(deleteEntity).toHaveBeenCalledWith(tenantId, 'billing_document', quoteId);
    expect(deleteEntity).toHaveBeenCalledWith(tenantId, 'quote', quoteId);
    expect(result.outcome).toBe('deleted');
  });
});
