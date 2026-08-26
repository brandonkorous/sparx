// GUESSING WHAT A COLUMN IS — the draft the tenant corrects.
//
// Pure functions over header names, split out of column-mapper.tsx so the screen
// is a screen and this is the thing it can be reasoned about without. No React,
// no state, no I/O: given a list of headers, which entity is this and which field
// does each column mean?

import { CANONICAL_ENTITIES, ENTITY_FIELDS, type CanonicalEntity } from '@wizeworks/migration';

/** Compare form for a header — the same normalisation the adapters use. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

/**
 * Extra spellings worth recognising per field, beyond the field's own key and label.
 *
 * Deliberately short. A guess that is usually right and occasionally wrong is a good
 * draft; a guess that fires on anything vaguely similar teaches people to distrust the
 * whole screen and check every row by hand, which is the thing this exists to avoid.
 */
const ALIASES: Record<string, string[]> = {
  title: ['name', 'item name', 'product name', 'product', 'item', 'description short'],
  sku: ['item code', 'code', 'part number', 'part no', 'item number', 'stock code', 'mpn'],
  price: ['unit price', 'sell price', 'retail', 'rrp', 'how much', 'amount'],
  cost_per_item: ['cost', 'unit cost', 'buy price', 'wholesale', 'cost price'],
  quantity: ['qty', 'stock', 'on hand', 'in stock', 'inventory', 'available'],
  barcode: ['upc', 'ean', 'gtin', 'isbn'],
  email: ['e mail', 'email address', 'contact email', 'primary email'],
  phone: ['telephone', 'mobile', 'cell', 'contact number', 'phone number'],
  first_name: ['firstname', 'given name', 'forename'],
  last_name: ['lastname', 'surname', 'family name'],
  company: ['company name', 'business', 'organisation', 'organization', 'account'],
  name: ['full name', 'company name', 'contact name'],
  location: ['warehouse', 'store', 'shop', 'site', 'branch', 'depot'],
  description: ['details', 'body', 'long description', 'notes'],
  vendor: ['brand', 'manufacturer', 'make', 'supplier'],
  city: ['town', 'suburb'],
  zip: ['postcode', 'postal code', 'zip code'],
  province: ['state', 'region', 'county'],
  address1: ['address', 'street', 'address line 1', 'street address'],
  total: ['order total', 'grand total'],
  order_number: ['order', 'order id', 'order no', 'invoice number', 'reference'],
};

/** Best-guess mapping of the file's headers onto one entity's fields. */
export function guessMapping(entity: CanonicalEntity, headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const taken = new Set<string>();

  for (const header of headers) {
    const wanted = normalize(header);
    if (wanted === '') continue;

    const match = ENTITY_FIELDS[entity].find((field) => {
      if (taken.has(field.key)) return false;
      if (normalize(field.key) === wanted) return true;
      if (normalize(field.label) === wanted) return true;
      return (ALIASES[field.key] ?? []).some((alias) => normalize(alias) === wanted);
    });

    if (match !== undefined) {
      mapping[header] = match.key;
      taken.add(match.key);
    }
  }

  return mapping;
}

/**
 * Which entity a set of headers most looks like.
 *
 * Scored by how many of that entity's REQUIRED and key fields a guess can fill, so a
 * file with SKU and Price lands on products rather than on the first entity in the
 * list that happens to have a `name` column.
 */
export function guessEntity(headers: string[]): CanonicalEntity {
  let best: CanonicalEntity = 'products';
  let bestScore = -1;

  for (const entity of CANONICAL_ENTITIES) {
    const mapping = guessMapping(entity, headers);
    const mapped = new Set(Object.values(mapping));
    const fields = ENTITY_FIELDS[entity];
    const required = fields.filter((field) => field.required === true);
    const keys = fields.filter((field) => field.naturalKey === true);

    // Required fields are worth most: an entity whose required column is absent
    // cannot be the answer no matter how many optional ones happen to line up.
    const score =
      required.filter((field) => mapped.has(field.key)).length * 5 +
      keys.filter((field) => mapped.has(field.key)).length * 3 +
      mapped.size;

    if (score > bestScore) {
      bestScore = score;
      best = entity;
    }
  }

  return best;
}
