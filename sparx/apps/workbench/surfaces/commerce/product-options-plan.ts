// What committing the Options draft would DO, worked out before anyone presses
// anything, and the sentences it turns into. Pure data: no React, no network.
// The tab (product-options.tsx) renders it; `planOf` is what the server is sent.
//
// Its own file for one reason: it is the part of the tab that can be wrong in a
// way nobody sees. "3 combinations will have no price" over three squares the
// server is about to refill reads exactly like a correct sentence, so it is
// tested (product-options-returning.test.ts), and a test cannot import a .tsx.

import {
  formatCents,
  lastCoordinate,
  type LatticeCoordinate,
  type LatticePlan,
  type OptionDisplayType,
  type ProductOption,
  type Variant,
} from './products-data';

export interface ValueDraft {
  /** The server's option-value id, or a local key for a value being added. */
  key: string;
  value: string;
  /** `#RRGGBB` — the color of the THING being sold, not a design token. */
  swatchHex: string | null;
}

export interface OptionDraft {
  /** The server's option id, or a local key for an axis being added. */
  key: string;
  name: string;
  displayType: OptionDisplayType;
  values: ValueDraft[];
}

/* ── What committing would do ───────────────────────────────────────────── */

export interface Consequence {
  /** Points in the new grid. Zero when the axes are being removed entirely. */
  combinations: number;
  /** Versions that keep their place, their price and their code. */
  keep: { variant: Variant; coordinate: LatticeCoordinate[] }[];
  /** The one version ADOPTED onto a brand-new grid — see the note below. */
  adopted: { variant: Variant; coordinate: LatticeCoordinate[] } | null;
  /**
   * Retired versions the new grid can hold again, so the server will put them
   * back where they were. Their combinations are NOT blank, which is the whole
   * reason this is counted separately: reading them as blank sent somebody to
   * the Variants tab to recreate versions that already existed, and since a
   * retired version keeps its code reserved, the new ones went on sale under
   * made-up codes with no stock beside the old ones holding the real codes and
   * all the stock.
   */
  returning: { variant: Variant; coordinate: LatticeCoordinate[] }[];
  /**
   * Retired versions still sitting on a square, and where that square is in the
   * new grid. Found by IDENTITY, like a live version, so they follow a rename.
   *
   * The server cannot do this for them. It puts a retired version back only by
   * the WORDS it remembered, so renaming "Clay" to "Terracotta" left every
   * stopped Clay version on no square at all, while this summary had promised
   * they came back (issue 305, re-driven on sparx). They are sent in `place`
   * like everything else that keeps a square, and assign-options accepts a
   * stopped version, so a rename can no longer strand them. Not announced:
   * nothing about them changes.
   */
  held: { variant: Variant; coordinate: LatticeCoordinate[] }[];
  /** Versions whose place no longer exists. */
  retire: Variant[];
  /** Combinations that would have no price yet. */
  blank: number;
  /** Removing every axis leaves these with no choice attached. */
  loose: Variant[];
}

/** Trimmed, blank-free view of the draft — the only form worth reasoning about.
 *  A half-typed option is not a decision yet, so it counts for nothing. */
export function cleanDraft(draft: OptionDraft[]): OptionDraft[] {
  return draft
    .map((option) => ({
      ...option,
      name: option.name.trim(),
      values: option.values
        .map((value) => ({ ...value, value: value.value.trim() }))
        .filter((value) => value.value !== ''),
    }))
    .filter((option) => option.name !== '' && option.values.length > 0);
}

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const keyOfCoordinate = (coordinate: LatticeCoordinate[]) =>
  coordinate
    .map((point) => `${point.option.trim().toLowerCase()}=${point.value.trim().toLowerCase()}`)
    .join('|');

/** Where this version sits in the NEW lattice, by the ids it holds. */
function placeById(variant: Variant, clean: OptionDraft[]): LatticeCoordinate[] | null {
  // Survival is decided by IDENTITY, not by text. A draft row that came from
  // the server still carries the server's id as its key, so a version sitting
  // on "Small" is still sitting on it after someone renames it to "S" — which
  // matching on the name would have got exactly backwards, quietly retiring
  // every SKU on the product over a typo fix.
  const held = new Set(variant.optionValueIds);
  const coordinate: LatticeCoordinate[] = [];
  for (const option of clean) {
    const kept = option.values.find((value) => held.has(value.key));
    if (!kept) return null;
    coordinate.push({ option: option.name, value: kept.value });
  }
  return coordinate;
}

/** A version's place in the SAVED grid, in words: what the server writes down for
 *  it (`rememberCoordinates`) the moment before a save deletes the old values. */
