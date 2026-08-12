// Adobe Commerce (Magento).
//
// The only export on the roster written for developers rather than shopkeepers, and it
// shows: multi-store rows repeat the same SKU once per `store_view_code`, and a
// configurable product's variants are encoded as a single packed string in
// `configurable_variations`:
//
//   sku=TEE-S,size=Small,color=Blue|sku=TEE-M,size=Medium,color=Blue
//
// Unpacking that is what turns a Magento catalogue into real products rather than a
// pile of disconnected simple products with a hollow parent sitting beside them.
//
// Rows with a non-empty `store_view_code` are per-store overrides of the default row.
// They are skipped: a store view is a locale/price variant of one product, and
// importing them as separate products triples the catalogue. Multi-store tenants get
// the default view, which is the one their catalogue is actually built on.

import type { CanonicalRow } from '../canonical';
import { clean, toList } from '../coerce';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { pick, productStatus, row } from './_helpers';

/** `size=Small,color=Blue` → `{ size: 'Small', color: 'Blue' }` */
function parsePairs(segment: string): Record<string, string> {
  const pairs: Record<string, string> = {};
  for (const part of segment.split(',')) {
    const equals = part.indexOf('=');
    if (equals === -1) continue;
    pairs[part.slice(0, equals).trim()] = part.slice(equals + 1).trim();
  }
  return pairs;
}

/** Magento packs extra attributes as `key=value,key=value` in one cell. */
export function additionalAttributes(value: string): Record<string, string> {
  return parsePairs(clean(value));
}

function mapProducts(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];
  const bySku = new Map<string, SourceRow>();
  for (const source of rows) {
    if (pick(source, 'store_view_code') !== '') continue;
    const sku = pick(source, 'sku');
    if (sku !== '') bySku.set(sku, source);
  }

  // A simple product that belongs to a configurable is emitted as that configurable's
  // variant, never on its own — tracked here so the second pass can skip it.
  const claimed = new Set<string>();
  const configurables: {
    parent: SourceRow;
    variants: { sku: string; options: Record<string, string> }[];
  }[] = [];

  for (const source of bySku.values()) {
    const packed = pick(source, 'configurable_variations');
    if (packed === '') continue;
    const variants = packed
      .split('|')
      .map((segment) => {
        const options = parsePairs(segment);
        const sku = options.sku ?? '';
        delete options.sku;
        return { sku, options };
      })
      .filter((variant) => variant.sku !== '');
    for (const variant of variants) claimed.add(variant.sku);
    configurables.push({ parent: source, variants });
  }

  const emit = (
    head: SourceRow,
    source: SourceRow,
    options: Record<string, string>,
    index: number
  ): void => {
    const names = Object.keys(options);
    const extra = additionalAttributes(pick(source, 'additional_attributes'));
    const images = [pick(head, 'base_image'), ...toList(pick(head, 'additional_images'))].filter(
      (url) => url !== ''
    );

    out.push(
      row({
        handle: pick(head, 'url_key') || pick(head, 'sku'),
        title: pick(head, 'name'),
        description: pick(head, 'description') || pick(head, 'short_description'),
        sku: pick(source, 'sku'),
        status: productStatus(pick(head, 'product_online'), ['1', 'true', 'enabled']),
        collections: pick(head, 'categories')
          .split(',')
          .map((path) => path.split('/').pop()?.trim() ?? '')
          .filter((name) => name !== '' && name.toLowerCase() !== 'default category')
          .join(', '),
        vendor: extra.manufacturer ?? extra.brand,
        price: pick(source, 'price') || pick(head, 'price'),
        compare_at_price: pick(source, 'special_price') !== '' ? pick(source, 'price') : '',
        cost_per_item: pick(source, 'cost') || extra.cost,
        quantity: pick(source, 'qty') || pick(head, 'qty'),
        track_inventory: 'true',
        weight_kg: pick(source, 'weight') || pick(head, 'weight'),
        taxable: pick(head, 'tax_class_name').toLowerCase() === 'none' ? 'false' : 'true',
        seo_title: index === 0 ? pick(head, 'meta_title') : '',
        seo_description: index === 0 ? pick(head, 'meta_description') : '',
        images: index === 0 ? images.join(', ') : '',
        image_url: index === 0 ? images[0] : '',
        option1_name: names[0],
        option1_value: names[0] === undefined ? '' : options[names[0]],
        option2_name: names[1],
        option2_value: names[1] === undefined ? '' : options[names[1]],
        option3_name: names[2],
        option3_value: names[2] === undefined ? '' : options[names[2]],
        fulfillment_type:
          pick(head, 'product_type').toLowerCase() === 'downloadable' ? 'digital' : 'physical',
        source_url: pick(head, 'url_key') === '' ? '' : `/${pick(head, 'url_key')}.html`,
      })
    );
  };

  for (const { parent, variants } of configurables) {
    variants.forEach((variant, index) => {
      const child = bySku.get(variant.sku);
      emit(parent, child ?? parent, variant.options, index);
    });
  }

  for (const [sku, source] of bySku) {
    if (claimed.has(sku)) continue;
    if (pick(source, 'configurable_variations') !== '') continue;
    emit(source, source, {}, 0);
  }

  return out;
}

