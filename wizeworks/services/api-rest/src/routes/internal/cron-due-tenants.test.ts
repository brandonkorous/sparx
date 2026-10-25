import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// WW-9: the SLA sweep opened a transaction per CRM tenant per run (33
// Ticket.findMany a run) and the reaper did the same per commerce tenant every
// minute, whether or not the tenant had anything due.

const h = vi.hoisted(() => ({
  sweep: vi.fn(() => Promise.resolve({ resolutionBreached: 0 })),
  expire: vi.fn(() => Promise.resolve(0)),
  reap: vi.fn((input: { tenantId: string }) => Promise.resolve({ ...input, released: 1 })),
  sync: vi.fn(() => Promise.resolve({ mailboxes: 1 })),
  reconcile: vi.fn(() => Promise.resolve({ scanned: 1, recovered: 0 })),
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
  },
}));
vi.mock('../../lib/crm-mailbox-sync.js', () => ({ syncTenantMailboxes: h.sync }));
vi.mock('../../lib/payment-webhook-reconcile.js', () => ({
  sweepStrandedCheckoutPayments: h.reconcile,
}));
vi.mock('../../lib/payment-due-tenants.js', () => ({
  listTenantsWithOpenPayments: () => Promise.resolve(new Set(['idle'])),
}));

import commerceCronRoutes from './commerce-cron.js';
import crmCronRoutes from './crm-cron.js';

const TOKEN = process.env.SPARX_INTERNAL_CRON_TOKEN ?? '';

async function post(url: string) {
  const app = Fastify();
  await app.register(crmCronRoutes);
  await app.register(commerceCronRoutes);
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
});
