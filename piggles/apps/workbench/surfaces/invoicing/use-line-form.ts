'use client';

// The line editor's state, validation, and dirty tracking — everything about the
// form that is not its markup.
//
// Split out of line-editor-modal.tsx when the discard guard landed: the guard
// needs a BASELINE captured at the exact moment the form seeds, and threading
// that through eleven separate useStates in a file that also owned ~270 lines of
// JSX was how the modal got to 474 lines. State and the rules over it belong
// together; the modal renders what this returns.

import { useEffect, useMemo, useState } from 'react';
import {
  freshMarkupState,
  isMarkupMode,
  resolveMarkup,
  seedCost,
  seedMarkupState,
  type MarkupRuleSummary,
  type MarkupState,
} from './line-markup';
import { blankLine, type DraftLine } from './totals';

/** One of the tenant's line types — the vocabulary the composer offers. Lives
 *  here rather than in the modal so the hook does not import its own consumer. */
export interface LineTypeOption {
  id: string;
  key: string;
  label: string;
  pricingMode: string;
  defaultTaxable: boolean;
}

/** Every field the operator can change, in one comparable shape. */
interface FormValues {
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
  markup: MarkupState;
}

/**
 * The dirty comparison. JSON over a fixed field list rather than a field-by-field
 * `===` chain: MarkupState is a nested object, so a shallow compare would miss an
 * ad-hoc markup edit — the single most likely thing to be typed and lost.
 */
function snapshot(values: FormValues): string {
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
    values.markup,
  ]);
}

interface UseLineFormArgs {
  open: boolean;
  line: DraftLine | null;
  lineTypes: LineTypeOption[];
  markupRules: MarkupRuleSummary[];
  onSave: (line: DraftLine) => void;
}

