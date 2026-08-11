// Model B per-site scoping (docs/49 §3) — "is this row visible on THAT site?"
//
// A product, content entry or media asset belongs to the TENANT, but a tenant can own
// several unrelated businesses (Bob's Parts and Savory Donuts under one login). These
// fragments are the single answer to which of them a given site may show.
//
// WHY THEY LIVE IN @sparx/db RATHER THAN IN A SERVICE. They started in api-rest's
// `lib/property.ts`, which made them reachable only from routes — so the moment anything
// else needed the same question answered (the builder resolving a sample record for a
// record page's preview), the choice was to import across a service boundary or to
// re-type the filter. A re-typed visibility filter is the failure mode worth designing
// against: two spellings drift, and the one that drifts is showing another site's rows.
// They are pure `where` fragments over Prisma types with no client of their own, so the
// data package is the honest floor. `api-rest/lib/property.ts` re-exports them, so every
// existing call site is unchanged.
//
// THE RULE, in one line: a row is visible on a site when it is scoped to NO site (global —
// the default, and what a single-site tenant always has) or scoped to THAT site.
//
// Returned wrapped in `AND` so the inner `OR` composes with whatever `OR` the caller
// already has at the top level (a text search, most often) instead of key-colliding with
// it and silently replacing it.

import type { Prisma } from '@prisma/client';

/** Product visibility `where` fragment for the active site. */
export function productSiteVisibilityWhere(propertyId: string): Prisma.ProductWhereInput {
  return {
    AND: [{ OR: [{ propertyLinks: { none: {} } }, { propertyLinks: { some: { propertyId } } }] }],
  };
}

/** Content-entry visibility `where` fragment for the active site. */
export function contentSiteVisibilityWhere(propertyId: string): Prisma.ContentEntryWhereInput {
  return {
    AND: [{ OR: [{ propertyLinks: { none: {} } }, { propertyLinks: { some: { propertyId } } }] }],
  };
}

/** Collection visibility `where` fragment for the active site — the same "unscoped = all
 *  sites, scoped = only those" rule products use, so a collection pinned to one site
 *  never surfaces on another. */
export function collectionSiteVisibilityWhere(
  propertyId: string
): Prisma.ProductCollectionWhereInput {
  return {
    AND: [{ OR: [{ propertyLinks: { none: {} } }, { propertyLinks: { some: { propertyId } } }] }],
  };
}

/** Category visibility `where` fragment for the active site. */
export function categorySiteVisibilityWhere(propertyId: string): Prisma.ProductCategoryWhereInput {
  return {
    AND: [{ OR: [{ propertyLinks: { none: {} } }, { propertyLinks: { some: { propertyId } } }] }],
  };
}

/** Media-library visibility `where` fragment for the active site.
 *
 *  Media is the odd one out: it carries a DIRECT nullable `property_id` (like
 *  SocialConnection) rather than the many-to-many `propertyLinks` products and content
 *  use — an asset belongs to ONE site or is shared tenant-wide. So the question is "this
 *  site OR shared (NULL)": a site sees its own uploads plus every shared asset, never
 *  another site's exclusive media. Same `AND` wrapper, same reason. */
export function mediaSiteVisibilityWhere(propertyId: string): Prisma.MediaAssetWhereInput {
  return { AND: [{ OR: [{ propertyId }, { propertyId: null }] }] };
}
