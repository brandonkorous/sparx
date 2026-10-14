// An order re-reads its buyer into search, not just itself.
//
// A customer's order count, what their orders come to and what they have paid
// are written in the same transaction as the order (crm customer-rollup.ts), and
// an order raises no `crm.customer.*` event. So the search worker re-read the
// order on every `order.*` event and never the person who placed it: Renée
// Castañeda's search copy said 6 orders and $150.00 while her record said 12 and
// $11,285.69, and that copy is what the AI app answers from (sparx persona
// issue 223).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const projectOrder = vi.fn();
const projectCustomer = vi.fn();
const upsertOrder = vi.fn();
const upsertCustomer = vi.fn();
const deleteOrder = vi.fn();
const getCustomerDocument = vi.fn();
const listOrderIdsForCustomer = vi.fn();

vi.mock('@wizeworks/commerce', () => ({
  marketService: {},
  projectAllCollectionRulesForTenant: vi.fn(),
  projectCollectionRules: vi.fn(),
  projectInventoryCollectionRulesForTenant: vi.fn(),
  projectCustomer,
  projectOrder,
  projectOrders: vi.fn(),
  projectProduct: vi.fn(),
  productIdForVariant: vi.fn(),
  listOrderIdsForCustomer,
}));
vi.mock('@wizeworks/search', () => ({
  bulkUpsertOrders: vi.fn(),
  deleteCustomer: vi.fn(),
  deleteEntity: vi.fn(),
  deleteOrder,
  deleteProduct: vi.fn(),
  getCustomerDocument,
  upsertCustomer,
  upsertEntity: vi.fn(),
  upsertOrder,
  upsertProduct: vi.fn(),
}));
vi.mock('../../src/reindex.js', () => ({ runReindex: vi.fn() }));
vi.mock('../../src/registry.js', () => ({ REGISTRY: {} }));

const { handleEvent } = await import('../../src/handler.js');

const logger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;
const tenantId = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const orderId = '0b6c1f43-6f1a-4b0e-9d7b-2a2f4f9d1c11';
const customerId = 'fd7795a2-99f3-4583-b7be-efcb2d886a1b';
const renee = { customer_id: customerId, order_count: 12, total_ordered_cents: 1128569 };

beforeEach(() => {
  vi.clearAllMocks();
  projectCustomer.mockResolvedValue({ document: renee });
});

describe.each([
  'order.placed',
  'order.paid',
  'order.cancelled',
  'order.refunded',
  'b2b.order.pending_approval',
  'b2b.order.rejected',
])('%s', (type) => {
  it('re-reads the buyer as well as the order', async () => {
    projectOrder.mockResolvedValue({ document: { order_id: orderId, customer_id: customerId } });
    await handleEvent({ type, tenantId, data: { orderId } }, logger);
    expect(upsertOrder).toHaveBeenCalled();
    expect(projectCustomer).toHaveBeenCalledWith({ tenantId }, customerId);
    expect(upsertCustomer).toHaveBeenCalledWith(renee);
  });
});

describe('the buyer is re-read without re-reading their every order', () => {
  it('leaves the rest of their orders alone', async () => {
    projectOrder.mockResolvedValue({ document: { order_id: orderId, customer_id: customerId } });
    await handleEvent({ type: 'order.placed', tenantId, data: { orderId } }, logger);
    expect(listOrderIdsForCustomer).not.toHaveBeenCalled();
  });
});

describe('an order with nobody to re-read', () => {
  it('a guest order with no customer touches no customer', async () => {
    projectOrder.mockResolvedValue({ document: { order_id: orderId } });
    await handleEvent({ type: 'order.placed', tenantId, data: { orderId } }, logger);
    expect(upsertOrder).toHaveBeenCalled();
    expect(projectCustomer).not.toHaveBeenCalled();
  });
});
