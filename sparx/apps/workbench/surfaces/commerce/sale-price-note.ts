// What a till line says about its own price.
//
// The catalog price is the walk-in's price. A business buying on account has an
// agreed one, and its own website already charges it that, so the till asks the
// pricing engine what THIS customer pays (`useAgreedPrices`). This is the sentence
// that makes the answer readable. Piggles found the problem as its issue 737; this
// console starts from the fixed version.
//
// Three shapes, and which one a row gets is the whole of the rule:
//
//   nothing agreed      nothing at all. A normal price needs no explaining, and
//                       a till that annotates every line is a till nobody reads
//   agreed, untouched   "Their agreed price · normally $96.00"
//   agreed, typed over  "You have typed $80.00. They pay $52.00, their agreed
//                       price."  and the typed number stands
//
// The last one is the point. A typed price belongs to the person who typed it
// ([[feedback_honor_the_users_choice]]): the row measures and warns, it never
// substitutes.

import { formatCents } from './products-data';
import type { SaleLine } from './sale-data';

export interface PriceNote {
  text: string;
  /** A figure has been typed that is not what this customer pays. Wears a badge,
   *  because it is the one of the three nobody may skim past. */
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
