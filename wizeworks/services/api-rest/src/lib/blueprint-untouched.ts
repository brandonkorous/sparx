// WHAT ON HER SITE IS STILL THE EXAMPLE.
//
// A design is COPIED into a site when it is installed, so what arrives is real
// content under the business's own name from the first minute: pages of example
// words, example products with prices and a working Add to cart, and example
// articles in the Journal.
//
// That is the right way to build it — a site that is empty on day one teaches
// nobody anything — and it is only true until she goes live. A business that
// pays and publishes before editing puts somebody else's merchandise and
// somebody else's articles on the public internet under its own masthead, and
// nothing in the product ever mentions it. Measured on The Marrow Review, a
// reader-funded magazine of ideas, live and public: three platform marketing
// articles in its Journal ("How to launch your online store in a weekend") and
// thirteen buyable sample products in its shop.
//
// ── HOW "STILL THE EXAMPLE" IS DECIDED ─────────────────────────────────────
//
// Not by looking for words. Every artifact an install creates is STAMPED with a
// baseline — the exact content it was given (docs/55 §4) — and the updater's own
// handlers already know how to read each kind's live row back in that same
// shape, deliberately, so that "base == live extract" is exact and no false
// change surfaces. So the question "has she touched this?" is already answerable
// and nobody was asking it.
//
// Reusing those handlers is the point. A second reader of a page tree would be a
// second thing to keep in step with the first, and the half that drifts is the
// half nobody looks at.
//
// ── WHAT IT NEVER DOES ─────────────────────────────────────────────────────
//
// It writes nothing, changes nothing, and hides nothing. Her examples stay
// exactly where they are: they are hers, she may have wanted them, and a
// product this says nothing about is a product she has edited. The only output
// is a sentence on Home naming what a visitor can still see.

import type { ArtifactKind } from './blueprint-baseline.js';

/** One thing on her site that is still exactly as the design delivered it. */
export interface UntouchedArtifact {
  kind: ArtifactKind;
  /** The manifest key: a page slug, a product handle, `typeKey:slug` for an
   *  article. What the console turns into a name a person recognises. */
  naturalKey: string;
  refId: string | null;
}

export interface UntouchedReport {
  installId: string;
  blueprintKey: string;
  /**
   * Products and articles — the design's FURNITURE (`EXAMPLE_ARTIFACT_KINDS`).
   *
   * Listed apart from the pages because the harm is a different size. An
   * unedited About page says nothing about the business; an unedited shop sells
   * an invented brand's enamel mug to the business's customers, and an unedited
   * Journal publishes the platform's own marketing under the business's name.
   */
  examples: UntouchedArtifact[];
  /** Pages whose words are still the example words. */
  pages: UntouchedArtifact[];
  /** Everything above, counted once. */
  total: number;
}

/**
 * Does this still SAY what the design delivered?
 *
 * Not "has this row ever been written to", which is a different and less useful
 * question. The sentence on Home is about what a visitor reads, so the compare
 * is over the fields the BASELINE carries and nothing else.
 *
 * That boundary had to be measured rather than assumed. A freshly installed
 * product, untouched by anybody, compares like this:
 *
 *     baseline  { title, handle, status, variants:[{ sku, priceCents }] }
 *     live      { title, handle, status, variants:[…],
 *                 tags: [], fulfillmentType: "physical", requiresShipping: true }
 *
 * Nobody typed those last three. They are column defaults, written by the
 * database on insert — a value nobody chose must never be read as a choice. On a
 * strict compare every example product in the catalog looked edited and the
 * panel reported nothing at all, which is the failure that reads as success.
 *
 * Absent, null and empty are one thing, for the same reason in the other
 * direction: the baseline omits what the design did not set, and the live read
 * fills the gap with `null` or `[]`.
 *
 * A value she CLEARS is still a difference: the baseline has the words and the
 * live row has nothing, so the two sides disagree on a key the baseline carries.
 */
export function sameAsInstalled(baseline: unknown, current: unknown): boolean {
  if (Array.isArray(baseline)) {
    const live = current ?? [];
    if (!Array.isArray(live) || live.length !== baseline.length) return false;
    return baseline.every((item, i) => sameAsInstalled(item, live[i]));
  }

  if (baseline !== null && typeof baseline === 'object') {
    const live = current ?? {};
    if (typeof live !== 'object' || Array.isArray(live)) return false;
    const row = live as Record<string, unknown>;
    // Only the design's own keys. A field it never set carries whatever the
    // column's default is, and reading a default as an edit is the bug above.
    return Object.entries(baseline as Record<string, unknown>).every(([key, value]) =>
      sameAsInstalled(value, row[key])
    );
  }

  if (isEmpty(baseline)) return isEmpty(current);
  return baseline === current;
}

/** Nothing written here: absent, null, an empty string, an empty list, an empty
 *  bag. The baseline and the live read spell "nothing" differently. */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/** Which half of the report an artifact belongs in. Products and articles are
 *  the furniture; everything else is the shape of the site. */
export function isExampleKind(kind: ArtifactKind): boolean {
  return kind === 'product' || kind === 'content';
}
