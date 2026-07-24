// Refunding an ORDER: settle at the tenant's gateway, then record it.
//
// `orderRefundsService.recordRefund` is BOOKKEEPING ONLY — it writes an
// `order_refunds` row from a `processorRef` the caller supplies and never contacts a
// gateway. That is correct for callers that settle elsewhere first (the returns flow
// in commerce's return-service, or an offline/manual refund a merchant already made
// by other means), but it meant `POST /v1/orders/:id/refunds` recorded a refund with
// no money moving — a phantom refund on the books while the customer kept waiting
// (BUG-007).
//
// This mirrors return-service's proven order: settle through the gateway FIRST, so a
// gateway failure leaves the order untouched and staff can retry, rather than marking
// it refunded when nothing moved. The `charge.refunded` webhook then reconciles the
// order's payment status + refund row (payment-webhook-reconcile's handleRefunded),
// which is why we persist the gateway's own refund id as the processorRef — that id
// is the join key the webhook looks the row up by.

import { GatewayNotFoundError, PaymentConfigError, paymentService } from '@sparx/payments';
import { orderRefundsService } from '@sparx/crm';
import type { OrderRefund } from '@sparx/db';
import { withTenant } from '@sparx/db';

import { badRequest } from '@sparx/api-core/errors';

export interface RefundOrderInput {
  orderId: string;
  /**
   * Refund amount in DOLLARS (the money vocabulary the CRM order surfaces use).
   * Optional: omit it to refund the FULL remaining amount (everything captured
   * on this order, less anything already refunded). The workbench always sends
   * an explicit amount; API/MCP/script callers can just POST `{}`.
   */
  amount?: number;
  currency?: string;
  reason?: string;
}

interface Ctx {
  tenantId: string;
  userId?: string;
}

/**
 * Settle a refund for `orderId` through the tenant's payment gateway and record it.
 * Returns the recorded `OrderRefund`.
 *
 * Throws a 400 when there is nothing to refund against (no captured payment) or the
 * gateway rejects/ isn't configured — in every one of those cases NO refund row is
 * written, so the order's books stay honest.
 */
export async function refundOrderThroughGateway(
  ctx: Ctx,
  input: RefundOrderInput
): Promise<OrderRefund> {
  // The order (for the full-remaining default) and the captured payment this
  // refund settles against — newest first, matching how the returns flow picks
  // the charge to reverse. Read together so the default amount and the target
  // charge come from one consistent snapshot.
  const { order, payment } = await withTenant({ tenantId: ctx.tenantId }, async (tx) => ({
    order: await tx.order.findUnique({
      where: { id: input.orderId },
      select: { amountPaid: true, refundTotal: true },
    }),
    payment: await tx.orderPayment.findFirst({
      where: { orderId: input.orderId, status: 'captured' },
      orderBy: { capturedAt: 'desc' },
      select: { id: true, processorRef: true, currency: true },
    }),
  }));
  if (!payment?.processorRef) {
    throw badRequest(
      'This order has no captured card payment to refund. Refund the customer manually, or issue account credit.'
    );
  }

  // An omitted/blank amount means "refund what's left" — everything captured on
  // the order, less anything already given back. Resolve it here rather than in
  // the route so every caller (workbench, MCP, scripts) gets the same default.
  const remaining = Number(order?.amountPaid ?? 0) - Number(order?.refundTotal ?? 0);
  const dollars = input.amount ?? remaining;
  const amountCents = Math.round(dollars * 100);
  // NaN slips past `<= 0` (every NaN comparison is false), which is exactly how a
  // missing amount used to reach the gateway as `Invalid integer: NaN`. Guard on
  // finiteness first so a bad amount fails HERE with a clear message, never at Stripe.
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw badRequest('There is nothing left to refund on this order.');
  }

  let result;
  try {
    result = await paymentService.refund({
      tenantId: ctx.tenantId,
      chargeId: payment.processorRef,
      amount: amountCents,
      ...(input.reason ? { metadata: { sparx_reason: input.reason.slice(0, 500) } } : {}),
    });
  } catch (err) {
    if (err instanceof PaymentConfigError || err instanceof GatewayNotFoundError) {
      throw badRequest(
        'No payment gateway is configured to settle this refund. Refund the customer manually, or issue account credit.'
      );
    }
    throw err;
  }
  if (!result.success) {
    throw badRequest(
      `Refund failed at the payment gateway: ${result.errorMessage ?? 'unknown error'}`
    );
  }

  // Record it against the SAME payment, stamped with the gateway's refund id so the
  // charge.refunded webhook can find this row and complete it.
  return orderRefundsService.recordRefund(ctx, {
    orderId: input.orderId,
    paymentId: payment.id,
    amount: dollars,
    currency: input.currency ?? payment.currency,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(result.refundId ? { processorRef: result.refundId } : {}),
  });
}
