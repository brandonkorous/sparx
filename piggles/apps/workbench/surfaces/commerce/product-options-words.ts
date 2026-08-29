// What committing the Options draft would do, in sentences a shop owner can
// read. The tab shows these above the form and again in the confirm.

import { formatCents, type Variant } from './products-data';
import type { Consequence } from './product-options-plan';

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
  // Said before the blank count, because these are the ones somebody would
  // otherwise read as blank and set about recreating by hand.
  if (consequence.returning.length > 0) {
    const count = consequence.returning.length;
    lines.push(
      `${countOf(count, 'version', 'versions')} you stopped selling ${count === 1 ? 'comes' : 'come'} back with ${count === 1 ? 'its' : 'their'} price, code and stock — ${skus(consequence.returning.map((entry) => entry.variant))}. Put ${count === 1 ? 'it' : 'them'} on sale again from the Variants tab.`
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
      `${countOf(count, 'version', 'versions')} ${count === 1 ? 'loses its place and stops' : 'lose their place and stop'} being sold — ${skus(consequence.retire)}. Orders already placed keep their record, and you can bring ${count === 1 ? 'it' : 'them'} back by adding that choice again.`
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
  const back = consequence.returning.length;
  if (blank === 0 && back > 0) {
    return {
      title: 'This product is sold differently now',
      description: `${countOf(back, 'version', 'versions')} came back with ${back === 1 ? 'its' : 'their'} price and code — put ${back === 1 ? 'it' : 'them'} on sale again on the Variants tab.`,
      type: 'success',
    };
  }
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
