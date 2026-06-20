// PaymentService (docs/94 ADR §5) — the single entry point every payment flow uses.
// Resolves the tenant's gateway from its config, delegates the operation, and keeps
// our own `payment_intents` ledger. The platform fee is recorded here (0 unless sparx
// Pay; for sparx Pay it's actually collected in Stripe via application_fee_amount —
// this row is informational, the source of truth for "what sparx earned").

import { withTenant } from '@sparx/db';

import { sparxPayFeeCents } from './fee';
import type {
  CreatePaymentIntentParams,
  CreatePaymentLinkParams,
  PaymentGateway,
  PaymentIntent,
  PaymentResult,
  RefundParams,
  RefundResult,
} from './gateway';
import { SPARX_PAY_ID } from './gateways/sparx-pay';
import { gatewayRegistry } from './registry';

export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentConfigError';
  }
}

export class PaymentService {
  /** The tenant's active gateway, from `tenant_payment_configs`. Throws when the
   *  tenant hasn't picked/onboarded a gateway. */
  async getGatewayForTenant(tenantId: string): Promise<PaymentGateway> {
    const config = await withTenant({ tenantId }, (tx) =>
      tx.tenantPaymentConfig.findUnique({ where: { tenantId } })
    );
    if (!config) {
      throw new PaymentConfigError(`No payment gateway configured for tenant ${tenantId}`);
    }
    return gatewayRegistry.get(config.gatewayId);
  }

  /** Create a payment intent through the tenant's gateway + record it. */
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    const gateway = await this.getGatewayForTenant(params.tenantId);
    const intent = await gateway.createPaymentIntent(params);

    const platformFee = gateway.id === SPARX_PAY_ID ? sparxPayFeeCents(params.amount) : 0;

    await withTenant({ tenantId: params.tenantId }, (tx) =>
      tx.paymentIntent.create({
        data: {
          tenantId: params.tenantId,
          gatewayId: gateway.id,
          externalId: intent.id,
          amount: params.amount,
          currency: params.currency,
          platformFee,
          status: intent.status,
          ...(params.orderId ? { orderId: params.orderId } : {}),
          ...(params.invoiceId ? { billingDocId: params.invoiceId } : {}),
          ...(params.bookingId ? { bookingId: params.bookingId } : {}),
          ...(params.customerId ? { customerId: params.customerId } : {}),
          metadata: params.metadata ?? {},
        },
      })
    );

    return intent;
  }

  /** Capture a previously-authorized (manual-capture) intent — fully, or a partial
   *  `amountCents`, releasing any uncaptured remainder. Used to take a no-show /
   *  late-cancel fee from a booking's card hold (docs/79 §9). Mirrors the ledger
   *  status on success; the gateway webhook is the backstop. */
  async capturePayment(
    tenantId: string,
    intentId: string,
    amountCents?: number
  ): Promise<PaymentResult> {
    const gateway = await this.getGatewayForTenant(tenantId);
    const result = await gateway.capturePayment(intentId, amountCents);
    if (result.success) {
      await withTenant({ tenantId }, (tx) =>
        tx.paymentIntent.updateMany({
          where: { externalId: intentId },
          data: { status: 'succeeded' },
        })
      );
    }
    return result;
  }

  /** Void an authorized-but-uncaptured intent (release a card hold). Used when a
   *  booking is cancelled in time or completed without a fee. */
  async cancelPayment(tenantId: string, intentId: string): Promise<PaymentResult> {
    const gateway = await this.getGatewayForTenant(tenantId);
    const result = await gateway.cancelPayment(intentId);
    if (result.success) {
      await withTenant({ tenantId }, (tx) =>
        tx.paymentIntent.updateMany({
          where: { externalId: intentId },
          data: { status: 'canceled' },
        })
      );
    }
    return result;
  }

  /** Refund through the tenant's gateway. */
  async refund(params: RefundParams): Promise<RefundResult> {
    const gateway = await this.getGatewayForTenant(params.tenantId);
    return gateway.refund(params);
  }

  /** Hosted payment link (invoices) through the tenant's gateway. */
  async createPaymentLink(params: CreatePaymentLinkParams): Promise<string | null> {
    const gateway = await this.getGatewayForTenant(params.tenantId);
    return gateway.createPaymentLink(params);
  }
}

export const paymentService = new PaymentService();
