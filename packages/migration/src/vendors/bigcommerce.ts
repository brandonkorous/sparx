// BigCommerce.
//
// `Item Type` discriminates the rows: `Product` is the parent, `SKU` is a variant, and
// `Rule` is a pricing/visibility rule attached to an option combination. Rules are
// skipped — they are BigCommerce's own modifier engine and have no equivalent shape
// here, and importing them as products would put dozens of phantom SKUs in the
// catalogue.
//
// Images are numbered columns (`Product Image File - 1` … `- 8`), and the tenant's
// export may carry either the file name or a full CDN URL depending on whether they
// ticked "export images". Both are passed through; the media processor resolves what
// it can reach and reports what it cannot, which is better than silently dropping a
// catalogue's photography.

import type { CanonicalRow } from '../canonical';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { groupBy, indexed, pick, productStatus, row, tags } from './_helpers';

function mapProducts(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];

  // Continuation rows leave Product ID blank, so groupBy's blank-continues-previous
  // rule is doing real work here rather than being defensive — and the key must be
  // Product ID ALONE. Falling back to the SKU column would give every variant row its
  // own group, which turns one product with three sizes into four products.
  //
  // `Rule` rows are BigCommerce's option-modifier engine (surcharge this combination,
  // hide that one). They have no equivalent here and are dropped before grouping, so
  // they cannot be mistaken for a variant.
  const catalogue = rows.filter((source) => pick(source, 'Item Type').toLowerCase() !== 'rule');

  for (const [productId, group] of groupBy(catalogue, (source) => pick(source, 'Product ID'))) {
    const head =
      group.find((source) => pick(source, 'Item Type').toLowerCase() === 'product') ?? group[0]!;
    const variants = group.filter((source) => pick(source, 'Item Type').toLowerCase() === 'sku');
    const effective = variants.length > 0 ? variants : [head];

    const images = indexed(head, (n) => `Product Image File - ${n}`, 8);
    const handle =
      pick(head, 'Product URL').split('/').filter(Boolean).pop() ??
      pick(head, 'Product Code/SKU') ??
      productId;

    effective.forEach((source, index) => {
      const sale = pick(source, 'Sale Price') || pick(head, 'Sale Price');
      const list = pick(source, 'Price') || pick(head, 'Price');
      const retail = pick(head, 'Retail Price');

      out.push(
        row({
          handle,
          title: pick(head, 'Product Name'),
          description: pick(head, 'Product Description'),
          sku: pick(source, 'Product Code/SKU'),
          vendor: pick(head, 'Brand Name'),
          status: productStatus(pick(head, 'Product Visible?'), ['yes', 'true', '1', 'visible']),
          category: pick(head, 'Category').split(';')[0]?.split('/').pop()?.trim(),
          // BigCommerce writes `Home/Shirts/Tees; Home/Sale` — semicolons between
          // paths, slashes for depth.
          collections: pick(head, 'Category')
            .split(';')
            .map((path) => path.split('/').pop()?.trim() ?? '')
            .filter(Boolean)
            .join(', '),
          tags: tags(pick(head, 'Product Tags')),
          price: sale !== '' ? sale : list,
          compare_at_price: sale !== '' ? list : retail !== list ? retail : '',
          cost_per_item: pick(source, 'Cost Price') || pick(head, 'Cost Price'),
          quantity: pick(source, 'Current Stock Level') || pick(head, 'Current Stock Level'),
          track_inventory: pick(head, 'Track Inventory').toLowerCase().includes('none')
            ? 'false'
            : 'true',
          weight_kg: '',
          barcode: pick(source, 'Product UPC/EAN') || pick(head, 'Product UPC/EAN'),
          option1_name: pick(source, 'Product Option 1 Name', 'Option Set'),
          option1_value: pick(source, 'Product Option 1 Value'),
          option2_name: pick(source, 'Product Option 2 Name'),
          option2_value: pick(source, 'Product Option 2 Value'),
          images: index === 0 ? images.join(', ') : '',
          image_url: index === 0 ? images[0] : '',
          seo_title: index === 0 ? pick(head, 'Page Title') : '',
          seo_description: index === 0 ? pick(head, 'Meta Description') : '',
          fulfillment_type:
            pick(head, 'Product Type').toLowerCase() === 'digital' ? 'digital' : 'physical',
          source_url: pick(head, 'Product URL'),
        })
      );
    });
  }

  return out;
}

