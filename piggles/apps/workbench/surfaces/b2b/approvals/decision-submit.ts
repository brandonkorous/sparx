'use client';

import { useToast } from '@wizeworks/silicaui-react';
import { afterPaneChange } from '../../../lib/defer';
import {
  approvalErrorMessage,
  queueBuyer,
  useApproveOrder,
  useRejectOrder,
  type ApproveResult,
  type QueueItem,
} from '../approvals-data';
import { approvedStockNotice, approveOutcome, type ApprovedStockNotice } from '../sign-off-words';
import { type Decision } from './shared';

// Approve or reject, then say what the server did.
export function useDecisionSubmit(
  decision: NonNullable<Decision>,
  reason: string,
  onDone: () => void,
  onStockShort: (notice: ApprovedStockNotice) => void
) {
  const toast = useToast();
  const approve = useApproveOrder();
  const reject = useRejectOrder();
  const isApprove = decision.action === 'approve';
  const pending = isApprove ? approve.isPending : reject.isPending;
  const { item } = decision;

  const onError = (error: unknown) => {
    // The server's own sentence: a refusal names who the order is waiting
    // for, which is the one thing worth reading here.
    toast.add({
      title: isApprove ? 'Could not approve this order' : 'Could not reject this order',
      description: approvalErrorMessage(error, 'Nothing was changed.'),
      type: 'error',
    });
  };

  const submit = () => {
    const input = { orderId: item.id, reason: reason.trim() === '' ? undefined : reason.trim() };
    if (isApprove) {
      approve.mutate(input, {
        onSuccess: (result) => {
          onDone();
          afterApproved(result, item, toast, onStockShort);
        },
        onError,
      });
      return;
    }
    reject.mutate(input, {
      onSuccess: () => {
        onDone();
        afterRejected(item, toast);
      },
      onError,
    });
  };
  return { submit, pending };
}

// Read what the server did, not what was asked: the business's half of an order
// the customer has yet to sign leaves it waiting (sparx persona issue 087).
function afterApproved(
  result: ApproveResult,
  item: QueueItem,
  toast: ReturnType<typeof useToast>,
  onStockShort: (notice: ApprovedStockNotice) => void
) {
  const outcome = approveOutcome(result, item.signOff, item.companyName);
  afterPaneChange(() => {
    toast.add({ ...outcome, type: 'success' });
  });
  const short = approvedStockNotice(result, queueBuyer(item));
  if (short) onStockShort(short);
}

function afterRejected(item: QueueItem, toast: ReturnType<typeof useToast>) {
  afterPaneChange(() => {
    toast.add({
      title: `Order ${item.orderNumber} rejected`,
      description: 'The order has been canceled.',
      type: 'success',
    });
  });
}
