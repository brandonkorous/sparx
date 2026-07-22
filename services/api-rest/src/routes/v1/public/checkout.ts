// Public checkout write surface for the storefront — the multi-step flow that
// turns a cart into an order.
//
//   POST /v1/public/commerce/checkout                  ?tenant= { cartId, email? } → { sessionId }
//   GET  /v1/public/commerce/checkout/:sessionId       ?tenant=
//   POST /v1/public/commerce/checkout/:sessionId/contact   { email, phone?, acceptsMarketing? }
//   POST /v1/public/commerce/checkout/:sessionId/shipping-quote → rate options
//   POST /v1/public/commerce/checkout/:sessionId/shipping  { shippingAddress, shippingRateRef, shippingProviderSlug, billingAddress? }
//   POST /v1/public/commerce/checkout/:sessionId/payment-intent → { clientSecret, paymentRef, providerSlug }
//   POST /v1/public/commerce/checkout/:sessionId/payment   { paymentProviderSlug, paymentRef, poNumber? }
//   POST /v1/public/commerce/checkout/:sessionId/complete  { idempotencyKey? } → { orderId, orderNumber }
//
// Ownership is proven the same way as the cart routes: the session's underlying
// cart must match the caller's x-cart-token.

import { randomUUID } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  checkoutService,
  discountService,
  shippingService,
  type ServiceContext,
} from '@sparx/commerce';
import { SubmitPaymentInput } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { notFound } from '@sparx/api-core/errors';

import { assertCartToken, publicCommerceContext } from '../../../lib/public-commerce-context.js';

const SessionParam = z.object({ sessionId: z.string().uuid() });

const StartBody = z.object({
  cartId: z.string().uuid(),
  email: z.string().email().optional(),
});

const ContactBody = z.object({
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  acceptsMarketing: z.boolean().optional(),
});

const Address = z.object({
  name: z.string().min(1).max(255),
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).optional(),
  city: z.string().min(1).max(127),
  region: z.string().max(127).optional(),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2),
  phone: z.string().max(50).optional(),
});

const ShippingQuoteBody = z.object({
  // Full destination address, sent once the shopper's shipping form is
  // filled in (the checkout form collects it before "Get shipping rates" is
  // clickable). Live carrier rating needs the real street/city — a carrier
  // geocodes the full address to rate, not just the ZIP — so without this,
  // live rates are silently unreachable and every quote falls back to the
  // manual/flat rate regardless of provider installed. `destinationCountry`/
  // `destinationPostal` remain as a fallback for a caller that only has
  // those (still enough for manual-zone matching, just not live rating).
  destinationAddress: Address.optional(),
  destinationCountry: z.string().length(2).optional(),
  destinationPostal: z.string().max(20).optional(),
});

const ShippingBody = z.object({
  shippingAddress: Address,
  billingAddress: Address.optional(),
  shippingRateRef: z.string().min(1).max(255),
  shippingProviderSlug: z.string().min(1).max(63),
});

// The storefront's checkout form collects the recipient's name into this
// route's own `Address.name`, but the canonical AddressSnapshot shape stored
// on the order (packages/crm-schemas) keys it `recipientName`. Map at this
// boundary — without it the name silently never lands on the order, and a
// merchant can't buy a real carrier label later (Shippo requires a complete
// recipient name to purchase, though it tolerates a missing one for a quote).
function toAddressSnapshot(addr: z.infer<typeof Address>): Record<string, unknown> {
  const { name, ...rest } = addr;
  return { ...rest, recipientName: name };
}

const IntentBody = z.object({
  // The storefront's post-payment return URL for hosted-redirect gateways (docs/111 D4).
  returnUrl: z.string().url().max(2048).optional(),
  cancelUrl: z.string().url().max(2048).optional(),
});

const CompleteBody = z.object({
  idempotencyKey: z.string().min(8).max(127).optional(),
});

const DiscountBody = z.object({
  code: z.string().min(1).max(64),
});

// Resolve the session → its cart, and assert the caller owns that cart.
async function assertSessionOwner(
  request: Parameters<typeof assertCartToken>[0],
  ctx: ServiceContext,
  tenantId: string,
  sessionId: string
): Promise<{ cartId: string }> {
  const session = await withTenant({ tenantId }, (tx) =>
    tx.checkoutSession.findFirst({ where: { id: sessionId }, select: { cartId: true } })
  );
  if (!session) throw notFound('CheckoutSession', sessionId);
  await assertCartToken(request, tenantId, session.cartId);
  return { cartId: session.cartId };
}

