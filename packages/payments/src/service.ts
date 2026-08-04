// PaymentService (docs/94 ADR §5) — the single entry point every payment flow uses.
// Resolves the tenant's gateway from its config, delegates the operation, and keeps
// our own `payment_intents` ledger. The platform fee is recorded here (0 unless sparx
// Pay; for sparx Pay it's actually collected in Stripe via application_fee_amount —
// this row is informational, the source of truth for "what sparx earned").

import { withTenant } from '@sparx/db';

import { getGatewayDescriptor } from './catalog';
import { sparxPayFeeCents } from './fee';
import type {
  ChargeStoredMethodParams,
  CompleteVaultParams,
  CreatePaymentIntentParams,
  CreatePaymentLinkParams,
  CreateSetupSessionParams,
  PaymentGateway,
  PaymentIntent,
  PaymentResult,
  RefundParams,
  RefundResult,
  SetupSession,
  StoredChargeResult,
  VaultedMethod,
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

  /* ── Stored payment methods (docs/142 §5) ─────────────────────────────────
   *
   * The three below all resolve the tenant's gateway, then check
   * `capabilities.storedMethods` BEFORE reaching for the optional adapter
   * method. Calling an undefined method would throw "not a function" — a stack
   * trace that says nothing about the actual situation, which is that this
   * tenant's processor cannot hold a card on file and their subscriptions
   * should be collecting by invoice instead. Callers catch this and fall back.
   */

  /** Whether this tenant's gateway can vault + charge off-session. Cheap and
   *  side-effect-free, so callers can branch on it before doing any work. */
  async supportsStoredMethods(tenantId: string): Promise<boolean> {
    const gateway = await this.getGatewayForTenant(tenantId);
    return getGatewayDescriptor(gateway.id)?.capabilities.storedMethods === true;
  }

  private async vaultingGateway(tenantId: string): Promise<PaymentGateway> {
    const gateway = await this.getGatewayForTenant(tenantId);
    const descriptor = getGatewayDescriptor(gateway.id);
    if (descriptor?.capabilities.storedMethods !== true) {
      throw new StoredMethodsUnsupportedError(descriptor?.name ?? gateway.id);
    }
    return gateway;
  }

  async createSetupSession(params: CreateSetupSessionParams): Promise<SetupSession> {
    const gateway = await this.vaultingGateway(params.tenantId);
    if (!gateway.createSetupSession) {
      throw new StoredMethodsUnsupportedError(gateway.name);
    }
    return gateway.createSetupSession(params);
  }

  async completeVault(params: CompleteVaultParams): Promise<VaultedMethod | null> {
    const gateway = await this.vaultingGateway(params.tenantId);
    if (!gateway.completeVault) {
      throw new StoredMethodsUnsupportedError(gateway.name);
    }
    return gateway.completeVault(params);
  }

  /** Charge a vaulted method. Also mirrors the attempt into our own
   *  `payment_intents` ledger on success, so a renewal charge shows up in the
   *  same place as every interactive one rather than being invisible to
   *  reconciliation. */
  async chargeStoredMethod(params: ChargeStoredMethodParams): Promise<StoredChargeResult> {
    const gateway = await this.vaultingGateway(params.tenantId);
    if (!gateway.chargeStoredMethod) {
      throw new StoredMethodsUnsupportedError(gateway.name);
    }
    const result = await gateway.chargeStoredMethod(params);

    if (result.paymentRef) {
      const platformFee = gateway.id === SPARX_PAY_ID ? sparxPayFeeCents(params.amount) : 0;
      await withTenant({ tenantId: params.tenantId }, (tx) =>
        tx.paymentIntent.upsert({
          where: {
            gatewayId_externalId: { gatewayId: gateway.id, externalId: result.paymentRef ?? '' },
          },
          create: {
            tenantId: params.tenantId,
            gatewayId: gateway.id,
            externalId: result.paymentRef ?? '',
            amount: params.amount,
            currency: params.currency,
            platformFee,
            status: ledgerStatus(result.status),
            ...(params.orderId ? { orderId: params.orderId } : {}),
            ...(params.customerId ? { customerId: params.customerId } : {}),
            metadata: params.metadata ?? {},
          },
          update: { status: ledgerStatus(result.status) },
        })
      );
    }

    return result;
  }
}

/** The tenant's processor cannot hold a card on file. Not a bug and not a
 *  misconfiguration — `manual` and `custom` are legitimate choices — so this
 *  reads as a routing signal rather than an error, and the subscription layer
 *  answers it by collecting via invoice instead (docs/142 §8). */
export class StoredMethodsUnsupportedError extends Error {
  constructor(gatewayName: string) {
    super(`${gatewayName} cannot save a payment method for later charges.`);
    this.name = 'StoredMethodsUnsupportedError';
  }
}

function ledgerStatus(status: StoredChargeResult['status']): string {
  switch (status) {
    case 'succeeded':
      return 'succeeded';
    case 'requires_action':
      return 'requires_action';
    default:
      return 'failed';
  }
}

export const paymentService = new PaymentService();
