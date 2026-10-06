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
export const COUNT_LABELS: readonly { key: keyof SampleDataCounts; label: string }[] = [
  { key: 'products', label: 'Products' },
  { key: 'orders', label: 'Orders' },
  { key: 'customers', label: 'Customers' },
  { key: 'billingDocuments', label: 'Invoices & quotes' },
  { key: 'bookings', label: 'Bookings' },
  // Remove takes these too, and the tiles never said so (persona issue 085).
  { key: 'services', label: 'Services' },
  { key: 'resources', label: 'People and equipment' },
  { key: 'deals', label: 'Sales leads' },
  { key: 'tickets', label: 'Support requests' },
  { key: 'articles', label: 'Articles' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'questions', label: 'Questions' },
  { key: 'returns', label: 'Returns' },
  { key: 'collections', label: 'Collections' },
  { key: 'categories', label: 'Categories' },
  { key: 'bundles', label: 'Bundles' },
  { key: 'movements', label: 'Stock movements' },
  { key: 'images', label: 'Images' },
  { key: 'aiPrompts', label: 'AI prompts' },
  { key: 'toolCalls', label: 'AI activity' },
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
  const present = COUNT_LABELS.map(({ key, label }) => ({ n: counts[key] || 0, label })).filter(
    (entry) => entry.n > 0
  );
  if (present.length === 0) return 'no records';

  const head = present.slice(0, 3);
  const tailTotal = present.slice(3).reduce((sum, entry) => sum + entry.n, 0);

  const parts = head.map((entry) => `${String(entry.n)} ${entry.label.toLowerCase()}`);
  const phrase = parts.join(', ');
  return tailTotal > 0
    ? `${phrase} and ${String(tailTotal)} more ${tailTotal === 1 ? 'record' : 'records'}`
    : phrase;
}
