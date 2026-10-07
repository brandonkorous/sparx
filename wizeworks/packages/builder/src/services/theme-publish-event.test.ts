import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Publishing a look tells the cache (persona issue 921).
 *
 * A site serves the published tokens of the look it wears, so publishing that
 * look repaints the live site. The publish emitted nothing, so a visitor kept
 * the old colors until the five-minute cache ran out while the pane said "a few
 * seconds".
 */

let row: { id: string; name: string; draftTokens: unknown } | null;

vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    Promise.resolve(
      fn({
        builderTheme: {
          findFirst: () => Promise.resolve(row),
          update: ({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({
              ...row,
              origin: 'custom',
              sourceKey: null,
              marketplaceThemeId: null,
              marketplaceVersion: null,
              publishedTokens: data.publishedTokens,
              publishedAt: data.publishedAt,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
        },
      })
    ),
}));
vi.mock('./theme-version-service', () => ({
  captureThemeVersionTx: () => Promise.resolve(),
}));

const { publish } = await import('./theme-service');
const { RecordingPublisher, setPublisher } = await import('../events');

const ctx = { tenantId: 't-juniper' };
const recorder = new RecordingPublisher();

beforeEach(() => {
  recorder.clear();
  setPublisher(recorder);
  row = { id: 'theme-amber', name: 'Amber', draftTokens: { colors: {} } };
});

describe('publishing a look', () => {
  it('tells the cache, after the write', async () => {
    await publish(ctx, 'theme-amber');
    expect(recorder.events).toEqual([
      {
        tenantId: 't-juniper',
        topic: 'builder.theme.published',
        payload: { themeId: 'theme-amber', name: 'Amber' },
      },
    ]);
  });

  it('says nothing when there was nothing to publish', async () => {
    row = null;
    await expect(publish(ctx as never, 'theme-gone')).rejects.toThrow();
    expect(recorder.events).toEqual([]);
  });
});
