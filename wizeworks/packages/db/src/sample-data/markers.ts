// Sample-data markers — the marker-free identification scheme (Wave 5).
//
// "Marker-free" = no schema change. Every row a pack creates is identifiable for
// Clear by one of:
//   - a `sample-` HANDLE/SLUG prefix (products, collections, categories, content),
//   - `metadata.sample = true` on rows that already carry a metadata JSON column
//     (customers, orders, quotes, deals, variants, products),
//   - `source = 'sample'` on inventory movements (append-only ledger),
//   - `settings.sample = true` on scheduling services/resources,
//   - parent-linkage for child rows that have none of the above (returns hang off
//     a sample order; bookings off a sample service; PO lines off a sample PO).
//
// Clear walks the FK graph parent-first so cascades remove children: carts →
// orders (→ items/payments/returns) → quotes/deals → bookings → content → products
// (→ variants/levels/movements/lots) → suppliers → customers. The two RESTRICT
// edges (CartItem→Variant, Order→Customer) are why carts clear before products and
// orders clear before customers.

import type { Prisma } from '@prisma/client';

/** Prefix on product / collection / category handles. */
export const SAMPLE_HANDLE_PREFIX = 'sample-';

/** Prefix on content-entry slugs (blog posts, articles). */
export const SAMPLE_SLUG_PREFIX = 'sample-';

/** Prefix on supplier codes. */
export const SAMPLE_SUPPLIER_PREFIX = 'SMP-';

/** Order / PO number prefixes — distinct from a tenant's own SO-/PO- series. */
export const SAMPLE_ORDER_PREFIX = 'SO-9';
export const SAMPLE_PO_PREFIX = 'PO-9';

/** The email domain every sample persona/customer is rewritten onto. A real
 *  customer would never use it, so `email LIKE '%@sample.example'` is a safe
 *  fallback identifier even though customers also carry `metadata.sample`. */
export const SAMPLE_EMAIL_DOMAIN = 'sample.example';

/** The `metadata.sample` marker stamped on metadata-bearing rows. */
export const SAMPLE_META = { sample: true } as const;

/** The `source` value on sample inventory movements. */
export const SAMPLE_MOVEMENT_SOURCE = 'sample';

/** The `settings.sample` marker on scheduling services/resources. */
export const SAMPLE_SETTINGS = { sample: true } as const;

/** Prefix on the `original_filename` of every MediaAsset a pack creates, so Clear
 *  finds sample imagery (MediaAsset carries no metadata column, and VariantImage
 *  has no FK back to it — the filename prefix is the only handle). */
export const SAMPLE_MEDIA_FILENAME_PREFIX = 'sample-';

/** Rewrite a persona email onto the sample domain (keeps the local-part). */
export function sampleEmail(email: string): string {
  const local = email.includes('@') ? email.slice(0, email.indexOf('@')) : email;
  return `${local}@${SAMPLE_EMAIL_DOMAIN}`;
}

/** Prefix a handle/slug once (idempotent — won't double-prefix). */
export function sampleHandle(handle: string): string {
  return handle.startsWith(SAMPLE_HANDLE_PREFIX) ? handle : `${SAMPLE_HANDLE_PREFIX}${handle}`;
}

/**
 * Does this row's `metadata` carry the sample marker?
 *
 * The read side of `withSampleMeta`. It lives here rather than beside any one
 * serializer because the marker vocabulary is this file's job, and a second
 * hand-rolled `metadata.sample === true` check is how the write side and the
 * read side drift apart.
 */
export function isSampleRow(metadata: unknown): boolean {
  return (
    !!metadata &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>).sample === true
  );
}

/** A `metadata.sample = true`-bearing JSON object, merging any extra keys. Typed
 *  as a Prisma JSON object so it drops straight into a `metadata` column. */
export function withSampleMeta(extra?: Record<string, unknown>): Prisma.InputJsonObject {
  return { ...(extra ?? {}), sample: true };
}
