// orderRefundsService — issue refunds against an order, optionally
// targeting specific line items + quantities.
//
// `recordRefund` is the only write path. It validates per-line cap against
// (quantity − quantity_refunded) on each line, writes the refund + its
// line-item join rows, then recomputes the parent order's payment rollup
// so amountPaid / paymentStatus / refundTotal stay correct.

import crypto from 'node:crypto';

import { RecordRefundInput } from '@wizeworks/crm-schemas';
import { afterCommit, withTenant } from '@wizeworks/db';
import type { OrderRefund } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { publishPlatformEvent } from '../consumers/platform-bus';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import { recomputeOrderPaymentRollup } from './order-payments-service';
import { closeWhenOrderMovesOn } from './task-service';

export async function listForOrder(ctx: ServiceContext, orderId: string): Promise<OrderRefund[]> {
  return withTenant(ctx, (tx) =>
    tx.orderRefund.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: { refundItems: true },
    })
  );
}

export async function recordRefund(ctx: ServiceContext, rawInput: unknown): Promise<OrderRefund> {
  const input = RecordRefundInput.parse(rawInput);

  // Captured inside the txn and read when publishing order.refunded — the CRM
  // consumer keys its activity + lifetime-spend decrement off this id, so the
  // event MUST carry it. Every order has a customer (Order.customerId is
  // non-null), so this is always set by the time we publish.
  let orderCustomerId = '';
  let orderNumber = '';

  const refund = await withTenant(ctx, async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { items: true },
    });
    if (!order) throw new CrmNotFoundError('Order', input.orderId);
    orderCustomerId = order.customerId;
    orderNumber = order.orderNumber;
    // A canceled order is refundable when money was taken for it. A wholesale
    // order paid by card and then turned down at sign-off is exactly that, and
    // refusing it here meant the buyer's money could only be kept (sparx persona
    // issue 087). A canceled order nobody paid has nothing to refund, and the
    // gateway path refuses that before it gets here.
    const cancelled = order.status === 'cancelled';

    // Surcharge proration (docs/48 §6.3) — the card-fee pass-through reverses in
    // proportion to the refunded share of the order total. Recorded on the refund
    // for accounting (surcharges are pass-through income, netted against fees).
    const surchargeTotalCents = Math.round(Number(order.surchargeTotal) * 100);
    const orderTotalCents = Math.round(Number(order.total) * 100);
    const refundCents = Math.round(Number(input.amount) * 100);
    const surchargeReversedCents =
      surchargeTotalCents > 0 && orderTotalCents > 0 && refundCents > 0
        ? Math.round(surchargeTotalCents * Math.min(1, refundCents / orderTotalCents))
        : 0;

    // If lines are given, validate each refund quantity against the
    // remaining refundable units on its parent line.
    if (input.lines && input.lines.length > 0) {
      const itemsById = new Map(order.items.map((i) => [i.id, i]));
      for (const line of input.lines) {
        const orderItem = itemsById.get(line.orderItemId);
        if (!orderItem) {
          throw new CrmNotFoundError('OrderItem', line.orderItemId);
        }
        const remaining = orderItem.quantity - orderItem.quantityRefunded;
        if (line.quantity > remaining) {
          throw new CrmValidationError(
            `Refund quantity ${line.quantity} exceeds remaining ${remaining} on item ${orderItem.sku}`
          );
        }
      }
    }

    if (input.paymentId) {
      const payment = await tx.orderPayment.findUnique({
        where: { id: input.paymentId },
      });
      if (payment?.orderId !== input.orderId) {
        throw new CrmValidationError('Payment does not belong to this order');
      }
    }

    const created = await tx.orderRefund.create({
      data: {
        tenantId: ctx.tenantId,
        orderId: input.orderId,
        paymentId: input.paymentId ?? null,
        amount: input.amount,
        currency: input.currency,
        reason: input.reason ?? null,
        processorRef: input.processorRef ?? null,
        status: 'completed',
        refundedAt: new Date(),
        metadata: {
          ...(input.metadata ?? {}),
          ...(surchargeReversedCents > 0 ? { surchargeReversedCents } : {}),
        },
      },
    });

    if (input.lines && input.lines.length > 0) {
      for (const line of input.lines) {
        await tx.orderRefundItem.create({
          data: {
            tenantId: ctx.tenantId,
            refundId: created.id,
            orderItemId: line.orderItemId,
            quantity: line.quantity,
            amount: line.amount,
          },
        });
        await tx.orderItem.update({
          where: { id: line.orderItemId },
          data: { quantityRefunded: { increment: line.quantity } },
        });
      }
    }

    // Flip the order's status to refunded if the refund covers the full
    // total; otherwise leave it alone (paymentStatus will reflect partial
    // refund via the rollup below). A canceled order stays canceled: that is
    // what happened to it, and the rollup says the money went back.
    const fullyRefunded = Number(input.amount) >= Number(order.total) - Number(order.refundTotal);
    if (fullyRefunded && !cancelled) {
      await tx.order.update({
        where: { id: input.orderId },
        data: { status: 'refunded', refundedAt: new Date() },
      });
      // A task waiting on the order to leave the status it was in (a held
      // wholesale order's "waiting for your sign-off") has nothing left to wait
      // for once every penny has gone back. Closed, not done: nobody did it.
      await closeWhenOrderMovesOn(tx, ctx, {
        orderId: input.orderId,
        left: order.status,
        as: 'cancelled',
        because: `Order ${order.orderNumber} was refunded in full, so there is nothing left to do here.`,
        byUserId: ctx.userId ?? null,
      });
    }

    // Giving money back lowers what they have spent, in the same transaction as
    // the refund — the buyer's figures are recomputed inside this call. It was a
    // `{ decrement }` in a consumer whose matching increment could go missing,
    // and when it did the customer's lifetime spend went NEGATIVE.
    await recomputeOrderPaymentRollup(tx, ctx.tenantId, input.orderId);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.order.refunded',
      entityType: 'OrderRefund',
      entityId: created.id,
      diff: { after: { amount: created.amount.toString(), full: fullyRefunded } },
    });

    return created;
  });

  await afterCommit('publish order.refunded', () =>
    publishPlatformEvent({
      id: crypto.randomUUID(),
      topic: 'order.refunded',
      tenantId: ctx.tenantId,
      occurredAt: refund.refundedAt ?? new Date(),
      payload: {
        orderId: refund.orderId,
        orderNumber,
        customerId: orderCustomerId,
        refundId: refund.id,
        refundAmount: Number(refund.amount),
        currency: refund.currency,
      },
    })
  );

  return refund;
}