function savedWords(variant: Variant, saved: ProductOption[]): LatticeCoordinate[] | null {
  const held = new Set(variant.optionValueIds);
  const coordinate: LatticeCoordinate[] = [];
  for (const option of saved) {
    const value = option.values.find((candidate) => held.has(candidate.id));
    if (!value) return null;
    coordinate.push({ option: option.name, value: value.value });
  }
  return coordinate;
}

/**
 * Where a RETIRED version lands in the new grid by its WORDS, the way the server
 * matches it (lattice-memory.ts): every point present, the new grid spanned
 * exactly once.
 *
 * On its own the server never follows a rename. `setOptions` deletes every value
 * and puts a retired version back only by the words it remembered, so a version
 * on "S" renamed to "Small" came out on no square. That is why a retired version
 * that still HAS a square is found by identity first (`held`, in consequenceOf)
 * and placed by the save itself; this is its fallback, and the whole answer for a
 * version whose square was taken away earlier.
 *
 * The words are what the server will have written down: its current place when it
 * still has one, else what it remembered from an earlier save.
 */
function placeRetired(
  variant: Variant,
  saved: ProductOption[],
  clean: OptionDraft[]
): LatticeCoordinate[] | null {
  const remembered =
    variant.optionValueIds.length > 0 ? savedWords(variant, saved) : lastCoordinate(variant);
  if (remembered?.length !== clean.length) return null;
  const coordinate: LatticeCoordinate[] = [];
  for (const option of clean) {
    const point = remembered.find((entry) => sameText(entry.option, option.name));
    const value =
      point && option.values.find((candidate) => sameText(candidate.value, point.value));
    if (!value) return null;
    coordinate.push({ option: option.name, value: value.value });
  }
  return coordinate;
}

export function consequenceOf(
  draft: OptionDraft[],
  saved: ProductOption[],
  variants: Variant[]
): Consequence {
  const clean = cleanDraft(draft);
  const live = variants.filter((variant) => variant.deletedAt === null);
  const retired = variants.filter((variant) => variant.deletedAt !== null);

  if (clean.length === 0) {
    return {
      combinations: 0,
      keep: [],
      adopted: null,
      returning: [],
      held: [],
      retire: [],
      blank: 0,
      loose: saved.length > 0 ? live : [],
    };
  }

  const combinations = clean.reduce((total, option) => total * option.values.length, 1);

  const keep: Consequence['keep'] = [];
  const stranded: Variant[] = [];

  for (const variant of live) {
    const coordinate = placeById(variant, clean);
    if (coordinate) keep.push({ variant, coordinate });
    else stranded.push(variant);
  }

  // A retired version whose place was taken away comes back if the new grid can
  // hold what it remembers, and that is news worth a sentence. One still sitting
  // on its square stays there, following its value through a rename exactly as
  // a live version does, and is not announced because nothing about it changes.
  // Its words are the fallback for a value deleted and typed back in the same
  // save, which has a new key but the same text the server matches on.
  const returning: Consequence['returning'] = [];
  const held: Consequence['held'] = [];
  for (const variant of retired) {
    if (variant.optionValueIds.length > 0) {
      const coordinate = placeById(variant, clean) ?? placeRetired(variant, saved, clean);
      if (coordinate) held.push({ variant, coordinate });
    } else {
      const coordinate = placeRetired(variant, saved, clean);
      if (coordinate) returning.push({ variant, coordinate });
    }
  }

  // ── Adoption ────────────────────────────────────────────────────────────
  // The overwhelmingly common first move is "I sell one thing, now I want to
  // sell it in three sizes". That product has exactly one version, carrying the
  // price and code someone typed when they created it. Retiring it and demanding
  // three new ones — leaving the product with NO price in between — is
  // technically correct and obviously not what was meant. So a lone unplaced
  // version on a product that had no choices at all lands on the first
  // combination, keeping its price and code. It is spelled out in the summary
  // and again in the confirm; it never happens quietly.
  const first = stranded[0];
  const adopting =
    saved.length === 0 && stranded.length === 1 && keep.length === 0 && first ? first : null;
  const adopted = adopting
    ? {
        variant: adopting,
        coordinate: clean.map((option) => ({
          option: option.name,
          // `cleanDraft` guarantees at least one value per surviving option.
          value: option.values[0]?.value ?? '',
        })),
      }
    : null;

  // Blank means nothing is sitting there at all. A combination held by a
  // retired version is occupied, and offering to create a second one on top of
  // it is what wrote duplicate versions carrying no stock. A SET, because a
  // retired version and a live one can share a square.
  const occupied = new Set([
    ...[...keep, ...(adopted ? [adopted] : []), ...returning].map((entry) =>
      keyOfCoordinate(entry.coordinate)
    ),
    ...held.map((entry) => keyOfCoordinate(entry.coordinate)),
  ]);

  return {
    combinations,
    keep,
    adopted,
    returning,
    held,
    retire: adopted ? [] : stranded,
    blank: Math.max(0, combinations - occupied.size),
    loose: [],
  };
}

