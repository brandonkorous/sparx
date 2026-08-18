// Model B per-site visibility (docs/49 §3), for the catalog's back-office reads.
//
// A catalog item is visible on a site if it has NO scope rows (global — the
// default) OR a scope row for that site. Each fragment is wrapped in `AND` so it
// composes with a caller's existing top-level `OR` (text search, usually)
// without key-colliding — two `OR` keys in one Prisma `where` silently drops the
// first.
//
// These live together because the rule is one rule. It was previously written
// out inside product-service and simply absent from the collection and category
// services, which is exactly how a site ended up listing another site's
// collections while correctly hiding its products: three readers, one of them
// implementing the rule, and nothing making them agree.
//
// api-rest has its own copies for the storefront reads (lib/property.ts). They
// are deliberately not shared across that boundary — a service package importing
// from a service would invert the dependency — but they MUST stay in step, and a
// change to the predicate belongs in both.

import type { Prisma } from '@wizeworks/db';

export function productSiteVisibility(propertyId: string): Prisma.ProductWhereInput {
  return {
    AND: [{ OR: [{ propertyLinks: { none: {} } }, { propertyLinks: { some: { propertyId } } }] }],
  };
}

export function collectionSiteVisibility(propertyId: string): Prisma.ProductCollectionWhereInput {
  return {
    AND: [{ OR: [{ propertyLinks: { none: {} } }, { propertyLinks: { some: { propertyId } } }] }],
  };
}

export function categorySiteVisibility(propertyId: string): Prisma.ProductCategoryWhereInput {
  return {
    AND: [{ OR: [{ propertyLinks: { none: {} } }, { propertyLinks: { some: { propertyId } } }] }],
  };
}
