// What a till line says about its own price. Issue 737.
//
// The till read the catalog's list price into every line and posted it through,
// so a shop with a signed agreement was quoted full retail at the counter it
// sells from, while its own website charged the agreed figure. `sale-detail`
// now asks the pricing engine what THIS customer pays; this is the sentence
// that makes the answer readable.
//
// Three shapes, and which one a row gets is the whole of the rule:
//
//   nothing agreed      nothing at all. A normal price needs no explaining, and
//                       a till that annotates every line is a till nobody reads
//   agreed, untouched   "Their agreed price · normally $96.00"
//   agreed, typed over  "You have typed $80.00. They pay $52.00, their agreed
//                       price."  and her number stands
//
// The last one is the point. A price she has typed is hers
// ([[feedback_honor_the_users_choice]]): the row measures and warns, it never
// substitutes. That is how the payment box two cards down has always behaved.

import { formatCents } from './products-data';
import type { SaleLine } from './sale-data';

export interface PriceNote {
  text: string;
  /** She has typed a figure that is not what this customer pays. Wears a badge,
   *  because it is the one of the three a person must not skim past. */
  typedOver: boolean;
}

/** The reasons are stored lower case so they read inside a sentence; a tag of
 *  its own starts with a capital like any other line of text. */
function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function priceNote(line: SaleLine): PriceNote | null {
  const agreed = line.agreed;
  if (!agreed) return null;

  const theirs = formatCents(agreed.unitPriceCents, 'USD');
  const typed = Math.round((Number(line.price) || 0) * 100);

  if (line.priceTouched && typed !== agreed.unitPriceCents) {
    return {
      text: `You have typed ${formatCents(typed, 'USD')}. They pay ${theirs}${
        agreed.why ? `, ${agreed.why}` : ''
      }.`,
      typedOver: true,
    };
  }

  if (agreed.unitPriceCents === agreed.listPriceCents) return null;
  return {
    text: `${sentenceCase(agreed.why ?? 'their price')} · normally ${formatCents(
      agreed.listPriceCents,
      'USD'
    )}`,
    typedOver: false,
  };
}
