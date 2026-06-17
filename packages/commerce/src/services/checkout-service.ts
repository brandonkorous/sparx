// checkoutService — multi-step state machine driving cart → order.
//
// State machine:
//   cart_review → contact → shipping → payment → review → completed
//                                                       ↘ expired
//
// All side effects (payment intent, shipping rate, tax calculation) are
// captured as provider refs on CheckoutSession so the flow is idempotent
// across reloads. complete() is the single function that creates an
// Order via @sparx/crm's orderService and fires the post-commit events
// (order.placed, inventory.adjusted, email.send).

import { orderService, b2bArService } from '@sparx/crm';
import {
  type AppliedSurcharge,
  applySurcharges,
  type CheckoutSessionSnapshot,
  CompleteCheckoutInput,
  StartCheckoutInput,
  SubmitContactInput,
  SubmitPaymentInput,
  SubmitShippingInput,
  type SurchargePaymentMethod,
} from '@sparx/commerce-schemas';
import {
  GatewayNotFoundError,
  PaymentConfigError,
  type PaymentGateway,
  type PaymentIntentStatus,
  paymentService,
} from '@sparx/payments';
import { withTenant } from '@sparx/db';
import type { CheckoutSession, TxClient } from '@sparx/db';
// purchaseApprovalRule not in generated types until migration 20260716000000 runs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTx = TxClient & Record<string, any>;

import { writeAuditLog } from '../audit';
import { CommerceConflictError, CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';

import * as discountService from './discount-service';
import * as surchargeService from './surcharge-service';

function parseDueDays(paymentTerms: string | null | undefined): number {
  if (!paymentTerms) return 30;
  const m = /^net(\d+)$/i.exec(paymentTerms);
  return m?.[1] ? parseInt(m[1], 10) : 30;
}

const DEFAULT_SESSION_TTL_MIN = 60; // 1 hour

// Valid transitions. Anything outside this table is a 409 CONFLICT.
const STEP_ORDER: Record<string, number> = {
  cart_review: 0,
  contact: 1,
  shipping: 2,
  payment: 3,
  review: 4,
  completed: 5,
  expired: 5,
};

// ─── start ───────────────────────────────────────────────────────────

export async function start(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ sessionId: string }> {
  const input = StartCheckoutInput.parse(rawInput);

  const sessionId = await withTenant(ctx, async (tx) => {
    const cart = await tx.cart.findFirst({
      where: { id: input.cartId, abandonedAt: null },
      include: { items: true },
    });
    if (!cart) throw new CommerceNotFoundError('Cart', input.cartId);
    if (cart.items.length === 0) {
      throw new CommerceValidationError('Cannot start checkout on an empty cart');
    }
    if (cart.currency !== input.currency) {
      throw new CommerceValidationError(
        `Cart currency ${cart.currency} does not match checkout currency ${input.currency}`
      );
    }

    // If an active session already exists for this cart, return it
    // instead of opening a parallel one. Idempotent start.
    const existing = await tx.checkoutSession.findFirst({
      where: {
        cartId: input.cartId,
        step: { notIn: ['completed', 'expired'] },
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing.id;

    const expiresAt = new Date(Date.now() + DEFAULT_SESSION_TTL_MIN * 60_000);
    const session = await tx.checkoutSession.create({
      data: {
        tenantId: ctx.tenantId,
        cartId: input.cartId,
        step: 'cart_review',
        channel: input.channel,
        currency: input.currency,
        customerId: input.customerId ?? null,
        b2bAccountId: input.b2bAccountId ?? null,
        customerEmail: input.customerEmail ?? null,
        subtotalCents: cart.subtotalCents,
        discountTotalCents: cart.discountTotalCents,
        shippingTotalCents: cart.shippingTotalCents,
        taxTotalCents: cart.taxTotalCents,
        giftCardAppliedCents: cart.giftCardAppliedCents,
        accountCreditAppliedCents: cart.accountCreditAppliedCents,
        totalCents: cart.totalCents,
        expiresAt,
      },
      select: { id: true },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'customer',
      action: 'commerce.checkout.started',
      entityType: 'CheckoutSession',
      entityId: session.id,
      diff: { after: { cartId: input.cartId, channel: input.channel } },
    });

    return session.id;
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'checkout.started',
    data: { sessionId, cartId: input.cartId, channel: input.channel },
  });

  return { sessionId };
}

// ─── reads ───────────────────────────────────────────────────────────

export async function get(
  ctx: ServiceContext,
  sessionId: string
): Promise<CheckoutSessionSnapshot | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.checkoutSession.findFirst({ where: { id: sessionId } });
    if (!row) return null;

    // Surcharge disclosure (docs/48 §6): a completed/expired session already
    // froze its surcharge into surcharge_total_cents + total; an in-flight
    // session computes it live from the active rules + the best-known payment
    // method so the storefront can disclose the fee BEFORE the customer pays.
    // Either way we recompute against active rules to surface the label.
    const specs = await surchargeService.listActiveSpecs(ctx, 'checkout', tx);
    const surcharge = applySurcharges(specs, {
      subtotalCents: Math.max(0, row.subtotalCents - row.discountTotalCents),
      shippingCents: row.shippingTotalCents,
      taxCents: row.taxTotalCents,
      paymentMethod: surchargeMethodForSession(row),
    });
    const terminal = row.step === 'completed' || row.step === 'expired';
    const surchargeTotalCents = terminal ? row.surchargeTotalCents : surcharge.totalCents;
    const totalCents = terminal ? row.totalCents : row.totalCents + surcharge.totalCents;

    return serializeSession(row, {
      surchargeTotalCents,
      totalCents,
      surchargeLabel: surchargeLabelFor(surcharge.applied),
    });
  });
}

// ─── step transitions ────────────────────────────────────────────────

export async function submitContact(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = SubmitContactInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const session = await assertSessionWritable(tx, input.sessionId);
    assertCanAdvance(session.step, 'contact');
    await tx.checkoutSession.update({
      where: { id: session.id },
      data: {
        step: 'contact',
        customerEmail: input.email,
        customerPhone: input.phone ?? null,
        acceptsMarketing: input.acceptsMarketing,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'customer',
      action: 'commerce.checkout.contact_submitted',
      entityType: 'CheckoutSession',
      entityId: session.id,
      diff: { after: { step: 'contact' } },
    });
  });
}

