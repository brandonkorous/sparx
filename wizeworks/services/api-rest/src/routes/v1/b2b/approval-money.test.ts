// The business's Approve and Reject settle the card on a held order once the
// decision has committed (sparx persona issue 087): approving charges the card
// held at checkout, rejecting lets it go or refunds it. Reject used to cancel
// the order and keep the money.

import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORDER = '66666666-6666-4666-8666-666666666666';
const ctx = { tenantId: 'tenant-gillett', userId: 'u-doty' };
const steps = vi.hoisted(() => [] as string[]);

const service = vi.hoisted(() => ({
  approveOrder: vi.fn(() =>
    Promise.resolve({
      order: { id: ORDER, orderNumber: 'O-000014', status: 'placed', waitingOn: [] },
      events: [{ type: 'order.placed', payload: { orderId: ORDER } }],
      committedSales: [],
      money: [{ action: 'capture', orderId: ORDER }],
    })
  ),
  rejectOrder: vi.fn(() =>
    Promise.resolve({
      order: { id: ORDER, orderNumber: 'O-000014', status: 'cancelled' },
      events: [{ type: 'b2b.order.rejected', payload: { orderId: ORDER } }],
      money: [{ action: 'refund', orderId: ORDER }],
    })
  ),
}));
const settleHeldOrderMoney = vi.hoisted(() =>
  vi.fn(() => {
    steps.push('settle');
    return Promise.resolve();
  })
);

vi.mock('@wizeworks/b2b', () => ({ approvalService: service }));
vi.mock('@wizeworks/api-core/auth', () => ({ requireRole: () => ({}) }));
vi.mock('../../../lib/b2b-context.js', () => ({
  requireB2bModule: () => Promise.resolve(),
  toB2bContext: () => ctx,
}));
vi.mock('../../../lib/property.js', () => ({ resolvePropertyId: () => Promise.resolve(null) }));
vi.mock('../../../lib/held-order-money.js', () => ({ settleHeldOrderMoney }));
vi.mock('@wizeworks/inventory', () => ({
  inventoryService: { emitSaleEvents: () => Promise.resolve() },
}));
vi.mock('@wizeworks/api-core/pubsub', () => ({
  publish: () => {
    steps.push('publish');
    return Promise.resolve();
  },
}));

const { default: routes } = await import('./approval.js');

async function app() {
  const a = Fastify();
  await a.register(routes);
  return a;
}

beforeEach(() => {
  vi.clearAllMocks();
  steps.length = 0;
});

describe('the console decides a held order', () => {
  it('Approve charges the held card, then announces the order', async () => {
    const res = await (
      await app()
    ).inject({ method: 'POST', url: `/v1/b2b/approval-queue/${ORDER}/approve`, payload: {} });
    expect(res.statusCode).toBe(200);
    expect(settleHeldOrderMoney).toHaveBeenCalledWith(expect.anything(), ctx, [
      { action: 'capture', orderId: ORDER },
    ]);
    expect(steps).toEqual(['settle', 'publish']);
  });

  it('Reject gives the buyer their money back', async () => {
    const res = await (
      await app()
    ).inject({ method: 'POST', url: `/v1/b2b/approval-queue/${ORDER}/reject`, payload: {} });
    expect(res.statusCode).toBe(200);
    expect(settleHeldOrderMoney).toHaveBeenCalledWith(expect.anything(), ctx, [
      { action: 'refund', orderId: ORDER },
    ]);
  });
});
