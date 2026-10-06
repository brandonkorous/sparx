// An account's orders follow the account's name, and a buyer's orders follow the
// buyer.
//
// Each order's search document copies the name of the account it belongs to
// (MEASURED 2026-10-04 on Gillett Diesel Service: "Wasatch" found none of the
// account's orders until it did). Copies go stale, so the indexer re-reads them:
//
//   - when an ACCOUNT is renamed or removed, every order that can name it;
//   - when a CUSTOMER's name, email, account or typed employer moves, their own;
//   - when two customers are MERGED, every order the survivor now holds.
//
// And, as importantly, NOT on the routine writes: a credit limit, a terms change,
// the daily near-the-limit signal, a tag on a customer, the counters every
// checkout bumps. Those leave every copy correct, and re-reading an account's
// whole order history on each of them would be the cost of this fix.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const projectCustomer = vi.fn();
const listCustomerIdsForAccount = vi.fn();
const listOrderIdsForAccount = vi.fn();
const listOrderIdsForCustomer = vi.fn();
const listOrderIdsForBillingDocument = vi.fn();
const projectInvoice = vi.fn();
const projectOrders = vi.fn();
const bulkUpsertOrders = vi.fn();
const getCustomerDocument = vi.fn();
const getEntity = vi.fn();
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
  listOrderIdsForAccount,
  listOrderIdsForCustomer,
  listOrderIdsForBillingDocument,
  projectCustomer,
  projectOrder: vi.fn(),
  projectOrders,
  projectProduct: vi.fn(),
  productIdForVariant: vi.fn(),
}));
vi.mock('@wizeworks/search', () => ({
  bulkUpsertOrders,
  getCustomerDocument,
  getEntity,
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
  REGISTRY: new Map([
    ['b2b_account', { project: projectAccount }],
    ['billing_document', { project: projectInvoice }],
  ]),
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
const duplicate = '00000000-0000-4000-8000-000000000002';
const WASATCH = 'Wasatch Front Utility Contractors, LLC';
const RENAMED = 'Wasatch Front Utility Contractors, Inc.';
const ORDERS = ['o-07', 'o-08', 'o-11', 'o-14', 'o-15'];

function accountChanged(op?: 'delete') {
  return {
    type: 'search.entity.changed',
    tenantId,
    data: { entityType: 'b2b_account', recordId: accountId, ...(op ? { op } : {}) },
  };
}

function customerDoc(over: Record<string, unknown> = {}) {
  return {
    customer_id: renee,
    full_name: 'Renée Castañeda',
    email: 'renee@wasatchfront.example',
    b2b_account_id: accountId,
    company: WASATCH,
    phone: '801-555-0100',
    ...over,
  };
}

/** The order ids re-read into search, in the order they were sent. */
function reread(): string[] {
  return bulkUpsertOrders.mock.calls.flatMap(([docs]) =>
    (docs as { order_id: string }[]).map((d) => d.order_id)
  );
}

beforeEach(() => {
  for (const fn of [
    projectCustomer,
    listCustomerIdsForAccount,
    listOrderIdsForAccount,
    listOrderIdsForCustomer,
    listOrderIdsForBillingDocument,
    projectInvoice,
    projectOrders,
    bulkUpsertOrders,
    getCustomerDocument,
    getEntity,
    upsertCustomer,
    deleteCustomer,
    upsertEntity,
    deleteEntity,
    projectAccount,
  ]) {
    fn.mockReset();
  }
  projectOrders.mockImplementation((_ctx: unknown, ids: string[]) =>
    Promise.resolve(ids.map((id) => ({ order_id: id })))
  );
  bulkUpsertOrders.mockImplementation((docs: unknown[]) =>
    Promise.resolve({ successCount: docs.length, errors: [] })
  );
  listOrderIdsForAccount.mockResolvedValue(ORDERS);
  listOrderIdsForCustomer.mockResolvedValue(ORDERS);
  listCustomerIdsForAccount.mockResolvedValue([renee]);
  projectCustomer.mockResolvedValue({ document: customerDoc() });
  getCustomerDocument.mockResolvedValue(customerDoc());
});

describe('an account signal', () => {
  it('re-reads every order that can name the account when it is renamed', async () => {
    getEntity.mockResolvedValue({ title: WASATCH });
    projectAccount.mockResolvedValue({ title: RENAMED });

    await handleEvent(accountChanged(), logger);

    expect(listOrderIdsForAccount).toHaveBeenCalledWith({ tenantId }, accountId);
    expect(reread()).toEqual(ORDERS);
  });

  it('re-reads them when the account is removed, so the old name stops finding them', async () => {
    getEntity.mockResolvedValue({ title: WASATCH });
    projectAccount.mockResolvedValue(null);

    await handleEvent(accountChanged(), logger);

    expect(reread()).toEqual(ORDERS);
    expect(deleteEntity).toHaveBeenCalledWith(tenantId, 'b2b_account', accountId);
  });

  it('leaves the orders alone when the name did not move', async () => {
    // A credit limit, a terms change, the daily near-the-limit signal.
    getEntity.mockResolvedValue({ title: WASATCH });
    projectAccount.mockResolvedValue({ title: WASATCH });

    await handleEvent(accountChanged(), logger);

    expect(listOrderIdsForAccount).not.toHaveBeenCalled();
    expect(bulkUpsertOrders).not.toHaveBeenCalled();
    expect(upsertEntity).toHaveBeenCalledTimes(1);
  });

  it('does not re-read the orders a second time through each of its people', async () => {
    getEntity.mockResolvedValue({ title: WASATCH });
    projectAccount.mockResolvedValue({ title: RENAMED });
    // Renée's own document moves with the rename.
    projectCustomer.mockResolvedValue({ document: customerDoc({ company: RENAMED }) });

    await handleEvent(accountChanged(), logger);

    expect(listOrderIdsForCustomer).not.toHaveBeenCalled();
    expect(reread()).toEqual(ORDERS);
    expect(upsertCustomer).toHaveBeenCalledTimes(1);
  });

  it('keeps the old entry when the orders could not be re-read, so the retry sees the rename', async () => {
    getEntity.mockResolvedValue({ title: WASATCH });
    projectAccount.mockResolvedValue({ title: RENAMED });
    bulkUpsertOrders.mockResolvedValue({
      successCount: 4,
      errors: [{ index: 0, document: {}, error: 'Field `total_cents` must be an int64.' }],
    });

    await expect(handleEvent(accountChanged(), logger)).rejects.toThrow(/refused 1 of 5/);
    expect(upsertEntity).not.toHaveBeenCalled();
  });

  it('re-reads a large account a batch at a time', async () => {
    getEntity.mockResolvedValue(null);
    projectAccount.mockResolvedValue({ title: WASATCH });
    const many = Array.from({ length: 600 }, (_, i) => `o-${String(i)}`);
    listOrderIdsForAccount.mockResolvedValue(many);

    await handleEvent(accountChanged(), logger);

    expect(projectOrders.mock.calls.map(([, ids]) => (ids as string[]).length)).toEqual([
      250, 250, 100,
    ]);
    expect(reread()).toEqual(many);
  });
});

describe('a quote or invoice signal', () => {
  it('re-reads the order it bills, which may take its account from it', async () => {
    projectInvoice.mockResolvedValue({ entity_type: 'billing_document' });
    listOrderIdsForBillingDocument.mockResolvedValue(['o-14']);

    await handleEvent(
      {
        type: 'b2b.invoice.created',
        tenantId,
        data: { invoiceId: 'inv-1' },
      },
      logger
    );

    expect(listOrderIdsForBillingDocument).toHaveBeenCalledWith({ tenantId }, 'inv-1');
    expect(reread()).toEqual(['o-14']);
  });

  it('re-reads nothing for a document on no order', async () => {
    projectInvoice.mockResolvedValue({ entity_type: 'billing_document' });
    listOrderIdsForBillingDocument.mockResolvedValue([]);

    await handleEvent(
      {
        type: 'search.entity.changed',
        tenantId,
        data: { entityType: 'billing_document', recordId: 'inv-2' },
      },
      logger
    );

    expect(bulkUpsertOrders).not.toHaveBeenCalled();
  });
});

describe('a customer signal', () => {
  const updated = { type: 'crm.customer.updated', tenantId, data: { customerId: renee } };

  it('re-reads their orders when their name changes', async () => {
    projectCustomer.mockResolvedValue({
      document: customerDoc({ full_name: 'Renée Castañeda-Ruiz' }),
    });

    await handleEvent(updated, logger);

    expect(listOrderIdsForCustomer).toHaveBeenCalledWith({ tenantId }, renee);
    expect(reread()).toEqual(ORDERS);
  });

  it('re-reads them when they move to another account', async () => {
    projectCustomer.mockResolvedValue({
      document: customerDoc({ b2b_account_id: 'red-rock', company: 'Red Rock Hotshot Trucking' }),
    });

    await handleEvent(updated, logger);

    expect(reread()).toEqual(ORDERS);
  });

  it('leaves their orders alone when nothing the orders copy has moved', async () => {
    projectCustomer.mockResolvedValue({ document: customerDoc({ phone: '801-555-0199' }) });

    await handleEvent(updated, logger);

    expect(listOrderIdsForCustomer).not.toHaveBeenCalled();
    expect(upsertCustomer).toHaveBeenCalledTimes(1);
  });

  it('re-reads them when the customer is not in search yet', async () => {
    getCustomerDocument.mockResolvedValue(null);
    listOrderIdsForCustomer.mockResolvedValue([]);

    await handleEvent(updated, logger);

    expect(listOrderIdsForCustomer).toHaveBeenCalledWith({ tenantId }, renee);
    expect(upsertCustomer).toHaveBeenCalledTimes(1);
  });

  it('moves the duplicates’ orders onto the survivor after a merge', async () => {
    await handleEvent(
      {
        type: 'crm.customer.merged',
        tenantId,
        data: { primaryCustomerId: renee, duplicateCustomerIds: [duplicate] },
      },
      logger
    );

    expect(deleteCustomer).toHaveBeenCalledWith(tenantId, duplicate);
    expect(listOrderIdsForCustomer).toHaveBeenCalledWith({ tenantId }, renee);
    expect(reread()).toEqual(ORDERS);
  });
});
