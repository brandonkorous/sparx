import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// WW-9: the SLA sweep opened a transaction per CRM tenant per run (33
// Ticket.findMany a run) and the reaper did the same per commerce tenant every
// minute, whether or not the tenant had anything due. The channel poll, the
// subscription tick and the cart-abandonment sweep had the same shape.

const h = vi.hoisted(() => ({
  sweep: vi.fn(() => Promise.resolve({ resolutionBreached: 0 })),
  expire: vi.fn(() => Promise.resolve(0)),
  reap: vi.fn((input: { tenantId: string }) => Promise.resolve({ ...input, released: 1 })),
  sync: vi.fn(() => Promise.resolve({ mailboxes: 1 })),
  reconcile: vi.fn(() => Promise.resolve({ scanned: 1, recovered: 0 })),
  carts: vi.fn((input: { tenantId: string }) => Promise.resolve({ ...input, marked: 1 })),
  tick: vi.fn((input: { tenantId: string }) => Promise.resolve({ ...input, due: 1 })),
  dueSubscriptions: vi.fn((_asOf: Date) => Promise.resolve(new Set(['shop', 'not-commerce']))),
  poll: vi.fn(() => Promise.resolve({ connections: 1, ingested: 0, deduped: 0, errors: 0 })),
}));

vi.mock('@wizeworks/crm', () => ({
  crmSchedulers: {
    listCrmActiveTenants: () => Promise.resolve([{ id: 'busy' }, { id: 'quiet' }]),
    listTenantsWithDueSlaWork: () => Promise.resolve(new Set(['busy', 'not-crm'])),
    listTenantsWithSyncableMailboxes: () => Promise.resolve(new Set(['quiet'])),
  },
  segmentService: {},
  signatureService: { expireStale: h.expire },
  ticketSlaSweep: { sweepTenant: h.sweep },
}));
vi.mock('@wizeworks/commerce', () => ({
  commerceSchedulers: {
    listCommerceActiveTenants: () => Promise.resolve([{ id: 'shop' }, { id: 'idle' }]),
    listTenantsWithDueReservations: () => Promise.resolve(new Set(['shop'])),
    reapExpiredReservations: h.reap,
    listTenantsWithOpenCarts: () => Promise.resolve(new Set(['idle'])),
    sweepAbandonedCarts: h.carts,
    listTenantsWithDueSubscriptionWork: h.dueSubscriptions,
    runSubscriptionTick: h.tick,
  },
}));
vi.mock('../../lib/channel-poll.js', () => ({
  listTenantsWithActiveChannels: () => Promise.resolve(new Set(['shop'])),
  pollTenantChannelOrders: h.poll,
}));
vi.mock('../../lib/crm-mailbox-sync.js', () => ({ syncTenantMailboxes: h.sync }));
vi.mock('../../lib/payment-webhook-reconcile.js', () => ({
  sweepStrandedCheckoutPayments: h.reconcile,
}));
vi.mock('../../lib/payment-due-tenants.js', () => ({
  listTenantsWithOpenPayments: () => Promise.resolve(new Set(['idle'])),
}));

import channelsCronRoutes from './channels-cron.js';
import commerceCronRoutes from './commerce-cron.js';
import crmCronRoutes from './crm-cron.js';

const TOKEN = process.env.SPARX_INTERNAL_CRON_TOKEN ?? '';

async function post(url: string) {
  const app = Fastify();
  await app.register(crmCronRoutes);
  await app.register(commerceCronRoutes);
  await app.register(channelsCronRoutes);
  const res = await app.inject({
    method: 'POST',
    url,
    headers: { 'x-sparx-internal-cron-token': TOKEN },
  });
  await app.close();
  return res;
}

beforeEach(() => vi.clearAllMocks());

describe('cron sweeps walk only tenants with something due', () => {
  it('sla-sweep skips a CRM tenant with no open tickets, and ignores non-CRM tenants', async () => {
    const res = await post('/internal/crm/sla-sweep');
    expect(res.statusCode).toBe(200);
    expect(h.sweep).toHaveBeenCalledTimes(1);
    expect(h.sweep).toHaveBeenCalledWith({ tenantId: 'busy' });
    expect(h.expire).toHaveBeenCalledTimes(1);
    expect(res.json().data).toMatchObject({ tenants: 1, skipped: 1 });
  });

  it('reservation-reaper skips a shop holding no expired reservation', async () => {
    const res = await post('/internal/commerce/reservation-reaper');
    expect(res.statusCode).toBe(200);
    expect(h.reap).toHaveBeenCalledTimes(1);
    expect(h.reap).toHaveBeenCalledWith({ tenantId: 'shop' });
  });

  it('mailbox-sync polls only tenants with a mailbox', async () => {
    await post('/internal/crm/mailbox-sync');
    expect(h.sync).toHaveBeenCalledTimes(1);
    expect(h.sync).toHaveBeenCalledWith(expect.anything(), 'quiet');
  });

  it('payment-reconcile-sweep asks only tenants with a payment still open', async () => {
    await post('/internal/commerce/payment-reconcile-sweep');
    expect(h.reconcile).toHaveBeenCalledTimes(1);
    expect(h.reconcile).toHaveBeenCalledWith(expect.anything(), 'idle');
  });

  it('channels/poll asks only shops with an active channel connection', async () => {
    const res = await post('/internal/channels/poll');
    expect(res.statusCode).toBe(200);
    expect(h.poll).toHaveBeenCalledTimes(1);
    expect(h.poll).toHaveBeenCalledWith('shop');
    expect(res.json().data).toMatchObject({ tenants: 1, skipped: 1 });
  });

  it('cart-abandonment-sweep looks only at shops holding a basket nobody bought', async () => {
    const res = await post('/internal/commerce/cart-abandonment-sweep');
    expect(res.statusCode).toBe(200);
    expect(h.carts).toHaveBeenCalledTimes(1);
    expect(h.carts).toHaveBeenCalledWith({ tenantId: 'idle' });
    expect(res.json().data).toMatchObject({ tenants: 1, skipped: 1 });
  });

  it('subscription-tick bills only shops with something due, and ignores non-commerce ones', async () => {
    const res = await post('/internal/commerce/subscription-tick');
    expect(res.statusCode).toBe(200);
    expect(h.tick).toHaveBeenCalledTimes(1);
    expect(h.tick).toHaveBeenCalledWith({ tenantId: 'shop' });
    expect(res.json().data).toMatchObject({ tenants: 1, skipped: 1 });
  });

  it('subscription-tick scans on the date it bills against when an operator dry-runs one', async () => {
    const asOf = '2027-03-01T00:00:00.000Z';
    await post(`/internal/commerce/subscription-tick?asOf=${asOf}`);
    expect(h.dueSubscriptions).toHaveBeenCalledWith(new Date(asOf));
    expect(h.tick).toHaveBeenCalledWith({ tenantId: 'shop', asOf });
  });
});
