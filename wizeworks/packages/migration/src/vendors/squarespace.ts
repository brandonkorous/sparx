// Squarespace.
//
// Squarespace's product CSV is a near-copy of Shopify's — repeated rows per product,
// options in numbered pairs — with two differences that matter. It has no `Handle`
// column, so grouping is by `Product ID [Non Editable]`; and it ships images as a
// SPACE-separated list in one cell (`Hosted Image URLs`), which every generic CSV
// importer on the market treats as a single broken URL.
//
// The site itself exports as WXR, because Squarespace built their exporter to target
// WordPress. It carries pages and blog posts — not product pages, not gallery blocks,
// not the design. The marketing page says that outright: a Squarespace migration
// brings the writing and the catalogue, and the look is rebuilt, which is the honest
// framing and also the better outcome.

import type { CanonicalRow } from '../canonical';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { groupBy, pathOf, pick, row, tags } from './_helpers';
import { wxrEntities } from './wordpress';

function mapProducts(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];

  for (const [productId, group] of groupBy(rows, (source) =>
    pick(source, 'Product ID [Non Editable]', 'Product ID')
  )) {
    const head = group[0]!;
    const images = pick(head, 'Hosted Image URLs')
      .split(/\s+/)
      .map((url) => url.trim())
      .filter((url) => url !== '');

    group.forEach((source, index) => {
      const onSale = pick(source, 'On Sale').toLowerCase() === 'yes';
      const salePrice = pick(source, 'Sale Price');
      const listPrice = pick(source, 'Price');

      out.push(
        row({
          handle: pathOf(pick(head, 'Product URL')).split('/').pop() ?? productId,
          title: pick(head, 'Title'),
          description: pick(head, 'Description'),
          sku: pick(source, 'SKU'),
          status: pick(head, 'Visible').toLowerCase() === 'yes' ? 'active' : 'draft',
          tags: tags(pick(head, 'Tags')),
          collections: pick(head, 'Categories'),
          price: onSale && salePrice !== '' ? salePrice : listPrice,
          compare_at_price: onSale && salePrice !== '' ? listPrice : '',
          quantity: pick(source, 'Stock'),
          track_inventory: pick(source, 'Stock') === '' ? 'false' : 'true',
          weight_kg: pick(source, 'Weight'),
          length_cm: pick(source, 'Length'),
          width_cm: pick(source, 'Width'),
          height_cm: pick(source, 'Height'),
          option1_name: pick(head, 'Option Name 1'),
          option1_value: pick(source, 'Option Value 1'),
          option2_name: pick(head, 'Option Name 2'),
          option2_value: pick(source, 'Option Value 2'),
          option3_name: pick(head, 'Option Name 3'),
          option3_value: pick(source, 'Option Value 3'),
          images: index === 0 ? images.join(', ') : '',
          image_url: index === 0 ? images[0] : '',
          fulfillment_type: pick(head, 'Product Type [Non Editable]')
            .toLowerCase()
            .includes('digital')
            ? 'digital'
            : pick(head, 'Product Type [Non Editable]').toLowerCase().includes('service')
              ? 'service'
              : 'physical',
          source_url: pathOf(pick(head, 'Product URL')),
        })
      );
    });
  }

  return out;
}

function mapOrders(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];
  for (const [orderId, group] of groupBy(rows, (source) => pick(source, 'Order ID'))) {
    const head = group[0]!;
    group.forEach((source, index) => {
      out.push(
        row({
          order_number: orderId,
          email: index === 0 ? pick(head, 'Email') : '',
          customer_name: index === 0 ? pick(head, 'Billing Name', 'Shipping Name') : '',
          placed_at: index === 0 ? pick(head, 'Created at') : '',
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
          ship_name: index === 0 ? pick(head, 'Shipping Name') : '',
          ship_address1: index === 0 ? pick(head, 'Shipping Address1') : '',
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

function mapContacts(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) =>
    row({
      email: pick(source, 'Email', 'Email Address'),
      first_name: pick(source, 'First Name'),
      last_name: pick(source, 'Last Name'),
      accepts_marketing: pick(source, 'Subscribed', 'Email Subscriber'),
      created_at: pick(source, 'Created', 'Date Created'),
      type: 'person',
    })
  );
}

export const squarespace: VendorAdapter = {
  slug: 'squarespace',
  name: 'Squarespace',
  kind: 'site',
  sources: [
    {
      id: 'squarespace.products',
      entity: 'products',
      label: 'Products',
      file: 'products.csv',
      where: 'Commerce → Inventory → ⋯ → Export All',
      format: 'csv',
      required: ['Product ID [Non Editable]', 'Hosted Image URLs'],
      hints: ['Variant ID [Non Editable]', 'Option Name 1', 'On Sale'],
      map: mapProducts,
    },
    {
      id: 'squarespace.orders',
      entity: 'orders',
      label: 'Orders',
      file: 'orders.csv',
      where: 'Commerce → Orders → Export → All orders',
      format: 'csv',
      required: ['Order ID', 'Lineitem quantity'],
      hints: ['Financial Status', 'Lineitem variant'],
      map: mapOrders,
    },
    {
      id: 'squarespace.contacts',
      entity: 'customers',
      label: 'Contacts',
      file: 'contacts.csv',
      where: 'Contacts → ⋯ → Export',
      format: 'csv',
      required: ['Email'],
      hints: ['Subscribed', 'Email Subscriber'],
      map: mapContacts,
    },
    {
      id: 'squarespace.content',
      entity: 'content',
      label: 'Pages and blog posts',
      file: 'Squarespace-Wordpress-Export-....xml',
      where: 'Settings → Import & Export → Export → WordPress',
      format: 'xml',
      filePattern: /squarespace.*export.*\.xml$/i,
      vendorMarker: /squarespace/i,
      required: [],
      yields: ['content', 'media', 'categories', 'redirects'],
      mapAll: wxrEntities,
    },
  ],
};

export const squarespaceInternals = { mapProducts, mapOrders, mapContacts };
