'use client';

// One order — what was bought, what was paid, where it went.
//
// This is a TRANSACTION detail: a record of something that already happened, so
// it keeps a real identity heading (the order number and who placed it) rather
// than opening with an editable name field. Nothing here is a draft, so there is
// nothing to save and no dirty state to guard.
//
// Deliberately NOT built on EditorLayout. That chassis is a form with a
// completion order and a running summary rail beside it; this pane is a
// narrative — items, then money, then who, then where, then what happened to it.
// A rail would repeat the totals that are already the loudest thing on screen.
// So: one centred column, capped, because a pane torn onto a second monitor is
// otherwise 2000px of grey with the line items pinned to the left edge.
//
// The audience owns a business, not a warehouse system. "Fulfilled" means "on
// the way" here, "captured" means "taken", and a payment processor's vocabulary
// never reaches the screen untranslated.

import { useEffect } from 'react';
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
import { ExternalLink, Ban, Undo2 } from 'lucide-react';
import { FormSection } from '../../components/form-section';
import { ModuleScope } from '../../components/module-scope';
import { deferTick } from '../../lib/defer';
import { useSites } from '../../lib/api/shell-data';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import {
  addressLines,
  amountDue,
  channelLabel,
  customerName,
  formatDate,
  formatDateTime,
  formatMoney,
  fulfillmentTone,
  orderErrorMessage,
  paymentRecordTone,
  paymentState,
  refundTone,
  shippingState,
  useCancelOrder,
  useOrder,
  useOrderFulfillments,
  useOrderPayments,
  useOrderRefunds,
  useRefundOrder,
  FULFILLMENT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  REFUND_STATUS_LABELS,
  type Order,
  type OrderAddress,
} from './data';

/** The one column everything sits in. */
const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/** A money line in the totals block. `emphasis` is the order's own total and the
 *  amount still owed — the two numbers anyone opens this pane for. */
function MoneyRow({
  label,
  amount,
  currency,
  emphasis = false,
}: {
  label: string;
  amount: number;
  currency: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={[
        'flex items-baseline justify-between gap-4',
        emphasis ? 'text-lg font-semibold' : 'text-base',
      ].join(' ')}
    >
      <span>{label}</span>
      <span className="tabular-nums">{formatMoney(amount, currency)}</span>
    </div>
  );
}

