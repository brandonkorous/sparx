// Loading or clearing sample data asks for the search index to be rebuilt.
//
// The sample-data engine writes customers, orders and products straight into the
// database in one bulk transaction, so none of them is announced one at a time.
// The search box then answered "Nothing in your records matches" about sample
// customers sitting in the customer list, and went on finding cleared ones that
// no longer existed (sparx persona issue 086). One rebuild request covers the
// whole load, and a clear asks for the stale entries to be dropped first.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

const publish = vi.fn();

vi.mock('@wizeworks/api-core/auth', () => ({
  requireRole: vi.fn(),
  requireAuth: () => ({ tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508', actorId: 'u-1' }),
}));
vi.mock('@wizeworks/api-core/pubsub', () => ({ publish }));
vi.mock('../../lib/sample-data.js', () => ({
  getSampleDataStatus: vi.fn(),
  loadTenantSampleData: () => Promise.resolve({ pack: 'generic', counts: { customers: 8 } }),
  clearTenantSampleData: () => Promise.resolve({ customers: 8 }),
}));

const { default: sampleDataRoutes } = await import('./sample-data.js');

beforeEach(() => {
  publish.mockReset().mockResolvedValue(undefined);
});

async function post(url: string) {
  const app = Fastify();
  await app.register(sampleDataRoutes);
  const res = await app.inject({ method: 'POST', url });
  await app.close();
  return res;
}

describe('sample data and search', () => {
  it('asks for a rebuild after loading, keeping what is already findable', async () => {
    const res = await post('/v1/sample-data/load');
    expect(res.statusCode).toBe(201);
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      'search.reindex.requested',
      '5944fe23-be83-4ce5-aafc-ef56b8594508',
      'u-1',
      expect.objectContaining({ dropStale: false })
    );
  });

  it('asks for a rebuild after clearing that drops what is no longer there', async () => {
    const res = await post('/v1/sample-data/clear');
    expect(res.statusCode).toBe(200);
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      'search.reindex.requested',
      '5944fe23-be83-4ce5-aafc-ef56b8594508',
      'u-1',
      expect.objectContaining({ dropStale: true })
    );
  });
});
