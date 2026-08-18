// The marketplace browse contract (docs/60 §6) — the shared query params + the
// faceted list response. Category-specific FACET params (vertical, modules,
// industry, …) are not enumerated here: each adapter declares its facet keys and
// the service parses them generically from the raw query string (comma-separated,
// OR within a key / AND across keys). This keeps the contract stable as
// categories add facets (D4/M3).

import { z } from 'zod';

import type { MarketplaceListing } from './listing';

/** Sort options every category supports. `popular` = sortWeight then installs;
 *  `newest` = publishedAt; `name` = A→Z; price sorts use price_cents. */
export const MarketplaceSort = z.enum(['popular', 'newest', 'name', 'price_low', 'price_high']);
export type MarketplaceSort = z.infer<typeof MarketplaceSort>;

/** The shared (category-agnostic) browse params. Cursor is a numeric offset
 *  encoded as a string in the response (`next_cursor`) — opaque to clients. */
export const MarketplaceBrowseQuery = z.object({
  q: z.string().trim().max(120).optional(),
  sort: MarketplaceSort.default('popular'),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});
export type MarketplaceBrowseQuery = z.infer<typeof MarketplaceBrowseQuery>;

/** A facet bucket: value → count, computed over the q-narrowed set with the
 *  other facets applied (standard faceted search). */
export type MarketplaceFacetBucket = Record<string, number>;

/** The faceted, paged catalog response — identical across categories and across
 *  the SQL adapter today / a Typesense adapter later (docs/60 §6, Phase 6). */
export interface MarketplaceListResponse {
  items: MarketplaceListing[];
  total: number;
  /** facetKey → (value → count). The set of keys is category-specific. */
  facets: Record<string, MarketplaceFacetBucket>;
  next_cursor: string | null;
}
