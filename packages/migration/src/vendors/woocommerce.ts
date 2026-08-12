// WooCommerce.
//
// Two files, and they come from different places, which is the thing tenants get
// stuck on: the catalogue comes from WooCommerce's own product exporter, and the
// blog/pages come from WordPress's exporter underneath it. Both are built in; neither
// is where you would look first.
//
// The product CSV's structure is a parent/child one rather than Shopify's repeated
// handle. A variable product is one row of `Type: variable`, and each of its variants
// is a separate `Type: variation` row pointing back through `Parent` — written either
// as `id:123` or as the parent's SKU depending on WooCommerce version. Resolving that
// pointer is what turns 40 orphan rows into 8 real products.

import type { CanonicalRow } from '../canonical';
import { clean } from '../coerce';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { indexed, pick, productStatus, row, tags } from './_helpers';
import { wxrEntities } from './wordpress';

/** `id:123` → `123`; a bare SKU stays a SKU. */
function parentRef(value: string): { id?: string; sku?: string } {
  const text = clean(value);
  if (text === '') return {};
  const match = /^id:\s*(\d+)$/i.exec(text);
  return match ? { id: match[1] } : { sku: text };
}

function handleFor(source: SourceRow): string {
  const sku = pick(source, 'SKU');
  if (sku !== '') return sku;
  const id = pick(source, 'ID');
  return id !== '' ? `woo-${id}` : '';
}

function mapProducts(rows: SourceRow[]): CanonicalRow[] {
  // Index by both id and SKU so a variation resolves whichever way it points.
  const byId = new Map<string, SourceRow>();
  const bySku = new Map<string, SourceRow>();
  for (const source of rows) {
    const id = pick(source, 'ID');
    const sku = pick(source, 'SKU');
    if (id !== '') byId.set(id, source);
    if (sku !== '') bySku.set(sku, source);
  }

  const out: CanonicalRow[] = [];
  // Track which handle each parent got, so its variations land in the same group even
  // when the variation row carries a different SKU (which is the normal case).
  const handleByParent = new Map<SourceRow, string>();

  const emit = (source: SourceRow, parent: SourceRow | undefined, index: number): void => {
    const base = parent ?? source;
    let handle = handleByParent.get(base);
    if (handle === undefined) {
      handle = handleFor(base);
      handleByParent.set(base, handle);
    }
    if (handle === '') return;

    // WooCommerce writes attributes as `Attribute 1 name` / `Attribute 1 value(s)`.
    // On a variable parent the value cell holds every option separated by commas; on
    // a variation it holds the single chosen one, which is what we want here.
    const optionNames = indexed(base, (n) => `Attribute ${n} name`, 3);
    const optionValues = indexed(source, (n) => `Attribute ${n} value(s)`, 3);
    const regular = pick(source, 'Regular price') || pick(base, 'Regular price');
    const sale = pick(source, 'Sale price') || pick(base, 'Sale price');

    out.push(
      row({
        handle,
        title: pick(base, 'Name'),
        description: pick(base, 'Description') || pick(base, 'Short description'),
        sku: pick(source, 'SKU') || (parent === undefined ? handle : `${handle}-${index + 1}`),
        status: productStatus(pick(base, 'Published'), [
          '1',
          'true',
          'yes',
          'published',
          'visible',
        ]),
        product_type: pick(base, 'Type') === 'external' ? 'External' : '',
        tags: tags(pick(base, 'Tags')),
        category: pick(base, 'Categories').split(',')[0]?.trim(),
        // WooCommerce category cells use ` > ` for depth and `, ` between roots.
        collections: pick(base, 'Categories'),
        // A WooCommerce sale price is the price the customer PAYS, with the regular
        // price shown struck through — so when both are present they map the other way
        // round from how the columns are named. Importing `Regular price` as the price
        // would quietly un-discount the tenant's whole catalogue on day one.
        price: sale !== '' ? sale : regular,
        compare_at_price: sale !== '' ? regular : '',
        quantity: pick(source, 'Stock'),
        track_inventory: pick(source, 'Stock') === '' ? 'false' : 'true',
        weight_kg: pick(source, 'Weight (kg)') || pick(base, 'Weight (kg)'),
        length_cm: pick(source, 'Length (cm)') || pick(base, 'Length (cm)'),
        width_cm: pick(source, 'Width (cm)') || pick(base, 'Width (cm)'),
        height_cm: pick(source, 'Height (cm)') || pick(base, 'Height (cm)'),
        taxable: pick(base, 'Tax status').toLowerCase() === 'taxable' ? 'true' : '',
        fulfillment_type: pick(base, 'Type').toLowerCase().includes('download')
          ? 'digital'
          : 'physical',
        images: index === 0 ? pick(base, 'Images') : '',
        image_url: index === 0 ? pick(base, 'Images').split(',')[0]?.trim() : '',
        option1_name: optionNames[0],
        option1_value: optionValues[0],
        option2_name: optionNames[1],
        option2_value: optionValues[1],
        option3_name: optionNames[2],
        option3_value: optionValues[2],
      })
    );
  };

  const variationsByParent = new Map<SourceRow, SourceRow[]>();
  const parents: SourceRow[] = [];

  for (const source of rows) {
    const type = pick(source, 'Type').toLowerCase();
    if (type === 'variation') {
      const ref = parentRef(pick(source, 'Parent'));
      const parent =
        (ref.id !== undefined ? byId.get(ref.id) : undefined) ??
        (ref.sku !== undefined ? bySku.get(ref.sku) : undefined);
      if (parent === undefined) {
        // An orphaned variation still beats a dropped product — treat it as its own.
        parents.push(source);
        continue;
      }
      const bucket = variationsByParent.get(parent);
      if (bucket === undefined) variationsByParent.set(parent, [source]);
      else bucket.push(source);
    } else {
      parents.push(source);
    }
  }

  for (const parent of parents) {
    const variations = variationsByParent.get(parent) ?? [];
    if (variations.length === 0) emit(parent, undefined, 0);
    else variations.forEach((variation, index) => emit(variation, parent, index));
  }

  return out;
}

