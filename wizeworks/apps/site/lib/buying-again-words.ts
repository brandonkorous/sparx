// The words a trade buyer reads when buying again: after Order again or a saved
// cart's Add to cart, on a saved cart's row, and on a quote request's needed-by
// day (sparx persona issue 086).
//
// After Order again the buyer is told what went into the cart and what did not,
// and the reason for each one that was left out, because a reorder that quietly drops a
// line is a shortage nobody notices until the truck is unloaded. Prices are
// today's prices for their account, never the old order's, and the report says
// so in the same sentence that says what went in.

import type { SilicaColor } from '@wizeworks/silicaui-react';

export interface RefillResultView {
  added: { name: string; quantity: number; requested: number }[];
  skipped: {
    name: string;
    quantity: number;
    reason: 'not_sold' | 'out_of_stock' | 'limited';
    message: string;
  }[];
}

export interface RefillReport {
  tone: SilicaColor;
  headline: string;
  /** One line per item that went in. */
  added: string[];
  /** One sentence per item that did not, with its reason. */
  skipped: string[];
}

const TODAY = 'at today’s prices for your account';

function itemsInCart(count: number, skippedAny: boolean): string {
  if (skippedAny)
    return `${count === 1 ? '1 item is' : `${count} items are`} in your cart, ${TODAY}.`;
  if (count === 1) return `It is in your cart, ${TODAY}.`;
  if (count === 2) return `Both items are in your cart, ${TODAY}.`;
  return `All ${count} items are in your cart, ${TODAY}.`;
}

export function refillReport(result: RefillResultView): RefillReport {
  const added = result.added.map((a) =>
    a.quantity < a.requested
      ? `${a.name}, ${a.quantity} of the ${a.requested} asked for. That is all there is right now.`
      : `${a.name}, ${a.quantity}`
  );
  const skipped = result.skipped.map((s) => s.message);

  if (result.added.length === 0) {
    return { tone: 'danger', headline: 'Nothing was added to your cart.', added, skipped };
  }
  const short = result.added.some((a) => a.quantity < a.requested);
  const headline =
    itemsInCart(result.added.length, skipped.length > 0) +
    (skipped.length > 0 ? ` ${skipped.length} could not be added.` : '');
  return {
    tone: skipped.length > 0 || short ? 'warning' : 'success',
    headline,
    added,
    skipped,
  };
}

/** A saved cart's row: how many items, how many units, and who saved it. */
export function savedCartSummary(cart: {
  itemCount: number;
  unitCount: number;
  savedBy: string | null;
}): string {
  const items = cart.itemCount === 1 ? '1 item' : `${cart.itemCount} items`;
  const units = cart.unitCount !== cart.itemCount ? `, ${cart.unitCount} in all` : '';
  return `${items}${units}${cart.savedBy ? ` · Saved by ${cart.savedBy}` : ''}`;
}

/** A calendar day (`YYYY-MM-DD`) as words, built from its parts so no time
 *  zone moves it to the day before. Null for nothing, or for not-a-day. */
export function neededByWords(day: string | null): string | null {
  if (!day) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