export async function submitShipping(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = SubmitShippingInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const session = await assertSessionWritable(tx, input.sessionId);
    assertCanAdvance(session.step, 'shipping');
    await tx.checkoutSession.update({
      where: { id: session.id },
      data: {
        step: 'shipping',
        shippingAddress: input.shippingAddress,
        billingAddress: input.billingAddress ?? input.shippingAddress,
        shippingProviderSlug: input.shippingProviderSlug,
        shippingRateRef: input.shippingRateRef,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'customer',
      action: 'commerce.checkout.shipping_submitted',
      entityType: 'CheckoutSession',
      entityId: session.id,
      diff: {
        after: {
          step: 'shipping',
          shippingProviderSlug: input.shippingProviderSlug,
          shippingRateRef: input.shippingRateRef,
        },
      },
    });
  });
}

export async function submitPayment(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = SubmitPaymentInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const session = await assertSessionWritable(tx, input.sessionId);
    assertCanAdvance(session.step, 'payment');

    // B2B-only fields are accepted only on b2b_portal sessions.
    if (input.poNumber && session.channel !== 'b2b_portal') {
      throw new CommerceValidationError('PO numbers are only accepted on b2b_portal checkouts');
    }

    await tx.checkoutSession.update({
      where: { id: session.id },
      data: {
        step: 'review',
        paymentProviderSlug: input.paymentProviderSlug,
        paymentRef: input.paymentRef,
        poNumber: input.poNumber ?? null,
        paymentTermsRequested: input.paymentTermsRequested ?? null,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'customer',
      action: 'commerce.checkout.payment_submitted',
      entityType: 'CheckoutSession',
      entityId: session.id,
      diff: {
        after: {
          step: 'review',
          paymentProviderSlug: input.paymentProviderSlug,
        },
      },
    });
  });
}

// ─── payment intent ──────────────────────────────────────────────────
//
// Storefront calls this after the customer reaches the payment step.
// It (a) resolves the active payment provider, (b) creates a real
// payment intent against the merchant's account, (c) persists the
// resulting paymentRef + providerSlug on the session, and (d) returns
// the clientSecret so Stripe Elements (or equivalent) can confirm in
// the browser. Idempotency: re-calls on the same session return the
// existing paymentRef instead of opening a parallel intent.

