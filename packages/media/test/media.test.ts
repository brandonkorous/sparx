// Unit tests for @sparx/media. The security-relevant REJECTIONS (mime allowlist,
// byte cap, scheme pin, ref length) all throw BEFORE any DB/storage call, so they
// need no live DB. The happy paths inject a fake storage (_setStorageForTest) and
// mock @sparx/db + @sparx/events so we can assert the object write + the
// media.uploaded fan-out without a Postgres/Prisma client.

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// ── Mocks (hoisted) ─────────────────────────────────────────────────────────

// vi.hoisted so the vi.mock factories (themselves hoisted above the imports) can
// reference this shared state without a TDZ error.
const { created, publishEventMock } = vi.hoisted(() => ({
  created: { rows: [] as { id: string; data: Record<string, unknown> }[] },
  publishEventMock: vi.fn(),
}));

vi.mock('@sparx/db', () => {
  const tx = {
    mediaAsset: {
      create: vi.fn(({ data, select }: { data: Record<string, unknown>; select?: unknown }) => {
        void select;
        const id = `asset-${created.rows.length + 1}`;
        created.rows.push({ id, data });
        return { id, ...data };
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = created.rows.find((r) => r.id === where.id);
        if (row) Object.assign(row.data, data);
        return { id: where.id, ...(row?.data ?? {}) };
      }),
    },
  };
  return {
    withTenant: (_ctx: unknown, fn: (t: typeof tx) => unknown) => fn(tx),
    prisma: { tenant: { findUnique: () => ({ slug: 'acme' }) } },
  };
});

vi.mock('@sparx/events', () => ({
  createPublisher: () => ({ publish: vi.fn() }),
  publishEvent: (...args: unknown[]) => {
    publishEventMock(...args);
    return Promise.resolve();
  },
}));

import {
  ALLOWED_IMAGE_MIME,
  MAX_UPLOAD_IMAGE_BYTES,
  MediaValidationError,
  createImageAssetFromBytes,
  createImageAssetFromUrl,
} from '../src/asset-service';
import { _setStorageForTest, type MediaStorage } from '../src/storage';
import { mediaMcpTools } from '../src/mcp/tools';

const CTX = { tenantId: 'tenant-1', actorId: 'user-1', tenantSlug: 'acme' };

let writeObject: Mock<MediaStorage['writeObject']>;

beforeEach(() => {
  created.rows = [];
  publishEventMock.mockClear();
  writeObject = vi.fn<MediaStorage['writeObject']>(() => Promise.resolve({ url: '' }));
  const fake: MediaStorage = { mode: 'gcs', writeObject, publicUrl: (k) => `/cdn/${k}` };
  _setStorageForTest(fake);
});

afterEach(() => {
  _setStorageForTest(null);
});

// ── Byte upload — security rejections (no DB touched) ────────────────────────

describe('createImageAssetFromBytes — rejections', () => {
  it('rejects a disallowed mime type before any write', async () => {
    await expect(
      createImageAssetFromBytes(CTX, {
        data: Buffer.from('x'),
        mimeType: 'image/tiff',
        filename: 'a.tiff',
      })
    ).rejects.toBeInstanceOf(MediaValidationError);
    expect(writeObject).not.toHaveBeenCalled();
    expect(created.rows).toHaveLength(0);
  });

  it('rejects an executable / non-image mime', async () => {
    await expect(
      createImageAssetFromBytes(CTX, {
        data: Buffer.from('x'),
        mimeType: 'application/pdf',
        filename: 'a.pdf',
      })
    ).rejects.toBeInstanceOf(MediaValidationError);
  });

  it('rejects an empty image', async () => {
    await expect(
      createImageAssetFromBytes(CTX, {
        data: Buffer.alloc(0),
        mimeType: 'image/png',
        filename: 'a.png',
      })
    ).rejects.toBeInstanceOf(MediaValidationError);
  });

  it('rejects bytes over the cap before any write', async () => {
    await expect(
      createImageAssetFromBytes(CTX, {
        data: Buffer.alloc(MAX_UPLOAD_IMAGE_BYTES + 1),
        mimeType: 'image/png',
        filename: 'big.png',
      })
    ).rejects.toBeInstanceOf(MediaValidationError);
    expect(writeObject).not.toHaveBeenCalled();
  });
});

// ── Byte upload — happy path ────────────────────────────────────────────────

