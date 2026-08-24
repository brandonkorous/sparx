// Plumbing shared across the reorder pane's files.

import type { OpenTarget } from '../../lib/surfaces/registry';
import type { ReorderRow } from './reorder-data';

/** Same modifier contract as every other list in the app. */
export function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** The stable identity of a worklist row: one product in one place. */
export function rowKey(row: Pick<ReorderRow, 'variantId' | 'warehouseId'>): string {
  return `${row.variantId}:${row.warehouseId}`;
}

/**
 * What to try when nothing matched — naming ONLY the narrowings actually in
 * force. Advice to clear a filter that was never set sends people hunting for a
 * control that is already off.
 */
export function emptyAdvice(
  search: string,
  locationName: string | null,
  supplierName: string | null
): string {
  const parts: string[] = [];
  if (search) parts.push('Try part of a product name or code.');
  if (locationName) parts.push(`You are only seeing ${locationName} — switch to every location.`);
  if (supplierName) parts.push(`You are only seeing ${supplierName} — switch to every supplier.`);
  return parts.join(' ');
}

/**
 * This used to read "Open a product, and on its Stock panel set a reorder
 * level". A product has no Stock tab — the panel is a dockable pane listed as
 * "How many you have" — so it named the right thing in the wrong place. The
 * button beside this sentence opens it.
 */
export const REORDER_RULES_ADVICE =
  'Nothing can be flagged as running low until you say when to reorder it. Set a reorder level and how many to buy on How many you have, and this list fills itself in as those items run down.';
