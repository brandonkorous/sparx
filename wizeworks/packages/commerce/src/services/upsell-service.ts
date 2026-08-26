// The post-purchase upsell (docs/151 §12.2, docs/152 E2).
//
// ── IT MAKES A SECOND ORDER, NOT AN AMENDMENT ────────────────────────────────
//
// This is the whole design, and the obvious implementation is the other one.
//
// Appending a line to the completed order and re-charging the difference would
// mean re-running tax on a document the customer already has a receipt for,
// changing a total they have already seen, and building a refund path that has
// to work out which lines belonged to which capture. Every one of those is a
// place to be wrong about money.
//
// A second order gets all of it for free: its own tax, its own inventory
// commitment, its own receipt, its own refund. The two refund independently
// because they always were two. The link is `upsellOfOrderId` on the impression
// row, which is PROVENANCE for reporting — nothing about fulfilment or money
// reads back through it.
//
// ── AND IT REUSES THE ORDINARY CHECKOUT PATH ─────────────────────────────────
//
// Cart → session → charge → complete, the same four steps a normal order takes.
// A bespoke "create an order directly" function would be a second order-creation
// path, and the first thing to diverge would be something nobody notices until a
// tax quarter closes.
//
// "One click" means exactly one thing: the payment method is already on file
// from the order a moment ago. It is not a charge without a decision — the
// customer still presses the button.

import { withTenant } from '@wizeworks/db';

import type { ServiceContext } from '../errors';
import { CommerceValidationError } from '../errors';
import {
  paymentService,
  PaymentConfigError,
  StoredMethodsUnsupportedError,
} from '@wizeworks/payments';
import * as cartService from './cart-service';
import * as checkoutService from './checkout-service';
import * as offerService from './offer-service';
import * as paymentMethodService from './payment-method-service';

export interface AcceptUpsellInput {
  /** The SHOWING being accepted. Never a bare variant id — see the route. */
  impressionId: string;
  /** The order the offer followed. */
  orderId: string;
}

export interface AcceptUpsellResult {
  outcome: 'ordered' | 'declined_by_bank' | 'no_saved_method' | 'unavailable';
  /** The second order, when one was created. */
  orderId: string | null;
  /** Said in words, for a screen. Null on success. */
  reason: string | null;
}

/**
 * Take the offer: build a second order and charge the card already on file.
 *
 * Every failure is a returned outcome rather than a thrown error, and each one
 * is its own outcome rather than a shared "could not complete". The customer has
 * already bought something and is being told what happened to a SECOND attempt —
 * "your bank declined it" and "we do not have a card saved" send them to
 * different places, and collapsing them sends most of them to the wrong one.
 */