export function planOf(draft: OptionDraft[], consequence: Consequence): LatticePlan {
  const clean = cleanDraft(draft);
  return {
    options: clean.map((option, index) => ({
      name: option.name,
      displayType: option.displayType,
      position: index,
      values: option.values.map((value, valueIndex) => ({
        value: value.value,
        ...(option.displayType === 'swatch' && value.swatchHex
          ? { swatchHex: value.swatchHex }
          : {}),
        position: valueIndex,
      })),
    })),
    // EVERY version this summary says has a square is placed by this save,
    // stopped ones included. assign-options accepts a stopped version, and a
    // promise left to the server's word-matching memory is one a rename breaks:
    // `held` follows its value by identity, which the server cannot see. The
    // server also restores `returning` itself (lattice-memory.ts); placing them
    // again writes the same square, and makes the sentence true on its own.
    place: [
      ...consequence.keep,
      ...(consequence.adopted ? [consequence.adopted] : []),
      ...consequence.held,
      ...consequence.returning,
    ].map((entry) => ({ variantId: entry.variant.id, coordinate: entry.coordinate })),
    retire: consequence.retire.map((variant) => variant.id),
  };
}

export function consequenceLines(consequence: Consequence): string[] {
  const lines: string[] = [];

  if (consequence.loose.length > 0) {
    const count = consequence.loose.length;
    lines.push('Shoppers stop choosing anything. This goes back to being sold one way.');
    lines.push(
      `${countOf(count, 'version', 'versions')} stay${count === 1 ? 's' : ''} on sale with no choice attached (${skus(consequence.loose)}). Retire the ones you do not want on the Variants tab.`
    );
    return lines;
  }

  lines.push(
    `${countOf(consequence.combinations, 'combination', 'combinations')} can be sold in all.`
  );

  if (consequence.adopted) {
    const { variant, coordinate } = consequence.adopted;
    lines.push(
      `Your existing version ${variant.sku} (${formatCents(variant.priceCents, variant.currency)}) becomes ${coordinate.map((point) => point.value).join(' · ')}, keeping its price and code.`
    );
  }
  if (consequence.keep.length > 0) {
    const count = consequence.keep.length;
    lines.push(
      `${countOf(count, 'version', 'versions')} ${count === 1 ? 'keeps its' : 'keep their'} price and code.`
    );
  }
  // Said before the blank count, because these are the ones somebody would
  // otherwise read as blank and set about recreating by hand.
  if (consequence.returning.length > 0) {
    const count = consequence.returning.length;
    lines.push(
      `${countOf(count, 'version', 'versions')} you stopped selling ${count === 1 ? 'comes' : 'come'} back to ${count === 1 ? 'its' : 'their'} place with ${count === 1 ? 'its' : 'their'} price, code and stock: ${skus(consequence.returning.map((entry) => entry.variant))}. Put ${count === 1 ? 'it' : 'them'} on sale again from the Variants tab.`
    );
  }
  if (consequence.blank > 0) {
    const count = consequence.blank;
    lines.push(
      `${countOf(count, 'combination', 'combinations')} will have no price, so ${count === 1 ? 'it cannot' : 'they cannot'} be bought until you set ${count === 1 ? 'one' : 'them'} on the Variants tab.`
    );
  }
  if (consequence.retire.length > 0) {
    const count = consequence.retire.length;
    lines.push(
      `${countOf(count, 'version', 'versions')} ${count === 1 ? 'loses its place and stops' : 'lose their place and stop'} being sold: ${skus(consequence.retire)}. Past orders keep their record, and you can bring ${count === 1 ? 'it' : 'them'} back.`
    );
  }
  if (consequence.combinations > 100) {
    lines.push(
      'That is a lot to keep priced and in stock. Most businesses find more than a hundred hard to manage.'
    );
  }
  return lines;
}

/** What to tell her once it is committed. When returning versions are all there
 *  is, they are the news: "every combination has a price" would be untrue of a
 *  grid whose squares are held by versions still off sale. */
export function committedDescription(consequence: Consequence): string {
  const blank = consequence.blank;
  const back = consequence.returning.length;
  if (blank === 0 && back > 0) {
    return `${countOf(back, 'version', 'versions')} came back with ${back === 1 ? 'its' : 'their'} price and code: put ${back === 1 ? 'it' : 'them'} on sale again on the Variants tab.`;
  }
  return blank > 0
    ? `${countOf(blank, 'combination', 'combinations')} still ${blank === 1 ? 'needs a price' : 'need a price'}. Set them on the Variants tab.`
    : 'Every combination has a price.';
}

function skus(variants: Variant[]): string {
  const shown = variants.slice(0, 4).map((variant) => variant.sku);
  const rest = variants.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} and ${String(rest)} more` : shown.join(', ');
}

export function countOf(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}
