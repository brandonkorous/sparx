// What the line editor puts on the invoice draft on Add or Save, testable
// without a browser. Moved out of use-line-form.ts.

import type { LineMarkupInput } from '@wizeworks/commerce-schemas';
import { coreChargeField } from './line-form-values';
import type { ResolvedMarkup } from './line-markup';
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
    // The typed cost is the line's own; nulling it hid the margin (issue 086).
    costCents: args.explicitCostCents,
  };
}

/** The whole line from the editor's fields, as Add or Save commits it. */
export function formLine(
  base: DraftLine,
  f: {
    lineTypeId: string | null;
    description: string;
    quantity: number;
    discountAmount: number;
    taxable: boolean;
    productId: string | null;
    variantId: string | null;
    productLabel: string | null;
    coreCharge: number | null | undefined;
    costNum: number | null;
    unitPrice: number;
    priceNote: string | null;
    markupMode: boolean;
    resolved: ResolvedMarkup;
  }
): DraftLine {
  const explicitCostCents =
    f.costNum != null && Number.isFinite(f.costNum) ? Math.round(f.costNum * 100) : null;
  const common: DraftLine = {
    ...base,
    lineTypeId: f.lineTypeId,
    description: f.description.trim(),
    quantity: f.quantity,
    discountAmount: f.discountAmount,
    taxable: f.taxable,
    productId: f.productId,
    variantId: f.variantId,
    productLabel: f.productLabel,
    ...coreChargeField(f.coreCharge),
  };
  const { payload, preview } = f.resolved;
  return committedLine(common, {
    markup:
      f.markupMode && payload && preview
        ? {
            priceCents: preview.priceCents,
            explicitCostCents: payload.explicitCostCents,
            markup: payload.markup ?? null,
          }
        : null,
    unitPrice: f.unitPrice,
    explicitCostCents,
    priceNote: f.priceNote,
  });
}
