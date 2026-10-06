// orderPaymentsService — record payments, void them, recompute the parent
// order's paymentStatus + amountPaid + paidAt invariants.
//
// `recordPayment` is the single write path. Voids happen via `voidPayment`
// (no UPDATE of an existing captured row — voids are a new row marker that
// drops the order's amountPaid back). Refunds live in
// order-refunds-service.ts to keep that lifecycle isolated.

import crypto from 'node:crypto';

import { RecordPaymentInput, VoidPaymentInput } from '@wizeworks/crm-schemas';
import { afterCommit, withTenant } from '@wizeworks/db';
import type { OrderPayment, Prisma } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { publishPlatformEvent } from '../consumers/platform-bus';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import { recomputeCustomerCommerce } from './customer-rollup';

export async function listForOrder(ctx: ServiceContext, orderId: string): Promise<OrderPayment[]> {
  return withTenant(ctx, (tx) =>
    tx.orderPayment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    })
  );
}

export async function recordPayment(ctx: ServiceContext, rawInput: unknown): Promise<OrderPayment> {
  const input = RecordPaymentInput.parse(rawInput);

  const identity = { customerId: '', orderNumber: '' };

  const { payment, becamePaid } = await withTenant(ctx, async (tx) => {
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw new CrmNotFoundError('Order', input.orderId);
    if (order.status === 'cancelled' || order.status === 'refunded') {
      throw new CrmValidationError(
        `Cannot record a payment on an order in status "${order.status}"`
      );
    }

    const created = await tx.orderPayment.create({
      data: {
        tenantId: ctx.tenantId,
        orderId: input.orderId,
        processor: input.processor,
        processorRef: input.processorRef ?? null,
        amount: input.amount,
        currency: input.currency,
        status: input.status,
        authorizedAt: input.authorizedAt ? new Date(input.authorizedAt) : null,
        capturedAt: input.capturedAt
          ? new Date(input.capturedAt)
          : input.status === 'captured'
            ? new Date()
            : null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    identity.customerId = order.customerId;
    identity.orderNumber = order.orderNumber;

    const paidInFull = await recomputeOrderPaymentRollup(tx, ctx.tenantId, input.orderId);
    // A wholesale order still waiting for sign-off is paid but not placed
    // (sparx persona issue 087): a gift card or account credit covering it at
    // checkout lands here while it is held. It is not announced as paid until
    // the sign-off places it, which announces it then (`placedEvents` in
    // @wizeworks/b2b). Read after the rollup's write to the order row, so an
    // approval writing the same row at the same moment is seen.
    const current = await tx.order.findUnique({
      where: { id: input.orderId },
      select: { status: true },
    });
    const becamePaid = paidInFull && current?.status !== 'pending_approval';

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.order.payment.recorded',
      entityType: 'OrderPayment',
      entityId: created.id,
      diff: { after: { amount: created.amount.toString(), status: created.status } },
    });

    return { payment: created, becamePaid };
  });

  await afterCommit('publish order.payment.recorded', () =>
    publishPlatformEvent({
      id: crypto.randomUUID(),
      topic: 'order.payment.recorded',
      tenantId: ctx.tenantId,
      occurredAt: payment.capturedAt ?? new Date(),
      payload: {
        orderId: payment.orderId,
        orderNumber: identity.orderNumber,
        customerId: identity.customerId,
        paymentId: payment.id,
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
      },
    })
  );

  // When this capture completed the order's balance, announce it's fully paid —
  // the signal the high-value-order automation (and any paid-order consumer)
  // listens for. Fires once (the unpaid→paid edge); `order.paid` tees to the
  // automation fan-in via the platform-bus PLATFORM_TEE_TOPICS allow-list.
  if (becamePaid) {
    await afterCommit('publish order.paid', async () => {
      // Asked again once everything has committed. Checkout redeems a gift card
      // inside its own transaction BEFORE it holds the order for sign-off, so
      // the read above saw an order not yet held (sparx persona issue 087).
      const settled = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
        tx.order.findUnique({ where: { id: payment.orderId }, select: { status: true } })
      );
      if (settled?.status === 'pending_approval') return;
      await publishPlatformEvent({
        id: crypto.randomUUID(),
        topic: 'order.paid',
        tenantId: ctx.tenantId,
        occurredAt: new Date(),
        payload: {
          orderId: payment.orderId,
          orderNumber: identity.orderNumber,
          customerId: identity.customerId,
        },
      });
    });
  }

  return payment;
}

