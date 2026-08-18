// Shopify.
//
// The most important adapter in the package, because it is the platform most of our
// tenants are leaving. Six native exports, all reachable without an app:
//
//   Products    Products → Export → All products (CSV for Excel)
//   Customers   Customers → Export
//   Orders      Orders → Export
//   Inventory   Products → Inventory → Export
//   Discounts   Discounts → Export
//   Redirects   Online Store → Navigation → URL Redirects → Export
//
// Collections, pages and blog posts have no native CSV export — they come from the
// live Admin API connector instead. The marketing page says exactly that, because a
// tenant who is told their blog will move and then finds it did not is a tenant who
// has already left.
//
// The products file is the interesting one. A product with three variants and five
// images is EIGHT rows: row one carries the product plus variant one plus image one,
// and rows two through eight carry a variant OR an image with almost every other
// column blank. Handle is the only thing tying them together.

import type { CanonicalRow } from '../canonical';
import { clean } from '../coerce';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { groupBy, pathOf, pick, productStatus, row, tags } from './_helpers';

/** Columns in the inventory export that are NOT a location. Everything else in that
 *  file is a warehouse the tenant named themselves, which is why this list has to be
 *  exact rather than a prefix match. */
const INVENTORY_FIXED = new Set(
  [
    'Handle',
    'Title',
    'Option1 Name',
    'Option1 Value',
    'Option2 Name',
    'Option2 Value',
    'Option3 Name',
    'Option3 Value',
    'SKU',
    'HS Code',
    'COO',
    'Location',
    'Incoming',
    'Unavailable',
    'Committed',
    'Available',
    'On hand',
  ].map((header) => header.toLowerCase())
);

function mapProducts(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];

  for (const [handle, group] of groupBy(rows, (source) => pick(source, 'Handle'))) {
    const head = group[0]!;

    // Gallery: every distinct Image Src across the group, ordered by Image Position
    // where it is given. Shopify writes position on the product rows and leaves it
    // blank on some app-generated exports, so absent sorts last rather than first.
    const gallery = group
      .map((source) => ({
        url: pick(source, 'Image Src'),
        position: Number(pick(source, 'Image Position')) || Number.MAX_SAFE_INTEGER,
      }))
      .filter((image) => image.url !== '')
      .sort((a, b) => a.position - b.position);
    const images: string[] = [];
    for (const image of gallery) if (!images.includes(image.url)) images.push(image.url);

    // Variant rows: anything carrying a SKU, a price or an option value. A product
    // with no options at all has exactly one, which is the first row.
    const variantRows = group.filter(
      (source) =>
        pick(source, 'Variant SKU') !== '' ||
        pick(source, 'Variant Price') !== '' ||
        pick(source, 'Option1 Value') !== ''
    );
    const effective = variantRows.length > 0 ? variantRows : [head];

    effective.forEach((source, index) => {
      const grams = pick(source, 'Variant Grams');
      const weightUnit = pick(source, 'Variant Weight Unit').toLowerCase();
      // Modern exports write the number in `Variant Weight Unit`'s unit, not grams,
      // despite the column still being called Grams. Both shapes are in the wild.
      const weightGrams =
        grams === ''
          ? ''
          : weightUnit === 'kg'
            ? String(Number(grams) * 1000)
            : weightUnit === 'lb'
              ? String(Math.round(Number(grams) * 453.592))
              : weightUnit === 'oz'
                ? String(Math.round(Number(grams) * 28.3495))
                : grams;

      out.push(
        row({
          handle,
          title: pick(head, 'Title'),
          description: pick(head, 'Body (HTML)'),
          vendor: pick(head, 'Vendor'),
          product_type: pick(head, 'Type', 'Product Category'),
          category: pick(head, 'Product Category'),
          tags: tags(pick(head, 'Tags')),
          // `Status` is the modern column; `Published` is the old boolean. Neither is
          // present in some app-written exports, and the default is draft on purpose.
          status: productStatus(pick(head, 'Status') || pick(head, 'Published')),
          seo_title: index === 0 ? pick(head, 'SEO Title') : '',
          seo_description: index === 0 ? pick(head, 'SEO Description') : '',
          images: index === 0 ? images.join(', ') : '',
          image_url: index === 0 ? images[0] : '',
          image_alt: index === 0 ? pick(head, 'Image Alt Text') : '',

          option1_name: pick(head, 'Option1 Name'),
          option1_value: pick(source, 'Option1 Value'),
          option2_name: pick(head, 'Option2 Name'),
          option2_value: pick(source, 'Option2 Value'),
          option3_name: pick(head, 'Option3 Name'),
          option3_value: pick(source, 'Option3 Value'),

          sku: pick(source, 'Variant SKU'),
          price: pick(source, 'Variant Price'),
          compare_at_price: pick(source, 'Variant Compare At Price'),
          cost_per_item: pick(source, 'Cost per item'),
          barcode: pick(source, 'Variant Barcode'),
          quantity: pick(source, 'Variant Inventory Qty'),
          // Shopify names the app that tracks stock; an empty tracker means untracked.
          track_inventory: pick(source, 'Variant Inventory Tracker') === '' ? 'false' : 'true',
          requires_shipping: pick(source, 'Variant Requires Shipping'),
          taxable: pick(source, 'Variant Taxable'),
          weight_grams: weightGrams,
          variant_image_url: pick(source, 'Variant Image'),
          fulfillment_type:
            pick(head, 'Gift Card').toLowerCase() === 'true' ? 'digital' : 'physical',
          source_url: `/products/${handle}`,
        })
      );
    });
  }

  return out;
}

