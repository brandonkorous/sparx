'use client';

// Choosing lines and turning them into draft purchase orders.
//
// The whole ROW is stored, not just its key, so a selection can span pages and
// still be drafted — the off-page rows' supplier and quantity come along rather
// than being re-fetched.

import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { plural, stockErrorMessage } from './data';
import {
  purchaseOrderCount,
  useDraftReorder,
  type DraftLine,
  type DraftReorderResult,
  type ReorderRow,
} from './reorder-data';
import { rowKey } from './reorder-shared';
import { useListSelection } from '../../lib/workbench/selection';

export type ReorderSelection = ReturnType<typeof useReorderSelection>;

/** Says plainly that nothing is ordered yet — a draft is the merchant's to
 *  check, change or discard before it reaches a supplier. */
function draftConfirm(itemCount: number, orderCount: number) {
  return {
    title: `Draft ${plural(orderCount, 'purchase order', 'purchase orders')}?`,
    description: `This turns the ${plural(itemCount, 'chosen item', 'chosen items')} into ${plural(
      orderCount,
      'draft order',
      'draft orders'
    )}, grouped by supplier and location. Nothing is ordered yet — a draft is yours to check, change, or discard before you send it to the supplier.`,
    confirmLabel: 'Create drafts',
    cancelLabel: 'Not yet',
    color: 'module' as const,
  };
}

function draftFailedToast(error: unknown) {
  return {
    title: 'Could not draft those orders',
    description: stockErrorMessage(error, 'Nothing was ordered. Please try again.'),
    type: 'error' as const,
  };
}

/** Names the orders it made, because "3 draft orders created" without their
 *  numbers leaves you hunting a list to find out what just happened. */
function draftedToast(result: DraftReorderResult) {
  const numbers = result.purchaseOrders.map((po) => po.number).join(', ');
  return {
    title: `${plural(result.count, 'draft order', 'draft orders')} created`,
    description: numbers
      ? `${numbers} — find them under Purchase orders to review and send.`
      : 'Find them under Purchase orders to review and send.',
    type: 'success' as const,
  };
}

export function useReorderSelection(rows: ReorderRow[]) {
  const toast = useToast();
  const confirm = useConfirm();
  const draft = useDraftReorder();

  const chosen = useListSelection(rows, {
    keyOf: rowKey,
    // A line with no supplier cannot become an order, so it is not choosable —
    // rather than choosable and then quietly dropped, which would make the
    // count in the bar disagree with what the button does.
    canChoose: (row) => row.supplierId !== null,
  });

  const lines: DraftLine[] = [...chosen.chosen.values()].map((row) => ({
    variantId: row.variantId,
    warehouseId: row.warehouseId,
    // Guarded by `canChoose` — only rows with a supplier are ever choosable.
    supplierId: row.supplierId ?? '',
    quantity: row.suggestedQuantity,
  }));
  const orderCount = purchaseOrderCount(lines);

  const onDraft = async () => {
    if (lines.length === 0) return;
    if (!(await confirm(draftConfirm(lines.length, orderCount)))) return;
    draft.mutate(lines, {
      onSuccess: (result) => {
        chosen.clear();
        toast.add(draftedToast(result));
      },
      onError: (error) => {
        toast.add(draftFailedToast(error));
      },
    });
  };

  // Spread rather than nested: callers say `selection.count` and
  // `selection.clear()` exactly as they would on any other list, and the two
  // reorder-only facts ride alongside.
  return { ...chosen, orderCount, isDrafting: draft.isPending, onDraft };
}
