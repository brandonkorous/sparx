'use client';

// The line editor's state, validation and dirty tracking: everything about the
// form that is not its markup. The modal renders what this returns.

import { useEffect, useState } from 'react';
import {
  freshMarkupState,
  isMarkupMode,
  resolveMarkup,
  type MarkupRuleSummary,
  type MarkupState,
} from './line-markup';
import { blankLine, type DraftLine } from './totals';
import { lineFormErrors, seedValues, snapshot, type LineTypeOption } from './line-form-values';
import { formLine } from './line-commit';
import { formMargin } from './line-margin';
import type { ProductPick } from './product-pick';
import { useLineCost } from './use-line-cost';
import type { TradeAccount } from './trade-price';
import { useLineTradePrice } from './use-line-trade-price';

export type { LineTypeOption } from './line-form-values';

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
  const costBox = useLineCost();
  const { cost, setCost } = costBox;
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

  // Seed the form on open and record the baseline in the SAME pass, from the
  // source values rather than from state, which has not re-rendered yet.
  useEffect(() => {
    if (!open) return;
    const seeded = seedValues(line ?? blankLine(), lineTypes, markupRules);
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
    costBox.forget();
    setBaseline(snapshot(seeded));
    // On open only: re-seeding when `lineTypes` or `markupRules` resolve would
    // reset the form under whoever is typing in it.
  }, [open, line?.key]);

  // A small array per render; cheaper than keeping a dependency list in step.
  const current = snapshot({
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
  });

  const dirty = baseline !== '' && current !== baseline;

  function selectType(id: string) {
    setLineTypeId(id);
    const type = lineTypes.find((t) => t.id === id);
    if (type) setTaxable(type.defaultTaxable);
    if (isMarkupMode(type?.pricingMode)) {
      setMarkup(freshMarkupState(markupRules, type?.pricingMode ?? 'markup'));
    }
  }

  const { errors, qtyNum, costNum, valid } = lineFormErrors({
    description,
    quantity,
    unitPrice,
    cost,
    markupMode,
    markupError: resolved.error,
  });
  const show = (message: string | null) => (showErrors ? message : null);
  // The margin as you price, on every line with a cost (sparx persona issue 086).
  const margin = formMargin({
    livePrice: markupMode
      ? resolved.preview
        ? resolved.preview.priceCents / 100
        : null
      : unitPrice,
    quantity: qtyNum,
    discountAmount,
    costText: cost,
  });

  function submit() {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    onSave(
      formLine(line ?? blankLine(), {
        lineTypeId,
        description,
        quantity: qtyNum,
        discountAmount,
        taxable,
        productId,
        variantId,
        productLabel,
        coreCharge,
        costNum,
        unitPrice,
        priceNote: trade.note,
        markupMode,
        resolved,
      })
    );
  }

  /** Attach a catalogue item. On a markup type it moves the line onto the
   *  `catalog` type so the item's own price comes with it, rather than asking a
   *  business for a cost it may not track. For a business on account, its own
   *  price replaces the list price as soon as the server answers (issue 077). */
  function pickProduct(pick: ProductPick) {
    setProductId(pick.productId);
    setVariantId(pick.variantId);
    setProductLabel(pick.description);
    setDescription(pick.description);
    // A newly picked part brings its own deposit, or leaves it to the server.
    // The deposit is never discounted by a trade price: it is paid back whole.
    setCoreCharge(pick.coreCharge);
    costBox.fromProduct(pick.costCents);

    const catalogType = lineTypes.find((t) => t.pricingMode === 'catalog');
    if (markupMode && catalogType) selectType(catalogType.id);
    // No catalogue type: a markup line keeps working its price out from cost,
    // and there is no price box for an item's price to land in.
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
    costBox.forget();
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
    ...costBox.fields(markupMode, productId),
    errors,
    dirty,
    show,
    // setters + actions
    setDescription,
    setQuantity,
    setUnitPrice: typeUnitPrice,
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