function mapCustomers(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) =>
    row({
      email: pick(source, 'Email'),
      first_name: pick(source, 'First Name'),
      last_name: pick(source, 'Last Name'),
      phone: pick(source, 'Phone', 'Default Address Phone'),
      company: pick(source, 'Company', 'Default Address Company'),
      accepts_marketing: pick(source, 'Accepts Email Marketing', 'Accepts Marketing'),
      accepts_sms: pick(source, 'Accepts SMS Marketing'),
      address1: pick(source, 'Default Address Address1', 'Address1'),
      address2: pick(source, 'Default Address Address2', 'Address2'),
      city: pick(source, 'Default Address City', 'City'),
      province: pick(
        source,
        'Default Address Province Code',
        'Default Address Province',
        'Province'
      ),
      country: pick(source, 'Default Address Country Code', 'Default Address Country', 'Country'),
      zip: pick(source, 'Default Address Zip', 'Zip'),
      tags: tags(pick(source, 'Tags')),
      note: pick(source, 'Note'),
      total_spent: pick(source, 'Total Spent'),
      total_orders: pick(source, 'Total Orders'),
      type: 'person',
    })
  );
}

function mapOrders(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];

  for (const [name, group] of groupBy(rows, (source) => pick(source, 'Name'))) {
    const head = group[0]!;
    group.forEach((source, index) => {
      out.push(
        row({
          order_number: name,
          // Totals live only on the first row of an order; repeating them on line
          // rows would multiply the order's revenue by its line count.
          email: index === 0 ? pick(head, 'Email') : '',
          customer_name: index === 0 ? pick(head, 'Billing Name', 'Shipping Name') : '',
          phone: index === 0 ? pick(head, 'Phone', 'Shipping Phone') : '',
          placed_at: index === 0 ? pick(head, 'Created at', 'Paid at') : '',
          currency: index === 0 ? pick(head, 'Currency') : '',
          financial_status: index === 0 ? pick(head, 'Financial Status') : '',
          fulfillment_status: index === 0 ? pick(head, 'Fulfillment Status') : '',
          subtotal: index === 0 ? pick(head, 'Subtotal') : '',
          shipping: index === 0 ? pick(head, 'Shipping') : '',
          tax: index === 0 ? pick(head, 'Taxes') : '',
          discount: index === 0 ? pick(head, 'Discount Amount') : '',
          total: index === 0 ? pick(head, 'Total') : '',
          discount_code: index === 0 ? pick(head, 'Discount Code') : '',
          shipping_method: index === 0 ? pick(head, 'Shipping Method') : '',
          note: index === 0 ? pick(head, 'Notes', 'Note') : '',
          ship_name: index === 0 ? pick(head, 'Shipping Name') : '',
          ship_address1: index === 0 ? pick(head, 'Shipping Address1') : '',
          ship_address2: index === 0 ? pick(head, 'Shipping Address2') : '',
          ship_city: index === 0 ? pick(head, 'Shipping City') : '',
          ship_province: index === 0 ? pick(head, 'Shipping Province') : '',
          ship_country: index === 0 ? pick(head, 'Shipping Country') : '',
          ship_zip: index === 0 ? pick(head, 'Shipping Zip') : '',

          line_sku: pick(source, 'Lineitem sku'),
          line_title: pick(source, 'Lineitem name'),
          line_quantity: pick(source, 'Lineitem quantity'),
          line_price: pick(source, 'Lineitem price'),
        })
      );
    });
  }

  return out;
}

/**
 * Inventory is a WIDE file: one column per location, named by whatever the tenant
 * called that location. Unpivoting it into (sku, location, quantity) is the whole
 * job, and it is the reason stock survives a migration at all — every other importer
 * on the market makes the tenant re-count.
 */
