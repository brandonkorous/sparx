// GoDaddy Websites + Marketing.
//
// A large install base of very small businesses, and an export that is exactly as
// plain as that suggests: one row per product, no variant structure at all, options
// flattened into a single text cell. There is nothing clever to do here — the value is
// that it works at all, because GoDaddy's own documentation mostly tells people to
// re-enter their catalogue by hand.
//
// The contacts export is the more valuable half. GoDaddy bundles email marketing, so
// the contact list is usually the tenant's real mailing list, subscription state
// included.

import type { CanonicalRow } from '../canonical';
import { toList } from '../coerce';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { pick, productStatus, row, tags } from './_helpers';

function mapProducts(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const images = toList(pick(source, 'Images', 'Image', 'Image URL'), ',');
    // GoDaddy writes options as `Size: Small, Medium; Colour: Blue` in one cell. Only
    // the first axis is recoverable, and inventing the rest would be worse than
    // carrying one honest option the tenant can extend.
    const optionCell = pick(source, 'Options', 'Variants');
    const [firstAxis = ''] = optionCell.split(';');
    const colon = firstAxis.indexOf(':');

    return row({
      handle: pick(source, 'SKU', 'Product ID') || pick(source, 'Product Name', 'Name'),
      title: pick(source, 'Product Name', 'Name', 'Title'),
      description: pick(source, 'Product Description', 'Description'),
      sku: pick(source, 'SKU'),
      status: productStatus(pick(source, 'Visible', 'Status', 'Published')),
      price: pick(source, 'Sale Price') || pick(source, 'Price'),
      compare_at_price: pick(source, 'Sale Price') !== '' ? pick(source, 'Price') : '',
      cost_per_item: pick(source, 'Cost'),
      quantity: pick(source, 'Quantity', 'Inventory', 'Stock'),
      track_inventory: pick(source, 'Track Inventory'),
      weight_kg: pick(source, 'Weight'),
      collections: pick(source, 'Categories', 'Category'),
      tags: tags(pick(source, 'Tags')),
      option1_name: colon === -1 ? '' : firstAxis.slice(0, colon).trim(),
      option1_value: colon === -1 ? '' : firstAxis.slice(colon + 1).trim(),
      images: images.join(', '),
      image_url: images[0],
    });
  });
}

function mapContacts(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) =>
    row({
      email: pick(source, 'Email', 'Email Address'),
      first_name: pick(source, 'First Name', 'FirstName'),
      last_name: pick(source, 'Last Name', 'LastName'),
      phone: pick(source, 'Phone', 'Phone Number'),
      company: pick(source, 'Company', 'Organization'),
      address1: pick(source, 'Address', 'Address Line 1'),
      city: pick(source, 'City'),
      province: pick(source, 'State', 'Region'),
      country: pick(source, 'Country'),
      zip: pick(source, 'Zip', 'Postal Code'),
      accepts_marketing: pick(source, 'Subscribed', 'Subscription Status', 'Email Opt In'),
      tags: tags(pick(source, 'Tags', 'Lists')),
      created_at: pick(source, 'Date Added', 'Created'),
      type: 'person',
    })
  );
}

export const godaddy: VendorAdapter = {
  slug: 'godaddy',
  name: 'GoDaddy',
  kind: 'site',
  sources: [
    {
      id: 'godaddy.products',
      entity: 'products',
      label: 'Products',
      file: 'products.csv',
      where: 'Websites + Marketing → Online Store → Products → Export',
      format: 'csv',
      required: ['Product Name', 'Price'],
      hints: ['Product Description', 'Track Inventory', 'Visible'],
      map: mapProducts,
    },
    {
      id: 'godaddy.contacts',
      entity: 'customers',
      label: 'Contacts',
      file: 'contacts.csv',
      where: 'Websites + Marketing → Connections → Contacts → Export',
      format: 'csv',
      required: ['Email'],
      hints: ['Subscription Status', 'Date Added', 'Lists'],
      map: mapContacts,
    },
  ],
};

export const godaddyInternals = { mapProducts, mapContacts };
