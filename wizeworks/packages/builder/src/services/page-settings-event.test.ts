import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A page's live settings tell the site cache (sparx persona issue 133).
 *
 * A page's search title, summary, sharing picture, chrome, name and address are
 * live the moment they are saved; only the body is staged for Publish. The site
 * caches them for five minutes, so a title changed from the SEO page check
 * reached visitors only when that cache ran out.
 */

const row = { id: 'about', name: 'About' };

vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    Promise.resolve(
      fn({
        builderPage: {
          findFirst: () => Promise.resolve(row),
          findMany: () => Promise.resolve([{ id: row.id }]),
          update: ({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({
              ...row,
              tenantId: 't-1',
              propertyId: 'site-1',
              kind: 'singleton',
              recordType: null,
              recordSubtype: null,
              slug: 'about',
              draftTree: { kind: 'element', tag: 'div', children: [] },
              publishedTree: null,
              publishedAt: null,
              position: 0,
              seoTitle: null,
              seoDescription: null,
              canonical: null,
              ogImage: null,
              noindex: false,
              isDefault: false,
              frameId: null,
              publishedFrameId: null,
              silicaDraftTree: null,
              silicaPublishedTree: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              ...data,
            }),
        },
      })
    ),
}));
vi.mock('@wizeworks/events', () => ({ indexEntity: () => Promise.resolve() }));

const { blankPageTree } = await import('@wizeworks/builder-schemas');
const { RecordingPublisher, setPublisher } = await import('../events');
const { update } = await import('./page-service');

const ctx = { tenantId: 't-1', propertyId: 'site-1', userId: 'u-1' };
let recorder: InstanceType<typeof RecordingPublisher>;

describe('saving a page', () => {
  beforeEach(() => {
    recorder = new RecordingPublisher();
    setPublisher(recorder);
  });

  it('tells the site cache when its search words change', async () => {
    await update(ctx, 'about', { seoTitle: 'About Gillett Diesel: Bluffdale diesel shop' });
    expect(recorder.events.map((e) => e.topic)).toEqual(['builder.page.settings.changed']);
    expect(recorder.events[0]?.payload).toMatchObject({ pageId: 'about' });
  });

  it('says nothing for a body edit, which waits for Publish', async () => {
    await update(ctx, 'about', { tree: blankPageTree() });
    expect(recorder.events).toEqual([]);
  });
});
