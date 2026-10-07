// A real import puts its rows into search by itself.
//
// MEASURED 2026-10-06 on Gillett: after importing 30 Shopify customers the
// search box said "30 customers are not in this box yet, so it cannot look at
// them" and offered a "Put them back" button (sparx persona issue 107).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const publishEvent = vi.fn((..._args: unknown[]) => Promise.resolve());
vi.mock('@wizeworks/events', () => ({
  createPublisher: () => ({ publish: () => Promise.resolve() }),
  publishEvent,
}));

const { collectionsFor, reindexSearchAfterImport } = await import('./reindex-after-import');

const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() } as never;
const GILLETT = '5944fe23-be83-4ce5-aafc-ef56b8594508';

beforeEach(() => {
  publishEvent.mockClear();
});

describe('after an import', () => {
  it('asks for the same rebuild "Put them back" asks for', async () => {
    await reindexSearchAfterImport(
      { tenantId: GILLETT, entityType: 'customers', dryRun: false, written: 30 },
      logger
    );
    expect(publishEvent).toHaveBeenCalledWith(
      expect.anything(),
      'search.reindex.requested',
      GILLETT,
      null,
      expect.objectContaining({ collections: ['customers', 'entities'], dropStale: false }),
      logger
    );
  });

  it('asks for nothing after a practice run or a run that wrote nothing', async () => {
    await reindexSearchAfterImport(
      { tenantId: GILLETT, entityType: 'customers', dryRun: true, written: 30 },
      logger
    );
    await reindexSearchAfterImport(
      { tenantId: GILLETT, entityType: 'customers', dryRun: false, written: 0 },
      logger
    );
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it('names the collections each kind of row lives in', () => {
    expect(collectionsFor('products')).toEqual(['products', 'entities']);
    expect(collectionsFor('orders')).toEqual(['orders', 'customers', 'entities']);
    expect(collectionsFor('blog_posts')).toEqual(['entities']);
  });
});
