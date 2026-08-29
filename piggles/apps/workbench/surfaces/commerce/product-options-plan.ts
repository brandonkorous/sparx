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

/** Where this version USED to sit, when the ids that said so are gone. */
function placeByMemory(
  variant: Variant,
  clean: ReturnType<typeof cleanDraft>
): LatticeCoordinate[] | null {
  const remembered = lastCoordinate(variant);
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

  // A retired version still sitting on a live coordinate stays where it is; one
  // whose ids are gone comes back if the lattice can hold what it remembers.
  const returning: Consequence['returning'] = [];
  for (const variant of retired) {
    const coordinate =
      variant.optionValueIds.length > 0 ? placeById(variant, clean) : placeByMemory(variant, clean);
    if (coordinate) returning.push({ variant, coordinate });
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

  // Blank means nothing is sitting there at all — a combination held by a
  // retired version is occupied, and offering to create a second one on top is
  // what wrote duplicate codes carrying no stock.
  const occupied = new Set(
    [...keep, ...(adopted ? [adopted] : []), ...returning].map((entry) => keyOf(entry.coordinate))
  );

  return {
    combinations,
    keep,
    adopted,
    returning,
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
    // `returning` is deliberately NOT here: assign-options refuses a retired
    // variant, and the server puts those back itself inside the same
    // transaction that rebuilds the lattice (lattice-memory.ts).
    place: [...consequence.keep, ...(consequence.adopted ? [consequence.adopted] : [])].map(
      (entry) => ({ variantId: entry.variant.id, coordinate: entry.coordinate })
    ),
    retire: consequence.retire.map((variant) => variant.id),
  };
}