export async function acceptUpsell(
  ctx: ServiceContext,
  input: AcceptUpsellInput
): Promise<AcceptUpsellResult> {
  const impression = await withTenant(ctx, (tx) =>
    tx.commerceOfferImpression.findFirst({
      where: { id: input.impressionId, tenantId: ctx.tenantId, orderId: input.orderId },
      select: {
        id: true,
        acceptedAt: true,
        resultOrderId: true,
        offer: { select: { variantId: true, active: true } },
      },
    })
  );
  if (!impression) throw new CommerceValidationError('That offer was not shown on this order.');

  // Already taken. Returning the order they already have is the honest answer to
  // a double-click, and beats charging them twice for being impatient.
  if (impression.acceptedAt) {
    return { outcome: 'ordered', orderId: impression.resultOrderId, reason: null };
  }
  if (!impression.offer.active) {
    return {
      outcome: 'unavailable',
      orderId: null,
      reason: 'That offer is no longer available.',
    };
  }

  const original = await withTenant(ctx, (tx) =>
    tx.order.findFirst({
      where: { id: input.orderId, tenantId: ctx.tenantId },
      select: {
        customerId: true,
        propertyId: true,
        currency: true,
        channel: true,
        email: true,
        shippingAddress: true,
        billingAddress: true,
      },
    })
  );
  if (!original?.customerId) {
    return {
      outcome: 'no_saved_method',
      orderId: null,
      reason: 'We do not have a card saved for this order.',
    };
  }
  const { customerId } = original;

  const method = await withTenant(ctx, (tx) =>
    tx.customerPaymentMethod.findFirst({
      where: { tenantId: ctx.tenantId, customerId, status: 'active' },
      orderBy: [{ isDefault: 'desc' }, { lastUsedAt: 'desc' }],
      select: {
        id: true,
        methodRef: true,
        customerRef: true,
        networkTransId: true,
        originalAuthAmount: true,
      },
    })
  );
  if (!method) {
    return {
      outcome: 'no_saved_method',
      orderId: null,
      reason: 'We do not have a card saved, so this one needs a normal checkout.',
    };
  }

  // ── The ordinary path, from the top ──────────────────────────────────────
  const { cartId } = await cartService.create(ctx, {
    ...(original.propertyId ? { propertyId: original.propertyId } : {}),
    channel: original.channel,
    currency: original.currency,
    customerId,
  });
  await cartService.addItem(ctx, {
    cartId,
    variantId: impression.offer.variantId,
    quantity: 1,
  });

  const { sessionId } = await checkoutService.start(ctx, { cartId, channel: original.channel });
  await checkoutService.submitContact(ctx, {
    sessionId,
    email: original.email,
    ...(original.shippingAddress ? { shippingAddress: original.shippingAddress } : {}),
    ...(original.billingAddress ? { billingAddress: original.billingAddress } : {}),
  });

  // Priced by the PLATFORM, from the cart — never from anything a client sent.
  // This is the number the card is charged, so it has exactly one source.
  const priced = await checkoutService.get(ctx, sessionId);
  if (!priced) {
    return { outcome: 'unavailable', orderId: null, reason: 'That offer expired.' };
  }

  let charge;
  try {
    charge = await paymentService.chargeStoredMethod({
      tenantId: ctx.tenantId,
      amount: priced.totals.totalCents,
      currency: original.currency.toLowerCase(),
      methodRef: method.methodRef,
      customerRef: method.customerRef,
      customerId,
      // Keyed on the SHOWING: stable across a retry of the same click, distinct
      // per showing, so a double-tap cannot become two charges.
      idempotencyKey: `upsell_${impression.id}`,
      metadata: { upsellOfOrderId: input.orderId },
      // The stored-credential chain (docs/142 §5.4). A merchant-initiated charge
      // has to name the transaction that established the mandate, or the issuer
      // soft-declines a perfectly good card.
      ...(method.networkTransId
        ? { networkTransId: method.networkTransId }
        : { isFirstCharge: true }),
      ...(method.originalAuthAmount !== null
        ? { originalAuthAmount: method.originalAuthAmount }
        : {}),
    });
  } catch (err) {
    // The tenant's gateway cannot charge a stored method, or has no config. Not
    // a decline and not the customer's problem — and unlike a subscription
    // renewal there is nothing to fall back to, because nobody owes us this.
    if (err instanceof StoredMethodsUnsupportedError || err instanceof PaymentConfigError) {
      return {
        outcome: 'no_saved_method',
        orderId: null,
        reason: 'This shop cannot charge a saved card, so this one needs a normal checkout.',
      };
    }
    throw err;
  }

  if (charge.status !== 'succeeded') {
    // NO ORDER. A declined upsell must not leave a pending order behind for the
    // merchant to chase: the customer's real purchase is already done and this
    // one simply did not happen.
    return {
      outcome: 'declined_by_bank',
      orderId: null,
      reason: 'Your bank did not approve that, so we have left your original order as it is.',
    };
  }

  await paymentMethodService.markUsed(ctx, method.id);
  // Anchor the chain the first time a charge establishes one. `record` is a
  // no-op once set — the networks check the link back to the ESTABLISHING
  // transaction, so overwriting it with the latest charge would break it.
  if (charge.networkTransId) {
    await paymentMethodService.recordCredentialChain(ctx, method.id, {
      networkTransId: charge.networkTransId,
      originalAuthAmount: priced.totals.totalCents,
    });
  }

  await checkoutService.submitPayment(ctx, {
    sessionId,
    paymentRef: charge.paymentRef ?? 'stored_method',
  });
  const completed = await checkoutService.complete(ctx, {
    sessionId,
    idempotencyKey: `upsell_${impression.id}`,
  });

  await offerService.acceptOffer(ctx, {
    impressionId: impression.id,
    resultOrderId: completed.orderId,
  });

  return { outcome: 'ordered', orderId: completed.orderId, reason: null };
}
