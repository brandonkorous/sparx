'use client';

// The moves you can make on a return, and the forms behind them.
//
// Only the ONE or two moves actually available from the current stage are
// offered, each as a plain row under a divider after the record — never a wall
// of greyed-out buttons for stages this return has passed or not reached.
//
// HOW a return is settled follows what the customer asked for: money back, or
// the replacement they wanted. Offering only the refund made an even swap
// impossible to finish honestly (issue 220).

import { useState } from 'react';
import { Button, useToast } from '@wizeworks/silicaui-react';
import { faBoxCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { useConfirm } from '../../lib/confirm';
import { deferTick } from '../../lib/defer';
import { returnErrorMessage, useReceiveReturn, type ReturnDetail } from './returns-data';
import {
  ApproveReturnModal,
  DenyReturnModal,
  ExchangeReturnModal,
  InspectReturnModal,
  RefundReturnModal,
} from './return-actions';
import { ActionRow } from './return-action-dialog';

export function ReturnMoves({
  detail,
  currency,
  suggestedCents,
}: {
  detail: ReturnDetail;
  currency: string;
  /** A starting refund figure worked out from the accepted lines. */
  suggestedCents: number;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const receive = useReceiveReturn(detail.id);

  const [approveOpen, setApproveOpen] = useState(false);
  const [denyOpen, setDenyOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [exchangeOpen, setExchangeOpen] = useState(false);

  // Nothing can be done to a return whose sale is gone: the lines point at
  // order items that no longer exist, so approving it would buy a prepaid label
  // for goods nobody can name and settling it would refund an order that is not
  // there (issue 225). `orderNumber` is null ONLY when the order lookup found
  // nothing — a real order always has a number.
  if (detail.orderNumber === null) return null;

  const canApprove = detail.status === 'requested' || detail.status === 'denied';
  const canDeny = detail.status === 'requested';
  const canReceive =
    detail.status === 'approved' ||
    detail.status === 'awaiting_shipment' ||
    detail.status === 'in_transit';
  const canInspect = detail.status === 'received' || detail.status === 'inspecting';
  // Ready to settle — but HOW depends on what the customer asked for. An even
  // swap moves no money, so offering only a refund there offers the one move
  // that is wrong (issue 220).
  const settling = detail.status === 'inspected' || detail.status === 'received';
  const swapping = detail.preferredOutcome === 'exchange';
  const canRefund = settling && !swapping;
  const canExchange = settling && swapping;
  const hasAction = canApprove || canDeny || canReceive || canInspect || canRefund || canExchange;
  const onReceive = async () => {
    const ok = await confirm({
      title: 'Mark the goods as received?',
      description:
        'This records that the returned items are back with you, so you can check their condition and finish the return. Only do this once they have actually arrived.',
      confirmLabel: 'Yes, they have arrived',
      cancelLabel: 'Not yet',
      color: 'module',
    });
    if (!ok) return;
    await deferTick();
    receive.mutate(undefined, {
      onSuccess: () => {
        toast.add({ title: 'Marked as received', type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not mark this as received',
          description: returnErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <>
      {hasAction ? (
        <div className="flex flex-col">
          {canApprove ? (
            <ActionRow
              title="Approve this return"
              description="Accept the goods back and tell the customer it is on. A prepaid label is bought automatically if a carrier is connected."
            >
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  setApproveOpen(true);
                }}
              >
                Approve…
              </Button>
            </ActionRow>
          ) : null}

          {canReceive ? (
            <ActionRow
              title="Mark the goods as received"
              description="Record that the items are physically back with you, ready to check over."
            >
              <Button
                size="sm"
                color="module"
                variant="soft"
                loading={receive.isPending}
                onClick={() => {
                  void onReceive();
                }}
              >
                <Icon glyph={faBoxCheck} className="size-4" aria-hidden />
                Received
              </Button>
            </ActionRow>
          ) : null}

          {canInspect ? (
            <ActionRow
              title="Record what came back"
              description="Note the condition of each item and whether it can go back on the shelf."
            >
              <Button
                size="sm"
                color="module"
                variant="soft"
                onClick={() => {
                  setInspectOpen(true);
                }}
              >
                Record check…
              </Button>
            </ActionRow>
          ) : null}

          {canRefund ? (
            <ActionRow
              title="Give the money back"
              description="Settle the return by refunding the customer. This moves real money and cannot be undone."
            >
              <Button
                size="sm"
                color="danger"
                variant="outline"
                onClick={() => {
                  setRefundOpen(true);
                }}
              >
                Give money back…
              </Button>
            </ActionRow>
          ) : null}

          {canExchange ? (
            <ActionRow
              title="Send the replacement"
              description="Finish the return by sending the version they asked for. No money moves in either direction."
            >
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  setExchangeOpen(true);
                }}
              >
                Send replacement…
              </Button>
            </ActionRow>
          ) : null}

          {canDeny ? (
            <ActionRow
              title="Turn this return down"
              description="Decline it — the customer keeps the item and no money changes hands. You give a reason they are told."
            >
              <Button
                size="sm"
                color="danger"
                variant="outline"
                onClick={() => {
                  setDenyOpen(true);
                }}
              >
                Turn down…
              </Button>
            </ActionRow>
          ) : null}
        </div>
      ) : null}

      <ApproveReturnModal
        detail={detail}
        open={approveOpen}
        onClose={() => {
          setApproveOpen(false);
        }}
      />
      <DenyReturnModal
        detail={detail}
        open={denyOpen}
        onClose={() => {
          setDenyOpen(false);
        }}
      />
      <InspectReturnModal
        detail={detail}
        open={inspectOpen}
        onClose={() => {
          setInspectOpen(false);
        }}
      />
      <RefundReturnModal
        detail={detail}
        currency={currency}
        suggestedCents={suggestedCents}
        open={refundOpen}
        onClose={() => {
          setRefundOpen(false);
        }}
      />
      <ExchangeReturnModal
        detail={detail}
        open={exchangeOpen}
        onClose={() => {
          setExchangeOpen(false);
        }}
      />
    </>
  );
}
