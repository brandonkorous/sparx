// The typed state of the line dialog, reset each time it opens, and the cost box
// following the supplier's quantity ladder until somebody types a price.

import { useEffect, useMemo, useState } from 'react';
import { resolvePurchasePrice } from '@wizeworks/commerce-schemas';
import type { PurchaseOrderLineDraft } from './purchase-orders-data';
import { usePriceLadder } from './supplier-performance-data';
import { centsToInput } from './purchase-order-draft';

export interface ChosenVariant {
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
}

function useLineFields() {
  const [variant, setVariant] = useState<ChosenVariant | null>(null);
  const [description, setDescription] = useState('');
  const [supplierSku, setSupplierSku] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [cost, setCost] = useState('');
  const [skuLookup, setSkuLookup] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  // `costTouched`: a figure she typed is hers and the ladder never overwrites it.
  const [supplierVariantId, setSupplierVariantId] = useState('');
  const [costTouched, setCostTouched] = useState(false);
  return {
    variant,
    setVariant,
    description,
    setDescription,
    supplierSku,
    setSupplierSku,
    quantity,
    setQuantity,
    cost,
    setCost,
    skuLookup,
    setSkuLookup,
    lookupError,
    setLookupError,
    supplierVariantId,
    setSupplierVariantId,
    costTouched,
    setCostTouched,
  };
}

export type LineFields = ReturnType<typeof useLineFields>;
type Setters = Pick<LineFields, `set${string}` & keyof LineFields>;

function resetFields(set: Setters, existing: PurchaseOrderLineDraft | null) {
  if (existing) {
    set.setVariant({
      variantId: existing.variantId,
      variantSku: existing.variantSku,
      productTitle: existing.productTitle,
    });
    set.setDescription(existing.description ?? existing.productTitle ?? '');
    set.setSupplierSku(existing.supplierSku ?? '');
    set.setQuantity(String(existing.quantityOrdered));
    set.setCost(centsToInput(existing.unitCostCents));
  } else {
    set.setVariant(null);
    set.setDescription('');
    set.setSupplierSku('');
    set.setQuantity('1');
    set.setCost('');
  }
  set.setSupplierVariantId('');
  // An existing line's price was agreed when it was added; only a fresh one is the ladder's.
  set.setCostTouched(existing !== null);
  set.setSkuLookup('');
  set.setLookupError(null);
}

/** Reset the form each time the dialog opens onto a (possibly different) line. */
function useResetOnOpen(
  fields: LineFields,
  open: boolean,
  existing: PurchaseOrderLineDraft | null
) {
  const { setVariant, setDescription, setSupplierSku, setQuantity, setCost } = fields;
  const { setSupplierVariantId, setCostTouched, setSkuLookup, setLookupError } = fields;
  useEffect(() => {
    if (!open) return;
    const set = { setVariant, setDescription, setSupplierSku, setQuantity, setCost };
    const rest = { setSupplierVariantId, setCostTouched, setSkuLookup, setLookupError };
    resetFields({ ...set, ...rest }, existing);
  }, [
    open,
    existing,
    setVariant,
    setDescription,
    setSupplierSku,
    setQuantity,
    setCost,
    setSupplierVariantId,
    setCostTouched,
    setSkuLookup,
    setLookupError,
  ]);
}

/** The cost box follows the QUANTITY on the supplier's ladder, with the same
 *  `resolvePurchasePrice` the server uses, so screen and record agree (issue 487). */
export function useLineState(open: boolean, existing: PurchaseOrderLineDraft | null) {
  const fields = useLineFields();
  const ladder = usePriceLadder(fields.supplierVariantId);
  useResetOnOpen(fields, open, existing);

  const qty = Number.parseInt(fields.quantity, 10);
  const laddered = useMemo(() => {
    const data = ladder.data;
    if (!data || data.baseUnitCostCents === null) return null;
    return resolvePurchasePrice(
      Number.isFinite(qty) && qty > 0 ? qty : 0,
      data.baseUnitCostCents,
      data.breaks
    );
  }, [ladder.data, qty]);

  const { costTouched, setCost } = fields;
  useEffect(() => {
    if (costTouched || laddered === null) return;
    setCost(centsToInput(laddered.unitCostCents));
  }, [costTouched, laddered, setCost]);

  return { ...fields, qty, laddered };
}
