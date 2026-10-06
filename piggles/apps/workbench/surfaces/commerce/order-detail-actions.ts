'use client';

// The moves on an order that cannot be taken back: giving money back, calling it
// off, and taking a payment off that never came in.
//
// All three are the same four parts — a confirm, a yield, a mutation, a toast —
// and all four have to agree about what is being done and what it costs. Kept
// together, and away from the pane's markup, so the wording and the guard read
// as one thing.

import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { deferTick } from '../../lib/defer';
import {
  customerName,
  formatMoney,
  orderErrorMessage,
  useCancelOrder,
  useRefundOrder,
  useTakePaymentOff,
  type Order,
  type OrderPayment,
} from './data';
import type { RefundWords } from './refund-words';
import { takeOffWords } from './payment-undo';

/**
 * An order's irreversible actions, with the mutations behind them.
 *
 * Takes the ID rather than the order, because the mutations are hooks and the
 * pane calls this before it knows whether the order loaded at all. The order
 * arrives at the moment somebody presses a button, which is the only moment
 * either sentence can be written.
 */
/**
 * The sale code coming back, when undoing this order gives it back.
 *
 * A whole order undone releases the customer's use of any code on it, so they can
 * use the sale again — which nothing did until issue 312. It belongs in the confirm
 * for the same reason the money already is: it is a consequence of the press, and
 * she should read it before the press rather than hear it from the customer.
 *
 * Empty for a PARTIAL refund, where the sale stands and the code stays spent.
 */
function codeComesBack(order: Order, whole: boolean): string {
  if (!whole || order.discountTotal <= 0) return '';
  // "them", not the name again: both confirms have already named the customer in
  // the sentence or the title above this one.
  return ' The sale code on it goes back to them, to use again.';
}

export function useOrderRisk(orderId: string) {
  const toast = useToast();
  const confirm = useConfirm();
  const cancel = useCancelOrder(orderId);
  const refund = useRefundOrder(orderId);
  const takeOff = useTakePaymentOff(orderId);

  const askToRefund = async (order: Order, amount: number, says: RefundWords) => {
    const currency = order.currency;
    const ok = await confirm({
      title: `Refund ${formatMoney(amount, currency)} to ${customerName(order.customer)}?`,
      description: says.confirm + codeComesBack(order, amount >= order.total - order.refundTotal),
      confirmLabel: `Refund ${formatMoney(amount, currency)}`,
      cancelLabel: 'Leave it as it is',
      color: 'danger',
    });
    if (!ok) return;
    // Same reason as askToCancel: let the confirm's flushSync close commit
    // finish before this pane re-renders underneath it.
    await deferTick();
    refund.mutate(
      { amount },
      {
        onSuccess: () => {
          toast.add({
            title: `Refunded ${formatMoney(amount, currency)}`,
            description: says.done,
            type: 'success',
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not refund this order',
            description: orderErrorMessage(
              error,
              'No money was moved and nothing was changed on the order.'
            ),
            type: 'error',
          });
        },
      }
    );
  };

  const askToCancel = async (order: Order) => {
    const currency = order.currency;
    const items = order.items ?? [];
    // Pieces, not lines: two turbos on one line are 2 items to the person
    // reading this, not "1 item worth $4,758.30".
    const units = items.reduce((sum, item) => sum + item.quantity, 0);
    const ok = await confirm({
      title: `Cancel order ${order.orderNumber}?`,
      description:
        `This marks the order as canceled for ${customerName(order.customer)}: ` +
        `${String(units)} ${units === 1 ? 'item' : 'items'} worth ` +
        `${formatMoney(order.total, currency)} will no longer be sent. ` +
        (order.amountPaid > 0
          ? `${formatMoney(order.amountPaid, currency)} has already been paid and is NOT refunded by this. You refund that separately.`
          : 'No money has come in, so there is nothing to refund.') +
        codeComesBack(order, true) +
        ' A canceled order cannot be reopened.',
      confirmLabel: 'Cancel the order',
      cancelLabel: 'Leave it as it is',
      color: 'danger',
    });
    if (!ok) return;
    // Yield before mutating, so the confirm's own close commit (Base UI closes
    // by measuring with flushSync) is finished before this pane starts
    // re-rendering underneath it. Same reason lifecycle.tsx yields around its
    // stage dialog — see lib/defer.ts.
    await deferTick();
    cancel.mutate(undefined, {
      onSuccess: () => {
        toast.add({ title: `Order ${order.orderNumber} canceled`, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not cancel this order',
          description: orderErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  /**
   * A payment written down by mistake, coming back off.
   *
   * Reads as a third irreversible act rather than an undo, because it is one: the
   * server refuses to un-take-off a row, and the figure it corrects is the one the
   * shop's takings are counted from. The dialog's own words live in
   * `payment-undo.ts`, next to the rule for when this is offered at all.
   */
  const askToTakeOff = async (order: Order, payment: OrderPayment) => {
    const amount = formatMoney(payment.amount, payment.currency);
    const says = takeOffWords({ amount, orderNumber: order.orderNumber });
    const ok = await confirm({
      title: says.title,
      description: says.confirm,
      confirmLabel: `Take ${amount} off`,
      cancelLabel: 'Leave it as it is',
      color: 'danger',
    });
    if (!ok) return;
    // Same yield as the two above: let the confirm's own close commit finish
    // before this pane re-renders underneath it. See lib/defer.ts.
    await deferTick();
    takeOff.mutate(payment.id, {
      onSuccess: () => {
        toast.add({
          title: `${amount} taken off order ${order.orderNumber}`,
          description: says.done,
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not take this payment off',
          description: orderErrorMessage(
            error,
            'No money was moved and nothing was changed on the order.'
          ),
          type: 'error',
        });
      },
    });
  };

  return { cancel, refund, takeOff, askToRefund, askToCancel, askToTakeOff };
}
