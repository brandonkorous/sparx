// Everything one order pane reads: the record, the local draft, the figures
// worked out from it, and the unsaved-changes guard.

import { useEffect, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { isEditable, usePurchaseOrder } from './purchase-orders-data';
import type { EditingLine } from './purchase-order-draft';
import { draftEditors, usePurchaseOrderDraft } from './use-purchase-order-draft';
import { usePurchaseOrderFigures } from './use-purchase-order-figures';

/** Named, so the pane's inferred type can refer to it. */
export interface PaneToast extends ReturnType<typeof useToast> {
  add: ReturnType<typeof useToast>['add'];
}

/** `{id:'new'}` before the order exists. Started from a supplier's page, that
 *  supplier is already chosen and the untouched form is not "unsaved". */
function paneParams(ctx: SurfaceContext) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const isNew = id === 'new';
  const presetSupplier =
    isNew && typeof ctx.params.supplier === 'string' ? ctx.params.supplier : '';
  return { id, isNew, presetSupplier };
}

export function usePurchaseOrderBase(ctx: SurfaceContext) {
  const { id, isNew, presetSupplier } = paneParams(ctx);
  const toast: PaneToast = useToast();
  const confirm = useConfirm();
  const po = usePurchaseOrder(id);
  const detail = po.data ?? null;
  const status = detail?.status ?? 'draft';
  const editable = isNew || (detail !== null && isEditable(status));
  const draftState = usePurchaseOrderDraft(isNew, presetSupplier, detail);
  const { draft, dirty, loaded } = draftState;
  const [editing, setEditing] = useState<EditingLine | null>(null);

  useEffect(() => {
    ctx.setTitle(isNew ? 'New order to a supplier' : (detail?.number ?? 'Order to a supplier'));
  }, [ctx, isNew, detail?.number]);

  const figures = usePurchaseOrderFigures(draft, detail);
  const supplierChosen = draft.header.supplierId !== '';
  const warehouseChosen = draft.header.warehouseId !== '';
  const canSave =
    editable && supplierChosen && warehouseChosen && draft.lines.length > 0 && (isNew || dirty);

  useDirtySource(
    editable && dirty && loaded,
    isNew
      ? 'This order to a supplier has not been saved yet. Close anyway?'
      : `Changes to ${detail?.number ?? 'this order'} have not been saved. Close anyway?`
  );

  return {
    ctx,
    id,
    isNew,
    toast,
    confirm,
    po,
    detail,
    status,
    editable,
    editing,
    setEditing,
    ...draftState,
    ...draftEditors(draftState.setDraft),
    ...figures,
    supplierChosen,
    canSave,
  };
}

export type PurchaseOrderBase = ReturnType<typeof usePurchaseOrderBase>;
