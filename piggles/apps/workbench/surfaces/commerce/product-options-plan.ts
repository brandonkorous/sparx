// What committing the Options draft would DO — worked out before anyone presses
// anything, and written as sentences a shop owner can read.
//
// Pure data. The tab shows `consequenceLines` above the form and again in the
// confirm; `planOf` is what the server is sent.

import { cleanDraft, type OptionDraft } from './product-options-draft';
import {
  formatCents,
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
  /** Versions whose place no longer exists. */
  retire: Variant[];
  /** Combinations that would have no price yet. */
  blank: number;
  /** Removing every axis leaves these with no choice attached. */
  loose: Variant[];
}

export function consequenceOf(
  draft: OptionDraft[],
  saved: ProductOption[],
  variants: Variant[]
): Consequence {
  const clean = cleanDraft(draft);
  const live = variants.filter((variant) => variant.deletedAt === null);

  if (clean.length === 0) {
    return {
      combinations: 0,
      keep: [],
      adopted: null,
      retire: [],
      blank: 0,
      loose: saved.length > 0 ? live : [],
    };
  }

  const combinations = clean.reduce((total, option) => total * option.values.length, 1);

  const keep: Consequence['keep'] = [];
  const stranded: Variant[] = [];

  for (const variant of live) {
    // Survival is decided by IDENTITY, not by text. A draft row that came from
    // the server still carries the server's id as its key, so a version sitting
    // on "Small" is still sitting on it after someone renames it to "S" — which
    // matching on the name would have got exactly backwards, quietly retiring
    // every SKU on the product over a typo fix.
    const held = new Set(variant.optionValueIds);
    const coordinate: LatticeCoordinate[] = [];
    for (const option of clean) {
      const kept = option.values.find((value) => held.has(value.key));
      if (!kept) break;
      coordinate.push({ option: option.name, value: kept.value });
    }

    if (coordinate.length === clean.length) keep.push({ variant, coordinate });
    else stranded.push(variant);
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

  const filled = keep.length + (adopted ? 1 : 0);

  return {
    combinations,
    keep,
    adopted,
    retire: adopted ? [] : stranded,
    blank: Math.max(0, combinations - filled),
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
    place: [...consequence.keep, ...(consequence.adopted ? [consequence.adopted] : [])].map(
      (entry) => ({ variantId: entry.variant.id, coordinate: entry.coordinate })
    ),
    retire: consequence.retire.map((variant) => variant.id),
  };
}

/* ── The same thing in sentences ────────────────────────────────────────── */

export function consequenceLines(consequence: Consequence): string[] {
  const lines: string[] = [];

  if (consequence.loose.length > 0) {
    const count = consequence.loose.length;
    lines.push('Shoppers stop choosing anything — this goes back to being sold one way.');
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
  if (consequence.blank > 0) {
    const count = consequence.blank;
    lines.push(
      `${countOf(count, 'combination', 'combinations')} will have no price, so ${count === 1 ? 'it cannot' : 'they cannot'} be bought until you set ${count === 1 ? 'one' : 'them'} on the Variants tab.`
    );
  }
  if (consequence.retire.length > 0) {
    const count = consequence.retire.length;
    lines.push(
      `${countOf(count, 'version', 'versions')} ${count === 1 ? 'loses its place and stops' : 'lose their place and stop'} being sold — ${skus(consequence.retire)}. Past orders keep their record, and you can bring ${count === 1 ? 'it' : 'them'} back.`
    );
  }
  if (consequence.combinations > 100) {
    lines.push(
      'That is a lot to keep priced and in stock. Most businesses find more than a hundred hard to manage.'
    );
  }
  return lines;
}

function skus(variants: Variant[]): string {
  const shown = variants.slice(0, 4).map((variant) => variant.sku);
  const rest = variants.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} and ${String(rest)} more` : shown.join(', ');
}

export function countOf(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/* ── What to tell her afterwards ────────────────────────────────────────── */

export interface Told {
  title: string;
  description: string;
  type: 'success' | 'warning';
}

export function committedToast(consequence: Consequence): Told {
  const blank = consequence.blank;
  return {
    title: 'This product is sold differently now',
    description:
      blank > 0
        ? `${countOf(blank, 'combination', 'combinations')} still ${blank === 1 ? 'needs a price' : 'need a price'} — set them on the Variants tab.`
        : 'Every combination has a price.',
    type: 'success',
  };
}

/** The axes DID change; only the re-placing failed. Saying "nothing was saved"
 *  here sends someone to redo work that is already stored. */
export function rebindToast(count: number): Told {
  return {
    title: 'The choices were changed, but some versions lost their place',
    description: `${countOf(count, 'version', 'versions')} now ${count === 1 ? 'has' : 'have'} no place in the grid. Open the Variants tab to put ${count === 1 ? 'it' : 'them'} right.`,
    type: 'warning',
  };
}
