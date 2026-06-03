// Content hash for the per-tenant stylesheet filename (docs/47 §5.2).
//
// Publish is made atomic by writing a content-HASHED tenant.css, then flipping
// the published pointer — so a page never paints before its CSS exists. The hash
// is derived from the compiled CSS, so identical output reuses the same file and
// changed output gets a fresh, cache-bustable name.

import { createHash } from 'node:crypto';

/** Short, stable hex hash of the compiled CSS (default 16 chars of sha-256). */
export function contentHash(css: string, length = 16): string {
  return createHash('sha256').update(css).digest('hex').slice(0, length);
}
