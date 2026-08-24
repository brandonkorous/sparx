// The vocabulary the products list is built from: the filter chips, the
// row-open contract, and what to say when nothing matched.

import type { OpenTarget } from '../../lib/surfaces/registry';
import type { ProductStatus } from './products-data';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
export const MODULE = 'commerce';

/**
 * The chips are the questions, not the stored words.
 *
 * "Retired" carries `includeArchived` as well as the status, because the server
 * hides archived rows by default — asking for them by status alone comes back
 * empty, which reads as "you have none" when you have forty.
 */
export const FILTERS = [
  { value: 'all', label: 'All', status: undefined, includeArchived: false },
  { value: 'active', label: 'On sale', status: 'active', includeArchived: false },
  { value: 'draft', label: 'Not on sale', status: 'draft', includeArchived: false },
  { value: 'archived', label: 'Retired', status: 'archived', includeArchived: true },
] as const satisfies readonly {
  value: string;
  label: string;
  status: ProductStatus | undefined;
  includeArchived: boolean;
}[];

export type FilterValue = (typeof FILTERS)[number]['value'];

export interface Modifiers {
  shiftKey: boolean;
  altKey: boolean;
}

/** Same modifier contract as every other list in the app. */
export function targetFor(event: Modifiers): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/**
 * What to try when nothing matched — naming ONLY what is actually narrowing the
 * list. Telling someone to clear a filter they never set sends them hunting for a
 * control that is already off.
 */
export function emptyAdvice(search: string, filterLabel: string | null): string {
  const parts: string[] = [];
  if (search) parts.push('Try part of the product name, its web address, or the brand.');
  if (filterLabel) {
    parts.push(
      `You are only seeing products marked “${filterLabel}” — switch to All for the rest.`
    );
  }
  return parts.join(' ');
}