export interface CreatePaymentIntentResult {
  paymentRef: string;
  providerSlug: string;
  clientSecret?: string;
  amountCents: number;
  currency: string;
  status: PaymentIntentStatus;
}

/** Resolve the tenant's active payment gateway, or surface a clean validation error
 *  when the tenant is on manual payments / has no gateway configured. */
async function resolvePaymentGateway(tenantId: string): Promise<PaymentGateway> {
  try {
    return await paymentService.getGatewayForTenant(tenantId);
  } catch (err) {
    if (err instanceof PaymentConfigError || err instanceof GatewayNotFoundError) {
      throw new CommerceValidationError(
        'Online payments are not configured for this site. Set up a payment gateway in Settings → Payments.'
      );
    }
    throw err;
  }
}

export async function createPaymentIntent(
  ctx: ServiceContext,
  input: { sessionId: string; idempotencyKey?: string }
): Promise<CreatePaymentIntentResult> {
  const session = await withTenant(ctx, (tx) =>
    tx.checkoutSession.findFirst({ where: { id: input.sessionId } })
  );
  if (!session) throw new CommerceNotFoundError('CheckoutSession', input.sessionId);
  if (session.step === 'completed' || session.step === 'expired') {
    throw new CommerceConflictError(`Cannot create payment intent on a ${session.step} session`);
  }
  if (session.totalCents <= 0) {
    throw new CommerceValidationError('Cannot create payment intent on a zero-total session');
  }
  if (!session.customerEmail) {
    throw new CommerceValidationError(
      'Submit contact information before creating a payment intent'
    );
  }

  // Resolve the tenant's active gateway (sparx Pay / Stripe Direct) and open the
  // intent through PaymentService. The gateway sets metadata.tenantId on the intent so
  // the payment webhook can resolve the tenant; the platform fee (sparx Pay only) is
  // recorded on the payment_intents ledger. The intent id IS the paymentRef the
  // webhook later reconciles against.
  const gateway = await resolvePaymentGateway(ctx.tenantId);
  const intent = await paymentService.createPaymentIntent({
    tenantId: ctx.tenantId,
    amount: session.totalCents,
    currency: session.currency.toLowerCase(),
    metadata: {
      sparx_checkout_session_id: session.id,
      sparx_cart_id: session.cartId,
      sparx_channel: session.channel,
    },
  });

  await withTenant(ctx, async (tx) => {
    await tx.checkoutSession.update({
      where: { id: session.id },
      data: {
        paymentProviderSlug: gateway.id,
        paymentRef: intent.id,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'customer',
      action: 'commerce.checkout.payment_intent_created',
      entityType: 'CheckoutSession',
      entityId: session.id,
      diff: {
        after: { paymentProviderSlug: gateway.id, paymentRef: intent.id },
      },
    });
  });

  return {
    paymentRef: intent.id,
    providerSlug: gateway.id,
    ...(intent.clientSecret ? { clientSecret: intent.clientSecret } : {}),
    amountCents: session.totalCents,
    currency: session.currency,
    status: intent.status,
  };
}

// ─── complete ────────────────────────────────────────────────────────

export async function complete(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{
  orderId: string;
  orderNumber: string;
  /** True only when THIS call created the order; false on an idempotent replay.
   *  Callers gate one-shot side effects (transaction-fee metering) on it so a
   *  retried completion never double-bills. */
  freshlyPlaced: boolean;
  /** True when the order is held for B2B approval — `order.placed` (and fee
   *  metering) is deferred to the approval route. */
  pendingApproval: boolean;
}> {
  const input = CompleteCheckoutInput.parse(rawInput);

  // Idempotency: if a session has already been completed with this key,
  // return the prior result without recreating the order.
  const prior = await withTenant(ctx, (tx) =>
    tx.checkoutSession.findFirst({
      where: { idempotencyKey: input.idempotencyKey, step: 'completed' },
      select: { id: true, resultOrderId: true },
    })
  );
  if (prior?.resultOrderId) {
    const order = await withTenant(ctx, (tx) =>
      tx.order.findFirst({
        where: { id: prior.resultOrderId ?? '' },
        select: { id: true, orderNumber: true },
      })
    );
    if (order)
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        freshlyPlaced: false,
        pendingApproval: false,
      };
  }

  // Load the session + cart in a single transaction so we have a
  // consistent snapshot to hand to orderService.create.
  const result = await withTenant(ctx, async (tx) => {
    const session = await tx.checkoutSession.findFirst({
      where: { id: input.sessionId },
      include: {
        cart: {
          include: {
            items: { include: { variant: { include: { product: true } } } },
            discounts: true,
          },
        },
      },
    });
    if (!session) throw new CommerceNotFoundError('CheckoutSession', input.sessionId);
    if (session.step !== 'review') {
      throw new CommerceConflictError(
        `Cannot complete checkout from step "${session.step}"; expected "review"`
      );
    }
    if (!session.shippingAddress) {
      throw new CommerceValidationError('Cannot complete checkout without a shipping address');
    }
    if (!session.paymentProviderSlug && session.channel !== 'b2b_portal') {
      throw new CommerceValidationError(
        'Cannot complete a retail checkout without a payment provider'
      );
    }

    // B2B credit enforcement: net-terms checkouts require available credit.
    if (session.channel === 'b2b_portal' && session.b2bAccountId && session.paymentTermsRequested) {
      const account = await tx.b2BAccount.findFirst({
        where: { id: session.b2bAccountId, tenantId: ctx.tenantId },
        select: { status: true, creditLimit: true, creditUsed: true, paymentTerms: true },
      });
      if (!account) {
        throw new CommerceValidationError('B2B account not found');
      }
      if (account.status === 'credit_hold') {
        throw new CommerceValidationError(
          'Account is on credit hold — payment required before placing new orders'
        );
      }
      if (account.status === 'suspended') {
        throw new CommerceValidationError('Account is suspended — contact your account manager');
      }
      const available = Number(account.creditLimit) - Number(account.creditUsed);
      const orderDollars = session.totalCents / 100;
      if (orderDollars > available) {
        throw new CommerceValidationError(
          `Insufficient credit: $${available.toFixed(2)} available, $${orderDollars.toFixed(2)} required`
        );
      }
    }

    const cart = session.cart;

    // CRM owns the customer spine. A storefront/guest checkout reaches here with
    // no customerId — link-or-create a customer membership keyed on the contact
    // email and scoped to the order's origin SITE (docs/58 D2), so the order
    // attaches to a real, site-scoped customer and a later registration on this
    // site adopts the same membership instead of duplicating it. An
    // authenticated checkout that already carries a customerId keeps it.
    let customerId = session.customerId;
    if (!customerId) {
      if (!session.customerEmail) {
        throw new CommerceValidationError(
          'Checkout session must have a customer or contact email before complete()'
        );
      }
      customerId = await ensureCheckoutCustomer(
        tx,
        ctx.tenantId,
        cart.propertyId ?? null,
        session.customerEmail
      );
    }

    // Translate cart lines into CRM LineItemInputs. The crm-schema uses
    // decimal dollars (Money), not integer cents — convert at the
    // boundary so both modules' internal contracts stay clean.
    const items = cart.items.map((it) => ({
      productId: it.variant.productId,
      variantId: it.variantId,
      sku: it.variant.sku,
      name: it.variant.product.title,
      quantity: it.quantity,
      unitPrice: it.unitPriceCents / 100,
    }));

    const subtotalDollars = session.subtotalCents / 100;
    const discountDollars = session.discountTotalCents / 100;
    const shippingDollars = session.shippingTotalCents / 100;
    const taxDollars = session.taxTotalCents / 100;

    // Document surcharge (docs/48 §6) — computed AFTER tax, gated by payment
    // method. Card-processor checkouts classify as 'card'; B2B net-terms / no
    // provider as 'account' (no card fee). Basis reads the post-discount amounts.
    const surchargePaymentMethod = surchargeMethodForSession(session);
    const surchargeSpecs = await surchargeService.listActiveSpecs(ctx, 'checkout', tx);
    const surcharge = applySurcharges(surchargeSpecs, {
      subtotalCents: Math.max(0, session.subtotalCents - session.discountTotalCents),
      shippingCents: session.shippingTotalCents,
      taxCents: session.taxTotalCents,
      paymentMethod: surchargePaymentMethod,
    });
    const surchargeDollars = surcharge.totalCents / 100;

    const order = await orderService.create(ctx, {
      customerId,
      // Origin site (docs/58 D1) — inherit the cart's property so the order is
      // tagged with the storefront it was placed on.
      propertyId: cart.propertyId ?? undefined,
      channel:
        session.channel === 'storefront' || session.channel === 'b2b_portal'
          ? session.channel
          : 'admin',
      source: 'commerce_checkout',
      currency: session.currency,
      shippingTotal: shippingDollars,
      taxTotal: taxDollars,
      discountTotal: discountDollars,
      surchargeTotal: surchargeDollars,
      appliedSurcharges: surcharge.applied,
      shippingAddress: session.shippingAddress as Parameters<
        typeof orderService.create
      >[1] extends infer A
        ? A
        : never,
      billingAddress: (session.billingAddress ?? session.shippingAddress) as Parameters<
        typeof orderService.create
      >[1] extends infer A
        ? A
        : never,
      items,
      metadata: {
        commerceCheckoutSessionId: session.id,
        commerceCartId: cart.id,
        paymentProviderSlug: session.paymentProviderSlug,
        paymentRef: session.paymentRef,
        shippingProviderSlug: session.shippingProviderSlug,
        shippingRateRef: session.shippingRateRef,
        poNumber: session.poNumber,
        paymentTermsRequested: session.paymentTermsRequested,
        subtotalCents: session.subtotalCents,
        giftCardAppliedCents: session.giftCardAppliedCents,
        accountCreditAppliedCents: session.accountCreditAppliedCents,
      },
    });

    // Card payments: open a PENDING OrderPayment keyed to the gateway intent so the
    // payment webhook (payment.succeeded) can mark it captured + flip the order paid
    // (docs/94 ADR §10). Net-terms / manual orders carry no paymentRef — they settle
    // via the AR document or a hand-recorded payment, never a gateway intent. Also
    // back-link the payment_intents ledger row (created order-less at intent time).
    if (session.paymentRef && session.paymentProviderSlug) {
      await tx.orderPayment.create({
        data: {
          tenantId: ctx.tenantId,
          orderId: order.id,
          processor: session.paymentProviderSlug,
          processorRef: session.paymentRef,
          amount: session.totalCents / 100,
          currency: session.currency,
          status: 'pending',
        },
      });
      await tx.paymentIntent.updateMany({
        where: { externalId: session.paymentRef },
        data: { orderId: order.id },
      });
    }

    // B2B approval gate: if an active rule covers this account + amount, hold the
    // order for staff review instead of immediately placing it. The pending status
    // blocks invoice creation and order.placed until approved (docs/64 B2B Ph6).
    let pendingApproval = false;
    if (session.channel === 'b2b_portal' && session.b2bAccountId) {
      const rule = await (tx as AnyTx).purchaseApprovalRule.findFirst({
        where: {
          tenantId: ctx.tenantId,
          isActive: true,
          minAmountCents: { lte: session.totalCents },
          OR: [{ accountId: session.b2bAccountId }, { accountId: null }],
        },
        select: { id: true },
      });
      if (rule) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'pending_approval' },
        });
        pendingApproval = true;
      }
    }

    // B2B net-terms: auto-create the AR document and sync credit_used.
    // Skipped when the order is gated for approval — creation runs inside the
    // approval route once the order is approved.
    //
    // The receivable is now a BillingDocument on the system `net-terms-ar`
    // workflow (docs/87 §15), not a `b2b_invoices` row. createOrderArDocument
    // composes into THIS checkout transaction (tx injection) and re-syncs the
    // account's credit_used via the billing money authority.
    let b2bInvoiceId: string | null = null;
    if (
      !pendingApproval &&
      session.channel === 'b2b_portal' &&
      session.b2bAccountId &&
      session.paymentTermsRequested
    ) {
      const account = await tx.b2BAccount.findFirst({
        where: { id: session.b2bAccountId, tenantId: ctx.tenantId },
        select: { paymentTerms: true },
      });
      const dueDays = parseDueDays(account?.paymentTerms ?? session.paymentTermsRequested);
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + dueDays);
      const arDoc = await b2bArService.createOrderArDocument(
        { tenantId: ctx.tenantId, userId: ctx.userId ?? undefined, tx },
        {
          b2bAccountId: session.b2bAccountId,
          orderId: order.id,
          amount: session.totalCents / 100,
          currency: session.currency,
          dueAt,
          description: `Order ${order.orderNumber}`,
        }
      );
      b2bInvoiceId = arDoc.id;
    }

    // Mark the session completed + record the resulting order so the
    // idempotency-key short-circuit above can find it on retry.
    await tx.checkoutSession.update({
      where: { id: session.id },
      data: {
        step: 'completed',
        idempotencyKey: input.idempotencyKey,
        resultOrderId: order.id,
        completedAt: new Date(),
        subtotalCents: Math.round(Number(subtotalDollars) * 100),
        surchargeTotalCents: surcharge.totalCents,
        totalCents: session.totalCents + surcharge.totalCents,
      },
    });

    // Freeze the cart by stamping recoveredAt — future addItem calls
    // against it will still work but the storefront should redirect to
    // the order confirmation page instead.
    await tx.cart.update({
      where: { id: cart.id },
      data: { recoveredAt: new Date() },
    });

    // Record discount usage rows so per-customer + total-usage limits
    // increment now that the cart has converted.
    for (const cd of cart.discounts) {
      await discountService.recordDiscountUsage(ctx, {
        discountId: cd.discountId,
        customerId,
        orderId: order.id,
        cartId: cart.id,
        appliedCents: cd.appliedCents,
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'customer',
      action: 'commerce.checkout.completed',
      entityType: 'CheckoutSession',
      entityId: session.id,
      diff: { after: { orderId: order.id, orderNumber: order.orderNumber } },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      b2bInvoiceId,
      b2bAccountId: session.b2bAccountId ?? null,
      pendingApproval,
    };
  });

  if (result.b2bInvoiceId) {
    await publishCommerceEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'b2b.invoice.created',
      data: {
        invoiceId: result.b2bInvoiceId,
        accountId: result.b2bAccountId,
        orderId: result.orderId,
        orderNumber: result.orderNumber,
      },
    });
  }

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'checkout.completed',
    data: {
      sessionId: input.sessionId,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      pendingApproval: result.pendingApproval,
    },
  });

  if (result.pendingApproval) {
    // Order is held for staff review — emit the approval-queue signal instead of
    // order.placed. Inventory and fulfillment listeners must NOT act until approved.
    await publishCommerceEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'b2b.order.pending_approval',
      data: {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        b2bAccountId: result.b2bAccountId,
      },
    });
  } else {
    // Order placement is announced on the dedicated topic so non-CRM consumers
    // (inventory decrement, fulfillment dispatch, analytics) pick it up without
    // subscribing to checkout.completed.
    await publishCommerceEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'order.placed',
      data: { orderId: result.orderId, orderNumber: result.orderNumber },
    });
  }

  return { ...result, freshlyPlaced: true };
}

