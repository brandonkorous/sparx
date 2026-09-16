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

import { useEffect, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Heading,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { PackageCheck } from 'lucide-react';
import { FormSection } from '../../components/form-section';
import { ModuleScope } from '../../components/module-scope';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ReturnDispositionPanel } from './return-disposition-panel';
import { deferTick } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatDate, formatDateTime, formatMoney, useOrder } from './data';
import { ReturnParcels } from './return-parcels';
import { needsShipmentRecord } from './return-shipment';
import {
  conditionLabel,
  outcomeLabel,
  reasonLabel,
  returnErrorMessage,
  returnState,
  useReceiveReturn,
  useReturn,
  type ReturnDetail,
  REFUND_ISSUED_AS_LABELS,
} from './returns-data';
import {
  ApproveReturnModal,
  DenyReturnModal,
  ExchangeReturnModal,
  InspectReturnModal,
  RecordReplacementShipmentModal,
  RefundReturnModal,
} from './return-actions';
import { PaneLoadError } from '../../components/pane-load-error';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

function money(cents: number, currency: string): string {
  return formatMoney(cents / 100, currency);
}

/** A plain action row, sitting after the record under a divider — the same shape
 *  the order pane uses for cancel. Rare, one-way moves never get a card of their
 *  own beside the things people came to read. */
function ActionRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Text className="text-base font-medium">{title}</Text>
        <Text className="text-sm">{description}</Text>
      </div>
      {children}
    </div>
  );
}

function ReturnIdentity({ detail }: { detail: ReturnDetail }) {
  const facts = [
    `Asked ${formatDate(detail.requestedAt)}`,
    `Wants ${outcomeLabel(detail.preferredOutcome).toLowerCase()}`,
    `${String(detail.itemCount)} ${detail.itemCount === 1 ? 'item' : 'items'}`,
  ];
  return (
    <div className="flex flex-col gap-1">
      <Heading level={1} className="text-2xl font-semibold">
        Return for order {detail.orderNumber ?? '—'}
      </Heading>
      <Text className="text-lg">{detail.customerName ?? 'Unknown customer'}</Text>
      <Text className="text-sm">{facts.join(' · ')}</Text>
    </div>
  );
}

