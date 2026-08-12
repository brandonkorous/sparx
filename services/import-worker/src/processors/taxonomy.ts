// Categories and collections — the shelves a catalogue sits on.
//
// Both live here because they are the same job with a different noun: a name, an
// optional parent or membership list, and a handle that has to be unique. Splitting
// them into two files would mean two copies of the handle-collision logic, which is
// the only part with any subtlety in it.
//
// Categories are hierarchical and are imported in DEPTH ORDER, because a child cannot
// name a parent that does not exist yet and every export writes them in whatever
// order the database happened to return. Sorting by depth first is what turns
// "Home > Shirts > Tees" into a real tree instead of three orphans.

import { categoryService, collectionService } from '@sparx/commerce';
import { withTenant } from '@sparx/db';
import { toList, toSlug } from '@sparx/migration';

import { Resolver } from './resolve';
import {
  eachRow,
  type EntityProcessor,
  type ImportRow,
  type PreviewResult,
  type ProcessorContext,
  type RowResult,
} from './types';

/** A free handle for `name`, avoiding anything already taken. */
async function freeHandle(
  ctx: ProcessorContext,
  table: 'category' | 'collection',
  desired: string
): Promise<string> {
  const base = toSlug(desired).slice(0, 100) || 'group';
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await withTenant(ctx, (tx) =>
      table === 'category'
        ? tx.productCategory.findFirst({
            where: { tenantId: ctx.tenantId, handle: candidate },
            select: { id: true },
          })
        : tx.productCollection.findFirst({
            where: { tenantId: ctx.tenantId, handle: candidate },
            select: { id: true },
          })
    );
    if (taken === null) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** How deep in the tree a row sits, so parents are created before children. */
function depthOf(row: ImportRow): number {
  const parent = (row.parent ?? '').trim();
  return parent === '' ? 0 : parent.split('>').length;
}

export const categoriesProcessor: EntityProcessor = {
  entity: 'categories',
  module: 'commerce',

  async run(ctx, rows, options, logger) {
    const resolver = new Resolver(ctx);
    // Index carried alongside so the results still line up with the file the tenant
    // is looking at after the depth sort.
    const ordered = rows
      .map((row, rowIndex) => ({ row, rowIndex }))
      .sort((a, b) => depthOf(a.row) - depthOf(b.row));

    const results: RowResult[] = [];
    for (const { row, rowIndex } of ordered) {
      try {
        const name = (row.name ?? '').trim();
        if (name === '') {
          results.push({ rowIndex, status: 'error', errorMsg: 'This row has no category name.' });
          continue;
        }

        const existingId = await resolver.categoryByName(name);
        if (existingId !== null && !options.upsert) {
          results.push({ rowIndex, status: 'skipped', naturalKey: name });
          continue;
        }

        // The parent cell is a name on some platforms and a path on others; the last
        // segment is the immediate parent either way.
        const parentName = (row.parent ?? '').split('>').pop()?.trim() ?? '';
        const parentId = parentName === '' ? null : await resolver.categoryByName(parentName);

        const input = {
          name: name.slice(0, 127),
          ...(row.description !== undefined && row.description !== ''
            ? { description: row.description.slice(0, 10_000) }
            : {}),
          ...(parentId === null ? {} : { parentId }),
        };

        if (existingId !== null) {
          await categoryService.update(ctx, existingId, input);
          results.push({ rowIndex, status: 'updated', naturalKey: name });
          continue;
        }

        const created = await categoryService.create(ctx, {
          ...input,
          handle:
            (row.slug ?? '').trim() !== ''
              ? await freeHandle(ctx, 'category', row.slug!)
              : await freeHandle(ctx, 'category', name),
        });
        resolver.rememberCategory(name, created.id);
        results.push({ rowIndex, status: 'imported', naturalKey: name });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn({ err: error, rowIndex }, 'category row failed');
        results.push({ rowIndex, status: 'error', errorMsg: message });
      }
    }

    return results.sort((a, b) => a.rowIndex - b.rowIndex);
  },

  async preview(ctx, rows, logger) {
    const resolver = new Resolver(ctx);
    return eachRow<PreviewResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const name = (row.name ?? '').trim();
        if (name === '') return { rowIndex, action: 'error', errorMsg: 'No category name.' };
        const existing = await resolver.categoryByName(name);
        return { rowIndex, action: existing === null ? 'create' : 'update', naturalKey: name };
      },
      (rowIndex, message) => ({ rowIndex, action: 'error', errorMsg: message })
    );
  },
};