// ─── expire ──────────────────────────────────────────────────────────

export async function expire(ctx: ServiceContext, sessionId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const session = await tx.checkoutSession.findFirst({
      where: { id: sessionId, step: { notIn: ['completed', 'expired'] } },
      select: { id: true },
    });
    if (!session) return;
    await tx.checkoutSession.update({
      where: { id: sessionId },
      data: { step: 'expired' },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'system',
      action: 'commerce.checkout.expired',
      entityType: 'CheckoutSession',
      entityId: sessionId,
      diff: null,
    });
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'checkout.expired',
    data: { sessionId },
  });
}

/** Worker sweep — return ids of sessions past their TTL still in a
 *  non-terminal step so the expirer can flip them in batches. */
export async function findExpiredSessions(ctx: ServiceContext): Promise<string[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.checkoutSession.findMany({
      where: {
        step: { notIn: ['completed', 'expired'] },
        expiresAt: { lt: new Date() },
      },
      orderBy: { expiresAt: 'asc' },
      take: 500,
      select: { id: true },
    });
    return rows.map((r) => r.id);
  });
}

// ─── helpers ─────────────────────────────────────────────────────────

/**
 * Link-or-create the customer membership a guest/storefront checkout converts
 * into. Keyed on (origin site, email) to match the per-site membership model
 * (docs/58 D2): an existing membership on this site is reused (a prospect is
 * promoted to retail); otherwise a new retail membership is created on this
 * site. When the cart carries no property (e.g. the primary site sends no
 * `?property=`), we default to the tenant's primary property so this resolves
 * to the SAME membership a later account registration would (which also
 * defaults to primary) — avoiding a duplicate. Email is normalized to match how
 * the account-registration path stores it.
 */
