// Products.
//
// Rebuilt from the flat one-row-one-product version, which could not represent the
// thing every commerce export actually contains: a product with variants. Shopify,
// WooCommerce, Wix, Square, BigCommerce and Adobe Commerce all spread one product
// across several rows, and the old processor turned a T-shirt with three sizes into
// three unrelated T-shirts. That is not a rough edge — it is a catalogue the tenant
// has to delete and re-enter.
//
// The shape now:
//
//   Rows are grouped by `handle`, which every vendor adapter emits. The FIRST row of
//   a group carries the product; every row carries one variant.
//
//   Option names are read from the group as a whole and their values collected in
//   first-seen order, so `Size: Small, Medium, Large` comes out in the order the
//   tenant's file had them rather than alphabetically.
//
//   Images are copied, not linked (see ./images), de-duplicated across the whole run,
//   and bound to the variant when the row named a variant-specific one.
//
// A row's result is reported against the row the tenant can see in their file, so an
// error on the fourth variant of the ninth product points at the line number they
// would find it on.

import { productService, variantService } from '@sparx/commerce';
import { withTenant } from '@sparx/db';
import { toCents, toDecimal, toList, toSlug } from '@sparx/migration';

import { ingestImage, linkedNotice } from './images';
import { Resolver } from './resolve';
import { type EntityProcessor, type ImportRow, type PreviewResult, type RowResult } from './types';

interface Group {
  handle: string;
  head: ImportRow;
  rows: { row: ImportRow; rowIndex: number }[];
}

/** Group by handle, falling back to SKU and then the title — a file with no handle
 *  column at all is still a file of products. */
function groupRows(rows: ImportRow[]): Group[] {
  const groups = new Map<string, Group>();
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
    const handle = toSlug(row.handle ?? '') || toSlug(row.sku ?? '') || toSlug(row.title ?? '');
    if (handle === '') continue;
    const existing = groups.get(handle);
    if (existing === undefined) {
      groups.set(handle, { handle, head: row, rows: [{ row, rowIndex }] });
    } else {
      existing.rows.push({ row, rowIndex });
    }
  }
  return [...groups.values()];
}

function normalizeStatus(value: string | undefined): 'draft' | 'active' | 'archived' {
  const text = (value ?? '').trim().toLowerCase();
  if (text === 'active') return 'active';
  if (text === 'archived') return 'archived';
  return 'draft';
}

function normalizeFulfillment(value: string | undefined): 'physical' | 'digital' | 'service' {
  const text = (value ?? '').trim().toLowerCase();
  if (text === 'digital') return 'digital';
  if (text === 'service') return 'service';
  return 'physical';
}

function grams(row: ImportRow): number | undefined {
  const asGrams = toDecimal(row.weight_grams);
  if (asGrams !== undefined) return Math.round(asGrams);
  const asKg = toDecimal(row.weight_kg);
  return asKg === undefined ? undefined : Math.round(asKg * 1000);
}

/**
 * A dimension in millimetres, or `undefined` when the file did not say.
 *
 * Returning 0 for "not given" is the obvious shortcut and it is wrong twice over:
 * commerce's schema requires every dimension to be positive, so a zero is rejected —
 * and a Shopify products export has NO dimension columns at all, which meant every
 * product in every Shopify migration failed on a validation error about a box size
 * the tenant never typed. Absent has to stay absent.
 */
function mm(cm: string | undefined, millimetres: string | undefined): number | undefined {
  const direct = toDecimal(millimetres);
  if (direct !== undefined) return Math.round(direct);
  const centimetres = toDecimal(cm);
  return centimetres === undefined ? undefined : Math.round(centimetres * 10);
}

/** The box, only if there is one. A partial set is kept — a tenant who recorded
 *  length and width and not height still knows two thirds of what fits on a shelf. */