describe('createImageAssetFromBytes — happy path', () => {
  it('writes the original under the tenant/originals/<id> key and fans out media.uploaded', async () => {
    const result = await createImageAssetFromBytes(CTX, {
      data: Buffer.from('PNGDATA'),
      mimeType: 'image/png',
      filename: 'hero.png',
      alt: 'Hero',
      width: 1200,
      height: 800,
    });

    expect(writeObject).toHaveBeenCalledTimes(1);
    const [key, ct] = writeObject.mock.calls[0]!;
    expect(key).toBe('tenant-1/originals/asset-1/hero.png');
    expect(ct).toBe('image/png');

    // gcs mode → stays 'uploading' until the worker transcodes.
    expect(result.status).toBe('uploading');
    expect(result.assetId).toBe('asset-1');
    expect(result.url).toBe('/v1/public/media/asset-1?tenant=acme');

    // The row carried the intrinsic dimensions + alt.
    const row = created.rows[0]!.data;
    expect(row.width).toBe(1200);
    expect(row.altText).toBe('Hero');

    // media.uploaded published with the finalised key + byte size (as string).
    expect(publishEventMock).toHaveBeenCalledTimes(1);
    const args = publishEventMock.mock.calls[0]!;
    expect(args[1]).toBe('media.uploaded');
    expect(args[4]).toMatchObject({
      assetId: 'asset-1',
      key: 'tenant-1/originals/asset-1/hero.png',
      mimeType: 'image/png',
      byteSize: '7',
    });
  });
});

// ── URL reference — scheme pin (the SSRF/XSS guard) ─────────────────────────

describe('createImageAssetFromUrl — scheme pin', () => {
  it.each([
    'data:text/html,<script>alert(1)</script>',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'ftp://example.com/x.png',
  ])('refuses non-(http|data:image) scheme: %s', async (url) => {
    await expect(createImageAssetFromUrl(CTX, { url })).rejects.toBeInstanceOf(
      MediaValidationError
    );
    expect(created.rows).toHaveLength(0);
  });

  it('refuses a data: URI longer than the key column', async () => {
    const huge = `data:image/png;base64,${'A'.repeat(1100)}`;
    await expect(createImageAssetFromUrl(CTX, { url: huge })).rejects.toBeInstanceOf(
      MediaValidationError
    );
  });

  it('accepts an https URL and stores it verbatim as the key (no server fetch)', async () => {
    const result = await createImageAssetFromUrl(CTX, {
      url: 'https://cdn.example.com/logo.svg',
      alt: 'Logo',
    });
    expect(result.status).toBe('ready');
    expect(result.url).toBe('/v1/public/media/asset-1?tenant=acme');
    const row = created.rows[0]!.data;
    expect(row.key).toBe('https://cdn.example.com/logo.svg');
    expect(row.mimeType).toBe('image/svg+xml'); // inferred from extension
    expect(row.byteSize).toBe(0n);
    // No bytes ever written — the browser fetches the external URL.
    expect(writeObject).not.toHaveBeenCalled();
  });

  it('accepts a small data:image/ URI', async () => {
    const svg = 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E';
    const result = await createImageAssetFromUrl(CTX, { url: svg });
    expect(result.status).toBe('ready');
    expect(created.rows[0]!.data.key).toBe(svg);
    expect(created.rows[0]!.data.mimeType).toBe('image/svg+xml');
  });
});

// ── MCP surface ─────────────────────────────────────────────────────────────

describe('mediaMcpTools', () => {
  it('exposes the media tools as write:builder; creates un-gated, delete confirmation-gated', () => {
    const byName = new Map(mediaMcpTools.map((t) => [t.name, t]));
    expect([...byName.keys()].sort()).toEqual([
      'create_image_upload',
      'delete_image',
      'set_image_from_url',
      'upload_image',
    ]);
    for (const t of mediaMcpTools) expect(t.scope).toBe('write:builder');
    // Destructive delete is confirmation-gated; the create/reference tools are not.
    expect(byName.get('delete_image')!.confirmation).toBe(true);
    for (const name of ['upload_image', 'create_image_upload', 'set_image_from_url']) {
      expect(byName.get(name)!.confirmation).toBe(false);
    }
  });

  it('upload_image input requires data/mimeType/filename', () => {
    const tool = mediaMcpTools.find((t) => t.name === 'upload_image')!;
    expect(tool.input.safeParse({}).success).toBe(false);
    expect(
      tool.input.safeParse({ data: 'AAAA', mimeType: 'image/png', filename: 'a.png' }).success
    ).toBe(true);
  });

  it('set_image_from_url caps the reference at 1024 chars', () => {
    const tool = mediaMcpTools.find((t) => t.name === 'set_image_from_url')!;
    expect(tool.input.safeParse({ url: 'x'.repeat(1025) }).success).toBe(false);
    expect(tool.input.safeParse({ url: 'https://x.com/a.png' }).success).toBe(true);
  });

  it('ALLOWED_IMAGE_MIME is images-only (no video/audio/pdf)', () => {
    for (const m of ALLOWED_IMAGE_MIME) expect(m.startsWith('image/')).toBe(true);
  });
});