function mapCustomers(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const name = pick(source, 'Name', 'Customer');
    const [first = '', ...rest] = name.split(' ');
    return row({
      email: pick(source, 'Email'),
      name,
      first_name: first,
      last_name: rest.join(' '),
      city: pick(source, 'City'),
      province: pick(source, 'Region', 'State'),
      country: pick(source, 'Country / Region', 'Country'),
      zip: pick(source, 'Postal code', 'Postcode'),
      total_spent: pick(source, 'Total spend'),
      total_orders: pick(source, 'Orders'),
      created_at: pick(source, 'Sign up'),
      type: 'person',
    });
  });
}

export const woocommerce: VendorAdapter = {
  slug: 'woocommerce',
  name: 'WooCommerce',
  kind: 'commerce',
  connector: 'wordpress',
  sources: [
    {
      id: 'woocommerce.products',
      entity: 'products',
      label: 'Products',
      file: 'wc-product-export-....csv',
      where: 'Products → All Products → Export',
      format: 'csv',
      filePattern: /wc-product-export/i,
      required: ['Type', 'Regular price'],
      hints: ['Is featured?', 'Visibility in catalogue', 'In stock?', 'Backorders allowed?'],
      map: mapProducts,
    },
    {
      id: 'woocommerce.customers',
      entity: 'customers',
      label: 'Customers',
      file: 'customers.csv',
      where: 'WooCommerce → Analytics → Customers → Download',
      format: 'csv',
      required: ['Total spend'],
      hints: ['Sign up', 'Last active', 'AOV'],
      map: mapCustomers,
    },
    {
      id: 'woocommerce.content',
      entity: 'content',
      label: 'Pages, posts and media',
      file: 'yoursite.WordPress.2026-01-01.xml',
      where: 'Tools → Export → All content',
      format: 'xml',
      filePattern: /\.wordpress\.[\d-]+\.xml$/i,
      vendorMarker: /woocommerce/i,
      required: [],
      yields: ['content', 'media', 'categories', 'redirects'],
      mapAll: wxrEntities,
    },
  ],
};

export const woocommerceInternals = { mapProducts, mapCustomers, parentRef };
