// Square (and Square Online, formerly Weebly).
//
// Square's item library is the best inventory export on the roster and the worst
// product export. Best, because stock is already per-location and explicit: every
// location the seller has produces its own `Current Quantity <Location>` column, so a
// three-shop seller's counts survive the move intact. Worst, because the file is one
// row per VARIATION with the item name repeated, and the only thing grouping them is
// `Reference Handle` — which Square leaves blank on items created through the POS,
// which is most of them.
//
// So grouping falls back to `Item Name`, which is correct in practice and is the
// reason a Square import produces "Blue T-Shirt with three sizes" instead of three
// unrelated products called Blue T-Shirt.

import type { CanonicalRow } from '../canonical';
import { clean } from '../coerce';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { groupBy, indexed, pick, row, tags } from './_helpers';

/** `Current Quantity Downtown` → `Downtown`. Square appends the location's name to
 *  each stock column, and the tenant named those locations, so the prefix is the only
 *  fixed part. */
function locationFrom(header: string, prefix: string): string | null {
  const normalized = header.trim();
  if (!normalized.toLowerCase().startsWith(prefix.toLowerCase())) return null;
  const name = normalized.slice(prefix.length).trim();
  return name === '' ? null : name;
}

function mapProducts(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];

  for (const [key, group] of groupBy(
    rows,
    (source) => pick(source, 'Reference Handle') || pick(source, 'Item Name')
  )) {
    const head = group[0]!;
    const handle = key
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 80);

    group.forEach((source, index) => {
      const optionNames = indexed(head, (n) => `Option Name ${n}`, 3);
      const optionValues = indexed(source, (n) => `Option Value ${n}`, 3);
      // Square writes a variation name like "Small" when there is no structured
      // option set, which is the common case for POS-created items.
      const variationName = pick(source, 'Variation Name');

      out.push(
        row({
          handle,
          title: pick(head, 'Item Name'),
          description: pick(head, 'Description'),
          sku: pick(source, 'SKU'),
          barcode: pick(source, 'GTIN'),
          status: pick(head, 'Archived').toLowerCase() === 'y' ? 'archived' : 'active',
          category: pick(head, 'Reporting Category', 'Category'),
          collections: pick(head, 'Reporting Category', 'Category'),
          tags: tags(pick(head, 'Tags')),
          price: pick(source, 'Price'),
          compare_at_price: '',
          cost_per_item: pick(source, 'Default Unit Cost'),
          weight_grams: '',
          option1_name: optionNames[0] ?? (variationName !== '' ? 'Option' : ''),
          option1_value: optionValues[0] ?? variationName,
          option2_name: optionNames[1],
          option2_value: optionValues[1],
          option3_name: optionNames[2],
          option3_value: optionValues[2],
          seo_title: index === 0 ? pick(head, 'SEO Title') : '',
          seo_description: index === 0 ? pick(head, 'SEO Description') : '',
          fulfillment_type: pick(head, 'Item Type').toLowerCase().includes('service')
            ? 'service'
            : 'physical',
          track_inventory: pick(source, 'Stockable').toLowerCase() === 'n' ? 'false' : 'true',
          source_url: pick(head, 'Permalink') === '' ? '' : `/${pick(head, 'Permalink')}`,
        })
      );
    });
  }

  return out;
}

/**
 * Unpivot the per-location stock columns.
 *
 * This is the payoff of Square's format: `Current Quantity Downtown` and
 * `Current Quantity Airport` become two rows, and a seller with three shops keeps
 * three real counts instead of one merged number they then have to re-count by hand.
 */
function mapInventory(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];

  for (const source of rows) {
    const sku = pick(source, 'SKU');
    if (sku === '') continue;
    const cost = pick(source, 'Default Unit Cost');

    for (const [header, value] of Object.entries(source)) {
      const location =
        locationFrom(header, 'Current Quantity') ?? locationFrom(header, 'New Quantity');
      if (location === null) continue;
      const quantity = clean(value);
      if (quantity === '' || !/^-?\d+(\.\d+)?$/.test(quantity)) continue;
      out.push(
        row({
          sku,
          location,
          quantity: String(Math.round(Number(quantity))),
          cost_per_item: cost,
          barcode: pick(source, 'GTIN'),
        })
      );
    }
  }

  return out;
}

function mapCustomers(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) =>
    row({
      email: pick(source, 'Email Address', 'Email'),
      first_name: pick(source, 'First Name'),
      last_name: pick(source, 'Last Name', 'Surname'),
      company: pick(source, 'Company Name'),
      phone: pick(source, 'Phone Number', 'Phone'),
      address1: pick(source, 'Street Address 1', 'Street Address'),
      address2: pick(source, 'Street Address 2'),
      city: pick(source, 'City'),
      province: pick(source, 'State', 'Province'),
      country: pick(source, 'Country'),
      zip: pick(source, 'Postal Code', 'ZIP Code'),
      note: pick(source, 'Memo'),
      accepts_marketing: pick(source, 'Email Subscription Status', 'Email Subscribed'),
      created_at: pick(source, 'Creation Source Date', 'First Visit'),
      type: pick(source, 'Company Name') !== '' ? 'company' : 'person',
    })
  );
}

export const square: VendorAdapter = {
  slug: 'square',
  name: 'Square',
  kind: 'commerce',
  sources: [
    {
      id: 'square.products',
      entity: 'products',
      label: 'Item library',
      file: 'catalog-....csv',
      where: 'Dashboard → Items & Orders → Items → Actions → Export Library',
      format: 'csv',
      filePattern: /catalog.*\.csv$/i,
      required: ['Item Name', 'Variation Name'],
      hints: ['Reference Handle', 'Token', 'Reporting Category', 'GTIN'],
      map: mapProducts,
    },
    {
      id: 'square.inventory',
      entity: 'inventory_levels',
      label: 'Stock by location',
      file: 'catalog-....csv',
      where: 'The same item library export — stock is one column per location',
      format: 'csv',
      required: ['Item Name', 'SKU'],
      hints: ['Default Unit Cost', 'Stockable', 'Variation Name'],
      map: mapInventory,
    },
    {
      id: 'square.customers',
      entity: 'customers',
      label: 'Customer directory',
      file: 'customers.csv',
      where: 'Dashboard → Customers → Directory → Export Customers',
      format: 'csv',
      required: ['Email Address', 'Reference ID'],
      hints: ['Creation Source', 'Memo', 'Square Customer ID'],
      map: mapCustomers,
    },
  ],
};

export const squareInternals = { mapProducts, mapInventory, mapCustomers, locationFrom };
