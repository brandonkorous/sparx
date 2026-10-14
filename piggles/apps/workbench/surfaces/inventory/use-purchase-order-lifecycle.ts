// Cancel, close, delete and receive: the lifecycle actions on a saved order.

import { afterPaneChange } from '../../lib/defer';
import { buyingErrorMessage } from './suppliers-data';
import {
  useCancelPurchaseOrder,
  useClosePurchaseOrder,
  useDeletePurchaseOrder,
} from './purchase-orders-data';
import type { PurchaseOrderBase } from './use-purchase-order-base';

interface LifecycleStep {
  mutate: (
    vars: undefined,
    handlers: { onSuccess: () => void; onError: (error: unknown) => void }
  ) => void;
}

interface StepWords {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  color: 'danger' | 'warning';
  done: string;
  failed: string;
}

/** Confirm, run the step, then toast the outcome. */
async function runStep(
  pane: PurchaseOrderBase,
  step: LifecycleStep,
  words: StepWords,
  after?: () => void
) {
  const { toast, confirm } = pane;
  const { done, failed, ...question } = words;
  const ok = await confirm(question);
  if (!ok) return;
  step.mutate(undefined, {
    onSuccess: () => {
      after?.();
      afterPaneChange(() => {
        toast.add({ title: done, type: 'success' });
      });
    },
    onError: (error) => {
      toast.add({
        title: failed,
        description: buyingErrorMessage(error, 'Nothing was changed.'),
        type: 'error',
      });
    },
  });
}

function cancelWords(number: string): StepWords {
  return {
    title: `Cancel ${number}?`,
    description:
      'This calls the order off for good. Nothing has been received against it, so nothing is undone, but it cannot be reopened. Start a new order if you still need the goods.',
    confirmLabel: 'Cancel the order',
    cancelLabel: 'Keep it',
    color: 'danger',
    done: `${number} canceled`,
    failed: 'Could not cancel that order',
  };
}

function closeWords(number: string): StepWords {
  return {
    title: `Close ${number}?`,
    description:
      'Closing stops you receiving any more against this order. Use it when the rest will not arrive (a supplier short-shipped and settled). What has already been received stays booked in.',
    confirmLabel: 'Close the order',
    cancelLabel: 'Leave it open',
    color: 'warning',
    done: `${number} closed`,
    failed: 'Could not close that order',
  };
}

function deleteWords(number: string): StepWords {
  return {
    title: `Delete draft ${number}?`,
    description:
      'This draft has never been placed, so deleting it removes it entirely. There is nothing to keep a record of.',
    confirmLabel: 'Delete the draft',
    cancelLabel: 'Keep it',
    color: 'danger',
    done: `${number} deleted`,
    failed: 'Could not delete that draft',
  };
}

export function usePurchaseOrderLifecycle(pane: PurchaseOrderBase) {
  const { ctx, id, detail } = pane;
  const cancel = useCancelPurchaseOrder(id);
  const close = useClosePurchaseOrder(id);
  const remove = useDeletePurchaseOrder(id);

  const onCancel = async () => {
    if (detail) await runStep(pane, cancel, cancelWords(detail.number));
  };
  const onClose = async () => {
    if (detail) await runStep(pane, close, closeWords(detail.number));
  };
  const onDelete = async () => {
    if (!detail) return;
    await runStep(pane, remove, deleteWords(detail.number), () => {
      ctx.close();
    });
  };
  const onReceive = () => {
    if (!detail) return;
    ctx.open(
      'inventory.receiving.detail',
      { id: 'new', purchaseOrderId: detail.id },
      { target: 'tab' }
    );
  };

  return { cancel, close, remove, onCancel, onClose, onDelete, onReceive };
}