export function useLineForm({ open, line, lineTypes, markupRules, onSave }: UseLineFormArgs) {
  const [lineTypeId, setLineTypeId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState(0);
  const [cost, setCost] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxable, setTaxable] = useState(true);
  const [productId, setProductId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [productLabel, setProductLabel] = useState<string | null>(null);
  const [markup, setMarkup] = useState<MarkupState>(() => freshMarkupState([], 'flat'));
  const [showErrors, setShowErrors] = useState(false);
  // What the form looked like when it opened. Empty until the seeding effect has
  // run, which is what keeps the very first render from reading as dirty.
  const [baseline, setBaseline] = useState('');

  const pricingMode = lineTypes.find((t) => t.id === lineTypeId)?.pricingMode ?? 'flat';
  const markupMode = isMarkupMode(pricingMode);
  const resolved = resolveMarkup(cost, markup, markupRules, pricingMode);

  // Seed the whole form from the line whenever the modal opens, and record that
  // seeded shape as the baseline in the SAME pass — computed from the source
  // values, not from state, which has not re-rendered yet.
  useEffect(() => {
    if (!open) return;
    const src = line ?? blankLine();
    const typeId = src.lineTypeId ?? lineTypes[0]?.id ?? null;
    const mode = lineTypes.find((t) => t.id === typeId)?.pricingMode ?? 'flat';
    const seeded: FormValues = {
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
      markup: seedMarkupState(src, markupRules, mode),
    };
    setLineTypeId(seeded.lineTypeId);
    setDescription(seeded.description);
    setQuantity(seeded.quantity);
    setUnitPrice(seeded.unitPrice);
    setCost(seeded.cost);
    setDiscountAmount(seeded.discountAmount);
    setTaxable(seeded.taxable);
    setProductId(seeded.productId);
    setVariantId(seeded.variantId);
    setProductLabel(seeded.productLabel);
    setMarkup(seeded.markup);
    setShowErrors(false);
    setBaseline(snapshot(seeded));
    // Seeding is intentional on open only, so the dep list is deliberately
    // narrower than the values read above: re-running it when `lineTypes` or
    // `markupRules` resolve would reset the form under whoever is typing in it.
    // (No exhaustive-deps disable needed — react-hooks is scoped to *.tsx.)
  }, [open, line?.key]);

  const current = useMemo(
    () =>
      snapshot({
        lineTypeId,
        description,
        quantity,
        unitPrice,
        cost,
        discountAmount,
        taxable,
        productId,
        variantId,
        productLabel,
        markup,
      }),
    [
      lineTypeId,
      description,
      quantity,
      unitPrice,
      cost,
      discountAmount,
      taxable,
      productId,
      variantId,
      productLabel,
      markup,
    ]
  );

  const dirty = baseline !== '' && current !== baseline;

  function selectType(id: string) {
    setLineTypeId(id);
    const type = lineTypes.find((t) => t.id === id);
    if (type) setTaxable(type.defaultTaxable);
    if (isMarkupMode(type?.pricingMode)) {
      setMarkup(freshMarkupState(markupRules, type?.pricingMode ?? 'markup'));
    }
  }

  // Per-field validation — each message renders inside the field that caused it,
  // so the error points at the control rather than at the form.
  //
  // Messages on the numeric fields are TERSE by necessity: they sit in a ~7rem
  // column, and a sentence there wraps to three lines and shoves the whole row
  // down. The label already says which field it is, so the message only has to
  // say what is wrong with it.
  const qtyNum = Number(quantity.trim());
  const costNum = cost.trim() ? Number(cost) : null;
  const costValid = costNum != null && Number.isFinite(costNum) && costNum >= 0;
  const errors = {
    description: description.trim() ? null : 'Add a description.',
    quantity: !Number.isFinite(qtyNum) ? 'Not a number' : qtyNum <= 0 ? 'Must be > 0' : null,
    unitPrice: !markupMode && unitPrice < 0 ? 'Must be ≥ 0' : null,
    // A markup line that can't be priced is the COST's problem while cost is
    // missing or unusable, and the markup's only once cost is sound. Gating the
    // markup message on `costValid` is what stops "enter a cost" from being
    // reported against the markup field, which names the wrong control.
    cost: markupMode ? (!cost.trim() ? 'Required' : !costValid ? 'Invalid' : null) : null,
    markup: markupMode && costValid ? resolved.error : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (message: string | null) => (showErrors ? message : null);

  function submit() {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    const explicitCostCents =
      costNum != null && Number.isFinite(costNum) ? Math.round(costNum * 100) : null;
    const common: DraftLine = {
      ...(line ?? blankLine()),
      lineTypeId: lineTypeId ?? null,
      description: description.trim(),
      quantity: qtyNum,
      discountAmount,
      taxable,
      productId,
      variantId,
      productLabel,
    };

    onSave(
      markupMode && resolved.payload && resolved.preview
        ? {
            ...common,
            unitPrice: resolved.preview.priceCents / 100,
            explicitCostCents: resolved.payload.explicitCostCents,
            markup: resolved.payload.markup ?? null,
          }
        : {
            ...common,
            unitPrice,
            explicitCostCents,
            // Leaving markup mode clears the directive AND the stale snapshot.
            markup: null,
            appliedMarkup: null,
            costCents: null,
          }
    );
  }

  /**
   * Attach a catalogue item to this line.
   *
   * ── WHY THIS SWITCHES THE LINE TYPE ─────────────────────────────────────
   *
   * The default type is "Product", which prices by MARKUP — cost in, markup on
   * top, unit price out. That is a trades model (a garage marking up a part),
   * and the line it produces asks a business for a **cost** it may not track.
   *
   * It also threw the answer away. This function has always received the
   * product's own price, and used to end at `if (!markupMode) setUnitPrice(…)`
   * — so on the DEFAULT type the price was discarded. A bakery picking her own
   * sourdough got an empty money box labelled "Cost", typed her SELLING price
   * into it, and the invoice recorded that as her cost at **0% margin**: a
   * number nobody measured, on the report that tells her whether she makes
   * money on wholesale.
   *
   * A catalogue item carries its own price — that is what the `catalog` pricing
   * mode is FOR, and every tenant is seeded with a line type that uses it. So
   * attaching one moves the line onto that type, and the price comes with it.
   */
  function pickProduct(pick: {
    productId: string | null;
    variantId: string | null;
    description: string;
    unitPrice: number;
  }) {
    setProductId(pick.productId);
    setVariantId(pick.variantId);
    setProductLabel(pick.description);
    setDescription(pick.description);

    const catalogType = lineTypes.find((t) => t.pricingMode === 'catalog');
    if (markupMode && catalogType) {
      selectType(catalogType.id);
      setUnitPrice(pick.unitPrice);
      return;
    }
    // No catalogue type configured — keep the type the operator chose, and seed
    // the price where the mode can hold one. In markup mode it cannot: the unit
    // price is derived, so writing it would be overwritten on the next keystroke.
    if (!markupMode) setUnitPrice(pick.unitPrice);
  }

  function clearProduct() {
    setProductId(null);
    setVariantId(null);
    setProductLabel(null);
  }

  return {
    // values
    lineTypeId,
    description,
    quantity,
    unitPrice,
    cost,
    discountAmount,
    taxable,
    productId,
    variantId,
    productLabel,
    markup,
    // derived
    pricingMode,
    markupMode,
    resolved,
    errors,
    dirty,
    show,
    // setters + actions
    setDescription,
    setQuantity,
    setUnitPrice,
    setCost,
    setDiscountAmount,
    setTaxable,
    setMarkup,
    selectType,
    pickProduct,
    clearProduct,
    submit,
  };
}
