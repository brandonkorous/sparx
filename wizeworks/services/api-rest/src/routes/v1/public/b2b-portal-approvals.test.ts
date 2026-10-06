// The routes a trade account's own approver signs its held orders with
// (sparx persona issue 087).
//
// Approving places a real order: stock comes off the shelf and an order on
// terms is invoiced. So the two writes take a signed-in website session, the
// same rule every other portal write follows, and a connected app holding the
// read grant may list what is waiting but never approve or turn one down. A
// business without the wholesale module has no approvals, and answers as a
// disabled module does. What each route caused is published only after the
// service has committed.

import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ACCOUNT = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
const ORDER = '9bda9258-18bc-4940-a9b8-0f4356b70926';

const state = vi.hoisted(() => ({
  scopes: null as ReadonlySet<string> | null,
  b2bOn: true,
}));

// The real session rule: a bearer must hold the route's scope; a website
// session holds every scope.
vi.mock('../../../lib/customer-session.js', () => {
  const resolve = (scope?: string) => {
    if (state.scopes !== null && (!scope || !state.scopes.has(scope))) {
      return Promise.reject(Object.assign(new Error('scope'), { statusCode: 403 }));
    }
    return Promise.resolve({ customerId: 'c-teodora', userId: 'u1', scopes: state.scopes });
  };
  return {
    requireCustomer: (_r: unknown, _c: unknown, scope?: string) => resolve(scope),
    requireCustomerId: (_r: unknown, _c: unknown, scope?: string) =>
      resolve(scope).then((c) => c.customerId),
  };
});
vi.mock('../../../lib/public-commerce-context.js', () => ({
  resolveTenantId: () => Promise.resolve('tenant-gillett'),
}));
vi.mock('@wizeworks/auth', () => ({
  isModuleEnabled: (_tenant: string, slug: string) =>
    Promise.resolve(slug === 'b2b' ? state.b2bOn : false),
}));

const service = vi.hoisted(() => ({
  listAccountApprovals: vi.fn(() => Promise.resolve({ items: [] })),
  approveOrderForAccount: vi.fn(() =>
    Promise.resolve({
      order: { id: ORDER, orderNumber: 'O-000014', status: 'placed', waitingOn: [] },
      events: [{ type: 'b2b.order.approved', payload: { orderId: ORDER } }],
      committedSales: [{ variantId: 'v1' }],
      money: [{ action: 'capture', orderId: ORDER, paymentRef: 'pi_wasatch' }],
    })
  ),
  rejectOrderForAccount: vi.fn(() =>
    Promise.resolve({
      order: { id: ORDER, orderNumber: 'O-000014', status: 'cancelled' },
      events: [{ type: 'b2b.order.rejected', payload: { orderId: ORDER } }],
      money: [{ action: 'release', orderId: ORDER, paymentRef: 'pi_wasatch' }],
    })
  ),
}));
vi.mock('@wizeworks/b2b', () => ({ approvalService: service }));

const published = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('@wizeworks/api-core/pubsub', () => ({ publish: published }));
const emitSaleEvents = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('@wizeworks/inventory', () => ({ inventoryService: { emitSaleEvents } }));
// The card on the order (sparx persona issue 087), settled after the decision
// commits. Mocked here: the gateway work has its own tests.
const settleHeldOrderMoney = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('../../../lib/held-order-money.js', () => ({ settleHeldOrderMoney }));

import approvalRoutes from './b2b-portal-approvals.js';

async function app() {
  const a = Fastify();
  // The real error envelope maps a thrown status onto the reply.
  a.setErrorHandler((err: { statusCode?: number; message: string }, _req, reply) => {
    void reply.status(err.statusCode ?? 500).send({ message: err.message });
  });
  await a.register(approvalRoutes);
  return a;
}

const base = `/v1/public/b2b/portal/${ACCOUNT}`;
const decider = { tenantId: 'tenant-gillett', customerId: 'c-teodora', accountId: ACCOUNT };

beforeEach(() => {
  state.scopes = null;
  state.b2bOn = true;
  vi.clearAllMocks();
});

describe('signed in on the website', () => {
  it('approves for the account in the path, then publishes what it caused', async () => {
    const res = await (
      await app()
    ).inject({ method: 'POST', url: `${base}/orders/${ORDER}/approve`, payload: {} });
    expect(res.statusCode).toBe(200);
    expect(service.approveOrderForAccount).toHaveBeenCalledWith(decider, ORDER, {});
    expect(emitSaleEvents).toHaveBeenCalledOnce();
    // The card held at checkout is charged now the order is placed.
    expect(settleHeldOrderMoney).toHaveBeenCalledWith(
      expect.anything(),
      { tenantId: 'tenant-gillett' },
      [{ action: 'capture', orderId: ORDER, paymentRef: 'pi_wasatch' }]
    );
    expect(published).toHaveBeenCalledWith(
      expect.anything(),
      'b2b.order.approved',
      'tenant-gillett',
      null,
      { orderId: ORDER }
    );
  });

  it('turns one down with the reason', async () => {
    const res = await (
      await app()
    ).inject({
      method: 'POST',
      url: `${base}/orders/${ORDER}/reject`,
      payload: { reason: 'Split it across two POs.' },
    });
    expect(res.statusCode).toBe(200);
    expect(service.rejectOrderForAccount).toHaveBeenCalledWith(decider, ORDER, {
      reason: 'Split it across two POs.',
    });
    expect(published).toHaveBeenCalledOnce();
    // Their own company said no, so the held card is let go.
    expect(settleHeldOrderMoney).toHaveBeenCalledWith(
      expect.anything(),
      { tenantId: 'tenant-gillett' },
      [{ action: 'release', orderId: ORDER, paymentRef: 'pi_wasatch' }]
    );
  });
});

describe('a connected app with the read grant', () => {
  beforeEach(() => {
    state.scopes = new Set(['b2b:read']);
  });

  it('may list what is waiting', async () => {
    const res = await (await app()).inject({ method: 'GET', url: `${base}/approvals` });
    expect(res.statusCode).toBe(200);
    expect(service.listAccountApprovals).toHaveBeenCalledWith(decider);
  });

  it.each(['approve', 'reject'])('may not %s', async (verb) => {
    const res = await (
      await app()
    ).inject({ method: 'POST', url: `${base}/orders/${ORDER}/${verb}`, payload: {} });
    expect(res.statusCode).toBe(403);
    expect(service.approveOrderForAccount).not.toHaveBeenCalled();
    expect(service.rejectOrderForAccount).not.toHaveBeenCalled();
    expect(published).not.toHaveBeenCalled();
    expect(settleHeldOrderMoney).not.toHaveBeenCalled();
  });
});

describe('a business without the wholesale module', () => {
  it.each([
    ['GET', `${base}/approvals`],
    ['POST', `${base}/orders/${ORDER}/approve`],
    ['POST', `${base}/orders/${ORDER}/reject`],
  ] as const)('%s %s answers as a disabled module', async (method, url) => {
    state.b2bOn = false;
    const res = await (await app()).inject({ method, url, payload: {} });
    expect(res.statusCode).toBe(404);
    expect(service.listAccountApprovals).not.toHaveBeenCalled();
    expect(service.approveOrderForAccount).not.toHaveBeenCalled();
    expect(service.rejectOrderForAccount).not.toHaveBeenCalled();
  });
});