export const collectionsProcessor: EntityProcessor = {
  entity: 'collections',
  module: 'commerce',

  async run(ctx, rows, options, logger) {
    return eachRow<RowResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const name = (row.name ?? '').trim();
        if (name === '') return { rowIndex, status: 'error', errorMsg: 'This row has no name.' };

        const existing = await withTenant(ctx, (tx) =>
          tx.productCollection.findFirst({
            where: { tenantId: ctx.tenantId, name: { equals: name, mode: 'insensitive' } },
            select: { id: true },
          })
        );
        if (existing !== null && !options.upsert) {
          return { rowIndex, status: 'skipped', naturalKey: name };
        }

        const input = {
          name: name.slice(0, 127),
          ...(row.description !== undefined && row.description !== ''
            ? { description: row.description.slice(0, 10_000) }
            : {}),
          type: 'manual' as const,
        };

        let collectionId: string;
        if (existing !== null) {
          await collectionService.update(ctx, existing.id, input);
          collectionId = existing.id;
        } else {
          const created = await collectionService.create(ctx, {
            ...input,
            handle: await freeHandle(ctx, 'collection', (row.slug ?? '').trim() || name),
          });
          collectionId = created.id;
        }

        // Membership, where the file listed it. Products are named by handle or SKU
        // depending on the platform, so both are tried — a collection that imports
        // with no products in it is a collection the tenant has to rebuild by hand.
        const members = toList(row.products);
        let matched = 0;
        if (members.length > 0) {
          const variants = await withTenant(ctx, (tx) =>
            tx.productVariant.findMany({
              where: { tenantId: ctx.tenantId, sku: { in: members }, deletedAt: null },
              select: { productId: true },
            })
          );
          const byHandle = await withTenant(ctx, (tx) =>
            tx.product.findMany({
              where: { tenantId: ctx.tenantId, handle: { in: members.map((m) => toSlug(m)) } },
              select: { id: true },
            })
          );
          const productIds = [
            ...new Set([...variants.map((v) => v.productId), ...byHandle.map((p) => p.id)]),
          ];
          matched = productIds.length;
          if (productIds.length > 0) {
            await collectionService.setProducts(ctx, { collectionId, productIds });
          }
        }

        return {
          rowIndex,
          status: existing === null ? 'imported' : 'updated',
          naturalKey: name,
          ...(members.length > 0 && matched < members.length
            ? {
                errorMsg: `${matched} of ${members.length} products in this collection were found. Import your products first if any are missing.`,
              }
            : {}),
        };
      },
      (rowIndex, message) => ({ rowIndex, status: 'error', errorMsg: message })
    );
  },

  async preview(ctx, rows, logger) {
    return eachRow<PreviewResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const name = (row.name ?? '').trim();
        if (name === '') return { rowIndex, action: 'error', errorMsg: 'No name.' };
        const existing = await withTenant(ctx, (tx) =>
          tx.productCollection.findFirst({
            where: { tenantId: ctx.tenantId, name: { equals: name, mode: 'insensitive' } },
            select: { id: true },
          })
        );
        return { rowIndex, action: existing === null ? 'create' : 'update', naturalKey: name };
      },
      (rowIndex, message) => ({ rowIndex, action: 'error', errorMsg: message })
    );
  },
};