async function ensureCheckoutCustomer(
  tx: TxClient,
  tenantId: string,
  cartPropertyId: string | null,
  email: string
): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  let propertyId = cartPropertyId;
  if (!propertyId) {
    const primary = await tx.property.findFirst({
      where: { isPrimary: true },
      select: { id: true },
    });
    propertyId = primary?.id ?? null;
  }
  const existing = await tx.customer.findFirst({
    where: { propertyId, email: normalizedEmail, deletedAt: null },
    select: { id: true, type: true },
  });
  if (existing) {
    if (existing.type === 'prospect') {
      await tx.customer.update({ where: { id: existing.id }, data: { type: 'retail' } });
    }
    return existing.id;
  }
  const created = await tx.customer.create({
    data: { tenantId, propertyId, email: normalizedEmail, type: 'retail' },
    select: { id: true },
  });
  return created.id;
}

async function assertSessionWritable(tx: TxClient, sessionId: string): Promise<CheckoutSession> {
  const session = await tx.checkoutSession.findFirst({ where: { id: sessionId } });
  if (!session) throw new CommerceNotFoundError('CheckoutSession', sessionId);
  if (session.step === 'completed' || session.step === 'expired') {
    throw new CommerceConflictError(`Cannot mutate a ${session.step} checkout session`);
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw new CommerceConflictError('Checkout session has expired');
  }
  return session;
}

