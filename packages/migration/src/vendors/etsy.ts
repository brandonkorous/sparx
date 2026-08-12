// Etsy.
//
// Etsy is where a lot of small makers start and the place they most often outgrow —
// usually the moment fees, or the fact that they do not own the customer relationship,
// starts to matter. So this adapter's job is not only the catalogue: the sold-orders
// file is the ONLY copy a seller has of who bought from them, because Etsy does not
// give them a customer list at all.
//
// Two format facts drive the mapping. Images are ten fixed columns (`IMAGE1` …
// `IMAGE10`), not a list. And variations are stored as `VARIATION 1 TYPE` /
// `VARIATION 1 NAME` / `VARIATION 1 VALUES`, where VALUES is a comma-separated set of
// every possible value — one listing row therefore describes a whole option matrix
// rather than one variant, which is why this mapper expands it.

import type { CanonicalRow } from '../canonical';
import { toList } from '../coerce';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { groupBy, indexed, pick, row, tags } from './_helpers';

function mapListings(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];

  for (const source of rows) {
    const title = pick(source, 'TITLE');
    if (title === '') continue;
    const images = indexed(source, (n) => `IMAGE${n}`, 10);
    const baseSku = pick(source, 'SKU');
    const handle = (baseSku || title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 80);

    const option1Name = pick(source, 'VARIATION 1 NAME', 'VARIATION 1 TYPE');
    const option1Values = toList(pick(source, 'VARIATION 1 VALUES'));
    const option2Name = pick(source, 'VARIATION 2 NAME', 'VARIATION 2 TYPE');
    const option2Values = toList(pick(source, 'VARIATION 2 VALUES'));

    // Expand the declared option values into one row per combination. Etsy caps a
    // listing at two variation axes, so this is a pair of loops rather than a
    // recursive product — and capping the expansion keeps a listing with 20 × 20
    // declared values from becoming 400 phantom variants.
    const first = option1Values.length > 0 ? option1Values.slice(0, 40) : [''];
    const second = option2Values.length > 0 ? option2Values.slice(0, 40) : [''];

    let index = 0;
    for (const value1 of first) {
      for (const value2 of second) {
        const suffix = [value1, value2].filter((value) => value !== '').join('-');
        out.push(
          row({
            handle,
            title,
            description: pick(source, 'DESCRIPTION'),
            sku:
              baseSku === ''
                ? suffix === ''
                  ? handle
                  : `${handle}-${suffix}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')
                : suffix === ''
                  ? baseSku
                  : `${baseSku}-${suffix}`.toUpperCase().replace(/[^A-Z0-9-]+/g, '-'),
            status: 'active',
            price: pick(source, 'PRICE'),
            currency: pick(source, 'CURRENCY_CODE'),
            // Etsy's QUANTITY is per LISTING, not per variation. Splitting it across
            // variants would invent stock; repeating it would multiply it. It is
            // carried on the first row only, and the marketing page says stock needs a
            // once-over after an Etsy move.
            quantity: index === 0 ? pick(source, 'QUANTITY') : '',
            track_inventory: 'true',
            tags: tags(pick(source, 'TAGS')),
            product_type: pick(source, 'MATERIALS') === '' ? '' : 'Handmade',
            option1_name: option1Name,
            option1_value: value1,
            option2_name: option2Name,
            option2_value: value2,
            images: index === 0 ? images.join(', ') : '',
            image_url: index === 0 ? images[0] : '',
          })
        );
        index++;
      }
    }
  }

  return out;
}

function mapSoldOrders(rows: SourceRow[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];
  for (const [orderId, group] of groupBy(rows, (source) => pick(source, 'Order ID'))) {
    const head = group[0]!;
    group.forEach((source, index) => {
      out.push(
        row({
          order_number: orderId,
          customer_name: index === 0 ? pick(head, 'Buyer', 'Ship Name') : '',
          placed_at: index === 0 ? pick(head, 'Sale Date') : '',
          currency: index === 0 ? pick(head, 'Currency') : '',
          financial_status: index === 0 && pick(head, 'Date Paid') !== '' ? 'paid' : '',
          fulfillment_status: index === 0 && pick(head, 'Date Shipped') !== '' ? 'fulfilled' : '',
          shipping: index === 0 ? pick(head, 'Order Shipping') : '',
          tax: index === 0 ? pick(head, 'Order Sales Tax') : '',
          discount: index === 0 ? pick(head, 'Discount Amount') : '',
          total: index === 0 ? pick(head, 'Order Total', 'Item Total') : '',
          discount_code: index === 0 ? pick(head, 'Coupon Code') : '',
          ship_name: index === 0 ? pick(head, 'Ship Name') : '',
          ship_address1: index === 0 ? pick(head, 'Ship Address1') : '',
          ship_address2: index === 0 ? pick(head, 'Ship Address2') : '',
          ship_city: index === 0 ? pick(head, 'Ship City') : '',
          ship_province: index === 0 ? pick(head, 'Ship State') : '',
          ship_country: index === 0 ? pick(head, 'Ship Country') : '',
          ship_zip: index === 0 ? pick(head, 'Ship Zipcode') : '',
          line_title: pick(source, 'Item Name'),
          line_sku: pick(source, 'SKU'),
          line_quantity: pick(source, 'Quantity'),
          line_price: pick(source, 'Price'),
        })
      );
    });
  }
  return out;
}

/** The buyer list, reconstructed from the orders file — the only place it exists. */
function mapBuyers(rows: SourceRow[]): CanonicalRow[] {
  const seen = new Map<string, CanonicalRow>();
  for (const source of rows) {
    const name = pick(source, 'Ship Name', 'Buyer');
    if (name === '') continue;
    const key = `${name}|${pick(source, 'Ship Zipcode')}`.toLowerCase();
    if (seen.has(key)) continue;
    const [first = '', ...rest] = name.split(' ');
    seen.set(
      key,
      row({
        name,
        first_name: first,
        last_name: rest.join(' '),
        address1: pick(source, 'Ship Address1'),
        address2: pick(source, 'Ship Address2'),
        city: pick(source, 'Ship City'),
        province: pick(source, 'Ship State'),
        country: pick(source, 'Ship Country'),
        zip: pick(source, 'Ship Zipcode'),
        created_at: pick(source, 'Sale Date'),
        type: 'person',
      })
    );
  }
  return [...seen.values()];
}

export const etsy: VendorAdapter = {
  slug: 'etsy',
  name: 'Etsy',
  kind: 'commerce',
  sources: [
    {
      id: 'etsy.listings',
      entity: 'products',
      label: 'Listings',
      file: 'EtsyListingsDownload.csv',
      where: 'Shop Manager → Settings → Options → Download Data → Currently for sale listings',
      format: 'csv',
      filePattern: /etsy.*listing/i,
      required: ['TITLE', 'CURRENCY_CODE'],
      hints: ['IMAGE1', 'VARIATION 1 TYPE', 'MATERIALS', 'QUANTITY'],
      map: mapListings,
    },
    {
      id: 'etsy.orders',
      entity: 'orders',
      label: 'Sold orders',
      file: 'EtsySoldOrderItems.csv',
      where: 'Shop Manager → Settings → Options → Download Data → Orders',
      format: 'csv',
      filePattern: /etsy.*(sold|order)/i,
      required: ['Order ID', 'Sale Date'],
      hints: ['Ship Zipcode', 'Coupon Code', 'Listing ID'],
      map: mapSoldOrders,
    },
    {
      id: 'etsy.buyers',
      entity: 'customers',
      label: 'Buyers',
      file: 'EtsySoldOrderItems.csv',
      where: 'The same orders file — Etsy has no customer export',
      format: 'csv',
      required: ['Order ID', 'Ship Name'],
      hints: ['Buyer', 'Sale Date'],
      map: mapBuyers,
    },
  ],
};

export const etsyInternals = { mapListings, mapSoldOrders, mapBuyers };