function mapCustomers(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) =>
    row({
      email: pick(source, 'email'),
      first_name: pick(source, 'firstname', 'First Name'),
      last_name: pick(source, 'lastname', 'Last Name'),
      company: pick(source, 'company', '_address_company'),
      phone: pick(source, 'telephone', '_address_telephone'),
      address1: pick(source, '_address_street', 'street'),
      city: pick(source, '_address_city', 'city'),
      province: pick(source, '_address_region', 'region'),
      country: pick(source, '_address_country_id', 'country_id'),
      zip: pick(source, '_address_postcode', 'postcode'),
      created_at: pick(source, 'created_at'),
      accepts_marketing: pick(source, 'is_subscribed'),
      type: 'person',
    })
  );
}

/** Magento's advanced-inventory export is tall already: sku + source_code + quantity. */
function mapInventory(rows: SourceRow[]): CanonicalRow[] {
  return rows
    .map((source) =>
      row({
        sku: pick(source, 'sku'),
        location: pick(source, 'source_code', 'source', 'stock_name') || 'Default',
        quantity: pick(source, 'quantity', 'qty'),
      })
    )
    .filter((mapped) => mapped.sku !== undefined);
}

export const magento: VendorAdapter = {
  slug: 'magento',
  name: 'Adobe Commerce',
  kind: 'commerce',
  sources: [
    {
      id: 'magento.products',
      entity: 'products',
      label: 'Products',
      file: 'catalog_product_....csv',
      where: 'System → Data Transfer → Export → Entity Type: Products',
      format: 'csv',
      filePattern: /catalog_product/i,
      required: ['sku', 'attribute_set_code'],
      hints: ['product_type', 'url_key', 'configurable_variations', 'additional_attributes'],
      map: mapProducts,
    },
    {
      id: 'magento.customers',
      entity: 'customers',
      label: 'Customers',
      file: 'customer_....csv',
      where: 'System → Data Transfer → Export → Entity Type: Customers Main File',
      format: 'csv',
      filePattern: /customer/i,
      required: ['email', 'firstname'],
      hints: ['group_id', 'store_id', 'created_at'],
      map: mapCustomers,
    },
    {
      id: 'magento.inventory',
      entity: 'inventory_levels',
      label: 'Stock levels',
      file: 'stock_sources.csv',
      where: 'System → Data Transfer → Export → Entity Type: Stock Sources',
      format: 'csv',
      required: ['sku', 'source_code'],
      hints: ['quantity', 'status'],
      map: mapInventory,
    },
  ],
};

export const magentoInternals = { mapProducts, mapCustomers, mapInventory, parsePairs };
