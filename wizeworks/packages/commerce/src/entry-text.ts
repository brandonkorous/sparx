// The words of a content entry, for the search index.
//
// A reader searching a journal types a word they remember from the piece: "sluice",
// a village, a supplier. The index held only an `excerpt` or `summary` field, which
// her Article kind does not have, so every piece was findable by its headline and by
// nothing else (P09). The words a reader remembers are in the standfirst and the body.
//
// So the text comes from the kind's own fields: every text, long text and rich text
// field, in the order the kind lists them, rich text stripped to its words. The
// headline is left out because it is already the document's title. Choices, links,
// addresses and ids are not prose and are left out too.
//
// A rich text field arrives in either of two shapes: an HTML string, or the
// editor's own document (`{ type: 'doc', content: [...] }`). Her pieces are the
// second, and the first version of this read only strings, so it indexed her
// standfirsts and still not one word of a body.

import { plainText } from '@wizeworks/commerce-schemas';

/** The field kinds that hold words a person wrote. */
const PROSE_KINDS = new Set(['text', 'long_text', 'rich_text']);

/** The words of an editor document, one paragraph per block. */
function docWords(node: unknown): string {
  if (typeof node !== 'object' || node === null) return '';
  const n = node as { type?: unknown; text?: unknown; content?: unknown };
  if (typeof n.text === 'string') return n.text;
  if (n.type === 'hardBreak') return ' ';
  if (!Array.isArray(n.content)) return '';
  const inner = n.content.map(docWords);
  // Inline runs join as they are; blocks stand apart, so two paragraphs never
  // run their last and first words together into one word nobody typed.
  const inline = n.content.every(
    (c) =>
      typeof (c as { text?: unknown })?.text === 'string' ||
      (c as { type?: unknown })?.type === 'hardBreak'
  );
  return inner.filter(Boolean).join(inline ? '' : '\n\n');
}

/** A field value as plain words, whichever shape it was stored in. */
function valueWords(value: unknown): string {
  if (typeof value === 'string') return plainText(value).trim();
  if (typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'doc') {
    return docWords(value).trim();
  }
  return '';
}

/** A whole long piece fits: about 5,000 words. Past that the index stays lean. */
export const ENTRY_TEXT_MAX = 30_000;

export interface EntryFieldLike {
  key: string;
  type: string;
}

/** The fields of a kind, read from its stored schema. Anything malformed reads as none. */
export function kindFields(schemaJson: unknown): EntryFieldLike[] {
  const fields = (schemaJson as { fields?: unknown } | null)?.fields;
  if (!Array.isArray(fields)) return [];
  return fields.filter(
    (f): f is EntryFieldLike =>
      typeof f === 'object' &&
      f !== null &&
      typeof (f as EntryFieldLike).key === 'string' &&
      typeof (f as EntryFieldLike).type === 'string'
  );
}

/**
 * Everything a reader could search for in one entry, as plain words.
 *
 * `titleKey` is the field already used as the title. With no kind to read (a kind
 * removed, or a row from before kinds had fields), the `excerpt` and `summary` fields
 * still count, as they always did.
 */
export function entryText(
  body: Record<string, unknown>,
  fields: readonly EntryFieldLike[],
  titleKey?: string
): string | undefined {
  const keys =
    fields.length > 0
      ? fields.filter((f) => PROSE_KINDS.has(f.type) && f.key !== titleKey).map((f) => f.key)
      : ['excerpt', 'summary'];
  const parts: string[] = [];
  for (const key of keys) {
    const words = valueWords(body[key]);
    if (words) parts.push(words);
  }
  if (parts.length === 0) return undefined;
  const text = parts.join('\n\n');
  return text.length > ENTRY_TEXT_MAX ? text.slice(0, ENTRY_TEXT_MAX) : text;
}
