// What the line editor puts on the invoice draft when Add or Save is pressed.
//
// Pulled out of use-line-form.ts so the rule can be tested without a browser:
// a line priced by hand keeps the cost typed for it, because that cost is what
// its margin is worked out from (sparx persona issue 086).

import type { LineMarkupInput } from '@wizeworks/commerce-schemas';
import type { DraftLine } from './totals';

/** A markup line's priced result, when the line is priced by cost and markup. */
export interface MarkupCommit {
  priceCents: number;
  explicitCostCents: number;
  markup: LineMarkupInput | null;
}

export function committedLine(
  common: DraftLine,
  args: {
    markup: MarkupCommit | null;
    /** Dollars, as typed, for a line priced by hand. */
    unitPrice: number;
    /** The cost typed in the editor, in cents, or null when the box is empty. */
    explicitCostCents: number | null;
    priceNote: string | null;
  }
): DraftLine {
  if (args.markup) {
    return {
      ...common,
      unitPrice: args.markup.priceCents / 100,
      explicitCostCents: args.markup.explicitCostCents,
      markup: args.markup.markup,
      // A price worked out from cost is nobody's trade price.
      priceNote: null,
    };
  }
  return {
    ...common,
    unitPrice: args.unitPrice,
    explicitCostCents: args.explicitCostCents,
    priceNote: args.priceNote,
    // Leaving markup mode clears the directive AND the stale snapshot.
    markup: null,
    appliedMarkup: null,
    // The cost typed here is the line's cost, not a markup input: it used to be
    // nulled, so a line priced by hand showed no margin (sparx persona issue 086).
    costCents: args.explicitCostCents,
  };
}
