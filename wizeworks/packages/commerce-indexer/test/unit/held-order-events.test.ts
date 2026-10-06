// An order held for sign-off, and one turned down, can be found by its number.
//
// A held order publishes `b2b.order.pending_approval` instead of
// `order.placed`, and a rejected one publishes `b2b.order.rejected`. The search
// worker listened for neither, so a held order could not be found by its number
// while it waited for somebody to sign it off, and a rejected one never could.
// The console's search box said "3 orders are not in this box yet" (sparx
// persona issue 086).

import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const projectOrder = vi.fn();
const upsertOrder = vi.fn();
const deleteOrder = vi.fn();

vi.mock('@wizeworks/commerce', () => ({
  marketService: {},
  projectAllCollectionRulesForTenant: vi.fn(),
  projectCollectionRules: vi.fn(),
  projectInventoryCollectionRulesForTenant: vi.fn(),
  projectCustomer: vi.fn(),
  projectOrder,
  projectProduct: vi.fn(),
  productIdForVariant: vi.fn(),
}));
vi.mock('@wizeworks/search', () => ({
  deleteCustomer: vi.fn(),
  deleteEntity: vi.fn(),
  deleteOrder,
  deleteProduct: vi.fn(),
  upsertCustomer: vi.fn(),
  upsertEntity: vi.fn(),
  upsertOrder,
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
const orderId = '0b6c1f43-6f1a-4b0e-9d7b-2a2f4f9d1c11';

describe.each(['b2b.order.pending_approval', 'b2b.order.rejected'])('%s', (type) => {
  it('is one of the events the search worker listens for', () => {
    expect(EVENTS).toContain(type);
  });

  it('puts the order into search', async () => {
    projectOrder.mockReset().mockResolvedValue({ document: { order_id: orderId } });
    upsertOrder.mockReset();
    const result = await handleEvent({ type, tenantId, data: { orderId } }, logger);
    expect(projectOrder).toHaveBeenCalledWith({ tenantId }, orderId);
    expect(upsertOrder).toHaveBeenCalledWith({ order_id: orderId });
    expect(result.outcome).toBe('indexed');
  });
});
