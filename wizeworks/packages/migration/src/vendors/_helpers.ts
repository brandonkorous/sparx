// Shared mapping helpers.
//
// Every adapter does the same four things — read a column under any of the spellings
// that vendor has shipped, drop empty keys, carry an option matrix, and normalise a
// status word. Doing them here rather than per adapter is what keeps twenty adapters
// at roughly forty lines each instead of two hundred.

import type { CanonicalRow } from '../canonical';
import { clean, toList } from '../coerce';
import type { SourceRow } from '../parse/csv';

/** Compare form for a header: lowercase, punctuation and spacing collapsed.
 *  `Variant Inventory Qty`, `variant_inventory_qty` and `Variant  Inventory  Qty`
 *  are the same column across three exporter versions. */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .replace(/[^a-z0-9 ()/]/g, '')
    .trim();
}

/** Read the first of several possible headers, case- and spacing-insensitively. */
export function pick(row: SourceRow, ...headers: string[]): string {
  for (const header of headers) {
    const direct = row[header];
    if (direct !== undefined && clean(direct) !== '') return clean(direct);
  }
  // Fall back to a normalised scan — one pass, only when the direct hit missed.
  const wanted = headers.map(normalizeHeader);
  for (const [key, value] of Object.entries(row)) {
    if (wanted.includes(normalizeHeader(key)) && clean(value) !== '') return clean(value);
  }
  return '';
}

/** True when a row carries any of these headers at all (even empty). */
export function has(row: SourceRow, ...headers: string[]): boolean {
  const wanted = headers.map(normalizeHeader);
  return Object.keys(row).some((key) => wanted.includes(normalizeHeader(key)));
}

/** Build a canonical row, dropping keys whose value is empty.
 *  Empty keys matter: `{ price: '' }` and `{}` mean different things to an upsert —
 *  the first says "set the price to nothing", the second says "leave it alone". */
export function row(fields: Record<string, string | undefined>): CanonicalRow {
  const out: CanonicalRow = {};
  for (const [key, value] of Object.entries(fields)) {
    const text = clean(value);
    if (text !== '') out[key] = text;
  }
  return out;
}

/** Collect every column matching a prefix + index, e.g. IMAGE1…IMAGE10 (Etsy) or
 *  `Attribute 1 name`…`Attribute 3 name` (WooCommerce). */
export function indexed(source: SourceRow, build: (n: number) => string, max: number): string[] {
  const values: string[] = [];
  for (let n = 1; n <= max; n++) {
    const value = pick(source, build(n));
    if (value !== '') values.push(value);
  }
  return values;
}

/** Map a vendor's status vocabulary onto ours. Unknown words fall to `draft`,
 *  never to `active` — publishing a tenant's entire catalogue by accident on the day
 *  they migrate is the one mistake that cannot be undone quietly. */
export function productStatus(
  value: string,
  activeWords: string[] = [
    'active',
    'published',
    'visible',
    'enabled',
    'true',
    '1',
    'instock',
    'live',
  ]
): string {
  const text = clean(value)
    .toLowerCase()
    .replace(/[\s_-]/g, '');
  if (text === '') return '';
  if (['archived', 'deleted', 'trash', 'inactive'].includes(text)) return 'archived';
  if (activeWords.includes(text)) return 'active';
  return 'draft';
}

/** Content status, same conservative rule. */
export function contentStatus(value: string): string {
  const text = clean(value).toLowerCase();
  if (text === '') return '';
  if (['publish', 'published', 'live', 'public'].includes(text)) return 'published';
  if (['future', 'scheduled'].includes(text)) return 'scheduled';
  if (['trash', 'archived', 'deleted'].includes(text)) return 'archived';
  return 'draft';
}

/** Split a vendor's tag cell, which is comma-separated everywhere except where it is
 *  pipe- or semicolon-separated. Detected rather than configured, because several
 *  vendors changed which one they emit between exporter versions. */
export function tags(value: string): string {
  const text = clean(value);
  if (text === '') return '';
  const separator = text.includes('|')
    ? '|'
    : text.includes(';') && !text.includes(',')
      ? ';'
      : ',';
  return toList(text, separator).join(', ');
}

/** Group delimited rows by a key column, preserving order. The shape every commerce
 *  export uses for variants: the first row of a group carries the product, later rows
 *  carry only the variant or an extra image. */
export function groupBy(
  rows: SourceRow[],
  key: (row: SourceRow) => string
): Map<string, SourceRow[]> {
  const groups = new Map<string, SourceRow[]>();
  let lastKey = '';
  for (const source of rows) {
    // A blank key continues the previous group — Shopify leaves Handle populated but
    // BigCommerce and Square leave the identifying column empty on continuation rows.
    const raw = key(source);
    const groupKey = raw === '' ? lastKey : raw;
    if (groupKey === '') continue;
    lastKey = groupKey;
    const bucket = groups.get(groupKey);
    if (bucket === undefined) groups.set(groupKey, [source]);
    else bucket.push(source);
  }
  return groups;
}

/** Strip a vendor's storefront origin off a URL so it becomes a portable path. */
export function pathOf(value: string): string {
  const text = clean(value);
  if (text === '') return '';
  const match = /^https?:\/\/[^/]+(\/[^?#]*)?/.exec(text);
  if (match) return match[1] ?? '/';
  return text.startsWith('/') ? text.split('?')[0]! : '';
}
