// What committing the Options draft would DO — worked out before anyone presses
// anything. Pure data; the sentences it turns into live in
// product-options-words.ts, and `planOf` is what the server is sent.

import { cleanDraft, type OptionDraft } from './product-options-draft';
import {
  lastCoordinate,
  type LatticeCoordinate,
  type LatticePlan,
  type ProductOption,
  type Variant,
} from './products-data';

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
   * reason this is counted separately: reading them as blank is what sent
   * somebody to recreate five versions that already existed (issue 305).
   */
  returning: { variant: Variant; coordinate: LatticeCoordinate[] }[];
  /**
   * Retired versions still sitting on a square, and where it is in the new
   * grid. Found by IDENTITY, like a live version, so they follow a rename. The
   * server puts a retired version back only by the WORDS it remembered, so a
   * rename used to strand every stopped version on the renamed value while this
   * summary said they came back. Sent in `place`; not announced, since nothing
   * about them changes.
   */
  held: { variant: Variant; coordinate: LatticeCoordinate[] }[];
  /** Versions whose place no longer exists. */
  retire: Variant[];
  /** Combinations that would have no price yet. */
  blank: number;
  /** Removing every axis leaves these with no choice attached. */
  loose: Variant[];
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const keyOf = (coordinate: LatticeCoordinate[]) =>
  coordinate
    .map((point) => `${point.option.trim().toLowerCase()}=${point.value.trim().toLowerCase()}`)
    .join('|');

/** Where this version sits in the NEW lattice, by the ids it holds. */
function placeById(
  variant: Variant,
  clean: ReturnType<typeof cleanDraft>
): LatticeCoordinate[] | null {
  // Survival is decided by IDENTITY, not by text. A draft row that came from the
  // server still carries the server's id as its key, so a version sitting on
  // "Small" is still sitting on it after someone renames it to "S" — which
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

/** Where these WORDS land in the new lattice: a version's remembered place, or
 *  its saved one, matched the way the server matches (lattice-memory.ts). */
function placeByWords(
  remembered: LatticeCoordinate[] | null,
  clean: ReturnType<typeof cleanDraft>
): LatticeCoordinate[] | null {
  if (remembered?.length !== clean.length) return null;
  const coordinate: LatticeCoordinate[] = [];
  for (const option of clean) {
    const point = remembered.find((entry) => same(entry.option, option.name));
    const value = point && option.values.find((candidate) => same(candidate.value, point.value));
    if (!value) return null;
    coordinate.push({ option: option.name, value: value.value });
  }
  return coordinate;
}

/** A version's place in the SAVED grid, in words. */
function savedWords(variant: Variant, saved: ProductOption[]): LatticeCoordinate[] | null {
  const held = new Set(variant.optionValueIds);
  const words: LatticeCoordinate[] = [];
  for (const option of saved) {
    const value = option.values.find((candidate) => held.has(candidate.id));
    if (!value) return null;
    words.push({ option: option.name, value: value.value });
  }
  return words;
}

/**
 * Sorts retired versions into the ones that stay on a square (`held`) and the
 * ones that come back to one (`returning`). One still on a square follows its
 * value by identity through a rename; its words are the fallback for a value
 * deleted and typed back in the same save. One whose ids are gone comes back
 * only if the new grid holds what the server remembered.
 */
function sortRetired(
  retired: Variant[],
  saved: ProductOption[],
  clean: ReturnType<typeof cleanDraft>
): Pick<Consequence, 'held' | 'returning'> {
  const held: Consequence['held'] = [];
  const returning: Consequence['returning'] = [];
  for (const variant of retired) {
    if (variant.optionValueIds.length > 0) {
      const coordinate =
        placeById(variant, clean) ?? placeByWords(savedWords(variant, saved), clean);
      if (coordinate) held.push({ variant, coordinate });
    } else {
      const coordinate = placeByWords(lastCoordinate(variant), clean);
      if (coordinate) returning.push({ variant, coordinate });
    }
  }
  return { held, returning };
}

/**
 * The overwhelmingly common first move is "I sell one thing, now I want to sell
 * it in three sizes". That product has exactly one version, carrying the price
 * and code someone typed when they created it. Retiring it and demanding three
 * new ones, leaving the product with NO price in between, is technically correct
 * and obviously not what was meant. So a lone unplaced version on a product that
 * had no choices at all lands on the first combination, keeping its price and
 * code. It is spelled out in the summary and again in the confirm; it never
 * happens quietly.
 */
function adoptionOf(
  saved: ProductOption[],
  stranded: Variant[],
  keep: Consequence['keep'],
  clean: ReturnType<typeof cleanDraft>
): Consequence['adopted'] {
  const first = stranded[0];
  if (saved.length > 0 || stranded.length !== 1 || keep.length > 0 || !first) return null;
  return {
    variant: first,
    coordinate: clean.map((option) => ({
      option: option.name,
      // `cleanDraft` guarantees at least one value per surviving option.
      value: option.values[0]?.value ?? '',
    })),
  };
}

/** Live versions that keep a square in the new grid, by identity, and the ones
 *  left with none. */
function sortLive(
  live: Variant[],
  clean: ReturnType<typeof cleanDraft>
): { keep: Consequence['keep']; stranded: Variant[] } {
  const keep: Consequence['keep'] = [];
  const stranded: Variant[] = [];
  for (const variant of live) {
    const coordinate = placeById(variant, clean);
    if (coordinate) keep.push({ variant, coordinate });
    else stranded.push(variant);
  }
  return { keep, stranded };
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

  const { keep, stranded } = sortLive(live, clean);
  const { held, returning } = sortRetired(retired, saved, clean);

  const adopted = adoptionOf(saved, stranded, keep, clean);

  // Blank means nothing is sitting there at all — a combination held by a
  // retired version is occupied, and offering to create a second one on top is
  // what wrote duplicate codes carrying no stock.
  const occupied = new Set(
    [...keep, ...(adopted ? [adopted] : []), ...returning, ...held].map((entry) =>
      keyOf(entry.coordinate)
    )
  );

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
    // EVERY version this summary gives a square is placed by this save, stopped
    // ones included: assign-options accepts them, and a promise left to the
    // server's word-matching memory is one a rename breaks. The server restores
    // `returning` itself too; placing them again writes the same square.
    place: [
      ...consequence.keep,
      ...(consequence.adopted ? [consequence.adopted] : []),
      ...consequence.held,
      ...consequence.returning,
    ].map((entry) => ({ variantId: entry.variant.id, coordinate: entry.coordinate })),
    retire: consequence.retire.map((variant) => variant.id),
  };
}