function mapInventory(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];

  for (const source of rows) {
    const sku = pick(source, 'SKU');
    if (sku === '') continue;

    // Newer exports are already tall: a Location column plus Available/On hand.
    const namedLocation = pick(source, 'Location');
    if (namedLocation !== '') {
      out.push(
        row({
          sku,
          location: namedLocation,
          quantity: pick(source, 'On hand', 'Available', 'Quantity'),
          available: pick(source, 'Available'),
          incoming: pick(source, 'Incoming'),
        })
      );
      continue;
    }

    for (const [header, value] of Object.entries(source)) {
      if (INVENTORY_FIXED.has(header.toLowerCase())) continue;
      const quantity = clean(value);
      if (quantity === '') continue;
      // Shopify writes `not stocked` for a location this variant is not carried at.
      if (!/^-?\d+$/.test(quantity)) continue;
      out.push(row({ sku, location: header, quantity }));
    }
  }

  return out;
}

function mapDiscounts(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const valueType = pick(source, 'Value Type', 'Type').toLowerCase();
    const raw = pick(source, 'Value');
    // Shopify writes percentages as a negative fraction (-0.15 for 15% off) and fixed
    // amounts as a negative currency value. Both are stored positive here.
    const numeric = Number(raw.replace(/[^\d.-]/g, ''));
    const isPercent = valueType.includes('percent');
    const value = Number.isFinite(numeric)
      ? String(Math.abs(isPercent && Math.abs(numeric) <= 1 ? numeric * 100 : numeric))
      : '';

    return row({
      code: pick(source, 'Name', 'Code', 'Discount Code'),
      title: pick(source, 'Name'),
      type: isPercent
        ? 'percentage'
        : pick(source, 'Type').toLowerCase().includes('shipping')
          ? 'free_shipping'
          : 'fixed_amount',
      value,
      minimum_amount: pick(source, 'Minimum Requirement Value'),
      usage_limit: pick(source, 'Usage Limit'),
      starts_at: pick(source, 'Starts At', 'Start Date'),
      ends_at: pick(source, 'Ends At', 'End Date'),
      status: pick(source, 'Status').toLowerCase(),
    });
  });
}

function mapRedirects(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) =>
    row({
      from: pathOf(pick(source, 'Redirect from', 'from', 'Path')),
      to: pathOf(pick(source, 'Redirect to', 'to', 'Target')) || pick(source, 'Redirect to', 'to'),
      status_code: '301',
    })
  );
}

export const shopify: VendorAdapter = {
  slug: 'shopify',
  name: 'Shopify',
  kind: 'commerce',
  connector: 'shopify',
  sources: [
    {
      id: 'shopify.products',
      entity: 'products',
      label: 'Products',
      file: 'products_export.csv',
      where: 'Products → Export → All products, CSV for Excel',
      format: 'csv',
      filePattern: /products?_export/i,
      required: ['Handle', 'Variant Price'],
      hints: ['Body (HTML)', 'Variant SKU', 'Option1 Name', 'Variant Inventory Qty'],
      map: mapProducts,
    },
    {
      id: 'shopify.customers',
      entity: 'customers',
      label: 'Customers',
      file: 'customers_export.csv',
      where: 'Customers → Export',
      format: 'csv',
      filePattern: /customers?_export/i,
      required: ['First Name', 'Accepts Email Marketing'],
      hints: ['Default Address Province Code', 'Total Spent'],
      map: mapCustomers,
    },
    {
      id: 'shopify.orders',
      entity: 'orders',
      label: 'Orders',
      file: 'orders_export.csv',
      where: 'Orders → Export',
      format: 'csv',
      filePattern: /orders?_export/i,
      required: ['Lineitem quantity', 'Financial Status'],
      hints: ['Lineitem sku', 'Fulfillment Status', 'Shipping Method'],
      map: mapOrders,
    },
    {
      id: 'shopify.inventory',
      entity: 'inventory_levels',
      label: 'Stock levels',
      file: 'inventory_export.csv',
      where: 'Products → Inventory → Export',
      format: 'csv',
      filePattern: /inventory_export/i,
      required: ['Handle', 'SKU'],
      hints: ['HS Code', 'COO', 'Option1 Value'],
      map: mapInventory,
    },
    {
      id: 'shopify.discounts',
      entity: 'discounts',
      label: 'Discount codes',
      file: 'discounts_export.csv',
      where: 'Discounts → Export',
      format: 'csv',
      filePattern: /discounts?_export/i,
      required: ['Value Type', 'Minimum Requirement Type'],
      hints: ['Applies Once Per Customer', 'Customer Eligibility'],
      map: mapDiscounts,
    },
    {
      id: 'shopify.redirects',
      entity: 'redirects',
      label: 'URL redirects',
      file: 'redirects.csv',
      where: 'Online Store → Navigation → URL Redirects → Export',
      format: 'csv',
      filePattern: /redirect/i,
      required: ['Redirect from', 'Redirect to'],
      map: mapRedirects,
    },
  ],
};

/** Exported for tests and for the live connector, which produces the same wide shape
 *  from the Admin API's inventoryLevels edges and then reuses these mappers. */
export const shopifyInternals = {
  mapProducts,
  mapCustomers,
  mapOrders,
  mapInventory,
  mapDiscounts,
  mapRedirects,
};