const publicCheckoutRoutes: FastifyPluginAsync = async (app) => {
  // Start a checkout session from a cart.
  app.post('/v1/public/commerce/checkout', async (request) => {
    const body = StartBody.parse(request.body);
    const { tenantId, ctx } = await publicCommerceContext(request);
    await assertCartToken(request, tenantId, body.cartId);
    const currency = await withTenant({ tenantId }, (tx) =>
      tx.cart.findFirst({ where: { id: body.cartId }, select: { currency: true } })
    );
    const { sessionId } = await checkoutService.start(ctx, {
      cartId: body.cartId,
      channel: 'storefront',
      currency: currency?.currency ?? 'USD',
      ...(body.email ? { customerEmail: body.email } : {}),
    });
    return ok(await checkoutService.get(ctx, sessionId));
  });

  app.get('/v1/public/commerce/checkout/:sessionId', async (request) => {
    const { sessionId } = SessionParam.parse(request.params);
    const { tenantId, ctx } = await publicCommerceContext(request);
    await assertSessionOwner(request, ctx, tenantId, sessionId);
    return ok(await checkoutService.get(ctx, sessionId));
  });

  app.post('/v1/public/commerce/checkout/:sessionId/contact', async (request) => {
    const { sessionId } = SessionParam.parse(request.params);
    const body = ContactBody.parse(request.body);
    const { tenantId, ctx } = await publicCommerceContext(request);
    await assertSessionOwner(request, ctx, tenantId, sessionId);
    await checkoutService.submitContact(ctx, {
      sessionId,
      email: body.email,
      ...(body.phone ? { phone: body.phone } : {}),
      acceptsMarketing: body.acceptsMarketing ?? false,
    });
    return ok(await checkoutService.get(ctx, sessionId));
  });

  app.post('/v1/public/commerce/checkout/:sessionId/shipping-quote', async (request) => {
    const { sessionId } = SessionParam.parse(request.params);
    const body = ShippingQuoteBody.parse(request.body ?? {});
    const { tenantId, ctx } = await publicCommerceContext(request);
    const { cartId } = await assertSessionOwner(request, ctx, tenantId, sessionId);

    // Build a ShipmentRequest from the cart: one consolidated package whose
    // weight/dimensions fall back variant → product → a nominal default
    // (resolvePackageForItems), summed against the tenant's real ship-from
    // warehouse address (resolveShipFromAddress). shippingService.rateShipment
    // matches this against manual zones/rates AND — when a carrier is
    // installed and the addresses are real, not placeholders — live rates too.
    const cart = await withTenant({ tenantId }, (tx) =>
      tx.cart.findFirst({
        where: { id: cartId },
        select: {
          currency: true,
          // The site this cart is on (docs/131 §4) — bounds which shipping zones
          // may quote, so a donut site's local-delivery rates never appear on a
          // parts cart. Without passing this, the zone scoping was inert here.
          propertyId: true,
          items: {
            select: {
              quantity: true,
              subtotalCents: true,
              variant: {
                select: {
                  weightGrams: true,
                  lengthMm: true,
                  widthMm: true,
                  heightMm: true,
                  product: {
                    select: { weightGrams: true, lengthMm: true, widthMm: true, heightMm: true },
                  },
                },
              },
            },
          },
        },
      })
    );
    if (!cart) throw notFound('Cart', cartId);

    const totalValue = cart.items.reduce((sum, it) => sum + it.subtotalCents, 0);
    const shipmentPackage = shippingService.resolvePackageForItems(
      cart.items.map((it) => ({
        quantity: it.quantity,
        weightGrams: it.variant.weightGrams,
        lengthMm: it.variant.lengthMm,
        widthMm: it.variant.widthMm,
        heightMm: it.variant.heightMm,
        productWeightGrams: it.variant.product.weightGrams,
        productLengthMm: it.variant.product.lengthMm,
        productWidthMm: it.variant.product.widthMm,
        productHeightMm: it.variant.product.heightMm,
      }))
    );
    shipmentPackage.declaredValueCents = totalValue;

    // Zone matching only reads toAddress.country, so that alone is enough for
    // manual rates. Live carrier rating needs the full street+city too — a
    // carrier geocodes the destination to rate, a placeholder always returns
    // zero live rates even though shipment creation "succeeds" — so when the
    // checkout form has already collected the shopper's full address (it has,
    // by the time "Get shipping rates" is clickable), forward it as a real
    // toAddress instead of the country/postal-only placeholder.
    // signatureRequired/saturdayDelivery default to false.
    const fromAddress = await shippingService
      .resolveShipFromAddress(ctx)
      .catch(() => ({ line1: '—', city: '—', country: 'US' }));
    const toAddress = body.destinationAddress ?? {
      line1: '—',
      city: '—',
      country: body.destinationCountry ?? 'US',
      ...(body.destinationPostal ? { postalCode: body.destinationPostal } : {}),
    };
    const rates = await shippingService.rateShipment(ctx, {
      ...(cart.propertyId ? { propertyId: cart.propertyId } : {}),
      fromAddress,
      toAddress,
      currency: cart.currency,
      signatureRequired: false,
      saturdayDelivery: false,
      packages: [shipmentPackage],
    });

    // Map the service RateOption shape → the storefront's ShippingRate shape.
    return ok(
      rates.map((r) => ({
        providerSlug: r.providerSlug,
        rateRef: r.rateRef,
        service: r.service,
        carrier: r.carrier,
        amountCents: r.amountCents,
        estimatedDays: r.estimatedDeliveryDays ?? null,
      }))
    );
  });

  app.post('/v1/public/commerce/checkout/:sessionId/shipping', async (request) => {
    const { sessionId } = SessionParam.parse(request.params);
    const body = ShippingBody.parse(request.body);
    const { tenantId, ctx } = await publicCommerceContext(request);
    await assertSessionOwner(request, ctx, tenantId, sessionId);
    await checkoutService.submitShipping(ctx, {
      sessionId,
      shippingAddress: toAddressSnapshot(body.shippingAddress),
      ...(body.billingAddress ? { billingAddress: toAddressSnapshot(body.billingAddress) } : {}),
      shippingRateRef: body.shippingRateRef,
      shippingProviderSlug: body.shippingProviderSlug,
    });
    return ok(await checkoutService.get(ctx, sessionId));
  });

  // Create the payment intent. Inline (Stripe-family) gateways return a clientSecret
  // the storefront confirms with Stripe.js; hosted-redirect gateways (docs/111 D4)
  // return a redirectUrl the storefront sends the shopper to. The storefront passes its
  // post-payment returnUrl for the hosted gateways.
  app.post('/v1/public/commerce/checkout/:sessionId/payment-intent', async (request) => {
    const { sessionId } = SessionParam.parse(request.params);
    const body = IntentBody.parse(request.body ?? {});
    const { tenantId, ctx } = await publicCommerceContext(request);
    await assertSessionOwner(request, ctx, tenantId, sessionId);
    const intent = await checkoutService.createPaymentIntent(ctx, {
      sessionId,
      ...(body.returnUrl ? { returnUrl: body.returnUrl } : {}),
      ...(body.cancelUrl ? { cancelUrl: body.cancelUrl } : {}),
    });
    return ok({
      paymentRef: intent.paymentRef,
      providerSlug: intent.providerSlug,
      ...(intent.clientSecret ? { clientSecret: intent.clientSecret } : {}),
      ...(intent.redirectUrl ? { redirectUrl: intent.redirectUrl } : {}),
      amountCents: intent.amountCents,
      currency: intent.currency,
      status: intent.status,
    });
  });

  // Record the confirmed payment ref on the session (advances to 'payment').
  app.post('/v1/public/commerce/checkout/:sessionId/payment', async (request) => {
    const { sessionId } = SessionParam.parse(request.params);
    // sessionId rides in the path, not the body — the client never sends it.
    const body = SubmitPaymentInput.omit({ sessionId: true }).parse(request.body);
    const { tenantId, ctx } = await publicCommerceContext(request);
    await assertSessionOwner(request, ctx, tenantId, sessionId);
    await checkoutService.submitPayment(ctx, { sessionId, ...body });
    return ok(await checkoutService.get(ctx, sessionId));
  });

  // Apply a discount code to the checkout session's underlying cart.
  // Validates the code, enforces usage limits, and returns the updated session
  // so the storefront can re-render totals. Idempotent — re-applying the same
  // code for the same cart returns the existing saving without erroring.
  app.post('/v1/public/commerce/checkout/:sessionId/discount', async (request) => {
    const { sessionId } = SessionParam.parse(request.params);
    const body = DiscountBody.parse(request.body);
    const { tenantId, ctx } = await publicCommerceContext(request);
    const { cartId } = await assertSessionOwner(request, ctx, tenantId, sessionId);
    await discountService.redeemCode(ctx, { cartId, code: body.code });
    return ok(await checkoutService.get(ctx, sessionId));
  });

  // Finalize → creates the Order, decrements stock, fires order.placed.
  app.post('/v1/public/commerce/checkout/:sessionId/complete', async (request) => {
    const { sessionId } = SessionParam.parse(request.params);
    const body = CompleteBody.parse(request.body ?? {});
    const { tenantId, ctx } = await publicCommerceContext(request);
    await assertSessionOwner(request, ctx, tenantId, sessionId);
    const result = await checkoutService.complete(ctx, {
      sessionId,
      idempotencyKey: body.idempotencyKey ?? randomUUID(),
    });

    return ok(result);
  });

  return Promise.resolve();
};

export default publicCheckoutRoutes;
