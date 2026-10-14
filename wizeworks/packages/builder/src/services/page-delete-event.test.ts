import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A live page that is deleted tells the site cache (persona issue 947).
 *
 * The site serves a published page out of a five-minute cache. Rosalind deleted her
 * "Each article" page and every article kept the old design until the cache ran out.
 */

let row: { id: string; name: string; publishedAt: Date | null; silicaPublishedTree: unknown };

vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    Promise.resolve(
      fn({
        builderPage: {
          findFirst: () => Promise.resolve(row),
          findMany: () => Promise.resolve([]),
          delete: () => Promise.resolve(row),
        },
        auditLog: { create: () => Promise.resolve({}) },
      })
    ),
}));
vi.mock('@wizeworks/events', () => ({ indexEntity: () => Promise.resolve() }));

const { RecordingPublisher, setPublisher } = await import('../events');
const { remove } = await import('./page-service');

const ctx = { tenantId: 't-1', propertyId: 'site-1', userId: 'u-1' };
let recorder: InstanceType<typeof RecordingPublisher>;

describe('deleting a page', () => {
  beforeEach(() => {
    recorder = new RecordingPublisher();
    setPublisher(recorder);
  });

  it('tells the site cache when the page was live', async () => {
    row = {
      id: 'each-article',
      name: 'Each article',
      publishedAt: new Date('2026-10-08T10:22:17Z'),
      silicaPublishedTree: { kind: 'element', tag: 'div' },
    };
    await remove(ctx, 'each-article');
    expect(recorder.events.map((e) => e.topic)).toEqual(['builder.page.deleted']);
    expect(recorder.events[0]?.payload).toMatchObject({ pageId: 'each-article' });
  });

  it('says nothing for a page that was never live: nothing was cached', async () => {
    row = { id: 'draft', name: 'Draft', publishedAt: null, silicaPublishedTree: null };
    await remove(ctx, 'draft');
    expect(recorder.events).toEqual([]);
  });
});
