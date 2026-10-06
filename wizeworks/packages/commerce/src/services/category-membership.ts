// Putting many products in a category, or taking them out, in one write.
//
// `setProductCategories` REPLACES one product's filing, which is right for the
// product's own Filing tab and wrong for "put these 126 fuel parts in Fuel
// System": a replace would pull each of them out of every other category they
// were in. So these ADD and REMOVE one link per product and leave the rest
// alone. Adding is idempotent (a product already filed there is counted, not
// written twice) and removing a product's MAIN category hands that role to the
// next one it is in, so no product is left filed with no main category.

import { BulkProductCategoryInput } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import { writeAuditLogs } from '../audit';
import { CommerceNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';
import { resolveSelection } from './product-selection';

/** One product's filing in one category, as stored. */
export interface CategoryLink {
  productId: string;
  categoryId: string;
  isPrimary: boolean;
  position: number;
}

/** Same as `withTenant`'s default for a request, raised for a write that can
 *  cover two thousand products. */
const BULK_TIMEOUT_MS = 60_000;

function linksByProduct(links: readonly CategoryLink[]): Map<string, CategoryLink[]> {
  const map = new Map<string, CategoryLink[]>();
  for (const link of links) {
    const list = map.get(link.productId);
    if (list) list.push(link);
    else map.set(link.productId, [link]);
  }
  return map;
}

/**
 * The links to insert so every product is in `categoryId`. A product already
 * there gets nothing. A product with no category at all gets this as its main
 * one; otherwise it goes after the ones it already has.
 */
export function planCategoryAdds(
  existing: readonly CategoryLink[],
  productIds: readonly string[],
  categoryId: string
): CategoryLink[] {
  const byProduct = linksByProduct(existing);
  const out: CategoryLink[] = [];
  for (const productId of new Set(productIds)) {
    const links = byProduct.get(productId) ?? [];
    if (links.some((link) => link.categoryId === categoryId)) continue;
    const position = links.reduce((max, link) => Math.max(max, link.position + 1), 0);
    out.push({ productId, categoryId, isPrimary: links.length === 0, position });
  }
  return out;
}

/**
 * Which products leave `categoryId`, and which of their remaining links becomes
 * the main one because the link leaving WAS the main one. The successor is the
 * earliest remaining by position, which is how the Filing tab orders them.
 */
export function planCategoryRemovals(
  existing: readonly CategoryLink[],
  productIds: readonly string[],
  categoryId: string
): { leaving: string[]; promote: CategoryLink[] } {
  const byProduct = linksByProduct(existing);
  const leaving: string[] = [];
  const promote: CategoryLink[] = [];
  for (const productId of new Set(productIds)) {
    const links = byProduct.get(productId) ?? [];
    const here = links.find((link) => link.categoryId === categoryId);
    if (!here) continue;
    leaving.push(productId);
    if (!here.isPrimary) continue;
    const next = links
      .filter((link) => link.categoryId !== categoryId)
      .sort((a, b) => a.position - b.position)[0];
    if (next) promote.push(next);
  }
  return { leaving, promote };
}

async function requireCategory(tx: TxClient, categoryId: string): Promise<{ name: string }> {
  const category = await tx.productCategory.findFirst({
    where: { id: categoryId, deletedAt: null },
    select: { name: true },
  });
  if (!category) throw new CommerceNotFoundError('Category', categoryId);
  return category;
}

async function announce(ctx: ServiceContext, productIds: readonly string[]): Promise<void> {
  await Promise.all(
    productIds.map((productId) =>
      publishCommerceEvent({
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        topic: 'product.updated',
        data: { productId, change: 'categories' },
      })
    )
  );
}

function auditRows(ctx: ServiceContext, action: string, productIds: string[], categoryId: string) {
  return productIds.map((productId) => ({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? ('user' as const) : ('system' as const),
    action,
    entityType: 'Product',
    entityId: productId,
    diff: { after: { categoryId } },
  }));
}

export interface CategoryBulkResult {
  /** Products this write actually moved. */
  changed: number;
  /** Chosen products that were already in (for add) or not in (for remove). */
  unchanged: number;
  /** Ids that no longer name a live product: deleted since they were chosen. */
  skipped: number;
  categoryName: string;
}

/** Put every product a selection names into one category. Never removes any
 *  other filing. */
export async function addProductsToCategory(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<CategoryBulkResult> {
  const input = BulkProductCategoryInput.parse(rawInput);

  const result = await withTenant(
    ctx,
    async (tx) => {
      const category = await requireCategory(tx, input.categoryId);
      const { ids, requested } = await resolveSelection(tx, input.selection);
      const existing = await tx.categoryProduct.findMany({
        where: { productId: { in: ids } },
        select: { productId: true, categoryId: true, isPrimary: true, position: true },
      });
      const rows = planCategoryAdds(existing, ids, input.categoryId);
      if (rows.length > 0) {
        // skipDuplicates: a link written by someone else between the read and
        // this insert is the same link, not a failure.
        await tx.categoryProduct.createMany({ data: rows, skipDuplicates: true });
      }
      const added = rows.map((row) => row.productId);
      await writeAuditLogs(
        tx,
        auditRows(ctx, 'commerce.product.category_added', added, input.categoryId)
      );
      return { added, total: ids.length, requested, categoryName: category.name };
    },
    undefined,
    { timeoutMs: BULK_TIMEOUT_MS }
  );

  await announce(ctx, result.added);
  return {
    changed: result.added.length,
    unchanged: result.total - result.added.length,
    skipped: result.requested - result.total,
    categoryName: result.categoryName,
  };
}

/** Take every product a selection names out of one category. Every other
 *  filing is kept, and a product losing its main category gets the next one. */
export async function removeProductsFromCategory(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<CategoryBulkResult> {
  const input = BulkProductCategoryInput.parse(rawInput);

  const result = await withTenant(
    ctx,
    async (tx) => {
      const category = await requireCategory(tx, input.categoryId);
      const { ids, requested } = await resolveSelection(tx, input.selection);
      const existing = await tx.categoryProduct.findMany({
        where: { productId: { in: ids } },
        select: { productId: true, categoryId: true, isPrimary: true, position: true },
      });
      const { leaving, promote } = planCategoryRemovals(existing, ids, input.categoryId);
      if (leaving.length > 0) {
        await tx.categoryProduct.deleteMany({
          where: { categoryId: input.categoryId, productId: { in: leaving } },
        });
      }
      for (const link of promote) {
        await tx.categoryProduct.update({
          where: {
            categoryId_productId: { categoryId: link.categoryId, productId: link.productId },
          },
          data: { isPrimary: true },
        });
      }
      await writeAuditLogs(
        tx,
        auditRows(ctx, 'commerce.product.category_removed', leaving, input.categoryId)
      );
      return { leaving, total: ids.length, requested, categoryName: category.name };
    },
    undefined,
    { timeoutMs: BULK_TIMEOUT_MS }
  );

  await announce(ctx, result.leaving);
  return {
    changed: result.leaving.length,
    unchanged: result.total - result.leaving.length,
    skipped: result.requested - result.total,
    categoryName: result.categoryName,
  };
}