function AddressBlock({ title, address }: { title: string; address: OrderAddress | null }) {
  const lines = addressLines(address);
  return (
    <div className="flex flex-col gap-1">
      <Heading level={3} className="text-base font-semibold">
        {title}
      </Heading>
      {lines.length === 0 ? (
        <Text className="text-sm">Not given</Text>
      ) : (
        <address className="text-base not-italic">
          {lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
      )}
    </div>
  );
}

/** A section whose data comes from its own request, so it reports its own
 *  loading and its own failure. One bad subresource must not blank out the rest
 *  of the order. */
function SubSection({
  title,
  description,
  isPending,
  isError,
  errorText,
  emptyText,
  count,
  children,
}: {
  title: string;
  description?: string;
  isPending: boolean;
  isError: boolean;
  errorText: string;
  emptyText: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <FormSection title={title} description={description}>
      {isPending ? (
        <Text className="text-sm" role="status">
          Loading…
        </Text>
      ) : isError ? (
        <Text className="text-sm">{errorText}</Text>
      ) : count === 0 ? (
        <Text>{emptyText}</Text>
      ) : (
        children
      )}
    </FormSection>
  );
}

function OrderIdentity({ order, siteName }: { order: Order; siteName: string | null }) {
  const facts = [
    `Placed ${formatDate(order.placedAt)}`,
    channelLabel(order),
    ...(siteName ? [siteName] : []),
  ];
  return (
    <div className="flex flex-col gap-1">
      {/* The order number IS this pane's identity, and it is read-only — so it
          gets a real heading, with the buyer beneath it. Anyone arriving from a
          list needs to know they opened the right sale before anything else. */}
      <Heading level={1} className="text-2xl font-semibold">
        Order {order.orderNumber}
      </Heading>
      <Text className="text-lg">{customerName(order.customer)}</Text>
      <Text className="text-sm">{facts.join(' · ')}</Text>
    </div>
  );
}

export function OrderDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : '';
  const toast = useToast();
  const confirm = useConfirm();

  const { data: order, isPending, isError, refetch } = useOrder(id);
  const { data: sites } = useSites();
  const payments = useOrderPayments(id);
  const fulfillments = useOrderFulfillments(id);
  const refunds = useOrderRefunds(id);
  const cancel = useCancelOrder(id);
  const refund = useRefundOrder(id);

  // Keyed on the NUMBER, not the order object. Depending on the object retitles
  // the tab on every refetch — including the one that follows a cancellation,
  // which pushes a dockview title update out of a commit for no gain, since the
  // title it sets is the one already there.
  const orderNumber = order?.orderNumber ?? null;
  useEffect(() => {
    if (orderNumber) ctx.setTitle(`Order ${orderNumber}`);
  }, [ctx, orderNumber]);

  // A failed load REPLACES the pane. Rendering an empty order beside a live
  // Cancel button offers a move against something that isn't there.
  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Alert color="error" variant="soft" className="max-w-md">
          <AlertContent>
            <AlertTitle>Could not load this order</AlertTitle>
            <AlertDescription>
              This is a problem reaching the server. The order itself is unaffected — nothing has
              been changed or lost.
            </AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            color="error"
            variant="soft"
            onClick={() => {
              void refetch();
            }}
          >
            Try again
          </Button>
        </Alert>
      </div>
    );
  }

  if (isPending || !order) {
    return (
      <p className="p-4 text-sm" role="status">
        Loading…
      </p>
    );
  }

  const paid = paymentState(order);
  const shipped = shippingState(order);
  const due = amountDue(order);
  const items = order.items ?? [];
  const currency = order.currency;
  const site = sites?.find((candidate) => candidate.id === order.propertyId);

  // Cancelling is refused by the server on an order that has already arrived or
  // been refunded, so the control simply isn't offered there — a button that
  // exists to hand back an error is worse than no button.
  const cancellable =
    order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'refunded';

  // What is still refundable: money actually taken, less anything already given
  // back. Rounded to cents so floating-point noise can't offer a $0.0000001 refund.
  const refundableAmount = Math.max(
    0,
    Math.round((Number(order.amountPaid) - Number(order.refundTotal ?? 0)) * 100) / 100
  );

  const onRefund = async () => {
    const ok = await confirm({
      title: `Refund ${formatMoney(refundableAmount, currency)} to ${customerName(order.customer)}?`,
      description:
        `This sends ${formatMoney(refundableAmount, currency)} back to the card used for order ` +
        `${order.orderNumber}. The money leaves your account straight away and this cannot be ` +
        `undone. Stock is NOT taken back in — if you expect the items returned, process a return ` +
        `instead so the goods come back on the shelf.`,
      confirmLabel: `Refund ${formatMoney(refundableAmount, currency)}`,
      cancelLabel: 'Leave it as it is',
      color: 'danger',
    });
    if (!ok) return;
    // Same reason as onCancel: let the confirm's flushSync close commit finish
    // before this pane re-renders underneath it.
    await deferTick();
    refund.mutate(
      { amount: refundableAmount },
      {
        onSuccess: () => {
          toast.add({
            title: `Refunded ${formatMoney(refundableAmount, currency)}`,
            description: `Order ${order.orderNumber} — the customer's card has been credited.`,
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

  const onCancel = async () => {
    const ok = await confirm({
      title: `Cancel order ${order.orderNumber}?`,
      description:
        `This marks the order as cancelled for ${customerName(order.customer)} — ` +
        `${String(items.length)} ${items.length === 1 ? 'item' : 'items'} worth ` +
        `${formatMoney(order.total, currency)} will no longer be sent. ` +
        (order.amountPaid > 0
          ? `${formatMoney(order.amountPaid, currency)} has already been paid and is NOT refunded by this — you refund that separately.`
          : 'No money has come in, so there is nothing to refund.') +
        ' A cancelled order cannot be reopened.',
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
        toast.add({ title: `Order ${order.orderNumber} cancelled`, type: 'success' });
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

  return (
    <div className={PANE_SHELL}>
      {/* Lifecycle in the pane header: the two states this order is actually in,
          side by side, always visible while the body scrolls. */}
      <PaneToolbar label="Order actions" wrap>
        <Badge color={paid.tone} variant="soft" size="sm">
          {paid.label}
        </Badge>
        {/* A refunded order carries the same word on both axes, and two
            identical badges side by side read as a rendering fault rather than
            as two facts. */}
        {shipped.label === paid.label ? null : (
          <Badge color={shipped.tone} variant="soft" size="sm">
            {shipped.label}
          </Badge>
        )}
        <div className="flex-1" />
        <Text className="text-sm tabular-nums">{formatMoney(order.total, currency)}</Text>
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className={COLUMN}>
          <OrderIdentity order={order} siteName={site?.name ?? null} />

          {/* ONE message, the most specific true one. A cancelled order says why
              it was cancelled; otherwise money owed is the thing worth saying,
              and an order that is paid and delivered says nothing at all — the
              badges above already carry it. */}
          {order.status === 'cancelled' || order.status === 'refunded' ? (
            <Alert color={shipped.tone} variant="soft">
              <AlertContent>
                <AlertTitle>{shipped.label}</AlertTitle>
                <AlertDescription>
                  {shipped.detail}
                  {order.cancelledAt ? ` (${formatDateTime(order.cancelledAt)})` : ''}
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : due > 0 ? (
            <Alert color="warning" variant="soft">
              <AlertContent>
                <AlertTitle>{formatMoney(due, currency)} still owed</AlertTitle>
                <AlertDescription>
                  {order.amountPaid > 0
                    ? `${formatMoney(order.amountPaid, currency)} of ${formatMoney(order.total, currency)} has come in so far.`
                    : 'No money has come in for this order yet.'}
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {/* What they bought, then what it came to. One card, because the
              totals are the sum of the rows directly above them — splitting them
              apart makes the reader carry a number across a gap. */}
          <FormSection title="What they bought">
            {items.length === 0 ? (
              <Text>This order has no items on it, which usually means it was imported.</Text>
            ) : (
              <ul className="flex flex-col">
                {items.map((item) => {
                  const partlySent =
                    item.quantityFulfilled > 0 && item.quantityFulfilled < item.quantity;
                  return (
                    <li
                      key={item.id}
                      className="border-base-300 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-base font-medium">{item.name}</span>
                        <span className="font-mono text-sm break-all">{item.sku}</span>
                        <span className="text-sm">
                          {item.quantity} × {formatMoney(item.unitPrice, currency)}
                          {item.discountAmount > 0
                            ? ` · ${formatMoney(item.discountAmount, currency)} off`
                            : ''}
                        </span>
                        {partlySent ? (
                          <span className="text-sm">
                            {item.quantityFulfilled} of {item.quantity} sent so far
                          </span>
                        ) : null}
                        {item.quantityRefunded > 0 ? (
                          <span className="text-sm">{item.quantityRefunded} refunded</span>
                        ) : null}
                      </div>
                      {/* Quantity × price, NOT the stored `lineTotal` — that one
                          folds the line's own tax in, while the totals block
                          below charges tax and discount as their own lines. Show
                          lineTotal and the column visibly fails to add up to
                          "Items", which reads as broken arithmetic. This one
                          sums to it exactly. */}
                      <span className="text-base font-medium tabular-nums">
                        {formatMoney(item.lineSubtotal, currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="border-base-300 flex flex-col gap-1 border-t pt-3">
              <MoneyRow label="Items" amount={order.subtotal} currency={currency} />
              {order.discountTotal > 0 ? (
                <MoneyRow label="Discount" amount={-order.discountTotal} currency={currency} />
              ) : null}
              {order.shippingTotal > 0 ? (
                <MoneyRow label="Delivery" amount={order.shippingTotal} currency={currency} />
              ) : null}
              {order.surchargeTotal > 0 ? (
                <MoneyRow
                  label="Card fee passed on"
                  amount={order.surchargeTotal}
                  currency={currency}
                />
              ) : null}
              {order.taxTotal > 0 ? (
                <MoneyRow label="Tax" amount={order.taxTotal} currency={currency} />
              ) : null}
              <MoneyRow label="Order total" amount={order.total} currency={currency} emphasis />
              {order.amountPaid > 0 ? (
                <MoneyRow label="Paid so far" amount={order.amountPaid} currency={currency} />
              ) : null}
              {order.refundTotal > 0 ? (
                <MoneyRow label="Given back" amount={order.refundTotal} currency={currency} />
              ) : null}
              {due > 0 ? (
                <MoneyRow label="Still owed" amount={due} currency={currency} emphasis />
              ) : null}
            </div>
          </FormSection>

          {/* The buyer is CRM's functionality showing up on a commerce screen,
              so this block wears CRM's hue — colour follows functionality, not
              the pane. */}
          <ModuleScope module="crm">
            <FormSection title="Who bought it">
              <div className="flex flex-col gap-1">
                <Text className="text-base font-medium">{customerName(order.customer)}</Text>
                {order.customer?.email ? (
                  <a href={`mailto:${order.customer.email}`} className="link text-base break-all">
                    {order.customer.email}
                  </a>
                ) : null}
                {order.customer?.company ? (
                  <Text className="text-base">
                    Trade account: {order.customer.company.companyName}
                    {order.customer.company.paymentTerms
                      ? ` · pays on ${order.customer.company.paymentTerms} terms`
                      : ''}
                  </Text>
                ) : null}
              </div>
            </FormSection>
          </ModuleScope>

          <FormSection
            title="Where it goes"
            description="Copied down when the order was placed, so changing the customer’s address later never rewrites where this one went."
          >
            <div className="grid gap-4 @md:grid-cols-2">
              <AddressBlock title="Delivery address" address={order.shippingAddress} />
              <AddressBlock title="Billing address" address={order.billingAddress} />
            </div>
          </FormSection>

          <SubSection
            title="Money in"
            description="Every attempt to take payment for this order, including the ones that did not work."
            isPending={payments.isPending}
            isError={payments.isError}
            errorText="We could not load the payments just now. The order and its money are unaffected — try reopening this order in a moment."
            emptyText="No payment has been recorded against this order yet."
            count={payments.data?.length ?? 0}
          >
            <ul className="flex flex-col">
              {(payments.data ?? []).map((payment) => (
                <li
                  key={payment.id}
                  className="border-base-300 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-base font-medium">
                      {formatMoney(payment.amount, payment.currency)} · {payment.processor}
                    </span>
                    <span className="text-sm">
                      {formatDateTime(payment.capturedAt ?? payment.createdAt)}
                    </span>
                    {payment.failureReason ? (
                      <span className="text-sm">{payment.failureReason}</span>
                    ) : null}
                  </div>
                  <Badge color={paymentRecordTone(payment.status)} variant="soft" size="sm">
                    {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </SubSection>

          <SubSection
            title="Deliveries"
            description="Each shipment sent for this order, and how to follow it."
            isPending={fulfillments.isPending}
            isError={fulfillments.isError}
            errorText="We could not load the deliveries just now. Anything already shipped is unaffected — try reopening this order in a moment."
            emptyText="Nothing has been sent for this order yet."
            count={fulfillments.data?.length ?? 0}
          >
            <ul className="flex flex-col">
              {(fulfillments.data ?? []).map((shipment) => (
                <li
                  key={shipment.id}
                  className="border-base-300 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-base font-medium">
                      {shipment.carrier ?? 'Delivery'}
                      {shipment.service ? ` · ${shipment.service}` : ''}
                    </span>
                    {shipment.trackingNumber ? (
                      shipment.trackingUrl ? (
                        <a
                          href={shipment.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="link inline-flex items-center gap-1 font-mono text-sm break-all"
                        >
                          {shipment.trackingNumber}
                          <ExternalLink className="size-3 shrink-0" aria-hidden />
                        </a>
                      ) : (
                        <span className="font-mono text-sm break-all">
                          {shipment.trackingNumber}
                        </span>
                      )
                    ) : null}
                    <span className="text-sm">
                      {shipment.shippedAt
                        ? `Sent ${formatDateTime(shipment.shippedAt)}`
                        : `Created ${formatDateTime(shipment.createdAt)}`}
                    </span>
                  </div>
                  <Badge color={fulfillmentTone(shipment.status)} variant="soft" size="sm">
                    {FULFILLMENT_STATUS_LABELS[shipment.status] ?? shipment.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </SubSection>

          {/* Refunds render only when there are any: an empty "Refunds — none"
              card on every healthy order is a card that trains people to skip
              the bottom of this pane. */}
          {(refunds.data?.length ?? 0) > 0 ? (
            <FormSection title="Money given back">
              <ul className="flex flex-col">
                {(refunds.data ?? []).map((refund) => (
                  <li
                    key={refund.id}
                    className="border-base-300 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-base font-medium">
                        {formatMoney(refund.amount, refund.currency)}
                      </span>
                      <span className="text-sm">
                        {formatDateTime(refund.refundedAt ?? refund.createdAt)}
                      </span>
                      {refund.reason ? <span className="text-sm">{refund.reason}</span> : null}
                    </div>
                    <Badge color={refundTone(refund.status)} variant="soft" size="sm">
                      {REFUND_STATUS_LABELS[refund.status] ?? refund.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </FormSection>
          ) : null}

          {order.customerNote || order.internalNote ? (
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
          ) : null}

          {/* Same treatment as cancelling: irreversible, so a plain row under a
              divider rather than a card competing with what people came to read.
              Offered only when there is money left to give back. */}
          {refundableAmount > 0 ? (
            <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Text className="text-base font-medium">Refund this order</Text>
                <Text className="text-sm">
                  Sends {formatMoney(refundableAmount, currency)} back to the card it was paid with.
                  The money leaves your account straight away and this cannot be undone. To give
                  back only part of it, or to take stock back in, use a return instead.
                </Text>
              </div>
              <Button
                size="sm"
                color="danger"
                variant="outline"
                loading={refund.isPending}
                onClick={() => {
                  void onRefund();
                }}
              >
                <Undo2 className="size-4" aria-hidden />
                Refund {formatMoney(refundableAmount, currency)}
              </Button>
            </div>
          ) : null}

          {/* Rare and irreversible, so it does NOT get a card of its own beside
              the things people came here to read — a plain row after the work,
              under a divider. */}
          {cancellable ? (
            <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Text className="text-base font-medium">Cancel this order</Text>
                <Text className="text-sm">
                  Marks it as cancelled so nothing more is sent. Any money already taken stays until
                  you refund it, and the order cannot be reopened afterwards.
                </Text>
              </div>
              <Button
                size="sm"
                color="danger"
                variant="outline"
                loading={cancel.isPending}
                onClick={() => {
                  // The confirm has to open after this click finishes committing;
                  // the pane never changes here, so no afterPaneChange is needed
                  // for the toast that follows it.
                  void onCancel();
                }}
              >
                <Ban className="size-4" aria-hidden />
                Cancel order
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
