// A customer who arrives without anybody on the team typing them in can be found.
//
// Most new people are not typed in. They make an account on the website, book a
// slot, check out as a guest or fill in a form, and none of those went through
// the one service that announced a new customer. So the search worker never
// heard of them: a buyer who signed up on a wholesale business's site was in the
// customer list and nowhere in the console's search box (sparx persona issue
// 086).
//
// Those paths now announce themselves. A form, a booking or a checkout handing
// over details says `crm.customer.captured`, and a newsletter opt-in says
// `crm.customer.subscribed`. Both have to reach the customer projection, or the
// announcement is a sentence nobody is listening to.

import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const projectCustomer = vi.fn();
const upsertCustomer = vi.fn();
const deleteCustomer = vi.fn();

vi.mock('@wizeworks/commerce', () => ({
  marketService: {},
  projectAllCollectionRulesForTenant: vi.fn(),
  projectCollectionRules: vi.fn(),
  projectInventoryCollectionRulesForTenant: vi.fn(),
  projectCustomer,
  projectOrder: vi.fn(),
  projectOrders: vi.fn(() => Promise.resolve([])),
  listOrderIdsForCustomer: vi.fn(() => Promise.resolve([])),
  projectProduct: vi.fn(),
  productIdForVariant: vi.fn(),
}));
vi.mock('@wizeworks/search', () => ({
  bulkUpsertOrders: vi.fn(() => Promise.resolve({ successCount: 0, errors: [] })),
  getCustomerDocument: vi.fn(() => Promise.resolve(null)),
  deleteCustomer,
  deleteEntity: vi.fn(),
  deleteOrder: vi.fn(),
  deleteProduct: vi.fn(),
  upsertCustomer,
  upsertEntity: vi.fn(),
  upsertOrder: vi.fn(),
  upsertProduct: vi.fn(),
  ensureSchemas: vi.fn(),
  ensureSynonyms: vi.fn(),
}));
vi.mock('../../src/reindex.js', () => ({ runReindex: vi.fn() }));
vi.mock('../../src/registry.js', () => ({ REGISTRY: {} }));
vi.mock('../../src/env.js', () => ({ env: { ENSURE_SCHEMAS_ON_BOOT: false } }));

const { handleEvent } = await import('../../src/handler.js');
const { EVENTS } = await import('../../src/index.js');

const logger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;
const tenantId = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const customerId = '72c35937-9a06-45b2-8cc3-a5a4547920c3';

describe.each(['crm.customer.captured', 'crm.customer.subscribed'])('%s', (type) => {
  it('is one of the events the search worker listens for', () => {
    expect(EVENTS).toContain(type);
  });

  it('puts the customer into search', async () => {
    projectCustomer.mockReset().mockResolvedValue({ document: { customer_id: customerId } });
    upsertCustomer.mockReset();
    const result = await handleEvent({ type, tenantId, data: { customerId } }, logger);
    expect(projectCustomer).toHaveBeenCalledWith({ tenantId }, customerId);
    expect(upsertCustomer).toHaveBeenCalledWith({ customer_id: customerId });
    expect(result.outcome).toBe('indexed');
  });
});