export async function voidPayment(ctx: ServiceContext, rawInput: unknown): Promise<OrderPayment> {
  const input = VoidPaymentInput.parse(rawInput);
  const payment = await withTenant(ctx, async (tx) => {
    const before = await tx.orderPayment.findUnique({ where: { id: input.paymentId } });
    if (!before) throw new CrmNotFoundError('OrderPayment', input.paymentId);
    if (before.status === 'voided' || before.status === 'refunded') return before;

    const updated = await tx.orderPayment.update({
      where: { id: input.paymentId },
      data: {
        status: 'voided',
        voidedAt: new Date(),
        failureReason: input.reason ?? null,
      },
    });
    // A voided payment drops the order's amountPaid, and the buyer's total drops
    // with it inside the same call — see `recomputeOrderPaymentRollup`.
    await recomputeOrderPaymentRollup(tx, ctx.tenantId, before.orderId);
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.order.payment.voided',
      entityType: 'OrderPayment',
      entityId: updated.id,
      diff: { before: { status: before.status }, after: { status: updated.status } },
    });
    return updated;
  });

  return payment;
}

/**
 * Re-derive order.amountPaid / paymentStatus / paidAt from the current set of
 * captured payments minus refunds, AND the buyer's lifetime figures with them.
 * Called from every path that mutates a payment or a refund. Returns whether
 * this recompute completed the order's balance (the unpaid→paid edge) so the
 * caller can publish `order.paid` exactly once — detected here, the single
 * chokepoint, so every payment path observes the transition identically.
 *
 * THE CUSTOMER ROLLUP IS INSIDE THIS FUNCTION, NOT BESIDE IT.
 *
 * `customer.totalSpent` is `SUM(order.amountPaid)`, so the moment this writes
 * `amountPaid` the buyer's figures are stale by definition. That used to be the
 * caller's job, and three of the five callers did it while two did not:
 *
 *   billing-payment-service.recordPayment   a payment taken against an INVOICE
 *   payment-webhook-reconcile               a card settling at the gateway
 *
 * The first is how Devi's customer Anneliese Vogt came to read **$0.00 spent**
 * on the Customers list after paying $180 — the order said Paid, the invoice
 * said Paid, and the person who paid showed as having never spent anything. The
 * second never ran here because no shop has a live gateway in development; in
 * production it is every online sale.
 *
 * A data migration had already repaired exactly this drift once
 * (`20270418000000_a_customers_lifetime_spend_agrees_with_their_orders`) while
 * the paths that caused it went on shipping, so it came straight back. Pairing
 * two calls by convention is what failed; there is one call now.
 */
export async function recomputeOrderPaymentRollup(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string
): Promise<boolean> {
  const payments = await tx.orderPayment.findMany({
    where: { tenantId, orderId, status: 'captured' },
  });
  const refunds = await tx.orderRefund.findMany({
    where: { tenantId, orderId, status: 'completed' },
  });
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) return false;

  const captured = payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const refunded = refunds.reduce((acc, r) => acc + Number(r.amount), 0);
  const amountPaid = Math.max(0, captured - refunded);
  const total = Number(order.total);

  // "Paid" asks whether the money that came IN covered the order, not what is
  // left after refunds. Measured against the net, an order paid in full and then
  // part refunded was stored as `partially_paid`, which every reader takes to mean
  // money is still owed: the console said "some is still owed", and the list of
  // orders to chase put it there. Every core deposit refunded on a rebuilt part
  // (issue 051) would have done the same to a fully paid order.
  let paymentStatus: 'unpaid' | 'partially_paid' | 'paid' | 'refunded' = 'unpaid';
  if (refunded > 0 && amountPaid === 0) paymentStatus = 'refunded';
  else if (captured >= total && total > 0) paymentStatus = 'paid';
  else if (amountPaid > 0) paymentStatus = 'partially_paid';

  // The unpaid→paid edge: the order had no paidAt and is now fully paid.
  const becamePaid = paymentStatus === 'paid' && order.paidAt === null;

  await tx.order.update({
    where: { id: orderId },
    data: {
      amountPaid,
      refundTotal: refunded,
      paymentStatus,
      paidAt: becamePaid ? new Date() : order.paidAt,
    },
  });

  // AFTER the order is written, never before: this reads `amountPaid` back off
  // the orders it sums, so running it first would sum the figures this call just
  // replaced.
  await recomputeCustomerCommerce(tx, tenantId, order.customerId);

  return becamePaid;
}
