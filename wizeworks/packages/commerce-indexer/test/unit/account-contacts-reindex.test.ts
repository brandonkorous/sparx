// A person on a trade account can be found by the account's name, and stays
// that way when the membership or the account changes.
//
// MEASURED 2026-10-03 on Gillett Diesel Service: typing "Wasatch" found one of
// the three people on Wasatch Front Utility Contractors, LLC, and "Wasatch
// Marcus" could not find Marcus. Each customer's search document now carries the
// names of the accounts they belong to. That makes two writes that are not the
// customer row able to change the document, and these hold the indexer to
// re-reading it for both:
//
//   - a contact added to, or switched off, an account's list
//     (`search.entity.changed` naming the customer), and
//   - the account itself renamed or removed (`search.entity.changed` naming the
//     account), which has to take every one of its people with it.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const projectCustomer = vi.fn();
const listCustomerIdsForAccount = vi.fn();
const upsertCustomer = vi.fn();
const deleteCustomer = vi.fn();
const upsertEntity = vi.fn();
const deleteEntity = vi.fn();
const projectAccount = vi.fn();

vi.mock('@wizeworks/commerce', () => ({
  marketService: {},
  projectAllCollectionRulesForTenant: vi.fn(),
  projectCollectionRules: vi.fn(),
  projectInventoryCollectionRulesForTenant: vi.fn(),
  listCustomerIdsForAccount,
  listOrderIdsForAccount: vi.fn(() => Promise.resolve([])),
  listOrderIdsForCustomer: vi.fn(() => Promise.resolve([])),
  projectCustomer,
  projectOrder: vi.fn(),
  projectOrders: vi.fn(() => Promise.resolve([])),
  projectProduct: vi.fn(),
  productIdForVariant: vi.fn(),
}));
vi.mock('@wizeworks/search', () => ({
  bulkUpsertOrders: vi.fn(() => Promise.resolve({ successCount: 0, errors: [] })),
  getCustomerDocument: vi.fn(() => Promise.resolve(null)),
  getEntity: vi.fn(() => Promise.resolve(null)),
  deleteCustomer,
  deleteEntity,
  deleteOrder: vi.fn(),
  deleteProduct: vi.fn(),
  upsertCustomer,
  upsertEntity,
  upsertOrder: vi.fn(),
  upsertProduct: vi.fn(),
}));
vi.mock('../../src/reindex.js', () => ({ runReindex: vi.fn() }));
vi.mock('../../src/registry.js', () => ({
  REGISTRY: new Map([['b2b_account', { project: projectAccount }]]),
}));

const { handleEvent } = await import('../../src/handler.js');

const logger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;
const tenantId = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const accountId = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
const renee = 'fd7795a2-99f3-4583-b7be-efcb2d886a1b';
const marcus = '72c35937-9a06-45b2-8cc3-a5a4547920c3';
const gone = '00000000-0000-4000-8000-000000000001';

function changed(entityType: string, recordId: string, op?: 'upsert' | 'delete') {
  return {
    type: 'search.entity.changed',
    tenantId,
    data: { entityType, recordId, ...(op ? { op } : {}) },
  };
}

beforeEach(() => {
  for (const fn of [
    projectCustomer,
    listCustomerIdsForAccount,
    upsertCustomer,
    deleteCustomer,
    upsertEntity,
    deleteEntity,
    projectAccount,
  ]) {
    fn.mockReset();
  }
});

describe('a contact added to or switched off an account', () => {
  it('re-reads that customer into the customers collection', async () => {
    const doc = { customer_id: marcus, company: 'Wasatch Front Utility Contractors, LLC' };
    projectCustomer.mockResolvedValue({ document: doc });
    const result = await handleEvent(changed('customer', marcus), logger);
    expect(projectCustomer).toHaveBeenCalledWith({ tenantId }, marcus);
    expect(upsertCustomer).toHaveBeenCalledWith(doc);
    expect(result).toEqual({ outcome: 'indexed', details: { customerId: marcus } });
  });

  it('takes a customer who is gone out of search', async () => {
    projectCustomer.mockResolvedValue({ document: null });
    const result = await handleEvent(changed('customer', marcus), logger);
    expect(deleteCustomer).toHaveBeenCalledWith(tenantId, marcus);
    expect(upsertCustomer).not.toHaveBeenCalled();
    expect(result.outcome).toBe('deleted');
  });

  it('deletes without reading when the signal says delete', async () => {
    await handleEvent(changed('customer', marcus, 'delete'), logger);
    expect(projectCustomer).not.toHaveBeenCalled();
    expect(deleteCustomer).toHaveBeenCalledWith(tenantId, marcus);
  });
});

describe('an account renamed or removed', () => {
  it('re-reads every person on it, as well as the account', async () => {
    projectAccount.mockResolvedValue({ id: `${tenantId}:b2b_account:${accountId}` });
    listCustomerIdsForAccount.mockResolvedValue([renee, marcus, gone]);
    projectCustomer.mockImplementation((_ctx: unknown, id: string) =>
      Promise.resolve({ document: id === gone ? null : { customer_id: id } })
    );

    const result = await handleEvent(changed('b2b_account', accountId), logger);

    expect(upsertEntity).toHaveBeenCalledTimes(1);
    expect(listCustomerIdsForAccount).toHaveBeenCalledWith({ tenantId }, accountId);
    expect(
      upsertCustomer.mock.calls.map(([doc]) => (doc as { customer_id: string }).customer_id)
    ).toEqual([renee, marcus]);
    expect(deleteCustomer).toHaveBeenCalledWith(tenantId, gone);
    expect(result.outcome).toBe('indexed');
  });

  it('still re-reads its people when the account itself is gone', async () => {
    // A removed account deletes its own entry, and its people must stop
    // answering to its name.
    projectAccount.mockResolvedValue(null);
    listCustomerIdsForAccount.mockResolvedValue([renee]);
    projectCustomer.mockResolvedValue({ document: { customer_id: renee } });

    const result = await handleEvent(changed('b2b_account', accountId), logger);

    expect(deleteEntity).toHaveBeenCalledWith(tenantId, 'b2b_account', accountId);
    expect(upsertCustomer).toHaveBeenCalledWith({ customer_id: renee });
    expect(result.outcome).toBe('deleted');
  });
});
