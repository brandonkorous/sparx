import { describe, expect, it } from 'vitest';

import { variantKey, variantUrlPath } from './storage.js';

// The variant serving route is /v1/public/media/variants/:tenantId/:assetId/:filename
// (routes/v1/public/media.ts) — THREE path segments — and it re-derives the storage
// key with variantKey(). The stored key, however, is FOUR segments
// (`<tenantId>/variants/<assetId>/<filename>`): its middle `variants/` is the bucket
// convention, not part of the URL. If the URL carries that middle segment the route
// never matches, the request hangs, and Cloudflare returns 503 — every uploaded image
// then previews broken (the bug these tests lock out).

// The route's own filename regex (media.ts): <format>-[<aspect>-]<width>.<ext>
const FILENAME_RE = /^([a-z0-9]+)-(?:(\d+x\d+)-)?(\d+)\.([a-z0-9]+)$/;

describe('variantUrlPath', () => {
  it('drops the middle `variants/` so the URL is three segments', () => {
    const key = variantKey('tenant-1', 'asset-9', 'avif', 400, 'avif');
    expect(key).toBe('tenant-1/variants/asset-9/avif-400.avif');
    // The path the URL carries after /v1/public/media/variants/.
    expect(variantUrlPath(key)).toBe('tenant-1/asset-9/avif-400.avif');
    expect(variantUrlPath(key).split('/')).toHaveLength(3);
  });

  it('round-trips: URL path → route params → variantKey reproduces the stored key', () => {
    // Both plain scale-to-width and a social-crop aspect must survive the trip.
    const cases = [
      variantKey('t-abc', 'a-123', 'webp', 1080, 'webp'),
      variantKey('t-abc', 'a-123', 'avif', 400, 'avif', '9:16'),
      variantKey('11111111-2222-3333-4444-555555555555', 'aaaa-bbbb', 'jpeg', 800, 'jpg'),
    ];
    for (const original of cases) {
      const [tenantId, assetId, filename] = variantUrlPath(original).split('/');
      // The route parses exactly these three params — nothing left over.
      expect(tenantId && assetId && filename).toBeTruthy();
      const m = FILENAME_RE.exec(filename!);
      expect(m).not.toBeNull();
      const [, format, aspect, width, ext] = m!;
      // Re-derive the key the handler will read from storage.
      const rederived = variantKey(
        tenantId!,
        assetId!,
        format!,
        Number(width),
        ext!,
        aspect ? aspect.replace('x', ':') : undefined
      );
      expect(rederived).toBe(original);
    }
  });

  it('only strips the FIRST `variants/` (a filename can never contain it, but be exact)', () => {
    // The middle segment is the only `/variants/`; the transform must not touch a
    // tenant/asset id that happens to embed the word.
    expect(variantUrlPath('t/variants/a/webp-100.webp')).toBe('t/a/webp-100.webp');
  });
});
