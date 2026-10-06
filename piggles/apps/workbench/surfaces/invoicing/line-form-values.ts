// The line editor's values as one comparable shape: what the form seeds from a
// line, and the snapshot its unsaved-changes guard compares.

import { seedCost, seedMarkupState, type MarkupRuleSummary, type MarkupState } from './line-markup';
import type { DraftLine } from './totals';

/** One of the tenant's line types — the vocabulary the composer offers. */
export interface LineTypeOption {
  id: string;
  key: string;
  label: string;
  pricingMode: string;
  defaultTaxable: boolean;
}

/** Every field the operator can change, in one comparable shape. */
export interface FormValues {
  lineTypeId: string | null;
  description: string;
  quantity: string;
  unitPrice: number;
  cost: string;
  discountAmount: number;
  taxable: boolean;
  productId: string | null;
  variantId: string | null;
  productLabel: string | null;
  /** Dollars per unit; null = none, undefined = let the server take the part's. */
  coreCharge: number | null | undefined;
  markup: MarkupState;
  /** Where the price came from, in words (issue 077); null for none. */
  priceNote: string | null;
}

/** JSON over a fixed field list: MarkupState is nested, so a shallow compare
 *  would miss a markup edit, the likeliest thing to be typed and lost. */
export function snapshot(values: FormValues): string {
  return JSON.stringify([
    values.lineTypeId,
    values.description,
    values.quantity,
    values.unitPrice,
    values.cost,
    values.discountAmount,
    values.taxable,
    values.productId,
    values.variantId,
    values.productLabel,
    values.coreCharge ?? null,
    values.markup,
    values.priceNote,
  ]);
}

/** The form's starting values for a line (or a blank one). */
export function seedValues(
  src: DraftLine,
  lineTypes: LineTypeOption[],
  markupRules: MarkupRuleSummary[]
): FormValues {
  const typeId = src.lineTypeId ?? lineTypes[0]?.id ?? null;
  const mode = lineTypes.find((t) => t.id === typeId)?.pricingMode ?? 'flat';
  return {
    lineTypeId: typeId,
    description: src.description,
    quantity: String(src.quantity || 1),
    unitPrice: src.unitPrice,
    cost: seedCost(src),
    discountAmount: src.discountAmount,
    taxable: src.taxable,
    productId: src.productId ?? null,
    variantId: src.variantId ?? null,
    productLabel: src.productLabel ?? null,
    coreCharge: src.coreCharge,
    markup: seedMarkupState(src, markupRules, mode),
    priceNote: src.priceNote ?? null,
  };
}

/** Per-field messages, shown inside the field that caused them. Terse: the
 *  numeric fields sit in a ~7rem column and the label names the field. */
export function lineFormErrors(input: {
  description: string;
  quantity: string;
  unitPrice: number;
  cost: string;
  markupMode: boolean;
  markupError: string | null;
}) {
  const qtyNum = Number(input.quantity.trim());
  const costNum = input.cost.trim() ? Number(input.cost) : null;
  const costValid = costNum != null && Number.isFinite(costNum) && costNum >= 0;
  // A markup line needs a cost; on any line a cost typed wrong is wrong, not
  // dropped without a word (sparx persona issue 086).
  const costError = input.markupMode
    ? !input.cost.trim()
      ? 'Required'
      : !costValid
        ? 'Invalid'
        : null
    : input.cost.trim() && !costValid
      ? 'Invalid'
      : null;
  const errors = {
    description: input.description.trim() ? null : 'Add a description.',
    quantity: !Number.isFinite(qtyNum) ? 'Not a number' : qtyNum <= 0 ? 'Must be > 0' : null,
    unitPrice: !input.markupMode && input.unitPrice < 0 ? 'Must be ≥ 0' : null,
    cost: costError,
    // The markup's problem only once cost is sound, so "enter a cost" never
    // lands on the markup field.
    markup: input.markupMode && costValid ? input.markupError : null,
  };
  return { errors, qtyNum, costNum, valid: !Object.values(errors).some(Boolean) };
}

/** A typed zero is no deposit; untouched, the server keeps the part's own. */
export function coreChargeField(coreCharge: number | null | undefined): Partial<DraftLine> {
  if (coreCharge === undefined) return {};
  return { coreCharge: coreCharge !== null && coreCharge > 0 ? coreCharge : null };
}
