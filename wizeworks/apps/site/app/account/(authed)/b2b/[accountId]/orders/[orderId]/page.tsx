'use client';

// Wholesale account: one order on a trade account, whoever on the account
// placed it, and Order again (sparx persona issue 086).
//
// The portal promised "order history ... one-click reorder". The orders list
// led nowhere: a colleague's order had no page, so a buyer could not see what
// was on it, let alone buy it again. Order again puts these items into the cart
// at TODAY's prices for the account, never the prices printed here, and says
// what went in and what did not.
//
// A held order says who it is waiting on, at the account or the business, and
// who has already said yes; the account's approver approves it or turns it
// down here (sparx persona issue 087). Teodora could open Renée's held order
// and read it, and had no button anywhere.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { Alert, Badge, Table } from '@wizeworks/silicaui-react';

import { FillCartButton } from '@/components/account/order-again-button';
import { SignOffPanel, type DecisionOutcome } from '@/components/account/sign-off-panel';
import { useCustomer } from '@/components/customer-provider';
import { orderStatusLabel, orderStatusTone } from '@/components/order-timeline';
import {
  AccountError,
  getB2bOrder,
  getB2bSummary,
  ORDERING_ROLES,
  reorderB2bOrder,
  type B2bOrderDetail,
} from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { orderedWord } from '@/lib/order-status-words';
import { cardNotChargedSentence } from '@/lib/sign-off-words';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** The money rows that add up to the total, leaving out the ones that are zero. */
function totalRows(order: B2bOrderDetail): { label: string; cents: number; total?: boolean }[] {
  const t = order.totals;
  const rows: { label: string; cents: number; total?: boolean }[] = [
    { label: 'Subtotal', cents: t.subtotalCents },
  ];
  if (t.discountCents > 0) rows.push({ label: 'Discount', cents: -t.discountCents });
  if (t.shippingCents > 0) rows.push({ label: 'Shipping', cents: t.shippingCents });
  if (t.taxCents > 0) rows.push({ label: 'Tax', cents: t.taxCents });
  if (t.surchargeCents > 0) rows.push({ label: 'Card fee', cents: t.surchargeCents });
  if (t.coreDepositCents > 0) {
    rows.push({ label: 'Refundable core deposits', cents: t.coreDepositCents });
  }
  rows.push({ label: 'Total', cents: t.totalCents, total: true });
  return rows;
}

export default function B2bOrderDetailPage() {
  const { tenantSlug } = useCustomer();
  const params = useParams<{ accountId: string; orderId: string }>();
  const { accountId, orderId } = params;
  const [order, setOrder] = useState<B2bOrderDetail | null>(null);
  const [error, setError] = useState<'notfound' | 'error' | null>(null);
  const [canOrder, setCanOrder] = useState(false);
  // What the approver's decision did, kept once the order reloads: the sign-off
  // panel goes when the order stops being held, and the page says why.
  const [decided, setDecided] = useState<DecisionOutcome | null>(null);
  // Bumped after a decision, to read the order again in its new state.
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let active = true;
    getB2bOrder(tenantSlug, accountId, orderId)
      .then((o) => active && setOrder(o))
      .catch((err) =>
        active
          ? setError(err instanceof AccountError && err.status === 404 ? 'notfound' : 'error')
          : null
      );
    return () => {
      active = false;
    };
  }, [tenantSlug, accountId, orderId, reloads]);

  useEffect(() => {
    let active = true;
    getB2bSummary(tenantSlug, accountId)
      .then((s) => active && setCanOrder(ORDERING_ROLES.has(s.account.role)))
      .catch(() => active && setCanOrder(false));
    return () => {
      active = false;
    };
  }, [tenantSlug, accountId]);

  const back = (
    <Link href={`/account/b2b/${accountId}/orders`} className="link link-primary">
      ← Back to orders
    </Link>
  );

  if (error === 'notfound') {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p className="text-base-content">That order is not on this account.</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Alert color="danger" role="alert">
          This order could not be loaded just now.
        </Alert>
      </div>
    );
  }
  if (!order) return <div className="skeleton h-80" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {back}
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-base-content text-3xl font-semibold tracking-tight">
            Order {order.orderNumber}
          </h1>
          <Badge color={orderStatusTone(order.status)} variant="soft">
            {orderStatusLabel(order.status)}
          </Badge>
        </div>
        <p className="text-base-content m-0">
          {/* A held order is not placed until it is signed off, and one
              turned down never was. */}
          {orderedWord(order.status)} {formatDate(order.placedAt)}
          {order.placedBy ? ` by ${order.placedBy}` : ''}
          {order.poNumber ? ` · Your PO number ${order.poNumber}` : ''}
        </p>
      </div>

      {decided ? (
        <Alert color={decided.approved ? 'success' : 'info'} role="status">
          {decided.sentence}
        </Alert>
      ) : null}

      {/* The yes placed it, but some of it was not in stock, so part of it
          follows later (sparx persona issue 087). Said here, where the
          approver is looking, rather than left for them to find out when less
          arrives than was ordered. */}
      {decided?.followsLater ? (
        <Alert color="warning" role="status">
          {decided.followsLater}
        </Alert>
      ) : null}

      {/* Approved, but the card held for it could not be charged, so it is
          unpaid (sparx persona issue 087). Named for whoever placed it, who is
          not always the person reading. */}
      {order.cardNotCharged ? (
        <Alert color="warning" role="status">
          {cardNotChargedSentence(order.placedBy)}
        </Alert>
      ) : null}

      {/* Placed and canceled orders have no sign-off: the API sends none. */}
      {order.signOff ? (
        <SignOffPanel
          tenantSlug={tenantSlug}
          accountId={accountId}
          order={{ ...order, signOff: order.signOff }}
          onDecided={(outcome) => {
            setDecided(outcome);
            setReloads((n) => n + 1);
          }}
        />
      ) : null}

      {canOrder && (
        <div className="card border-base-300 gap-3 border p-4">
          <p className="text-base-content m-0">
            Need these again? Order again puts every item into your cart at today’s prices for your
            account, and tells you about anything that could not be added.
          </p>
          <FillCartButton
            label="Order again"
            busyLabel="Adding to your cart…"
            run={(cartId) => reorderB2bOrder(tenantSlug, accountId, order.id, cartId)}
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">Quantity</th>
              <th className="text-right">Each</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.name}
                  {item.sku ? <span className="block text-sm">{item.sku}</span> : null}
                </td>
                <td className="text-right tabular-nums">{item.quantity}</td>
                <td className="text-right tabular-nums">
                  {formatMoney(item.unitPriceCents, order.currency)}
                </td>
                <td className="text-right tabular-nums">
                  {formatMoney(item.lineSubtotalCents, order.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <dl className="border-base-300 ml-auto flex w-full max-w-sm flex-col gap-2 border-t pt-3">
        {totalRows(order).map((row) => (
          <div
            key={row.label}
            className={
              row.total
                ? 'flex justify-between gap-4 text-lg font-semibold'
                : 'flex justify-between gap-4'
            }
          >
            <dt>{row.label}</dt>
            <dd className="whitespace-nowrap">{formatMoney(row.cents, order.currency)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
