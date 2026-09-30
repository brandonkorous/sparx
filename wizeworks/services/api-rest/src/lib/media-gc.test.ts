// The media GC must never hard-delete a picture something still uses.
//
// Eligibility used to be `usage_count = 0`, a column nothing has ever written, so
// every soft-deleted asset passed and a live photo was one tick from permanent
// deletion (issue 381). These pin that the tick COUNTS references with the same
// helper the delete guards use, and keeps anything still in use.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';

const state = vi.hoisted(() => ({
  candidates: [] as { id: string; tenant_id: string; key: string }[],
  inUse: new Set<string>(),
  deletedKeys: [] as string[],
  deletedRows: [] as string[],
  selects: [] as string[],
}));

vi.mock('@wizeworks/db', () => {
  const tx = {
    mediaVariant: {
      findMany: ({ where }: { where: { assetId: string } }) =>
        Promise.resolve([{ id: `v-${where.assetId}`, key: `variants/${where.assetId}` }]),
      deleteMany: () => Promise.resolve({ count: 1 }),
    },
    mediaAsset: {
      delete: ({ where }: { where: { id: string } }) => {
        state.deletedRows.push(where.id);
        return Promise.resolve({});
      },
    },
  };
  return {
    ADVISORY_LOCKS: { MEDIA_GC: 1 },
    withAdvisoryTickLock: (_key: number, _held: unknown, fn: () => Promise<unknown>) => fn(),
    // Keyset paging: answer the rows after the cursor, once.
    prisma: {
      $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
        const after = String(values[1]);
        state.selects.push(strings.join('?'));
        return Promise.resolve(state.candidates.filter((c) => c.id > after));
      },
    },
    withTenant: (_ctx: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
});

vi.mock('@wizeworks/media', () => ({
  countOneAssetUsage: (_tx: unknown, id: string) =>
    Promise.resolve({ total: state.inUse.has(id) ? 1 : 0 }),
}));

vi.mock('./storage.js', () => ({
  getStorage: () => ({
    deleteObject: (key: string) => {
      state.deletedKeys.push(key);
      return Promise.resolve();
    },
  }),
}));

const { runMediaGcTick } = await import('./media-gc.js');

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
} as unknown as FastifyBaseLogger;

const asset = (n: number) => ({
  id: `00000000-0000-0000-0000-00000000000${String(n)}`,
  tenant_id: 't1',
  key: `originals/${String(n)}`,
});

beforeEach(() => {
  state.candidates = [asset(1), asset(2)];
  state.inUse = new Set();
  state.deletedKeys = [];
  state.deletedRows = [];
  state.selects = [];
});

describe('runMediaGcTick', () => {
  it('keeps a soft-deleted asset that something still uses, bytes and row', async () => {
    state.inUse.add(asset(1).id);
    const result = await runMediaGcTick(logger, 0);
    expect(result).toMatchObject({ removed: 1, kept: 1, errors: 0 });
    expect(state.deletedRows).toEqual([asset(2).id]);
    expect(state.deletedKeys).not.toContain(asset(1).key);
    expect(state.deletedKeys).not.toContain(`variants/${asset(1).id}`);
  });

  it('purges an asset nothing uses, variants first, then the original', async () => {
    const result = await runMediaGcTick(logger, 0);
    expect(result.removed).toBe(2);
    expect(state.deletedKeys).toEqual([
      `variants/${asset(1).id}`,
      asset(1).key,
      `variants/${asset(2).id}`,
      asset(2).key,
    ]);
  });

  it('never selects on the unwritten usage_count column', async () => {
    await runMediaGcTick(logger, 0);
    expect(state.selects.join('\n')).not.toMatch(/AND\s+usage_count/);
  });
});
