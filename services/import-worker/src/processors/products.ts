// Product row processor for CSV import.
//
// Natural key: SKU (variant SKU). Upsert semantics:
//   - Row has a matching SKU → update product title/status/vendor/type + update
//     variant price/compareAt/cost. Inventory adjustment is skipped (inventory
//     import is its own entity type).
//   - No matching SKU → create product + one default variant.
//
// Required columns: title, sku (when creating). Missing sku → auto-generated.
// Required for price: price (in dollars, converted to cents at import).
//
// Column aliases (case-insensitive, underscores optional):
//   title, sku, vendor, product_type, status, price, compare_at_price,
//   cost_per_item, barcode, track_inventory, quantity, weight_kg, weight_grams,
//   length_cm, length_mm, width_cm, width_mm, height_cm, height_mm,
//   fulfillment_type, tags

import type { Logger } from 'pino';
import { withTenant } from '@sparx/db';
import { productService, variantService } from '@sparx/commerce';

export interface ProductRow {
  title?: string;
  sku?: string;
  vendor?: string;
  product_type?: string;
  status?: string;
  price?: string;
  compare_at_price?: string;
  cost_per_item?: string;
  barcode?: string;
  track_inventory?: string;
  quantity?: string;
  weight_kg?: string;
  weight_grams?: string;
  length_cm?: string;
  length_mm?: string;
  width_cm?: string;
  width_mm?: string;
  height_cm?: string;
  height_mm?: string;
  fulfillment_type?: string;
  tags?: string;
  [key: string]: string | undefined;
}

export interface RowResult {
  rowIndex: number;
  status: 'imported' | 'updated' | 'skipped' | 'error';
  naturalKey?: string;
  errorMsg?: string;
}

function parseCents(val: string | undefined): number | undefined {
  if (!val || val.trim() === '') return undefined;
  const n = parseFloat(val.replace(/[$,]/g, ''));
  return isNaN(n) ? undefined : Math.round(n * 100);
}

function parseGrams(row: ProductRow): number | undefined {
  if (row.weight_grams) return parseFloat(row.weight_grams) || undefined;
  if (row.weight_kg) return Math.round(parseFloat(row.weight_kg) * 1000) || undefined;
  return undefined;
}

function parseMm(cmVal: string | undefined, mmVal: string | undefined): number | undefined {
  if (mmVal) return parseFloat(mmVal) || undefined;
  if (cmVal) return Math.round(parseFloat(cmVal) * 10) || undefined;
  return undefined;
}

function normalizeStatus(val: string | undefined): 'draft' | 'active' | 'archived' {
  if (val === 'active') return 'active';
  if (val === 'archived') return 'archived';
  return 'draft';
}

function normalizeFulfillment(val: string | undefined): 'physical' | 'digital' | 'service' {
  if (val === 'digital') return 'digital';
  if (val === 'service') return 'service';
  return 'physical';
}

function autoSku(title: string, index: number): string {
  return `${title.replace(/[^a-z0-9]/gi, '-').toUpperCase().slice(0, 20)}-${index + 1}`;
}

export async function processProductRows(
  ctx: { tenantId: string },
  rows: ProductRow[],
  opts: { upsert: boolean },
  logger: Logger
): Promise<RowResult[]> {
  const results: RowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const sku = row.sku?.trim() || autoSku(row.title ?? `product-${i}`, i);
    const log = logger.child({ rowIndex: i, sku });

    try {
      // Look up existing variant by SKU.
      const existing = await withTenant(ctx, (tx) =>
        tx.productVariant.findFirst({
          where: { tenantId: ctx.tenantId, sku, deletedAt: null },
          select: { id: true, productId: true },
        })
      );

      if (existing && opts.upsert) {
        // Update product + variant.
        const priceCents = parseCents(row.price);
        await productService.update(ctx, existing.productId, {
          ...(row.title ? { title: row.title } : {}),
          ...(row.vendor !== undefined ? { vendor: row.vendor } : {}),
          ...(row.product_type !== undefined ? { productType: row.product_type } : {}),
          ...(row.status ? { status: normalizeStatus(row.status) } : {}),
          ...(row.tags ? { tags: row.tags.split(',').map((t) => t.trim()).filter(Boolean) } : {}),
          ...(row.fulfillment_type ? { fulfillmentType: normalizeFulfillment(row.fulfillment_type) } : {}),
          weight: parseGrams(row),
          dimensions: {
            lengthMm: parseMm(row.length_cm, row.length_mm) ?? 0,
            widthMm: parseMm(row.width_cm, row.width_mm) ?? 0,
            heightMm: parseMm(row.height_cm, row.height_mm) ?? 0,
          },
        });
        if (priceCents !== undefined) {
          await variantService.update(ctx, existing.id, {
            priceCents,
            compareAtPriceCents: parseCents(row.compare_at_price),
            costCents: parseCents(row.cost_per_item),
            barcode: row.barcode ?? undefined,
          });
        }
        results.push({ rowIndex: i, status: 'updated', naturalKey: sku });
        log.debug('updated');
      } else if (existing && !opts.upsert) {
        results.push({ rowIndex: i, status: 'skipped', naturalKey: sku });
        log.debug('skipped (upsert off)');
      } else {
        // Create product + variant.
        if (!row.title?.trim()) {
          results.push({ rowIndex: i, status: 'error', naturalKey: sku, errorMsg: 'title is required for new products' });
          continue;
        }
        const priceCents = parseCents(row.price) ?? 0;
        const { id: productId } = await productService.create(ctx, {
          title: row.title.trim(),
          status: normalizeStatus(row.status),
          vendor: row.vendor ?? null,
          productType: row.product_type ?? null,
          fulfillmentType: normalizeFulfillment(row.fulfillment_type),
          tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
          weight: parseGrams(row),
          dimensions: {
            lengthMm: parseMm(row.length_cm, row.length_mm) ?? 0,
            widthMm: parseMm(row.width_cm, row.width_mm) ?? 0,
            heightMm: parseMm(row.height_cm, row.height_mm) ?? 0,
          },
          options: [],
          variants: [],
        });
        await variantService.create(ctx, productId, {
          sku,
          priceCents,
          compareAtPriceCents: parseCents(row.compare_at_price),
          costCents: parseCents(row.cost_per_item),
          barcode: row.barcode ?? undefined,
          isDefault: true,
          inventoryPolicy: row.track_inventory?.toLowerCase() === 'false' ? 'continue' : 'deny',
          requiresShipping: normalizeFulfillment(row.fulfillment_type) === 'physical',
          currency: 'USD',
          optionValueIds: [],
        });
        results.push({ rowIndex: i, status: 'imported', naturalKey: sku });
        log.debug('imported');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn({ err }, 'row error');
      results.push({ rowIndex: i, status: 'error', naturalKey: sku, errorMsg: msg });
    }
  }

  return results;
}
