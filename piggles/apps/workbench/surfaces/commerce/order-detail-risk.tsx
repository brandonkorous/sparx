'use client';

// The notes on an order, and the two moves that cannot be taken back.
//
// Both irreversible rows are plain rows under a divider rather than cards
// competing with what people came here to read.

import { Button, Heading, Text } from '@wizeworks/silicaui-react';
import { faBan, faRotateLeft } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { FormSection } from '../../components/form-section';
import { formatMoney, type Order } from './data';
import type { RefundWords } from './refund-words';
import type { useOrderRisk } from './order-detail-actions';

const ROW = 'border-base-300 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4';

export function OrderNotes({ order }: { order: Order }) {
  if (!order.customerNote && !order.internalNote) return null;
  return (
    <FormSection title="Notes">
      {order.customerNote ? (
        <div className="flex flex-col gap-1">
          <Heading level={3} className="text-base font-semibold">
            From the customer
          </Heading>
          <Text className="text-base whitespace-pre-wrap">{order.customerNote}</Text>
        </div>
      ) : null}
      {order.internalNote ? (
        <div className="flex flex-col gap-1">
          <Heading level={3} className="text-base font-semibold">
            Your team’s note
          </Heading>
          <Text className="text-base whitespace-pre-wrap">{order.internalNote}</Text>
        </div>
      ) : null}
    </FormSection>
  );
}

/** Offered only while there is money left to give back. */
export function RefundRow({
  order,
  amount,
  says,
  risk,
}: {
  order: Order;
  amount: number;
  says: RefundWords;
  risk: ReturnType<typeof useOrderRisk>;
}) {
  if (amount <= 0) return null;
  return (
    <div className={ROW}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Text className="text-base font-medium">Refund this order</Text>
        <Text className="text-base">
          {says.panel} To give back only part of it, or to take stock back in, use a return instead.
        </Text>
      </div>
      <Button
        size="sm"
        color="danger"
        variant="outline"
        loading={risk.refund.isPending}
        onClick={() => {
          void risk.askToRefund(order, amount, says);
        }}
      >
        <Icon glyph={faRotateLeft} className="size-4" aria-hidden />
        Refund {formatMoney(amount, order.currency)}
      </Button>
    </div>
  );
}

/** Rare and irreversible. Refused by the server on an order that has already
 *  arrived or been refunded, so it is simply not offered there. */
export function CancelRow({
  order,
  cancellable,
  risk,
}: {
  order: Order;
  cancellable: boolean;
  risk: ReturnType<typeof useOrderRisk>;
}) {
  if (!cancellable) return null;
  return (
    <div className={ROW}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Text className="text-base font-medium">Cancel this order</Text>
        <Text className="text-sm">
          Marks it as cancelled so nothing more is sent. Any money already taken stays until you
          refund it, and the order cannot be reopened afterwards.
        </Text>
      </div>
      <Button
        size="sm"
        color="danger"
        variant="outline"
        loading={risk.cancel.isPending}
        onClick={() => {
          // The confirm has to open after this click finishes committing; the
          // pane never changes here, so no afterPaneChange is needed.
          void risk.askToCancel(order);
        }}
      >
        <Icon glyph={faBan} className="size-4" aria-hidden />
        Cancel order
      </Button>
    </div>
  );
}
