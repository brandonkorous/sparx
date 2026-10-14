// The line dialog's whole model: its fields, the item picker, whether it can be
// added, and the discard guard. Its Save writes into the DRAFT, never the server.

import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { PurchaseOrderLineDraft } from './purchase-orders-data';
import { inputToCents, type EditingLine } from './purchase-order-draft';
import { useLineState, type LineFields } from './use-purchase-order-line-state';
import { useLinePick } from './use-purchase-order-line-pick';

export interface LineEditorProps {
  supplierId: string;
  currency: string;
  editing: EditingLine | null;
  onClose: () => void;
  onSave: (line: PurchaseOrderLineDraft) => void;
}

function isDirty(
  fields: LineFields,
  existing: PurchaseOrderLineDraft | null,
  qty: number,
  costCents: number | null
) {
  if (fields.variant === null) return false;
  if (existing === null) return true;
  return (
    qty !== existing.quantityOrdered ||
    costCents !== existing.unitCostCents ||
    fields.supplierSku.trim() !== (existing.supplierSku ?? '') ||
    fields.description.trim() !== (existing.description ?? '')
  );
}

/** The line as it goes into the draft. The editor works in SINGLE units, so an
 *  edited line keeps its unit and a new one is in singles (a blank unit). */
function lineFrom(
  fields: LineFields,
  existing: PurchaseOrderLineDraft | null,
  qty: number,
  costCents: number
): PurchaseOrderLineDraft | null {
  const { variant, description, supplierSku } = fields;
  if (variant === null) return null;
  return {
    ...(existing?.id ? { id: existing.id } : {}),
    variantId: variant.variantId,
    variantSku: variant.variantSku,
    productTitle: variant.productTitle,
    description: description.trim() === '' ? (variant.productTitle ?? null) : description.trim(),
    supplierSku: supplierSku.trim() === '' ? null : supplierSku.trim(),
    quantityOrdered: qty,
    unitCostCents: costCents,
    uomCode: existing?.uomCode ?? null,
    unitsPerUom: existing?.unitsPerUom ?? 1,
  };
}

function useRequestClose(isEdit: boolean, dirty: boolean, onClose: () => void) {
  const confirm = useConfirm();
  return async () => {
    if (dirty) {
      const ok = await confirm({
        title: isEdit ? 'Discard your changes?' : 'Discard this line?',
        description: isEdit
          ? 'Your changes to this line have not been saved to the order yet.'
          : 'This line has not been added to the order yet.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        color: 'danger',
      });
      if (!ok) return;
    }
    onClose();
  };
}

export function useLineEditor({ supplierId, editing, onClose, onSave }: LineEditorProps) {
  const open = editing !== null;
  const existing = editing?.line ?? null;
  const isEdit = existing !== null;
  const state = useLineState(open, existing);
  const { qty, variant } = state;
  const costCents = inputToCents(state.cost);
  const valid = variant !== null && Number.isFinite(qty) && qty > 0 && costCents !== null;
  const dirty = isDirty(state, existing, qty, costCents);

  useDirtySource(
    open && dirty,
    isEdit
      ? 'A line you were editing has changes you never saved. Discard them?'
      : 'You have a line you never added to this order. Discard it?'
  );
  const pick = useLinePick(state, supplierId);

  const submit = () => {
    if (!valid || costCents === null) return;
    const line = lineFrom(state, existing, qty, costCents);
    if (line === null) return;
    onSave(line);
    onClose();
  };

  const lineTotal =
    variant && Number.isFinite(qty) && qty > 0 && costCents !== null ? qty * costCents : null;
  const requestClose = useRequestClose(isEdit, dirty, onClose);
  return { ...state, ...pick, open, isEdit, valid, submit, requestClose, lineTotal };
}

export type LineEditorModel = ReturnType<typeof useLineEditor>;
