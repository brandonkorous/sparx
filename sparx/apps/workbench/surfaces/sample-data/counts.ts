// What a set of sample-data counts SAYS: the labels, the removable total, and
// the sentence a Remove confirmation and its toast are built from.
//
// Apart from `data.ts` so a test can load it without the hooks and JSX there.
// The one rule that matters here: sample LOCATIONS are kept by Remove (issue
// 174), so they are in DURABLE_COUNT_LABELS and nowhere else.

import type { SampleDataCounts } from './data';

/** Count keys in the order they read on screen, with plain-language labels.
 *  Ordered so the headline entities (products, orders, customers) come first.
 *  REMOVABLE only: `countsTotal` and `summarizeCounts` both read this list, and
 *  both feed copy that says "removes". See DURABLE_COUNT_LABELS. */
/** A count's tile label, and how a sentence says one or several of it. Lowercasing
 *  the label wrote "1 products" and "ai prompts" into the Remove confirmation. */
export interface CountLabel {
  key: keyof SampleDataCounts;
  label: string;
  one: string;
  many: string;
}

export const COUNT_LABELS: readonly CountLabel[] = [
  { key: 'products', label: 'Products', one: 'product', many: 'products' },
  { key: 'orders', label: 'Orders', one: 'order', many: 'orders' },
  { key: 'customers', label: 'Customers', one: 'customer', many: 'customers' },
  {
    key: 'billingDocuments',
    label: 'Invoices & quotes',
    one: 'invoice or quote',
    many: 'invoices and quotes',
  },
  { key: 'bookings', label: 'Bookings', one: 'booking', many: 'bookings' },
  // Remove takes these too, and the tiles never said so (persona issue 085).
  { key: 'services', label: 'Services', one: 'service', many: 'services' },
  {
    key: 'resources',
    label: 'People and equipment',
    one: 'person or piece of equipment',
    many: 'people and pieces of equipment',
  },
  // A design's example rules and places, which Remove now takes (issue 920).
  // "Booking" in both, beside the stock Locations that Remove keeps.
  { key: 'bookingRules', label: 'Booking rules', one: 'booking rule', many: 'booking rules' },
  { key: 'places', label: 'Booking places', one: 'booking place', many: 'booking places' },
  { key: 'deals', label: 'Sales leads', one: 'sales lead', many: 'sales leads' },
  { key: 'tickets', label: 'Support requests', one: 'support request', many: 'support requests' },
  { key: 'articles', label: 'Articles', one: 'article', many: 'articles' },
  { key: 'reviews', label: 'Reviews', one: 'review', many: 'reviews' },
  { key: 'questions', label: 'Questions', one: 'question', many: 'questions' },
  { key: 'returns', label: 'Returns', one: 'return', many: 'returns' },
  { key: 'collections', label: 'Collections', one: 'collection', many: 'collections' },
  { key: 'categories', label: 'Categories', one: 'category', many: 'categories' },
  { key: 'bundles', label: 'Bundles', one: 'bundle', many: 'bundles' },
  { key: 'movements', label: 'Stock movements', one: 'stock movement', many: 'stock movements' },
  { key: 'images', label: 'Images', one: 'image', many: 'images' },
  { key: 'aiPrompts', label: 'AI prompts', one: 'AI prompt', many: 'AI prompts' },
  {
    key: 'toolCalls',
    label: 'AI activity',
    one: 'piece of AI activity',
    many: 'pieces of AI activity',
  },
];

/** What sample data leaves behind after Remove: locations. Kept on purpose (a
 *  business may have renamed one and counted stock into it), so they are listed
 *  apart from the removable figures rather than folded in. Folding them into
 *  COUNT_LABELS would make the Remove confirmation promise to delete a location
 *  the server will not touch (issue 174). */
export const DURABLE_COUNT_LABELS: readonly { key: keyof SampleDataCounts; label: string }[] = [
  { key: 'warehouses', label: 'Locations' },
];

/** How many sample locations are still standing. Zero when none. */
export function durableTotal(counts: SampleDataCounts): number {
  return DURABLE_COUNT_LABELS.reduce((sum, { key }) => sum + (counts[key] || 0), 0);
}

export function countsTotal(counts: SampleDataCounts): number {
  return COUNT_LABELS.reduce((sum, { key }) => sum + (counts[key] || 0), 0);
}

/** A short human sentence of the biggest few things in a count set, for confirm
 *  copy — e.g. "24 products, 10 orders, 8 customers and 30 more records". */
export function summarizeCounts(counts: SampleDataCounts): string {
  const present = COUNT_LABELS.map(({ key, one, many }) => ({
    n: counts[key] || 0,
    one,
    many,
  })).filter((entry) => entry.n > 0);
  if (present.length === 0) return 'no records';

  const head = present.slice(0, 3);
  const tailTotal = present.slice(3).reduce((sum, entry) => sum + entry.n, 0);

  const parts = head.map((entry) => `${String(entry.n)} ${entry.n === 1 ? entry.one : entry.many}`);
  const phrase = parts.join(', ');
  return tailTotal > 0
    ? `${phrase} and ${String(tailTotal)} more ${tailTotal === 1 ? 'record' : 'records'}`
    : phrase;
}
