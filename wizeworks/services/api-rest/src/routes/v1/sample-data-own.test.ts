// The Home checklist asks how many products, customers and invoices are the
// business's own, not how many the list holds: on a business that signup filled
// with a practice pack, the list totals ticked every step before the owner saw
// the checklist (Piggles persona issue 935).

import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

const countTenantOwnRecords = vi.fn();

vi.mock('@wizeworks/api-core/auth', () => ({
  requireRole: vi.fn(),
  requireAuth: () => ({ tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508', actorId: 'u-1' }),
}));
vi.mock('@wizeworks/api-core/pubsub', () => ({ publish: vi.fn() }));
vi.mock('../../lib/sample-data.js', () => ({
  countTenantOwnRecords,
  getSampleDataStatus: vi.fn(),
  loadTenantSampleData: vi.fn(),
  clearTenantSampleData: vi.fn(),
}));

const { default: sampleDataRoutes } = await import('./sample-data.js');

async function get(url: string) {
  const app = Fastify();
  await app.register(sampleDataRoutes);
  const res = await app.inject({ method: 'GET', url });
  await app.close();
  return res;
}

describe('counting what the business made itself', () => {
  it('answers with the own count for the kind asked about', async () => {
    countTenantOwnRecords.mockResolvedValue(0);
    const res = await get('/v1/sample-data/own?kind=product');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ data: { total: 0 } });
    expect(countTenantOwnRecords).toHaveBeenCalledWith(
      { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508', userId: 'u-1' },
      'product'
    );
  });

  it('refuses a kind it does not count rather than guessing', async () => {
    countTenantOwnRecords.mockClear();
    const res = await get('/v1/sample-data/own?kind=orders');
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(countTenantOwnRecords).not.toHaveBeenCalled();
  });
});
