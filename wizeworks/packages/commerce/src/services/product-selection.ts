// Which products a bulk write acts on.
//
// The Products list narrows by search, status, kind of product and site. A bulk
// write that takes "everything that matches" has to narrow by EXACTLY the same
// rule, or "All 126 matching" on screen becomes 131 rows in the database. So the
// rule lives here once: `productListWhere` is what the list reads with and what
// every selection resolves through.

import {
  BULK_MATCH_LIMIT,
  BulkProductStatusBySelectionInput,
  ProductSelection,
  type ProductMatch,
  type ProductStatus,
} from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { Prisma, TxClient } from '@wizeworks/db';

import { CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { productSiteVisibility } from './site-visibility';
import { bulkUpdateStatus } from './product-service';

/** The narrowing fields `productListWhere` understands. `ListProductsFilter`
 *  is a superset of this, so the list passes itself straight in. */
export interface ProductNarrowing {
  status?: ProductStatus;
  categoryId?: string;
  collectionId?: string;
  vendor?: string;
  tag?: string;
  productType?: string;
  q?: string;
  hasFitment?: boolean;
  includeArchived?: boolean;
  includeDeleted?: boolean;
  propertyId?: string;
}

/**
 * What a typed search matches, word by word.
 *
 * Every word must be found SOMEWHERE on the product: its title, handle, brand,
 * kind, any version's code, or any entry it fits. As one phrase against the
 * title alone, "L5P" found the 19 parts with "L5P" in their names and none of
 * the parts set to fit the L5P; "6.7L Cummins" missed every title written
 * "Cummins 6.7L"; and a part number found nothing at all (sparx persona issue
 * 065, act 3: "searching L5P finds the parts that fit it").
 */
export function searchWhere(q: string | undefined): Prisma.ProductWhereInput {
  const words = (q ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 8);
  if (words.length === 0) return {};
  return {
    AND: words.map((word) => {
      const contains = { contains: word, mode: 'insensitive' as const };
      return {
        OR: [
          { title: contains },
          { handle: contains },
          { vendor: contains },
          { productType: contains },
          { variants: { some: { deletedAt: null, sku: contains } } },
          { fitments: { some: { node: { deletedAt: null, name: contains } } } },
        ],
      };
    }),
  };
}

/** The `where` the Products list reads with. Archived rows are hidden unless a
 *  status is named or `includeArchived` is set; deleted rows unless asked. */
export function productListWhere(filter: ProductNarrowing): Prisma.ProductWhereInput {
  const status: Prisma.ProductWhereInput['status'] =
    filter.status ?? (filter.includeArchived ? undefined : { not: 'archived' });

  return {
    ...(filter.includeDeleted ? {} : { deletedAt: null }),
    ...(status !== undefined ? { status } : {}),
    ...(filter.vendor ? { vendor: filter.vendor } : {}),
    ...(filter.productType ? { productType: filter.productType } : {}),
    ...(filter.tag ? { tags: { has: filter.tag } } : {}),
    ...(filter.categoryId ? { categoryLinks: { some: { categoryId: filter.categoryId } } } : {}),
    ...(filter.collectionId
      ? { collectionLinks: { some: { collectionId: filter.collectionId } } }
      : {}),
    ...(filter.hasFitment ? { fitments: { some: {} } } : {}),

    // The search and the site are both `AND` lists, so they are joined rather
    // than spread: spread, the site's list replaced the search's, and every
    // search on a scoped list returned the whole catalog.
    AND: [
      searchWhere(filter.q),
      // Model B: restrict to products visible on the active site (none = global).
      filter.propertyId ? productSiteVisibility(filter.propertyId) : {},
    ],
  };
}

/** A selection in the shape `productListWhere` reads. Deleted products are
 *  never acted on, whichever form the selection took. */
export function selectionWhere(selection: ProductSelection): Prisma.ProductWhereInput {
  if ('productIds' in selection) {
    return { id: { in: selection.productIds }, deletedAt: null };
  }
  const match: ProductMatch = selection.match;
  return productListWhere({ ...match, includeDeleted: false });
}

/**
 * The live products a selection names, oldest-listed first.
 *
 * `requested` is how many the caller asked about: the id count, or for a match
 * the number that matched. Ids that no longer name a live product are dropped
 * and counted by the caller as `requested - ids.length`.
 *
 * A match past `limit` is refused, not truncated: acting on the first 2,000 of
 * 2,400 and reporting success is the worst available answer.
 */
export async function resolveSelection(
  tx: TxClient,
  rawSelection: unknown,
  limit: number = BULK_MATCH_LIMIT
): Promise<{ ids: string[]; requested: number }> {
  const selection = ProductSelection.parse(rawSelection);
  const rows = await tx.product.findMany({
    where: selectionWhere(selection),
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: limit + 1,
  });
  if (rows.length > limit) {
    throw new CommerceValidationError(
      `That matches more than ${limit.toLocaleString('en-US')} products, which is more than one change can safely cover. Narrow the search or the filters and do it in parts.`
    );
  }
  const ids = rows.map((row) => row.id);
  const requested = 'productIds' in selection ? new Set(selection.productIds).size : ids.length;
  return { ids, requested };
}

/** The distinct kinds of product this catalog actually uses, for the list's
 *  filter. Unlike `getFacets` there is no platform baseline mixed in: a filter
 *  offering "Apparel" to a business with none of it only ever finds nothing. */
export async function productTypesInUse(
  ctx: ServiceContext,
  propertyId?: string
): Promise<{ name: string; count: number }[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.product.groupBy({
      by: ['productType'],
      where: {
        ...productListWhere({ includeArchived: true, ...(propertyId ? { propertyId } : {}) }),
        productType: { not: null },
      },
      _count: { _all: true },
    });
    return rows
      .filter((row): row is typeof row & { productType: string } => Boolean(row.productType))
      .map((row) => ({ name: row.productType, count: row._count._all }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

/**
 * Retire, or put on sale, every product a selection names.
 *
 * Only the products whose status would actually MOVE are written and counted:
 * "126 put on sale" when 100 were already on sale is a number nobody can trust.
 * Written through the ids-form write in batches, so its audit and events are
 * the same ones a ticked set produces.
 */
export async function updateStatusBySelection(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ updated: number; unchanged: number }> {
  const input = BulkProductStatusBySelectionInput.parse(rawInput);
  const { moving, requested } = await withTenant(ctx, async (tx) => {
    const resolved = await resolveSelection(tx, input.selection);
    const rows = await tx.product.findMany({
      where: { id: { in: resolved.ids }, status: { not: input.status } },
      select: { id: true },
    });
    return { moving: rows.map((row) => row.id), requested: resolved.requested };
  });

  // 250 at a time: the ids-form write audits each product in its own insert,
  // and a thousand of those is close to a transaction's five-second limit.
  let updated = 0;
  for (let at = 0; at < moving.length; at += 250) {
    const batch = moving.slice(at, at + 250);
    const result = await bulkUpdateStatus(ctx, { productIds: batch, status: input.status });
    updated += result.updated;
  }
  return { updated, unchanged: requested - updated };
}