export function ReturnDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : '';
  const { data: detail, isPending, isError, error, refetch } = useReturn(id);

  const orderNumber = detail?.orderNumber ?? null;
  useEffect(() => {
    if (orderNumber) ctx.setTitle(`Return · ${orderNumber}`);
  }, [ctx, orderNumber]);

  if (isError) {
    return (
      <PaneLoadError
        error={error}
        noun="return"
        title="Could not load this return"
        description="This is a problem reaching the server. The return itself is unaffected. Nothing has been changed or lost."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (isPending || !detail) {
    return (
      <p className="p-4 text-sm" role="status">
        Loading…
      </p>
    );
  }

  // Split so the body always has a loaded return: the order lookup below keys on
  // a real orderId, never the empty string the pane holds while the return loads
  // (useOrder has no enabled guard of its own).
  return <ReturnDetailBody detail={detail} />;
}

function ReturnDetailBody({ detail }: { detail: ReturnDetail }) {
  const toast = useToast();
  const confirm = useConfirm();

  // The order backs two things the return row cannot: the line prices shown
  // against each item, and a sensible starting figure for the refund. A return
  // stores only quantities and an orderItemId, so without the order there is no
  // money on this screen — the refund modal then simply asks for the amount.
  const { data: order } = useOrder(detail.orderId);
  const receive = useReceiveReturn(detail.id);

  const [approveOpen, setApproveOpen] = useState(false);
  const [denyOpen, setDenyOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [shippedOpen, setShippedOpen] = useState(false);

  // What the customer ASKED for changes what "finish this" means, so the status
  // line takes it too. Without it every ready-to-settle return read "give the
  // customer their money back", including the even swaps (issue 220).
  const state = returnState(detail.status, detail.preferredOutcome);
  const currency = order?.currency ?? 'USD';

  // orderItemId → unit price in dollars, from the order lines. Absent when the
  // order didn't load — every price below then simply isn't shown.
  const priceByOrderItem = new Map((order?.items ?? []).map((it) => [it.id, it.unitPrice]));
  // returnLineItemId → the condition inspection recorded for it, if any.
  const conditionByLine = new Map(
    detail.inspections.map((ins) => [ins.returnLineItemId, ins] as const)
  );

  const suggestedCents = detail.items.reduce((sum, it) => {
    const unit = priceByOrderItem.get(it.orderItemId);
    if (unit === undefined) return sum;
    const qty = it.approvedQuantity > 0 ? it.approvedQuantity : it.quantity;
    return sum + Math.round(unit * qty * 100);
  }, 0);

  const canApprove = detail.status === 'requested' || detail.status === 'denied';
  const canDeny = detail.status === 'requested';
  const canReceive =
    detail.status === 'approved' ||
    detail.status === 'awaiting_shipment' ||
    detail.status === 'in_transit';
  // Settled, and nobody ever wrote down what came back. The goods are real and
  // on a shelf, but the returns bench lists inspections, so without this row
  // they appear on no screen in the product ever again (issue 452).
  const goodsUnaccounted =
    (detail.status === 'refunded' || detail.status === 'exchanged') &&
    detail.inspections.length === 0;
  const canInspect =
    detail.status === 'received' || detail.status === 'inspecting' || goodsUnaccounted;
  // Ready to settle — but HOW depends on what the customer asked for. An even
  // swap moves no money, so offering only a refund there offers the one move
  // that is wrong (issue 220).
  const settling = detail.status === 'inspected' || detail.status === 'received';
  const swapping = detail.preferredOutcome === 'exchange';
  const canRefund = settling && !swapping;
  const canExchange = settling && swapping;
  // The swap is settled and nobody has said how the replacement is travelling.
  // The ordinary state rather than an unusual one: she settles it while the
  // customer waits and walks to the post office afterwards, so without a route
  // back in the tracking number has nowhere to go.
  const canSayShipped = needsShipmentRecord(detail);
  const hasAction =
    canApprove || canDeny || canReceive || canInspect || canRefund || canExchange || canSayShipped;

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
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Return actions"
        status={<Text className="text-sm">Order {detail.orderNumber ?? '—'}</Text>}
        controls={
          <>
            <Badge color={state.tone} variant="soft" size="sm">
              {state.label}
            </Badge>
            <div className="flex-1" />
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className={COLUMN}>
          <ReturnIdentity detail={detail} />

          {/* One message, the most specific true one — what stage this is at and
              what it means, in plain words. */}
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

          <FormSection title="What is coming back">
            <ul className="flex flex-col">
              {detail.items.map((it) => {
                const unit = priceByOrderItem.get(it.orderItemId);
                const inspection = conditionByLine.get(it.id);
                const qty = it.approvedQuantity > 0 ? it.approvedQuantity : it.quantity;
                return (
                  <li
                    key={it.id}
                    className="border-base-300 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-base font-medium">{it.orderItemName ?? 'Item'}</span>
                      <span className="text-sm">
                        {reasonLabel(it.reasonCode)} · {it.quantity} asked back
                        {it.approvedQuantity > 0 && it.approvedQuantity !== it.quantity
                          ? ` · ${it.approvedQuantity} accepted`
                          : ''}
                      </span>
                      {inspection ? (
                        <span className="text-sm">
                          Came back {conditionLabel(inspection.condition).toLowerCase()}
                          {inspection.restockable ? ' · fit to resell' : ' · not for resale'}
                        </span>
                      ) : null}
                      {it.customerNote ? (
                        <span className="text-sm">“{it.customerNote}”</span>
                      ) : null}
                    </div>
                    {unit !== undefined ? (
                      <span className="text-base font-medium tabular-nums">
                        {formatMoney(unit * qty, currency)}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </FormSection>

          {/* CRM's data on a commerce screen wears CRM's hue. */}
          {detail.customerName ? (
            <ModuleScope module="crm">
              <FormSection title="Who is returning it">
                <Text className="text-base font-medium">{detail.customerName}</Text>
              </FormSection>
            </ModuleScope>
          ) : null}

          {/* What physically happens to the goods (docs/146 Phase 9.7). Appears
              once anything has been inspected, because before that there is
              nothing to decide about — and deciding where goods go before
              somebody has looked at them is how a damaged item ends up back on
              the shelf. */}
          {detail.inspections.length > 0 ? <ReturnDispositionPanel returnId={detail.id} /> : null}

          {/* A swap settles with no money at all, and saying so out loud is the
              point — "nothing was given back" is the ANSWER on an even
              exchange, not a missing figure (issue 220). */}
          {detail.status === 'exchanged' ? (
            <FormSection title="How it was settled">
              <div className="flex items-baseline justify-between gap-4 text-lg font-semibold">
                <span>Money moved</span>
                <span className="tabular-nums">{money(0, currency)}</span>
              </div>
              <Text className="text-base">
                They were sent a replacement instead of being given anything back
                {detail.refundedAt ? ` · ${formatDateTime(detail.refundedAt)}` : ''}
              </Text>
            </FormSection>
          ) : null}

          {/* The settlement only exists once the money has gone back, so the card
              only appears then — no empty "Refund: none" on every open return. */}
          {detail.status === 'refunded' && detail.refundedAmountCents !== null ? (
            <FormSection title="How it was settled">
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-4 text-lg font-semibold">
                  <span>Given back</span>
                  <span className="tabular-nums">
                    {money(detail.refundedAmountCents, currency)}
                  </span>
                </div>
                {detail.restockingFeeCents && detail.restockingFeeCents > 0 ? (
                  <div className="flex items-baseline justify-between gap-4">
                    <span>Restocking fee kept</span>
                    <span className="tabular-nums">
                      {money(detail.restockingFeeCents, currency)}
                    </span>
                  </div>
                ) : null}
                {detail.refundIssuedAs ? (
                  <Text className="text-sm">
                    {REFUND_ISSUED_AS_LABELS[detail.refundIssuedAs] ?? detail.refundIssuedAs}
                    {detail.refundedAt ? ` · ${formatDateTime(detail.refundedAt)}` : ''}
                  </Text>
                ) : null}
              </div>
            </FormSection>
          ) : null}

          {/* The staff note is already surfaced in the status alert when a return
              was denied; show the card only when it says something else. */}
          {detail.staffNote && detail.status !== 'denied' ? (
            <FormSection title="Your team’s note">
              <Text className="text-base whitespace-pre-wrap">{detail.staffNote}</Text>
            </FormSection>
          ) : null}

          <ReturnParcels labels={detail.labels} />

          {hasAction ? (
            <div className="flex flex-col">
              {canSayShipped ? (
                <ActionRow
                  title="Say how it went out"
                  description="They are waiting to hear how to follow their replacement. Putting the tracking number in emails it to them."
                >
                  <Button
                    size="sm"
                    color="module"
                    onClick={() => {
                      setShippedOpen(true);
                    }}
                  >
                    Add tracking…
                  </Button>
                </ActionRow>
              ) : null}

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
                    <PackageCheck className="size-4" aria-hidden />
                    Received
                  </Button>
                </ActionRow>
              ) : null}

              {canInspect ? (
                <ActionRow
                  title={goodsUnaccounted ? 'Say what came back' : 'Record what came back'}
                  description={
                    goodsUnaccounted
                      ? 'This return is finished, but nothing was written down about the goods themselves. Note their condition so they show up on your returns bench.'
                      : 'Note the condition of each item and whether it can go back on the shelf.'
                  }
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
                  description="Decline it: the customer keeps the item and no money changes hands. You give a reason they are told."
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
        </div>
      </div>

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
      <RecordReplacementShipmentModal
        detail={detail}
        open={shippedOpen}
        onClose={() => {
          setShippedOpen(false);
        }}
      />
    </div>
  );
}