function mapCustomers(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) =>
    row({
      email: pick(source, 'Email Address', 'Email'),
      first_name: pick(source, 'First Name'),
      last_name: pick(source, 'Last Name'),
      company: pick(source, 'Company Name', 'Company'),
      phone: pick(source, 'Phone Number', 'Phone'),
      address1: pick(source, 'Address Line 1', 'Address 1'),
      address2: pick(source, 'Address Line 2', 'Address 2'),
      city: pick(source, 'City', 'Suburb/City'),
      province: pick(source, 'State/Province', 'State'),
      country: pick(source, 'Country'),
      zip: pick(source, 'Zip/Postcode', 'Zip'),
      accepts_marketing: pick(source, 'Receives Marketing Emails', 'Store Credit'),
      created_at: pick(source, 'Date Joined', 'Customer Since'),
      type: pick(source, 'Company Name') !== '' ? 'company' : 'person',
    })
  );
}

function mapOrders(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];
  for (const [number, group] of groupBy(rows, (source) =>
    pick(source, 'Order ID', 'Order Number')
  )) {
    const head = group[0]!;
    group.forEach((source, index) => {
      out.push(
        row({
          order_number: number,
          email: index === 0 ? pick(head, 'Customer Email', 'Email') : '',
          customer_name: index === 0 ? pick(head, 'Customer Name') : '',
          placed_at: index === 0 ? pick(head, 'Order Date', 'Date') : '',
          financial_status: index === 0 ? pick(head, 'Payment Status') : '',
          fulfillment_status: index === 0 ? pick(head, 'Order Status', 'Status') : '',
          subtotal: index === 0 ? pick(head, 'Subtotal') : '',
          shipping: index === 0 ? pick(head, 'Shipping Cost') : '',
          tax: index === 0 ? pick(head, 'Tax') : '',
          discount: index === 0 ? pick(head, 'Discount Amount') : '',
          total: index === 0 ? pick(head, 'Order Total', 'Total') : '',
          currency: index === 0 ? pick(head, 'Currency Code', 'Currency') : '',
          ship_name: index === 0 ? pick(head, 'Shipping First Name') : '',
          ship_address1: index === 0 ? pick(head, 'Shipping Address Line 1') : '',
          ship_city: index === 0 ? pick(head, 'Shipping City') : '',
          ship_province: index === 0 ? pick(head, 'Shipping State') : '',
          ship_country: index === 0 ? pick(head, 'Shipping Country') : '',
          ship_zip: index === 0 ? pick(head, 'Shipping Zip') : '',
          line_sku: pick(source, 'Product SKU', 'SKU'),
          line_title: pick(source, 'Product Name'),
          line_quantity: pick(source, 'Quantity'),
          line_price: pick(source, 'Product Price', 'Price'),
        })
      );
    });
  }
  return out;
}

export const bigcommerce: VendorAdapter = {
  slug: 'bigcommerce',
  name: 'BigCommerce',
  kind: 'commerce',
  sources: [
    {
      id: 'bigcommerce.products',
      entity: 'products',
      label: 'Products',
      file: 'products.csv',
      where: 'Products → Export → Bulk Edit template → Export to CSV',
      format: 'csv',
      required: ['Item Type', 'Product Name'],
      hints: ['Product Code/SKU', 'Current Stock Level', 'Brand Name', 'Product Visible?'],
      map: mapProducts,
    },
    {
      id: 'bigcommerce.customers',
      entity: 'customers',
      label: 'Customers',
      file: 'customers.csv',
      where: 'Customers → Export → Export to CSV',
      format: 'csv',
      required: ['Email Address'],
      hints: ['Customer Group', 'Store Credit', 'Date Joined'],
      map: mapCustomers,
    },
    {
      id: 'bigcommerce.orders',
      entity: 'orders',
      label: 'Orders',
      file: 'orders.csv',
      where: 'Orders → Export → Export to CSV',
      format: 'csv',
      required: ['Order ID'],
      hints: ['Order Status', 'Product SKU', 'Shipping Address Line 1'],
      map: mapOrders,
    },
  ],
};

export const bigcommerceInternals = { mapProducts, mapCustomers, mapOrders };
