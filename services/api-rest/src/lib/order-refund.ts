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
  /** Refund amount in DOLLARS (the money vocabulary the CRM order surfaces use). */
  amount: number;
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
  const amountCents = Math.round(input.amount * 100);
  if (amountCents <= 0) throw badRequest('Refund amount must be greater than zero.');

  // The captured payment this refund settles against — newest first, matching how
  // the returns flow picks the charge to reverse.
  const payment = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.orderPayment.findFirst({
      where: { orderId: input.orderId, status: 'captured' },
      orderBy: { capturedAt: 'desc' },
      select: { id: true, processorRef: true, currency: true },
    })
  );
  if (!payment?.processorRef) {
    throw badRequest(
      'This order has no captured card payment to refund. Refund the customer manually, or issue account credit.'
    );
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
    amount: input.amount,
    currency: input.currency ?? payment.currency,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(result.refundId ? { processorRef: result.refundId } : {}),
  });
}
