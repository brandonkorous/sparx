// Who a published piece credits, and where an author's work lives.
//
// A piece names its writer in `author_id`. Every other credit (a photographer, an
// illustrator) is a field of the `author` kind on the piece's own kind, holding the
// author's id. An author's page lists both, so it reads the kinds' fields to know where
// to look. Only top-level fields count: a credit inside a repeating group is a list
// of people, not a credit for the piece.

import type { Prisma } from '@wizeworks/db';

import { entryPublicPath } from './content-paths.js';

/** One field that credits an author: "Photograph by". */
export interface CreditField {
  key: string;
  label: string;
  multiple: boolean;
}

/** A kind whose pieces the website serves, with what an author page needs to say. */
export interface ServedKindInfo {
  key: string;
  name: string;
  pluralName: string;
  urlPattern: string | null;
  fields: unknown[];
  credits: CreditField[];
}

interface KindRow {
  key: string;
  name: string;
  pluralName: string;
  urlPattern: string | null;
  schemaJson: unknown;
}

/** The fields on a kind that credit an author. */
export function creditFieldsOf(fields: readonly unknown[]): CreditField[] {
  const out: CreditField[] = [];
  for (const raw of fields) {
    if (!raw || typeof raw !== 'object') continue;
    const f = raw as { type?: unknown; key?: unknown; label?: unknown; multiple?: unknown };
    if (f.type !== 'author' || typeof f.key !== 'string') continue;
    out.push({
      key: f.key,
      label: typeof f.label === 'string' && f.label ? f.label : f.key,
      multiple: f.multiple === true,
    });
  }
  return out;
}

/**
 * The kinds whose pieces the website serves at an address, keyed by kind key.
 *
 * `rows` ordered tenant-first (`isBuiltIn asc`), so the tenant's own kind shadows a
 * built-in of the same key. Pages are left out: a page has an author column but is
 * not a piece of writing anybody is credited on.
 */
export function servedKinds(rows: readonly KindRow[]): Map<string, ServedKindInfo> {
  const out = new Map<string, ServedKindInfo>();
  for (const row of rows) {
    if (out.has(row.key) || row.key === 'page') continue;
    if (entryPublicPath(row.key, row.urlPattern, 'x') === null) continue;
    const fields = (row.schemaJson as { fields?: unknown[] } | null)?.fields ?? [];
    out.set(row.key, {
      key: row.key,
      name: row.name,
      pluralName: row.pluralName,
      urlPattern: row.urlPattern,
      fields,
      credits: creditFieldsOf(fields),
    });
  }
  return out;
}

/** The entries that credit `authorId` in any credit field, as one `where` branch per
 *  field. Empty when no served kind credits anybody. */
export function creditWhere(
  kinds: Iterable<ServedKindInfo>,
  authorId: string
): Prisma.ContentEntryWhereInput[] {
  const out: Prisma.ContentEntryWhereInput[] = [];
  for (const kind of kinds) {
    for (const field of kind.credits) {
      out.push({
        typeKey: kind.key,
        body: field.multiple
          ? { path: [field.key], array_contains: [authorId] }
          : { path: [field.key], equals: authorId },
      });
    }
  }
  return out;
}

/** The label of the first credit field on `body` that names `authorId` — the role the
 *  author page prints beside the piece ("Photograph by"). */
export function creditRole(
  credits: readonly CreditField[],
  body: Record<string, unknown>,
  authorId: string
): string | null {
  for (const field of credits) {
    const value = body[field.key];
    if (value === authorId) return field.label;
    if (Array.isArray(value) && value.includes(authorId)) return field.label;
  }
  return null;
}

/** Every author id a piece's credit fields name. */
export function creditedIds(
  credits: readonly CreditField[],
  body: Record<string, unknown>
): string[] {
  const ids = new Set<string>();
  for (const field of credits) {
    const value = body[field.key];
    if (typeof value === 'string') ids.add(value);
    if (Array.isArray(value)) {
      for (const v of value) if (typeof v === 'string') ids.add(v);
    }
  }
  return [...ids];
}
