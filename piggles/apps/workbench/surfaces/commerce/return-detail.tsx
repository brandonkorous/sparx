'use client';

// One return — what a customer sent back, why, and where you are in settling it.
//
// This is a TRANSACTION detail, the sibling of the order pane: a record of
// something that happened, so it keeps a real identity heading (which order this
// return is against, and who asked) rather than an editable name field. Nothing
// here is a draft.
//
// The pane READS; the moves are the RMA lifecycle. Only the ONE or two moves that
// are actually available from the current stage are offered, each as a plain row
// under a divider after the record — never a wall of greyed-out buttons for
// stages this return has passed or not reached. Marking the goods received is a
// plain confirm; the moves that need real input (approve quantities, a reason to
// turn down, the condition of what came back, the amount to refund) open a short
// modal. The refund moves money and cannot be undone, so it names the customer
// and the amount before it commits.
//
// The audience owns a business, not a warehouse system: "inspected" becomes
// "checked", "in_transit" becomes "on its way back", and a refund is "giving the
// money back".

import { useEffect } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  Text,
} from '@wizeworks/silicaui-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatDate, useOrder } from './data';
import { outcomeLabel, returnState, useReturn, type ReturnDetail } from './returns-data';
import { ReturnRecord } from './return-detail-record';
import { ReturnMoves } from './return-detail-moves';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

function ReturnIdentity({ detail }: { detail: ReturnDetail }) {
  const facts = [
    `Asked ${formatDate(detail.requestedAt)}`,
    `Wants ${outcomeLabel(detail.preferredOutcome).toLowerCase()}`,
    `${String(detail.itemCount)} ${detail.itemCount === 1 ? 'item' : 'items'}`,
  ];
  return (
    <div className="flex flex-col gap-1">
      {/* The order this came back from IS this pane's identity, and the tab
          carries it. The buyer leads the body instead. */}
      <Text className="text-lg">
        {detail.orderNumber === null
          ? 'The sale this came from is gone'
          : (detail.customerName ?? 'Unknown customer')}
      </Text>
      <Text className="text-sm">{facts.join(' · ')}</Text>
    </div>
  );
}

export function ReturnDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : '';
  const { data: detail, isPending, isError, isFetching, dataUpdatedAt, refetch } = useReturn(id);

  const orderNumber = detail?.orderNumber ?? null;
  useEffect(() => {
    if (orderNumber) ctx.setTitle(`Return · ${orderNumber}`);
  }, [ctx, orderNumber]);

  if (isError) {
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            title="Could not load this return"
            description="This is a problem reaching the server. The return itself is unaffected — nothing has been changed or lost."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (isPending || !detail) return <PaneWaiting />;

  // Split so the body always has a loaded return: the order lookup below keys on
  // a real orderId, never the empty string the pane holds while the return loads
  // (useOrder has no enabled guard of its own).
  return (
    <ReturnDetailBody
      detail={detail}
      isFetching={isFetching}
      updatedAt={dataUpdatedAt}
      onRefresh={() => {
        void refetch();
      }}
    />
  );
}

function ReturnDetailBody({
  detail,
  isFetching,
  updatedAt,
  onRefresh,
}: {
  detail: ReturnDetail;
  isFetching: boolean;
  updatedAt: number;
  onRefresh: () => void;
}) {
  // The order backs two things the return row cannot: the line prices shown
  // against each item, and a sensible starting figure for the refund.
  const { data: order } = useOrder(detail.orderId);
  const state = returnState(detail.status, detail.preferredOutcome);
  // Null ONLY when the order lookup found nothing — a real order always has a
  // number, so this is the one honest test for "the sale is gone" (issue 225).
  const gone = detail.orderNumber === null;
  const currency = order?.currency ?? 'USD';

  const suggestedCents = detail.items.reduce((sum, it) => {
    const unit = (order?.items ?? []).find((line) => line.id === it.orderItemId)?.unitPrice;
    if (unit === undefined) return sum;
    const qty = it.approvedQuantity > 0 ? it.approvedQuantity : it.quantity;
    return sum + Math.round(unit * qty * 100);
  }, 0);

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Return actions"
        status={
          <>
            {/* A stage is a claim about what happens next. On a return whose
                sale is gone, nothing happens next (issue 225). */}
            {gone ? (
              <Badge color="warning" variant="soft" size="sm">
                Nothing to do
              </Badge>
            ) : (
              <Badge color={state.tone} variant="soft" size="sm">
                {state.label}
              </Badge>
            )}
            <div className="flex-1" />
            <Text className="text-sm">{gone ? 'No order' : `Order ${detail.orderNumber}`}</Text>
          </>
        }
        refresh={
          <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className={COLUMN}>
          <ReturnIdentity detail={detail} />

          {/* One message, the most specific true one — what stage this is at and
              what it means, in plain words. A return whose SALE is gone gets a
              different message entirely: its stage is meaningless and every
              action on it would act on nothing (issue 225). */}
          {gone ? (
            <Alert color="warning" variant="soft">
              <AlertContent>
                <AlertTitle>The sale this came from is gone</AlertTitle>
                <AlertDescription>
                  There is no order behind this return any more, so nothing here can be named,
                  approved or settled. It is safe to ignore. If you did not expect to see it, it
                  almost certainly arrived with sample data that was later cleared.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : (
            <Alert color={state.tone} variant="soft">
              <AlertContent>
                <AlertTitle>{state.label}</AlertTitle>
                <AlertDescription>
                  {state.detail}
                  {detail.status === 'denied' && detail.staffNote
                    ? ` Reason given: ${detail.staffNote}`
                    : ''}
                </AlertDescription>
              </AlertContent>
            </Alert>
          )}

          <ReturnRecord detail={detail} order={order} currency={currency} />

          <ReturnMoves detail={detail} currency={currency} suggestedCents={suggestedCents} />
        </div>
      </div>
    </div>
  );
}