function dimensionsOf(
  head: ImportRow
): { lengthMm?: number; widthMm?: number; heightMm?: number } | undefined {
  const lengthMm = mm(head.length_cm, head.length_mm);
  const widthMm = mm(head.width_cm, head.width_mm);
  const heightMm = mm(head.height_cm, head.height_mm);
  if (lengthMm === undefined && widthMm === undefined && heightMm === undefined) return undefined;
  return {
    ...(lengthMm === undefined ? {} : { lengthMm }),
    ...(widthMm === undefined ? {} : { widthMm }),
    ...(heightMm === undefined ? {} : { heightMm }),
  };
}

/** A SKU for a variant that arrived without one. Deterministic, so a re-run of the
 *  same file updates the same variant instead of minting a second. */
function fallbackSku(handle: string, index: number, row: ImportRow): string {
  const suffix = [row.option1_value, row.option2_value, row.option3_value]
    .filter((value) => value !== undefined && value !== '')
    .join('-');
  const base = handle
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .slice(0, 30);
  return suffix === ''
    ? `${base}-${index + 1}`
    : `${base}-${suffix.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`.slice(0, 100);
}

/** Option names and their values, in the order the file presented them. */
function optionsOf(group: Group): { name: string; values: string[] }[] {
  const options: { name: string; values: string[] }[] = [];
  for (let axis = 1; axis <= 3; axis++) {
    const name = (group.head[`option${axis}_name`] ?? '').trim();
    if (name === '') continue;
    const values: string[] = [];
    for (const { row } of group.rows) {
      const value = (row[`option${axis}_value`] ?? '').trim();
      if (value !== '' && !values.includes(value)) values.push(value);
    }
    if (values.length > 0) options.push({ name, values });
  }
  return options;
}

