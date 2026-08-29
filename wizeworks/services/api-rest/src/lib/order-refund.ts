// Refunding an ORDER: settle at the tenant's gateway if one is holding the
// charge, then record it. Most shops on this platform are not holding a charge
// anywhere — they took cash, a cheque or a bank transfer — and for them the
// refund is a bookkeeping entry against money they hand back themselves.
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

import {
  GatewayNotFoundError,
  PaymentConfigError,
  paymentService,
  takenByGateway,
} from '@wizeworks/payments';
import { orderRefundsService } from '@wizeworks/crm';
import type { OrderRefund } from '@wizeworks/db';
import { withTenant } from '@wizeworks/db';

import { badRequest } from '@wizeworks/api-core/errors';

export interface RefundOrderInput {
  orderId: string;
  /**
   * Refund amount in DOLLARS (the money vocabulary the CRM order surfaces use).
   * Optional: omit it to refund the FULL remaining amount — the order's
   * `amountPaid`, which the payment rollup already writes net of everything
   * given back. The workbench always sends an explicit amount; API/MCP/script
   * callers can just POST `{}`.
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
 * Settle a refund for `orderId` and record it. Money a gateway is holding is
 * reversed there first; money handed over by hand is recorded and handed back by
 * the shop. Returns the recorded `OrderRefund`.
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
      select: { amountPaid: true },
    }),
    payment: await tx.orderPayment.findFirst({
      where: { orderId: input.orderId, status: 'captured' },
      orderBy: { capturedAt: 'desc' },
      select: { id: true, processor: true, processorRef: true, currency: true },
    }),
  }));
  if (!payment) {
    throw badRequest('No payment has been taken on this order, so there is nothing to give back.');
  }

  // An omitted/blank amount means "refund what's left". `amountPaid` IS what is
  // left: the rollup writes it as captured MINUS refunded, so subtracting
  // `refundTotal` here took every earlier refund off a second time — a shop
  // holding $128.00 of a customer's money was offered $86.00, and once that
  // went through the row disappeared with $42.00 still unaccounted for
  // (issue 303).
  const dollars = input.amount ?? Number(order?.amountPaid ?? 0);
  const amountCents = Math.round(dollars * 100);
  // NaN slips past `<= 0` (every NaN comparison is false), which is exactly how a
  // missing amount used to reach the gateway as `Invalid integer: NaN`. Guard on
  // finiteness first so a bad amount fails HERE with a clear message, never at Stripe.
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw badRequest('There is nothing left to refund on this order.');
  }

  // Money handed over by hand — cash, a cheque, a bank transfer, a card on the
  // shop's own terminal — never passed through a gateway, so there is nothing to
  // call and the refund is simply recorded. Decided on the PROCESSOR, never on
  // whether a `processorRef` is filled in: that box is free text, and a shop that
  // takes cheques writes "Cheque 4471, banked Aug 25" in it. The returns flow has
  // asked it this way since issue 223; this path did not, so a shop on manual
  // payments could not refund an order at all — it was told either "no captured
  // card payment" or "no payment gateway is configured", and both ended by
  // advising the manual refund the button had just offered to record (issue 303).
  const chargeRef = takenByGateway(payment.processor) ? payment.processorRef : null;

  let gatewayRefundId: string | undefined;
  if (chargeRef) {
    let result;
    try {
      result = await paymentService.refund({
        tenantId: ctx.tenantId,
        chargeId: chargeRef,
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
    gatewayRefundId = result.refundId;
  }

  // Record it against the SAME payment, stamped with the gateway's refund id so the
  // charge.refunded webhook can find this row and complete it.
  return orderRefundsService.recordRefund(ctx, {
    orderId: input.orderId,
    paymentId: payment.id,
    amount: dollars,
    currency: input.currency ?? payment.currency,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(gatewayRefundId ? { processorRef: gatewayRefundId } : {}),
  });
}
