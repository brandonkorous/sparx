// Acting on many products at once by WHICH products, not only by a list of ids.
//
// A list pane shows fifty rows. An owner who searched "Fuel System" and wants to
// file all 126 of them is choosing a RESULT, not fifty ticks, so a bulk write
// accepts either explicit ids or the same narrowing the list used. The server
// resolves the narrowing itself, at the moment of the write, inside the write's
// transaction: the client never has to page through 126 rows to learn their ids.
//
// The site a list is scoped to is NOT the client's to say here. The route sets
// `match.propertyId` from the caller's working site, exactly as the list read
// does, so "all that match" can never reach products another site's list would
// not have shown.

import { z } from 'zod';

import { Uuid } from '@wizeworks/crm-schemas';

import { ProductStatus } from './common';
import { ProductFitmentInput } from './fitment';

/** The most products one "everything that matches" write may touch. Past this the
 *  server refuses with a sentence asking for a narrower search, rather than
 *  running a write nobody can check the size of. */
export const BULK_MATCH_LIMIT = 2000;

/** The same narrowing `GET /v1/commerce/products` applies. */
export const ProductMatch = z.object({
  q: z.string().trim().max(255).optional(),
  status: ProductStatus.optional(),
  includeArchived: z.boolean().optional(),
  productType: z.string().trim().min(1).max(255).optional(),
  /** Set by the route from the caller's working site, never trusted from a
   *  console body. MCP callers may name one; omitted means the whole catalog. */
  propertyId: Uuid.optional(),
});
export type ProductMatch = z.infer<typeof ProductMatch>;

export const ProductSelection = z.union([
  z.object({ productIds: z.array(Uuid).min(1).max(BULK_MATCH_LIMIT) }).strict(),
  z.object({ match: ProductMatch }).strict(),
]);
export type ProductSelection = z.infer<typeof ProductSelection>;

/** Put every chosen product in one category, or take them all out of it. */
export const BulkProductCategoryInput = z.object({
  categoryId: Uuid,
  selection: ProductSelection,
});
export type BulkProductCategoryInput = z.infer<typeof BulkProductCategoryInput>;

/**
 * ADD fitment rules to every chosen product. Additive: a product keeps every
 * rule it already had, and a rule it already has (same list, same entry, same
 * windows) is skipped rather than written twice. Contrast `BulkAssignFitmentInput`,
 * which REPLACES each product's rules and exists for importers.
 */
export const BulkAddFitmentInput = z.object({
  selection: ProductSelection,
  fitments: z
    .array(ProductFitmentInput.omit({ productId: true }))
    .min(1)
    .max(100),
});
export type BulkAddFitmentInput = z.infer<typeof BulkAddFitmentInput>;

/**
 * Take rules off every chosen product: each one targeting exactly one of these
 * entries in this list, whatever years it was narrowed to. `null` in `nodeIds`
 * names the "fits everything in this list" rule. Rules at a more specific entry
 * underneath one of these are kept.
 */
export const BulkRemoveFitmentInput = z.object({
  selection: ProductSelection,
  domainId: z.guid(),
  nodeIds: z.array(z.guid().nullable()).min(1).max(100),
});
export type BulkRemoveFitmentInput = z.infer<typeof BulkRemoveFitmentInput>;

/** Retire / put on sale by selection. The ids form is `BulkUpdateProductStatusInput`. */
export const BulkProductStatusBySelectionInput = z.object({
  selection: ProductSelection,
  status: ProductStatus,
});
export type BulkProductStatusBySelectionInput = z.infer<typeof BulkProductStatusBySelectionInput>;