export const productsProcessor: EntityProcessor = {
  entity: 'products',
  module: 'commerce',

  async run(ctx, rows, options, logger) {
    const resolver = new Resolver(ctx);
    const groups = groupRows(rows);
    const results: RowResult[] = [];

    const claimed = new Set(groups.flatMap((group) => group.rows.map((entry) => entry.rowIndex)));
    for (let index = 0; index < rows.length; index++) {
      if (!claimed.has(index)) {
        results.push({
          rowIndex: index,
          status: 'error',
          errorMsg: 'This row has no product name, SKU or handle, so there is nothing to create.',
        });
      }
    }

    for (const group of groups) {
      const { head, handle } = group;
      const notes: string[] = [];

      try {
        const title = (head.title ?? '').trim();
        if (title === '') {
          for (const { rowIndex } of group.rows) {
            results.push({
              rowIndex,
              status: 'error',
              naturalKey: handle,
              errorMsg: 'This product has no title.',
            });
          }
          continue;
        }

        // Match an existing product by handle first, then by any SKU in the group —
        // a tenant who renamed a product on the old platform still has the same SKUs.
        let productId: string | null = null;
        const byHandle = await withTenant(ctx, (tx) =>
          tx.product.findFirst({
            where: { tenantId: ctx.tenantId, handle, deletedAt: null },
            select: { id: true },
          })
        );
        productId = byHandle?.id ?? null;
        if (productId === null) {
          for (const { row } of group.rows) {
            const sku = (row.sku ?? '').trim();
            if (sku === '') continue;
            const variant = await resolver.variantBySku(sku);
            if (variant !== null) {
              productId = variant.productId;
              break;
            }
          }
        }

        if (productId !== null && !options.upsert) {
          for (const { rowIndex } of group.rows) {
            results.push({ rowIndex, status: 'skipped', naturalKey: handle });
          }
          continue;
        }

        const categoryId =
          head.category === undefined ? null : await resolver.categoryByName(head.category);

        const productInput = {
          title: title.slice(0, 255),
          handle,
          ...(head.description !== undefined && head.description !== ''
            ? { description: head.description.slice(0, 50_000) }
            : {}),
          status: normalizeStatus(head.status),
          ...(head.vendor !== undefined && head.vendor !== ''
            ? { vendor: head.vendor.slice(0, 127) }
            : {}),
          ...(head.product_type !== undefined && head.product_type !== ''
            ? { productType: head.product_type.slice(0, 127) }
            : {}),
          tags: toList(head.tags)
            .slice(0, 50)
            .map((tag) => tag.slice(0, 63)),
          fulfillmentType: normalizeFulfillment(head.fulfillment_type),
          ...(grams(head) !== undefined ? { weight: grams(head) } : {}),
          ...(dimensionsOf(head) === undefined ? {} : { dimensions: dimensionsOf(head) }),
          ...(head.seo_title !== undefined && head.seo_title !== ''
            ? { seoTitle: head.seo_title.slice(0, 255) }
            : {}),
          ...(head.seo_description !== undefined && head.seo_description !== ''
            ? { seoDescription: head.seo_description.slice(0, 512) }
            : {}),
          ...(categoryId === null ? {} : { categoryIds: [categoryId] }),
          ...(ctx.propertyId == null ? {} : { propertyIds: [ctx.propertyId] }),
        };

        const isNew = productId === null;
        if (productId === null) {
          const created = await productService.create(ctx, {
            ...productInput,
            options: [],
            variants: [],
          });
          productId = created.id;
        } else {
          await productService.update(ctx, productId, productInput);
        }

        // ── Options ────────────────────────────────────────────────────────────
        // Set from the whole group at once. `setOptions` replaces the set, which is
        // right for an import: the file is the statement of what the options are.
        const declared = optionsOf(group);
        const valueIdByOption = new Map<string, Map<string, string>>();
        if (declared.length > 0) {
          const saved = await variantService.setOptions(ctx, productId, {
            options: declared.map((option, position) => ({
              name: option.name.slice(0, 63),
              position,
              values: option.values.slice(0, 250).map((value, valuePosition) => ({
                value: value.slice(0, 127),
                position: valuePosition,
              })),
            })),
          });
          for (const option of saved) {
            const byValue = new Map<string, string>();
            for (const value of option.values) byValue.set(value.value.toLowerCase(), value.id);
            valueIdByOption.set(option.name.toLowerCase(), byValue);
          }
        }

        // ── Images ─────────────────────────────────────────────────────────────
        const gallery =
          toList(head.images).length > 0 ? toList(head.images) : toList(head.image_url);
        const assetByUrl = new Map<string, string>();
        let position = 0;
        for (const url of gallery.slice(0, 30)) {
          const ingested = await ingestImage(ctx, url, {
            ...(head.image_alt !== undefined && head.image_alt !== ''
              ? { alt: head.image_alt }
              : {}),
          });
          assetByUrl.set(url, ingested.assetId);
          if (!ingested.copied && ingested.reason !== undefined && notes.length === 0) {
            notes.push(linkedNotice(ingested.reason));
          }
          await variantService.addImage(ctx, {
            productId,
            mediaAssetId: ingested.assetId,
            position,
            ...(head.image_alt !== undefined && head.image_alt !== ''
              ? { alt: head.image_alt }
              : {}),
          });
          position += 1;
        }

        // ── Variants ───────────────────────────────────────────────────────────
        for (let index = 0; index < group.rows.length; index++) {
          const { row, rowIndex } = group.rows[index]!;
          try {
            const sku = (row.sku ?? '').trim() || fallbackSku(handle, index, row);
            const existingVariant = await resolver.variantBySku(sku);

            const optionValueIds: string[] = [];
            for (let axis = 1; axis <= 3; axis++) {
              const name = (head[`option${axis}_name`] ?? '').trim().toLowerCase();
              const value = (row[`option${axis}_value`] ?? '').trim().toLowerCase();
              if (name === '' || value === '') continue;
              const id = valueIdByOption.get(name)?.get(value);
              if (id !== undefined) optionValueIds.push(id);
            }

            const priceCents = toCents(row.price);
            const variantInput = {
              ...(priceCents !== undefined ? { priceCents } : {}),
              ...(toCents(row.compare_at_price) !== undefined
                ? { compareAtPriceCents: toCents(row.compare_at_price) }
                : {}),
              ...(toCents(row.cost_per_item) !== undefined
                ? { costCents: toCents(row.cost_per_item) }
                : {}),
              ...(row.barcode !== undefined && row.barcode !== ''
                ? { barcode: row.barcode.slice(0, 100) }
                : {}),
              ...(grams(row) !== undefined ? { weight: grams(row) } : {}),
            };

            if (existingVariant !== null && existingVariant.productId === productId) {
              await variantService.update(ctx, existingVariant.id, variantInput);
              if (optionValueIds.length > 0) {
                await variantService.assignOptionValues(ctx, {
                  variantId: existingVariant.id,
                  optionValueIds,
                });
              }
              results.push({
                rowIndex,
                status: 'updated',
                naturalKey: sku,
                ...(index === 0 && notes.length > 0 ? { errorMsg: notes[0] } : {}),
              });
              continue;
            }

            const created = await variantService.create(ctx, productId, {
              sku,
              priceCents: priceCents ?? 0,
              ...variantInput,
              isDefault: index === 0,
              // `deny` stops the storefront selling past zero; an export that tracks
              // nothing gets `continue`, which is what the old platform was doing.
              inventoryPolicy:
                (row.track_inventory ?? '').toLowerCase() === 'false' ? 'continue' : 'deny',
              requiresShipping: normalizeFulfillment(head.fulfillment_type) === 'physical',
              currency:
                row.currency !== undefined && /^[A-Za-z]{3}$/.test(row.currency)
                  ? row.currency.toUpperCase()
                  : 'USD',
              optionValueIds,
            });
            resolver.rememberVariant(sku, { id: created.id, productId });

            // A variant-specific photo, bound so the storefront swaps it on selection.
            const variantImage = (row.variant_image_url ?? '').trim();
            if (variantImage !== '') {
              const assetId =
                assetByUrl.get(variantImage) ?? (await ingestImage(ctx, variantImage)).assetId;
              await variantService.addImage(ctx, {
                productId,
                variantId: created.id,
                mediaAssetId: assetId,
                position: position + index,
                ...(optionValueIds.length > 0 ? { optionValueIds } : {}),
              });
            }

            results.push({
              rowIndex,
              status: isNew ? 'imported' : 'updated',
              naturalKey: sku,
              ...(index === 0 && notes.length > 0 ? { errorMsg: notes[0] } : {}),
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn({ err: error, handle, rowIndex }, 'variant row failed');
            results.push({ rowIndex, status: 'error', naturalKey: handle, errorMsg: message });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn({ err: error, handle }, 'product group failed');
        for (const { rowIndex } of group.rows) {
          results.push({ rowIndex, status: 'error', naturalKey: handle, errorMsg: message });
        }
      }
    }

    return results.sort((a, b) => a.rowIndex - b.rowIndex);
  },

  async preview(ctx, rows, logger) {
    const resolver = new Resolver(ctx);
    const groups = groupRows(rows);
    const results: PreviewResult[] = [];

    const claimed = new Set(groups.flatMap((group) => group.rows.map((entry) => entry.rowIndex)));
    for (let index = 0; index < rows.length; index++) {
      if (!claimed.has(index)) {
        results.push({
          rowIndex: index,
          action: 'error',
          errorMsg: 'Nothing identifies this row.',
        });
      }
    }

    for (const group of groups) {
      let exists = false;
      try {
        const byHandle = await withTenant(ctx, (tx) =>
          tx.product.findFirst({
            where: { tenantId: ctx.tenantId, handle: group.handle, deletedAt: null },
            select: { id: true },
          })
        );
        exists = byHandle !== null;
      } catch (error) {
        logger.warn({ err: error }, 'product preview failed');
      }

      for (const { row, rowIndex } of group.rows) {
        const sku = (row.sku ?? '').trim();
        const variant = sku === '' ? null : await resolver.variantBySku(sku);
        results.push({
          rowIndex,
          action:
            (row.title ?? '').trim() === ''
              ? 'error'
              : variant !== null || exists
                ? 'update'
                : 'create',
          naturalKey: sku === '' ? group.handle : sku,
          ...((row.title ?? '').trim() === '' ? { errorMsg: 'No title.' } : {}),
        });
      }
    }

    return results.sort((a, b) => a.rowIndex - b.rowIndex);
  },
};

export const productInternals = { groupRows, optionsOf, fallbackSku, normalizeStatus, grams };
