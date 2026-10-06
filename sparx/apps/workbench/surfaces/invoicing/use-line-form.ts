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
import { committedLine } from './line-commit';
import { lineMargin } from './line-margin';
import { costHelp } from './cost-help';
import type { ProductPick } from './product-pick';
import type { TradeAccount } from './trade-price';
import { useLineTradePrice } from './use-line-trade-price';

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
  /** Dollars per unit; null = none, undefined = let the server take the part's. */
  coreCharge: number | null | undefined;
  markup: MarkupState;
  /** Where the price came from, in words (issue 077); null for none. */
  priceNote: string | null;
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
    values.coreCharge ?? null,
    values.markup,
    values.priceNote,
  ]);
}

interface UseLineFormArgs {
  open: boolean;
  line: DraftLine | null;
  lineTypes: LineTypeOption[];
  markupRules: MarkupRuleSummary[];
  /** The wholesale account whose own prices a picked part takes, or null. */
  tradeAccount: TradeAccount | null;
  onSave: (line: DraftLine) => void;
}

export function useLineForm({
  open,
  line,
  lineTypes,
  markupRules,
  tradeAccount,
  onSave,
}: UseLineFormArgs) {
  const [lineTypeId, setLineTypeId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState(0);
  const [cost, setCost] = useState('');
  // What picking a product put in the cost box in this sitting, so the help
  // under it can say whether the product had a cost (sparx persona issue 086).
  const [productCost, setProductCost] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxable, setTaxable] = useState(true);
  const [productId, setProductId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [productLabel, setProductLabel] = useState<string | null>(null);
  const [coreCharge, setCoreCharge] = useState<number | null | undefined>(undefined);
  const [markup, setMarkup] = useState<MarkupState>(() => freshMarkupState([], 'flat'));
  const [showErrors, setShowErrors] = useState(false);
  // What the form looked like when it opened. Empty until the seeding effect has
  // run, which is what keeps the very first render from reading as dirty.
  const [baseline, setBaseline] = useState('');

  const trade = useLineTradePrice({ tradeAccount, quantity, unitPrice, setUnitPrice });

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
      coreCharge: src.coreCharge,
      markup: seedMarkupState(src, markupRules, mode),
      priceNote: src.priceNote ?? null,
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
    setCoreCharge(seeded.coreCharge);
    setMarkup(seeded.markup);
    trade.reset({
      variantId: seeded.variantId,
      unitPrice: seeded.unitPrice,
      quantity: Number(seeded.quantity),
      priceNote: seeded.priceNote,
    });
    setShowErrors(false);
    setProductCost(null);
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
        coreCharge,
        markup,
        priceNote: trade.note,
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
      coreCharge,
      markup,
      trade.note,
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
    // On a line priced by hand the cost is optional, but a cost typed wrong is
    // still wrong: it used to be dropped without a word (sparx persona issue 086).
    cost: markupMode
      ? !cost.trim()
        ? 'Required'
        : !costValid
          ? 'Invalid'
          : null
      : cost.trim() && !costValid
        ? 'Invalid'
        : null,
    markup: markupMode && costValid ? resolved.error : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (message: string | null) => (showErrors ? message : null);

  // The margin as it stands while typing, on every kind of line that has a
  // cost: the /b2b page promises it shows as you price (sparx persona issue 086).
  const livePrice = markupMode
    ? resolved.preview
      ? resolved.preview.priceCents / 100
      : null
    : unitPrice;
  const margin =
    livePrice !== null && costValid && Number.isFinite(qtyNum) && qtyNum > 0
      ? lineMargin({
          quantity: qtyNum,
          unitPrice: livePrice,
          discountAmount,
          explicitCostCents: Math.round((costNum ?? 0) * 100),
        })
      : null;

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
      // A typed zero is no deposit; untouched, the server keeps the part's own.
      ...(coreCharge === undefined
        ? {}
        : { coreCharge: coreCharge !== null && coreCharge > 0 ? coreCharge : null }),
    };

    onSave(
      committedLine(common, {
        markup:
          markupMode && resolved.payload && resolved.preview
            ? {
                priceCents: resolved.preview.priceCents,
                explicitCostCents: resolved.payload.explicitCostCents,
                markup: resolved.payload.markup ?? null,
              }
            : null,
        unitPrice,
        explicitCostCents,
        priceNote: trade.note,
      })
    );
  }

  /**
   * Attach a catalog part. Its own price comes with it: on a line type priced
   * by cost and markup the line moves onto the `catalog` type, because the part
   * already HAS a price and asking for a cost the business may not track left
   * the line unpriced (issue 077). For a business on account, its own price
   * replaces the list price as soon as the server answers.
   */
  function pickProduct(pick: ProductPick) {
    setProductId(pick.productId);
    setVariantId(pick.variantId);
    setProductLabel(pick.description);
    setDescription(pick.description);
    // A newly picked part brings its own deposit, or leaves it to the server.
    // The deposit is never discounted by a trade price: it is paid back whole.
    setCoreCharge(pick.coreCharge);
    // Its cost comes with it, so the line starts from the part's cost basis and
    // shows its margin at once; it can still be changed (sparx persona issue 086).
    // A part with no cost on record empties the box rather than keeping a cost
    // typed for something else.
    const brought = pick.costCents == null ? '' : String(pick.costCents / 100);
    setCost(brought);
    setProductCost(brought);

    const catalogType = lineTypes.find((t) => t.pricingMode === 'catalog');
    if (markupMode && catalogType) selectType(catalogType.id);
    // Without a catalog type a markup line keeps working its price out from
    // cost, and there is no price box for a part's price to land in.
    const holdsAPrice = !markupMode || Boolean(catalogType);
    trade.clear();
    if (!holdsAPrice) return;
    setUnitPrice(pick.unitPrice);
    if (pick.variantId) trade.lookUp(pick.variantId, Number(quantity) > 0 ? Number(quantity) : 1);
  }

  function clearProduct() {
    setProductId(null);
    setVariantId(null);
    setProductLabel(null);
    setProductCost(null);
    trade.clear();
  }

  /** A price typed by hand: it is the owner's, not a looked-up one. */
  function typeUnitPrice(dollars: number) {
    setUnitPrice(dollars);
    trade.typed(dollars);
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
    coreCharge,
    markup,
    // where the price came from (issue 077)
    priceNote: trade.note,
    priceWarning: trade.warning,
    pricingLookup: trade.looking,
    // derived
    pricingMode,
    markupMode,
    resolved,
    margin,
    // The cost box as money that can be blank: null is nothing typed, 0 is a
    // cost of nothing (sparx persona issue 086). The text above stays the one
    // store, so the margin and the markup read exactly what this holds.
    costValue: cost.trim() === '' ? null : Number(cost),
    costHelp: costHelp({ markupMode, productId, cost, productCost }),
    errors,
    dirty,
    show,
    // setters + actions
    setDescription,
    setQuantity,
    setUnitPrice: typeUnitPrice,
    setCost,
    setCostValue: (value: number | null) => {
      setCost(value === null ? '' : String(value));
    },
    setDiscountAmount,
    setCoreCharge,
    setTaxable,
    setMarkup,
    selectType,
    pickProduct,
    clearProduct,
    submit,
  };
}
