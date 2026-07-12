// CSV feed adapter — polls a remote URL that serves a CSV catalog.
// Order submission and tracking are not supported; inventory can be synced
// when the feed includes a quantity column.
//
// credentials shape (CsvCredentials) is a FLAT string bag — every value here
// travels through the generic vendor `credentialFields` form + the
// `credentials: Record<string, string>` API schema shared by every supplier
// type (see packages/dropship/src/vendors.ts + services/api-rest's
// SupplierBody), so the column-mapping inputs are just more text fields
// (each one the CSV header name for that product attribute) rather than a
// nested object the generic form/schema can't represent.
//
//   csvUrl              — URL the adapter fetches (must be publicly accessible)
//   delimiter           — field separator, default ','
//   mapProductIdColumn  — header that groups variant rows into one product
//   mapTitleColumn      — header for the product/variant title
//   mapSkuColumn        — header for the variant SKU
//   mapCostColumn       — header for cost price, e.g. "15.99" → 1599 cents
//   map*Column (rest)   — optional per-attribute header names

import type {
  Credentials,
  InventoryMap,
  NormalizedProduct,
  NormalizedProductVariant,
  Order,
  SupplierAdapter,
  SupplierOrderResult,
  TrackingInfo,
} from '../types.js';

export interface CsvColumnMapping {
  supplierProductId: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string; // comma-separated values within the cell
  imageUrls?: string; // pipe-separated URLs within the cell
  sku: string;
  costPrice: string; // dollar amount e.g. "15.99" → 1599 cents
  msrp?: string;
  inventory?: string; // integer quantity
  weightGrams?: string;
  // Option columns — extend with variantOptionN pattern in future
  variantColor?: string;
  variantSize?: string;
}

export interface CsvCredentials {
  csvUrl: string;
  delimiter?: string;
  mapProductIdColumn: string;
  mapTitleColumn: string;
  mapSkuColumn: string;
  mapCostColumn: string;
  mapDescriptionColumn?: string;
  mapCategoryColumn?: string;
  mapTagsColumn?: string;
  mapImagesColumn?: string;
  mapMsrpColumn?: string;
  mapInventoryColumn?: string;
  mapWeightColumn?: string;
  mapColorColumn?: string;
  mapSizeColumn?: string;
}

// Build the nested CsvColumnMapping the row-parsing helpers use, from the flat
// credential fields the connect form actually collects. Empty optional
// strings become `undefined` so `mapping.foo &&` checks below skip them.
function toColumnMapping(creds: CsvCredentials): CsvColumnMapping {
  const opt = (v: string | undefined): string | undefined => (v?.trim() ? v.trim() : undefined);
  return {
    supplierProductId: creds.mapProductIdColumn?.trim() ?? '',
    title: creds.mapTitleColumn?.trim() ?? '',
    sku: creds.mapSkuColumn?.trim() ?? '',
    costPrice: creds.mapCostColumn?.trim() ?? '',
    description: opt(creds.mapDescriptionColumn),
    category: opt(creds.mapCategoryColumn),
    tags: opt(creds.mapTagsColumn),
    imageUrls: opt(creds.mapImagesColumn),
    msrp: opt(creds.mapMsrpColumn),
    inventory: opt(creds.mapInventoryColumn),
    weightGrams: opt(creds.mapWeightColumn),
    variantColor: opt(creds.mapColorColumn),
    variantSize: opt(creds.mapSizeColumn),
  };
}

// ── RFC 4180 CSV parser ───────────────────────────────────────────────────────

function splitCsvRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(text: string, delimiter = ','): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvRow(lines[0]!, delimiter);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvRow(lines[i]!, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

// ── Row → normalized types ────────────────────────────────────────────────────

function rowToVariant(
  row: Record<string, string>,
  mapping: CsvColumnMapping
): NormalizedProductVariant {
  const options: Record<string, string> = {};
  if (mapping.variantColor && row[mapping.variantColor])
    options['color'] = row[mapping.variantColor]!;
  if (mapping.variantSize && row[mapping.variantSize]) options['size'] = row[mapping.variantSize]!;

  const imageUrls = mapping.imageUrls
    ? (row[mapping.imageUrls] ?? '')
        .split('|')
        .map((u) => u.trim())
        .filter(Boolean)
    : [];

  const costRaw = parseFloat(row[mapping.costPrice] ?? '0');
  const msrpRaw = mapping.msrp ? parseFloat(row[mapping.msrp] ?? '') : NaN;
  const invRaw = mapping.inventory ? parseInt(row[mapping.inventory] ?? '', 10) : NaN;
  const wRaw = mapping.weightGrams ? parseInt(row[mapping.weightGrams] ?? '', 10) : NaN;

  return {
    supplierSku: row[mapping.sku] ?? '',
    title: Object.values(options).join(' / ') || (row[mapping.title] ?? ''),
    options,
    costPriceCents: Math.round(isNaN(costRaw) ? 0 : costRaw * 100),
    msrpCents: isNaN(msrpRaw) ? null : Math.round(msrpRaw * 100),
    inventoryQuantity: isNaN(invRaw) ? null : invRaw,
    weight: isNaN(wRaw) ? null : wRaw,
    imageUrls,
  };
}

function rowsToProducts(
  rows: Record<string, string>[],
  mapping: CsvColumnMapping
): NormalizedProduct[] {
  const productMap = new Map<
    string,
    { rows: Record<string, string>[]; first: Record<string, string> }
  >();

  for (const row of rows) {
    const pid = row[mapping.supplierProductId];
    if (!pid) continue;
    const existing = productMap.get(pid);
    if (existing) {
      existing.rows.push(row);
    } else {
      productMap.set(pid, { rows: [row], first: row });
    }
  }

  const products: NormalizedProduct[] = [];
  for (const [supplierProductId, { rows: pRows, first }] of productMap) {
    const imageUrls = mapping.imageUrls
      ? (first[mapping.imageUrls] ?? '')
          .split('|')
          .map((u) => u.trim())
          .filter(Boolean)
      : [];
    const tags = mapping.tags
      ? (first[mapping.tags] ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    products.push({
      supplierProductId,
      title: first[mapping.title] ?? '',
      description: mapping.description ? (first[mapping.description] ?? null) : null,
      category: mapping.category ? (first[mapping.category] ?? null) : null,
      tags,
      imageUrls,
      variants: pRows.map((r) => rowToVariant(r, mapping)),
      raw: first as Record<string, unknown>,
    });
  }
  return products;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class CsvAdapter implements SupplierAdapter {
  private readonly creds: CsvCredentials;

  constructor(credentials: Credentials) {
    this.creds = credentials as unknown as CsvCredentials;
  }

  async authenticate(_credentials: Credentials): Promise<boolean> {
    if (!this.creds.csvUrl) return false;
    const mapping = toColumnMapping(this.creds);
    if (!mapping.supplierProductId || !mapping.title || !mapping.sku || !mapping.costPrice) {
      return false;
    }
    try {
      const res = await fetch(this.creds.csvUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async *syncCatalog(_since?: Date): AsyncGenerator<NormalizedProduct> {
    const { csvUrl, delimiter = ',' } = this.creds;
    const mapping = toColumnMapping(this.creds);
    if (!mapping.supplierProductId || !mapping.title || !mapping.sku || !mapping.costPrice) {
      throw new Error(
        'CSV column mapping is incomplete — Product ID, Title, SKU, and Cost price columns are all required.'
      );
    }
    const res = await fetch(csvUrl, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
    const text = await res.text();
    const rows = parseCsv(text, delimiter);
    for (const product of rowsToProducts(rows, mapping)) {
      yield product;
    }
  }

  async submitOrder(order: Order): Promise<SupplierOrderResult> {
    return {
      supplierOrderId: `manual-${order.sparxOrderId}`,
      status: 'failed',
      errorMessage:
        'CSV suppliers do not support automated order submission. Place this order manually with your supplier.',
    };
  }

  async getTrackingUpdate(_supplierOrderId: string): Promise<TrackingInfo> {
    throw new Error('CSV suppliers do not support automated tracking.');
  }

  async checkInventory(skus: string[]): Promise<InventoryMap> {
    const { csvUrl, delimiter = ',' } = this.creds;
    const mapping = toColumnMapping(this.creds);
    if (!mapping.sku || !mapping.inventory) return {};
    try {
      const res = await fetch(csvUrl, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) return {};
      const text = await res.text();
      const rows = parseCsv(text, delimiter);
      const result: InventoryMap = {};
      for (const row of rows) {
        const sku = row[mapping.sku];
        if (sku && skus.includes(sku)) {
          const qty = parseInt(row[mapping.inventory] ?? '', 10);
          result[sku] = isNaN(qty) ? null : qty;
        }
      }
      return result;
    } catch {
      return {};
    }
  }
}

/** Construct the right adapter for a given supplier type. */
export function createAdapter(type: string, credentials: Credentials): SupplierAdapter {
  switch (type) {
    case 'csv':
      return new CsvAdapter(credentials);
    default:
      throw new Error(`No adapter registered for supplier type: ${type}`);
  }
}
