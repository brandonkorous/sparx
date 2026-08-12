// Big Cartel.
//
// The smallest shops on the roster, and the ones for whom a migration is most likely
// to be their first ever — a band with twelve shirts, an artist with prints. So this
// adapter is deliberately forgiving: Big Cartel's exports have changed header casing
// three times, and a maker who has just discovered CSV should not lose an afternoon to
// it. Every column is read through the alias list rather than a fixed name.
//
// Options are one row per option (`option_name`, `option_quantity`, `option_price`)
// under a repeated product, which is the same shape as everyone else once grouped.

import type { CanonicalRow } from '../canonical';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { groupBy, pick, row, tags } from './_helpers';

function mapProducts(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];

  for (const [handle, group] of groupBy(rows, (source) =>
    pick(source, 'permalink', 'Permalink', 'name', 'Name', 'Product')
  )) {
    const head = group[0]!;
    group.forEach((source, index) => {
      const optionName = pick(source, 'option_name', 'Option', 'Option Name');
      out.push(
        row({
          handle,
          title: pick(head, 'name', 'Name', 'Product'),
          description: pick(head, 'description', 'Description'),
          sku: pick(source, 'option_sku', 'SKU', 'sku'),
          status: pick(head, 'status', 'Status').toLowerCase() === 'active' ? 'active' : 'draft',
          vendor: pick(head, 'artist', 'Artist'),
          collections: pick(head, 'category', 'Category', 'Categories'),
          tags: tags(pick(head, 'tags', 'Tags')),
          price: pick(source, 'option_price', 'Option Price') || pick(head, 'price', 'Price'),
          quantity: pick(source, 'option_quantity', 'Option Quantity', 'Quantity', 'Inventory'),
          track_inventory:
            pick(source, 'option_quantity', 'Option Quantity', 'Quantity') === ''
              ? 'false'
              : 'true',
          option1_name: optionName === '' ? '' : 'Option',
          option1_value: optionName,
          images: index === 0 ? pick(head, 'images', 'Images', 'Image URL') : '',
          image_url:
            index === 0 ? pick(head, 'images', 'Images', 'Image URL').split(/[,;\s]+/)[0] : '',
          source_url: handle === '' ? '' : `/product/${handle}`,
        })
      );
    });
  }

  return out;
}

function mapOrders(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];
  for (const [number, group] of groupBy(rows, (source) =>
    pick(source, 'Order Number', 'order_number', 'id')
  )) {
    const head = group[0]!;
    group.forEach((source, index) => {
      out.push(
        row({
          order_number: number,
          email: index === 0 ? pick(head, 'Customer Email', 'email') : '',
          customer_name:
            index === 0
              ? `${pick(head, 'Customer First Name', 'first_name')} ${pick(head, 'Customer Last Name', 'last_name')}`.trim()
              : '',
          placed_at: index === 0 ? pick(head, 'Date', 'placed_at', 'created_at') : '',
          financial_status: index === 0 ? pick(head, 'Status', 'status') : '',
          total: index === 0 ? pick(head, 'Total', 'total') : '',
          shipping: index === 0 ? pick(head, 'Shipping', 'shipping_total') : '',
          tax: index === 0 ? pick(head, 'Tax', 'tax_total') : '',
          discount: index === 0 ? pick(head, 'Discount', 'discount_total') : '',
          ship_address1: index === 0 ? pick(head, 'Shipping Address 1', 'shipping_address_1') : '',
          ship_city: index === 0 ? pick(head, 'Shipping City', 'shipping_city') : '',
          ship_province: index === 0 ? pick(head, 'Shipping State', 'shipping_state') : '',
          ship_country: index === 0 ? pick(head, 'Shipping Country', 'shipping_country') : '',
          ship_zip: index === 0 ? pick(head, 'Shipping Zip', 'shipping_zip') : '',
          line_title: pick(source, 'Product Name', 'Product', 'product_name'),
          line_quantity: pick(source, 'Quantity', 'quantity'),
          line_price: pick(source, 'Price', 'price'),
          line_sku: pick(source, 'SKU', 'sku'),
        })
      );
    });
  }
  return out;
}

export const bigcartel: VendorAdapter = {
  slug: 'bigcartel',
  name: 'Big Cartel',
  kind: 'commerce',
  sources: [
    {
      id: 'bigcartel.products',
      entity: 'products',
      label: 'Products',
      file: 'products.csv',
      where: 'Admin → Products → Export products',
      format: 'csv',
      required: ['permalink'],
      hints: ['option_name', 'option_quantity', 'artist', 'option_price'],
      map: mapProducts,
    },
    {
      id: 'bigcartel.orders',
      entity: 'orders',
      label: 'Orders',
      file: 'orders.csv',
      where: 'Admin → Orders → Export orders',
      format: 'csv',
      required: ['Order Number'],
      hints: ['Customer First Name', 'Shipping Address 1', 'Product Name'],
      map: mapOrders,
    },
  ],
};

export const bigcartelInternals = { mapProducts, mapOrders };
