// Wix.
//
// Wix's catalogue export is the odd one on the roster: a `fieldType` column
// discriminates each row as `Product` or `Variant`, and the variant rows carry ONLY
// the fields that differ, with `handleId` tying them to the parent. Everything else —
// title, description, images — appears once, on the product row.
//
// Two quirks worth knowing, because both silently corrupt a naive import:
//
//   `productImageUrl` is a SEMICOLON-separated list, not a comma-separated one, so a
//   comma split yields one URL containing the whole gallery.
//
//   `price` on a variant row is often blank meaning "same as the parent", but
//   `surcharge` carries a DELTA to add to it. A variant priced at parent + $4 reads
//   as free if you take the price cell literally.

import type { CanonicalRow } from '../canonical';
import { toCents } from '../coerce';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { groupBy, indexed, pick, row, tags } from './_helpers';

function mapProducts(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];

  for (const [handle, group] of groupBy(rows, (source) => pick(source, 'handleId'))) {
    const head =
      group.find((source) => pick(source, 'fieldType').toLowerCase() === 'product') ?? group[0]!;
    const variants = group.filter(
      (source) => pick(source, 'fieldType').toLowerCase() === 'variant'
    );
    const effective = variants.length > 0 ? variants : [head];

    const images = pick(head, 'productImageUrl')
      .split(';')
      .map((url) => url.trim())
      .filter((url) => url !== '');

    const parentPrice = toCents(pick(head, 'price'));
    const optionNames = indexed(head, (n) => `productOptionName${n}`, 6);

    effective.forEach((source, index) => {
      const ownPrice = toCents(pick(source, 'price'));
      const surcharge = toCents(pick(source, 'surcharge'));
      // Resolve the variant's real price: its own if it has one, else the parent's
      // plus any surcharge. Falling back to the parent alone would under-price every
      // upgraded variant in the catalogue.
      const cents =
        ownPrice !== undefined && ownPrice !== 0
          ? ownPrice
          : parentPrice === undefined
            ? undefined
            : parentPrice + (surcharge ?? 0);

      const optionValues = indexed(source, (n) => `productOptionDescription${n}`, 6);

      out.push(
        row({
          handle,
          title: pick(head, 'name'),
          description: pick(head, 'description'),
          sku: pick(source, 'sku') || pick(head, 'sku'),
          status: pick(head, 'visible').toLowerCase() === 'true' ? 'active' : 'draft',
          collections: pick(head, 'collection'),
          tags: tags(pick(head, 'ribbon')),
          price: cents === undefined ? '' : String(cents / 100),
          cost_per_item: pick(source, 'cost') || pick(head, 'cost'),
          quantity: pick(source, 'inventory') || pick(head, 'inventory'),
          track_inventory: pick(source, 'inventory') === '' ? 'false' : 'true',
          weight_kg: pick(source, 'weight') || pick(head, 'weight'),
          option1_name: optionNames[0],
          option1_value: optionValues[0],
          option2_name: optionNames[1],
          option2_value: optionValues[1],
          option3_name: optionNames[2],
          option3_value: optionValues[2],
          images: index === 0 ? images.join(', ') : '',
          image_url: index === 0 ? images[0] : '',
          fulfillment_type:
            pick(head, 'productType').toLowerCase() === 'digital' ? 'digital' : 'physical',
        })
      );
    });
  }

  return out;
}

function mapContacts(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) =>
    row({
      email: pick(source, 'Email', 'Email 1', 'Primary Email'),
      first_name: pick(source, 'First Name'),
      last_name: pick(source, 'Last Name'),
      phone: pick(source, 'Phone', 'Phone 1', 'Primary Phone'),
      company: pick(source, 'Company'),
      address1: pick(source, 'Address', 'Street Address', 'Address Line 1'),
      city: pick(source, 'City'),
      province: pick(source, 'State', 'Subdivision'),
      country: pick(source, 'Country'),
      zip: pick(source, 'Zip', 'Postal Code'),
      tags: tags(pick(source, 'Labels')),
      accepts_marketing: pick(source, 'Subscriber Status', 'Subscribed'),
      type: 'person',
    })
  );
}

function mapOrders(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];
  for (const [number, group] of groupBy(rows, (source) =>
    pick(source, 'Order Number', 'Order #')
  )) {
    group.forEach((source, index) => {
      const head = group[0]!;
      out.push(
        row({
          order_number: number,
          email: index === 0 ? pick(head, 'Recipient Email', 'Buyer Email', 'Email') : '',
          customer_name: index === 0 ? pick(head, 'Recipient Name', 'Buyer Name') : '',
          placed_at: index === 0 ? pick(head, 'Date', 'Order Date') : '',
          currency: index === 0 ? pick(head, 'Currency') : '',
          financial_status: index === 0 ? pick(head, 'Payment Status') : '',
          fulfillment_status: index === 0 ? pick(head, 'Fulfillment Status') : '',
          total: index === 0 ? pick(head, 'Total') : '',
          shipping: index === 0 ? pick(head, 'Shipping') : '',
          tax: index === 0 ? pick(head, 'Tax') : '',
          discount: index === 0 ? pick(head, 'Discount') : '',
          ship_address1: index === 0 ? pick(head, 'Shipping Address') : '',
          ship_city: index === 0 ? pick(head, 'Shipping City') : '',
          ship_country: index === 0 ? pick(head, 'Shipping Country') : '',
          ship_zip: index === 0 ? pick(head, 'Shipping Zip') : '',
          line_title: pick(source, 'Item Name', 'Product Name'),
          line_sku: pick(source, 'SKU'),
          line_quantity: pick(source, 'Quantity'),
          line_price: pick(source, 'Item Price', 'Price'),
        })
      );
    });
  }
  return out;
}

export const wix: VendorAdapter = {
  slug: 'wix',
  name: 'Wix',
  kind: 'site',
  sources: [
    {
      id: 'wix.products',
      entity: 'products',
      label: 'Products',
      file: 'catalog_products.csv',
      where: 'Store Products → More Actions → Export',
      format: 'csv',
      filePattern: /catalog_products/i,
      required: ['handleId', 'fieldType'],
      hints: ['productImageUrl', 'surcharge', 'discountMode', 'ribbon'],
      map: mapProducts,
    },
    {
      id: 'wix.contacts',
      entity: 'customers',
      label: 'Contacts',
      file: 'contacts.csv',
      where: 'Contacts → More Actions → Export',
      format: 'csv',
      required: ['Email'],
      hints: ['Labels', 'Subscriber Status'],
      map: mapContacts,
    },
    {
      id: 'wix.orders',
      entity: 'orders',
      label: 'Orders',
      file: 'orders.csv',
      where: 'Store Orders → More Actions → Export',
      format: 'csv',
      required: ['Order Number'],
      hints: ['Payment Status', 'Fulfillment Status', 'Recipient Name'],
      map: mapOrders,
    },
  ],
};

export const wixInternals = { mapProducts, mapContacts, mapOrders };
