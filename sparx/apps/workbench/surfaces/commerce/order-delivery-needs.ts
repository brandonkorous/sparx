// What a trade buyer said about delivery when they asked for the quote an order
// came from (sparx persona issue 086), as rows to read on the order. It rides
// from the quote onto the order in `metadata.delivery`, beside the PO number,
// and `deliveryNeedsOf` is the one reader of that bag.

import { deliveryNeedsOf } from '@wizeworks/crm-schemas';

/**
 * A calendar day (`YYYY-MM-DD`) as words. Built from its parts rather than
 * parsed, because `new Date('2026-10-20')` is midnight in London, which is the
 * evening of the 19th in Salt Lake City: the buyer asked for the 20th.
 */
function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/** Needed by, Deliver to and Delivery notes: only what the buyer said. */
export function orderDeliveryRows(metadata: unknown): { label: string; value: string }[] {
  const needs = deliveryNeedsOf(metadata);
  if (!needs) return [];
  const rows: { label: string; value: string }[] = [];
  if (needs.neededBy) rows.push({ label: 'Needed by', value: formatDay(needs.neededBy) });
  if (needs.deliverTo) rows.push({ label: 'Deliver to', value: needs.deliverTo });
  if (needs.notes) rows.push({ label: 'Delivery notes', value: needs.notes });
  return rows;
}
