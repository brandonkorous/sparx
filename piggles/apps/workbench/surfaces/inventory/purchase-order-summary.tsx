// The top of the order's body: who it is with and where it lands (the number
// names the tab), and for a placed order, where it stands in one line.

import { Alert, AlertContent, AlertDescription, AlertTitle, Text } from '@wizeworks/silicaui-react';
import { formatMoment, type purchaseOrderState } from './purchase-orders-data';
import { emailedLine } from './purchase-order-email-words';
import type { PurchaseOrderPane } from './use-purchase-order-detail';

type OrderState = ReturnType<typeof purchaseOrderState> | null;

export function OrderIntro({ pane, state }: { pane: PurchaseOrderPane; state: OrderState }) {
  const { detail, supplierName } = pane;
  if (!detail) {
    return (
      <Text>
        Choose who you are buying from and where it lands, add the items, then save it as a draft.
        You place it with the supplier when it is ready.
      </Text>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Text className="text-sm">
        {supplierName ?? 'No supplier'}
        {detail.warehouseName ? ` · Landing at ${detail.warehouseName}` : ''}
        {/* Placed is an instant, so the reader's own clock; Expected is a day, in UTC. */}
        {detail.orderedAt ? ` · Placed ${formatMoment(detail.orderedAt)}` : ''}
      </Text>
      {state ? <Text className="text-sm">{state.detail}</Text> : null}
    </div>
  );
}

export function PlacedAlert({
  pane,
  state,
  outstanding,
  emailable,
}: {
  pane: PurchaseOrderPane;
  state: OrderState;
  outstanding: number;
  emailable: boolean;
}) {
  const { detail, editable } = pane;
  if (!detail || editable) return null;
  return (
    <Alert color={state?.tone ?? 'info'} variant="soft">
      <AlertContent>
        <AlertTitle>
          {outstanding > 0
            ? `${String(outstanding)} of ${String(detail.quantityOrdered)} units still to come`
            : 'Everything ordered has been received'}
        </AlertTitle>
        <AlertDescription>
          {state?.detail}
          {emailable ? ` ${emailedLine(detail, formatMoment)}` : ''}
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}