function assertCanAdvance(from: string, to: string): void {
  const fromIdx = STEP_ORDER[from] ?? -1;
  const toIdx = STEP_ORDER[to] ?? -1;
  if (toIdx < fromIdx) {
    throw new CommerceConflictError(`Cannot move checkout from "${from}" back to "${to}"`);
  }
}

/**
 * Coarse payment-method classification driving surcharge gating (docs/48 §6).
 * Shared by `get()` (pre-payment disclosure) and `complete()` (final charge) so
 * the disclosed fee and the charged fee always agree. A net-terms request →
 * 'account' (no card fee); a chosen card provider → 'card'. Before either is
 * known we default by channel: retail storefront pays by card, B2B on account.
 */
function surchargeMethodForSession(row: {
  paymentTermsRequested: string | null;
  paymentProviderSlug: string | null;
  channel: string;
}): SurchargePaymentMethod {
  if (row.paymentTermsRequested) return 'account';
  if (row.paymentProviderSlug) return 'card';
  return row.channel === 'b2b_portal' ? 'account' : 'card';
}

/** One human label for the disclosed surcharge: the single rule's label, or a
 *  generic heading when several rules stack. Null when nothing applies. */
function surchargeLabelFor(applied: AppliedSurcharge[]): string | null {
  if (applied.length === 0) return null;
  if (applied.length === 1) return applied[0]!.label;
  return 'Surcharges';
}

