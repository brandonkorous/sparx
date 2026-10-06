import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A PICTURE COMES ACROSS ONCE, AND AS A COPY WHEN IT CAN (sparx persona issue 056).
 *
 * Gillett Diesel's first import linked 101 photos to Shopify (too big for the old
 * cap). A second run reused those links forever and called them copies. And a
 * picture was "already here" by file name alone, so two different "image.png"
 * photos would have shown the first one on both products.
 */
interface Asset {
  id: string;
  key: string;
  originalFilename: string;
  byteSize: number;
  deletedAt: Date | null;
}
interface Placement {
  id: string;
  productId: string;
  variantId: string | null;
  mediaAssetId: string;
}

let assets: Asset[] = [];
let placements: Placement[] = [];
const created: string[] = [];

const tx = {
  mediaAsset: {
    findFirst: vi.fn(
      (args: {
        where: {
          key?: string;
          originalFilename?: string;
          byteSize?: number;
          NOT?: { key: { startsWith: string } };
        };
      }) => {
        const w = args.where;
        const hit = assets.find(
          (a) =>
            a.deletedAt === null &&
            (w.key === undefined || a.key === w.key) &&
            (w.originalFilename === undefined || a.originalFilename === w.originalFilename) &&
            (w.byteSize === undefined || a.byteSize === w.byteSize) &&
            (w.NOT === undefined || !a.key.startsWith(w.NOT.key.startsWith))
        );
        return Promise.resolve(hit ? { id: hit.id } : null);
      }
    ),
    update: vi.fn((args: { where: { id: string }; data: { deletedAt: Date } }) => {
      const asset = assets.find((a) => a.id === args.where.id);
      if (asset) asset.deletedAt = args.data.deletedAt;
      return Promise.resolve({});
    }),
  },
  variantImage: {
    findMany: vi.fn((args: { where: { mediaAssetId: string } }) =>
      Promise.resolve(placements.filter((p) => p.mediaAssetId === args.where.mediaAssetId))
    ),
    findFirst: vi.fn(
      (args: { where: { productId: string; variantId: string | null; mediaAssetId: string } }) =>
        Promise.resolve(
          placements.find(
            (p) =>
              p.productId === args.where.productId &&
              p.variantId === args.where.variantId &&
              p.mediaAssetId === args.where.mediaAssetId
          ) ?? null
        )
    ),
    update: vi.fn((args: { where: { id: string }; data: { mediaAssetId: string } }) => {
      const placement = placements.find((p) => p.id === args.where.id);
      if (placement) placement.mediaAssetId = args.data.mediaAssetId;
      return Promise.resolve({});
    }),
    delete: vi.fn((args: { where: { id: string } }) => {
      placements = placements.filter((p) => p.id !== args.where.id);
      return Promise.resolve({});
    }),
  },
};

vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('@wizeworks/media', () => ({
  ALLOWED_IMAGE_MIME: new Set(['image/jpeg', 'image/png']),
  MAX_PROXIED_UPLOAD_BYTES: 20 * 1024 * 1024,
  createImageAssetFromBytes: vi.fn((_w: unknown, input: { filename: string; data: Buffer }) => {
    const id = `copy-${String(created.length + 1)}`;
    created.push(id);
    assets.push({
      id,
      key: `t/originals/${id}/${input.filename}`,
      originalFilename: input.filename,
      byteSize: input.data.length,
      deletedAt: null,
    });
    return Promise.resolve({ assetId: id });
  }),
  createImageAssetFromUrl: vi.fn((_w: unknown, input: { url: string; filename: string }) => {
    const id = `link-${String(created.length + 1)}`;
    created.push(id);
    assets.push({
      id,
      key: input.url,
      originalFilename: input.filename,
      byteSize: 0,
      deletedAt: null,
    });
    return Promise.resolve({ assetId: id });
  }),
}));

const { ingestImage, _forgetSeenImagesForTest } = await import('./images');

const CTX = { tenantId: '2e78fb6c-a823-4698-bcb9-58a4f17710a0' };

function serve(bytes: number | null): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        bytes === null
          ? new Response(null, { status: 404 })
          : new Response(new Uint8Array(bytes), {
              status: 200,
              headers: { 'content-type': 'image/jpeg', 'content-length': String(bytes) },
            })
      )
    )
  );
}

beforeEach(() => {
  assets = [];
  placements = [];
  created.length = 0;
  _forgetSeenImagesForTest();
});

describe('ingestImage', () => {
  it('replaces an earlier run’s link with the real copy on every product using it', async () => {
    const url = 'https://cdn.shopify.com/s/files/A7SABC509_1.png';
    assets.push({
      id: 'old-link',
      key: url,
      originalFilename: 'A7SABC509_1.png',
      byteSize: 0,
      deletedAt: null,
    });
    placements.push({ id: 'p1', productId: 'prod-1', variantId: null, mediaAssetId: 'old-link' });
    serve(400_000);

    const result = await ingestImage(CTX, url);

    expect(result.copied).toBe(true);
    expect(result.assetId).toMatch(/^copy-/);
    expect(placements).toEqual([
      { id: 'p1', productId: 'prod-1', variantId: null, mediaAssetId: result.assetId },
    ]);
    expect(assets.find((a) => a.id === 'old-link')?.deletedAt).not.toBeNull();
  });

  it('keeps the link, and says so, when the picture still cannot be fetched', async () => {
    const url = 'https://cdn.shopify.com/s/files/gone.png';
    assets.push({
      id: 'old-link',
      key: url,
      originalFilename: 'gone.png',
      byteSize: 0,
      deletedAt: null,
    });
    serve(null);

    const result = await ingestImage(CTX, url);

    expect(result).toMatchObject({ assetId: 'old-link', copied: false, reused: true });
    expect(created).toEqual([]);
  });

  it('does not mistake a different picture with the same name for this one', async () => {
    assets.push({
      id: 'other',
      key: 't/originals/other/image.png',
      originalFilename: 'image.png',
      byteSize: 1234,
      deletedAt: null,
    });
    serve(5678);

    const result = await ingestImage(CTX, 'https://cdn.shopify.com/s/files/b/image.png');

    expect(result.assetId).not.toBe('other');
    expect(result.reused).toBe(false);
  });

  it('reuses the copy it already made of the same picture', async () => {
    serve(5678);
    const first = await ingestImage(CTX, 'https://cdn.shopify.com/s/files/a/pump.jpg');
    _forgetSeenImagesForTest();
    const second = await ingestImage(CTX, 'https://cdn.shopify.com/s/files/a/pump.jpg');

    expect(second).toMatchObject({ assetId: first.assetId, reused: true, copied: true });
    expect(created).toHaveLength(1);
  });
});
