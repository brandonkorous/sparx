'use client';

// Single order detail: line items, totals, shipping address, status. A
// wholesale buyer can Order again from here (sparx persona issue 086).

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import { OrderTimeline, orderStatusLabel, orderStatusTone } from '@/components/order-timeline';
import {
  getOrder,
  getReturnable,
  reorderOwnOrder,
  AccountError,
  type OrderDetail,
  type OrderReturnability,
} from '@/lib/customer-client';
import { CORE_RETURN_HEADING, coreReturnSentence, orderCoreLine } from '@/lib/core-choice-copy';
import { cardNotChargedSentence } from '@/lib/sign-off-words';
import { formatMoney } from '@/lib/format';
import { orderedWord } from '@/lib/order-status-words';
import { Alert, Badge, Button } from '@wizeworks/silicaui-react';
import { FillCartButton } from '@/components/account/order-again-button';
import { useOrderingAccounts } from '@/components/account/ordering-accounts';

/** What happened to her money, in her words. `partially_paid` is one code over two
 *  opposite situations — she still owes, or some came back — and only the refund
 *  total tells them apart, so it is asked first (issue 292). */
function paymentLine(order: OrderDetail): string {
  if (order.refundedTotalCents > 0) {
    return order.amountPaidCents > 0 ? 'Partly refunded' : 'Refunded in full';
  }
  if (order.paymentStatus === 'paid') return 'Paid in full';
  if (order.paymentStatus === 'partially_paid') return 'Partly paid';
  return 'Not paid yet';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function addressLine(addr: Record<string, unknown> | null): string | null {
  if (!addr) return null;
  const parts = [
    addr.recipientName,
    addr.line1,
    addr.line2,
    [addr.city, addr.region, addr.postalCode].filter(Boolean).join(', '),
    addr.country,
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * A rebuilt part's old part, and what the buyer still has to do about it (sparx
 * persona issues 051, 057). A deposit line comes back when the old part does, so it
 * says how many are still to send. A line bought by sending the old part first had no
 * deposit and is HELD until that part arrives, so it says how many units are waiting
 * and that they ship when it does. The words live in `lib/core-choice-copy`.
 */
function CoreLine({ item, order }: { item: OrderDetail['items'][number]; order: OrderDetail }) {
  const said = orderCoreLine(item, order.orderNumber, order.currency);
  if (said === null) return null;
  return <span className="text-base-content block text-sm">{said}</span>;
}

/**
 * Where old parts go, once for the whole order, whenever any line still owes one.
 *
 * The address is the business's own, from its Business details. When it has none the
 * page says to ask rather than printing half an address, because a parcel sent to
 * "Springfield" goes nowhere.
 */
function CoreReturn({ order }: { order: OrderDetail }) {
  if (!order.items.some((it) => it.coresOwed > 0)) return null;
  const to = order.coreReturnTo;
  return (
    <Alert color="info" className="mb-6">
      <div className="flex flex-col gap-2">
        <strong>{CORE_RETURN_HEADING}</strong>
        {to ? (
          <address className="not-italic">
            {[to.name, ...to.lines]
              .filter((line) => line.trim() !== '')
              .map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
          </address>
        ) : null}
        <span>{coreReturnSentence(order.orderNumber, to !== null)}</span>
      </div>
    </Alert>
  );
}

/** The money breakdown — subtotal, optional discount/tax, shipping, total. */
function OrderTotals({ order }: { order: OrderDetail }) {
  return (
    <div className="rounded-box border-base-300 bg-base-100 ml-auto flex max-w-sm flex-col gap-3 border p-6">
      <div className="text-base-content flex justify-between text-sm">
        <span>Subtotal</span>
        <span>{formatMoney(order.subtotalCents, order.currency)}</span>
      </div>
      {order.discountTotalCents > 0 ? (
        <div className="text-base-content flex justify-between text-sm">
          <span>Discount</span>
          <span>−{formatMoney(order.discountTotalCents, order.currency)}</span>
        </div>
      ) : null}
      <div className="text-base-content flex justify-between text-sm">
        <span>Shipping</span>
        <span>{formatMoney(order.shippingTotalCents, order.currency)}</span>
      </div>
      {order.taxTotalCents > 0 ? (
        <div className="text-base-content flex justify-between text-sm">
          <span>Tax</span>
          <span>{formatMoney(order.taxTotalCents, order.currency)}</span>
        </div>
      ) : null}
      {order.coreChargeTotalCents > 0 ? (
        <div className="text-base-content flex justify-between text-sm">
          <span>Refundable core deposits</span>
          <span>{formatMoney(order.coreChargeTotalCents, order.currency)}</span>
        </div>
      ) : null}
      <div className="border-base-300 text-base-content flex justify-between border-t pt-3 text-lg font-semibold">
        <span>Total</span>
        <span>{formatMoney(order.totalCents, order.currency)}</span>
      </div>
      {/* A refund is the biggest thing that happens to an order after it is placed,
          so her own copy says so and ends on what she is actually out of pocket. */}
      {order.refundedTotalCents > 0 ? (
        <>
          <div className="text-success flex justify-between text-sm font-semibold">
            <span>Refunded to you</span>
            <span>−{formatMoney(order.refundedTotalCents, order.currency)}</span>
          </div>
          <div className="border-base-300 text-base-content flex justify-between border-t pt-3 text-lg font-semibold">
            <span>You paid</span>
            <span>{formatMoney(order.amountPaidCents, order.currency)}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function OrderDetailPage() {
  const { tenantSlug, customer } = useCustomer();
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Loaded alongside the order so the page can OFFER a return rather than making
  // her find out elsewhere that she is allowed one. A failure here is silent: it
  // costs a button, and must never take the order page down with it.
  const [returnable, setReturnable] = useState<OrderReturnability | null>(null);
  // Order again is for a contact who can order on a wholesale account.
  const { accounts } = useOrderingAccounts();

  useEffect(() => {
    let active = true;
    getOrder(tenantSlug, params.orderId)
      .then((o) => active && setOrder(o))
      .catch((err) =>
        active
          ? setError(err instanceof AccountError && err.status === 404 ? 'notfound' : 'error')
          : null
      );
    getReturnable(tenantSlug, params.orderId)
      .then((r) => active && setReturnable(r))
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [tenantSlug, params.orderId]);

  if (error === 'notfound') {
    return (
      <div>
        <p className="text-base-content mb-4">We couldn’t find that order.</p>
        <Button render={<Link href="/account/orders" />}>← Back to orders</Button>
      </div>
    );
  }
  if (error) {
    return (
      <Alert color="danger" role="alert">
        Could not load this order.
      </Alert>
    );
  }
  if (!order) return <div className="skeleton h-80" />;

  const ship = addressLine(order.shippingAddress);

  return (
    <div>
      <Link href="/account/orders" className="link link-hover text-sm">
        ← Orders
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-base-content text-3xl font-semibold tracking-tight">
          Order #{order.orderNumber}
        </h1>
        <Badge color={orderStatusTone(order.status)} variant="soft">
          {orderStatusLabel(order.status)}
        </Badge>
      </div>
      <p className="text-base-content mb-6">
        {/* A held wholesale order is not placed until it is signed off, and one
            turned down never was; the timeline below says who it is waiting on
            (sparx persona issue 087). */}
        {orderedWord(order.status)} {formatDate(order.placedAt)} · {paymentLine(order)}
      </p>

      {/* Approved, but the card held for it could not be charged, so it is
          unpaid: "Not paid yet" alone would not say why, or what happens next
          (sparx persona issue 087). */}
      {order.cardNotCharged ? (
        <Alert color="warning" role="status" className="mb-6">
          {cardNotChargedSentence()}
        </Alert>
      ) : null}

      {/* Order status timeline — the lifecycle at a glance. */}
      <div className="card border-base-300 mb-6 border p-6">
        <h2 className="text-base-content mb-5 text-2xl font-semibold">Order status</h2>
        <OrderTimeline order={order} viewerId={customer?.id ?? null} />
      </div>

      <div className="mb-6 flex flex-col gap-3">
        {order.items.map((it) => (
          <div key={it.id} className="flex justify-between gap-4">
            <span className="text-base-content">
              {it.name}
              <span> × {it.quantity}</span>
              {/* Which items the code came off. The Discount row below already
                  takes the saving off the total, so the line shows what it was
                  worth and names its share rather than quietly subtracting it
                  a second time. */}
              {it.discountAmountCents > 0 ? (
                <span className="text-success block text-sm">
                  {formatMoney(it.discountAmountCents, order.currency)} off
                </span>
              ) : null}
              <CoreLine item={it} order={order} />
            </span>
            <strong className="text-base-content">
              {formatMoney(it.lineSubtotalCents, order.currency)}
            </strong>
          </div>
        ))}
      </div>

      <CoreReturn order={order} />

      <OrderTotals order={order} />

      {/* Today's prices for their account, never the ones above. */}
      {accounts.length > 0 ? (
        <div className="mt-6">
          <FillCartButton
            label="Order again"
            busyLabel="Adding to your cart…"
            run={(cartId) => reorderOwnOrder(tenantSlug, order.id, cartId)}
          />
        </div>
      ) : null}

      {/* Offered where she is already looking at what she bought. Only when there
          is something left to send back — the page it leads to explains the other
          cases rather than being a button that goes nowhere. */}
      {returnable?.eligible ? (
        <div className="mt-6">
          <Button
            render={<Link href={`/account/orders/${order.id}/return`} />}
            color="primary"
            variant="soft"
          >
            Return or exchange something
          </Button>
        </div>
      ) : null}

      {/* How it reaches them. An order with no address is not an order with a
          missing address: since issue 064 a collected order records none,
          because nobody was ever asked for one. */}
      {ship || order.shippingDescription ? (
        <div className="mt-6">
          <h2 className="text-base-content mb-2 text-2xl font-semibold">
            {order.collecting ? 'How you’ll get it' : 'Shipping to'}
          </h2>
          {order.shippingDescription ? (
            <p className="text-base-content">{order.shippingDescription}</p>
          ) : null}
          {ship ? <p className="text-base-content">{ship}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