function serializeSession(
  row: CheckoutSession,
  surcharge: { surchargeTotalCents: number; totalCents: number; surchargeLabel: string | null }
): CheckoutSessionSnapshot {
  return {
    sessionId: row.id,
    cartId: row.cartId,
    step: row.step as CheckoutSessionSnapshot['step'],
    channel: row.channel as CheckoutSessionSnapshot['channel'],
    currency: row.currency,
    customerEmail: row.customerEmail ?? undefined,
    customerId: row.customerId ?? undefined,
    b2bAccountId: row.b2bAccountId ?? undefined,
    shippingAddress: (row.shippingAddress ??
      undefined) as CheckoutSessionSnapshot['shippingAddress'],
    billingAddress: (row.billingAddress ?? undefined) as CheckoutSessionSnapshot['billingAddress'],
    shippingProviderSlug: row.shippingProviderSlug ?? undefined,
    shippingRateRef: row.shippingRateRef ?? undefined,
    shippingDescription: row.shippingDescription ?? undefined,
    paymentProviderSlug: row.paymentProviderSlug ?? undefined,
    paymentRef: row.paymentRef ?? undefined,
    taxBreakdownRef: row.taxBreakdownRef ?? undefined,
    poNumber: row.poNumber ?? undefined,
    paymentTermsRequested: row.paymentTermsRequested ?? undefined,
    surchargeLabel: surcharge.surchargeLabel ?? undefined,
    totals: {
      subtotalCents: row.subtotalCents,
      discountTotalCents: row.discountTotalCents,
      shippingTotalCents: row.shippingTotalCents,
      taxTotalCents: row.taxTotalCents,
      surchargeTotalCents: surcharge.surchargeTotalCents,
      giftCardAppliedCents: row.giftCardAppliedCents,
      accountCreditAppliedCents: row.accountCreditAppliedCents,
      totalCents: surcharge.totalCents,
    },
    expiresAt: row.expiresAt.toISOString(),
  };
}
