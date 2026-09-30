// A product description is PLAIN TEXT. This file is where that is decided, and
// it is the only copy of the rule.
//
// Everything a person touches already agreed. The console edits `description` in
// a bare <Textarea> ("Say what someone would ask you in person"). The site
// renders it as text split at blank lines (issue 191), deliberately, so a
// tenant's own words are never injected as markup into their own site. The
// builder record, the silica record, the `<meta name="description">` and the
// JSON-LD a search engine prints all do the same.
//
// One line disagreed, and it was the one that let anything through:
//
//     description: z.string().max(50_000).nullish(), // rich text (HTML allowed)
//
// So the sample-data packs wrote HTML into it and the shopper read the tags
// (issue 848). Measured on this machine: 185 of 642 product descriptions.
//
// The schema now normalizes on parse, so a write through any surface stores what
// the column is supposed to hold, and `plainText` stays available as the read
// side for the rows written before that was true.

import { z } from 'zod';

const BLOCK_END = /<\/(?:p|div|h[1-6]|li|ul|ol|tr|blockquote)\s*>/gi;
const LINE_BREAK = /<br\s*\/?>/gi;
const ANY_TAG = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/g;

/** The few an author actually types, and the one a form post leaves behind. */
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/**
 * Does this text carry real markup?
 *
 * Asked before anything is stripped, because "sizes < 3 inches" and "a < b" are
 * ordinary sentences and must come back untouched. Only a complete open or close
 * tag counts.
 *
 * A bare `/<[^>]*>/` does NOT ask this question: in "fits anything < 3 inches,
 * weighs > 2oz" it matches from the `<` to the `>` and eats the words between
 * them. Two consoles shipped that version against this same field.
 */
export function looksLikeMarkup(text: string): boolean {
  ANY_TAG.lastIndex = 0;
  return ANY_TAG.test(text);
}

/**
 * The same words, as the plain text the field is supposed to hold.
 *
 * Blocks become paragraph breaks rather than disappearing, because the renderer
 * splits on blank lines: collapsing `</p><p>` to nothing would turn four
 * paragraphs into one run-on sentence, which is a different way of being wrong.
 */
export function plainText(text: string | null | undefined): string {
  const raw = text ?? '';
  if (raw === '' || !looksLikeMarkup(raw)) return raw;
  const withBreaks = raw.replace(LINE_BREAK, '\n\n').replace(BLOCK_END, '\n\n');
  const stripped = withBreaks.replace(ANY_TAG, '');
  const decoded = stripped.replace(
    /&(?:amp|lt|gt|quot|apos|nbsp|#39);/g,
    (match) => ENTITIES[match] ?? match
  );
  return decoded
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim();
}

/**
 * The same rule, keeping "no description at all" as null.
 *
 * Every column and response field holding this distinguishes null from an empty
 * string, so a read that turned one into the other would be a second, quieter
 * change riding along with the strip.
 */
export function plainTextOrNull(text: string | null | undefined): string | null {
  if (text == null) return null;
  const clean = plainText(text);
  return clean === '' ? null : clean;
}

/**
 * A prose field that is stored as plain text, normalized on the way in.
 *
 * The length cap is applied to what was SENT, not to what is kept, so a caller
 * who pastes 60k of markup is told the field is too long rather than quietly
 * having it accepted because the tags happened to strip down under the limit.
 */
export function PlainTextField(max: number) {
  return z
    .string()
    .max(max)
    .transform((value) => plainText(value));
}
