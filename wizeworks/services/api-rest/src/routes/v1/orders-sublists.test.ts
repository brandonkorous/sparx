// The lists under an order answer for the order first (persona issue 083). An
// order this business cannot see is a 404 at `/v1/orders/:id`, and its payments,
// fulfillments and refunds answered 200 with an empty list, which leaked
// nothing but disagreed with the order about whether it exists.

import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const FOREIGN = 'ee8bd403-2dfe-477e-a8c2-58e367e09ad5';
const OWN = '66666666-6666-4666-8666-666666666666';

const crm = vi.hoisted(() => {
  class NotFound extends Error {
    readonly statusCode = 404;
  }
  const list = () => vi.fn(() => Promise.resolve([]));
  return {
    NotFound,
    orderService: {
      get: vi.fn((_ctx: unknown, id: string) =>
        id === '66666666-6666-4666-8666-666666666666'
          ? Promise.resolve({ id })
          : Promise.reject(new NotFound(`Order ${id} not found`))
      ),
    },
    orderPaymentsService: { listForOrder: list() },
    orderFulfillmentsService: { listForOrder: list() },
    orderRefundsService: { listForOrder: list() },
    billingFromOrderService: {},
  };
});

vi.mock('@wizeworks/crm', () => crm);
vi.mock('@wizeworks/commerce', () => ({
  listFulfillmentLabels: vi.fn(),
  quoteOutboundRates: vi.fn(),
  shippingService: {},
}));
vi.mock('@wizeworks/inventory', () => ({ inventoryService: {} }));
vi.mock('@wizeworks/api-core/auth', () => ({
  requireAuth: () => ({ tenantId: 't', actorId: 'u' }),
  requireRole: () => ({ tenantId: 't', actorId: 'u' }),
}));
vi.mock('../../lib/order-context.js', () => ({
  requireOrderAccess: () => Promise.resolve(),
  toOrderContext: () => ({ tenantId: 't', userId: 'u' }),
}));
vi.mock('../../lib/order-refund.js', () => ({ refundOrderThroughGateway: vi.fn() }));
vi.mock('../../lib/property.js', () => ({ reachableSiteIds: vi.fn() }));
vi.mock('../../lib/commerce-context.js', () => ({
  defaultOwningSite: vi.fn(),
  requireCommerceModule: vi.fn(),
  toCommerceContext: vi.fn(),
}));

const { default: routes } = await import('./orders.js');

async function app() {
  const a = Fastify();
  await a.register(routes);
  return a;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the lists under an order agree with the order', () => {
  it.each([
    ['payments', crm.orderPaymentsService],
    ['fulfillments', crm.orderFulfillmentsService],
    ['refunds', crm.orderRefundsService],
  ])('%s of another business’s order is a 404, and is never read', async (path, service) => {
    const res = await (await app()).inject({ method: 'GET', url: `/v1/orders/${FOREIGN}/${path}` });
    expect(res.statusCode).toBe(404);
    expect(service.listForOrder).not.toHaveBeenCalled();
  });

  it('still lists an order of her own', async () => {
    const res = await (await app()).inject({ method: 'GET', url: `/v1/orders/${OWN}/payments` });
    expect(res.statusCode).toBe(200);
    expect(crm.orderPaymentsService.listForOrder).toHaveBeenCalledOnce();
  });
});
