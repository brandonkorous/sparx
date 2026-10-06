// An AI client approving or rejecting a held wholesale order settles the card
// that paid for it, the same as the console and the site do (sparx persona issue
// 087). The tools that lived in @wizeworks/b2b/mcp decided the order and never
// touched the card, so a rejected order kept the buyer's money.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const theOrder = { id: 'order-14', orderNumber: 'O-000014' };
const capture = { action: 'capture', orderId: 'order-14', paymentRef: 'pi_wasatch' };
const refund = { action: 'refund', orderId: 'order-14', paymentRef: 'pi_wasatch' };

const approvalService = vi.hoisted(() => ({
  approveOrder: vi.fn(),
  rejectOrder: vi.fn(),
}));
const settle = vi.hoisted(() => vi.fn<(ctx: unknown, moves: unknown[]) => Promise<unknown[]>>());
const steps = vi.hoisted(() => [] as string[]);

vi.mock('@wizeworks/b2b', () => ({ approvalService }));
vi.mock('@wizeworks/commerce', () => ({
  heldOrderPayments: {
    settle: (ctx: unknown, moves: unknown[]) => {
      steps.push('settle');
      return settle(ctx, moves);
    },
  },
}));
vi.mock('@wizeworks/api-core/pubsub', () => ({
  publish: () => {
    steps.push('publish');
    return Promise.resolve();
  },
}));
vi.mock('@wizeworks/inventory', () => ({
  inventoryService: { emitSaleEvents: () => Promise.resolve() },
}));

const { b2bApprovalMcpTools } = await import('./b2b-approval-tools.js');
const tool = (name: string) => b2bApprovalMcpTools.find((t) => t.name === name)!;
const ctx = { tenantId: 't-gillett', userId: 'u-doty' };

beforeEach(() => {
  vi.clearAllMocks();
  steps.length = 0;
  settle.mockImplementation((_ctx: unknown, moves: unknown[]) =>
    Promise.resolve(moves.map((move) => ({ move, ok: true })))
  );
});

describe('approve_b2b_order', () => {
  it('charges the held card once the order is placed, before announcing it', async () => {
    approvalService.approveOrder.mockResolvedValue({
      order: { ...theOrder, status: 'placed', waitingOn: [] },
      events: [{ type: 'order.placed', payload: {} }],
      committedSales: [],
      money: [capture],
    });
    const result = await tool('approve_b2b_order').run(ctx, { orderId: 'order-14' });
    expect(settle).toHaveBeenCalledWith(ctx, [capture]);
    expect(steps).toEqual(['settle', 'publish']);
    expect(result).toMatchObject({ status: 'placed', card: [{ action: 'capture', done: true }] });
  });

  it('says plainly when the card could not be charged', async () => {
    approvalService.approveOrder.mockResolvedValue({
      order: { ...theOrder, status: 'placed', waitingOn: [] },
      events: [],
      committedSales: [],
      money: [capture],
    });
    settle.mockResolvedValue([{ move: capture, ok: false, error: 'card_declined' }]);
    const result = await tool('approve_b2b_order').run(ctx, { orderId: 'order-14' });
    expect(result).toMatchObject({
      card: [{ action: 'capture', done: false, problem: 'card_declined' }],
    });
  });

  it('touches no card while the order still waits for somebody', async () => {
    approvalService.approveOrder.mockResolvedValue({
      order: { ...theOrder, status: 'pending_approval', waitingOn: ['account'] },
      events: [],
      committedSales: [],
      money: [],
    });
    const result = await tool('approve_b2b_order').run(ctx, { orderId: 'order-14' });
    expect(settle).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('card');
  });
});

describe('reject_b2b_order', () => {
  it('gives the buyer their money back', async () => {
    approvalService.rejectOrder.mockResolvedValue({
      order: { ...theOrder, status: 'cancelled' },
      events: [{ type: 'b2b.order.rejected', payload: {} }],
      money: [refund],
    });
    const result = await tool('reject_b2b_order').run(ctx, {
      orderId: 'order-14',
      reason: 'Over budget',
    });
    expect(approvalService.rejectOrder).toHaveBeenCalledWith(ctx, 'order-14', {
      reason: 'Over budget',
    });
    expect(settle).toHaveBeenCalledWith(ctx, [refund]);
    expect(result).toMatchObject({ status: 'cancelled', card: [{ action: 'refund', done: true }] });
  });
});
