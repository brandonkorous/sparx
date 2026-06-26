// Public (unauthenticated) sparx.market storefront surface — the cross-tenant
// browse + the single-merchant cart/checkout that power apps/market (docs/106 §4.7).
//
// Browse (no merchant param — reads the global market_listings projection):
//   GET  /v1/public/market/products                    catalog browse (faceted)
//   GET  /v1/public/market/products/:slug              listing detail
//   GET  /v1/public/market/categories                  the category taxonomy
//   GET  /v1/public/market/merchants                   merchant directory
//   GET  /v1/public/market/merchants/:slug             merchant profile + products
//
// Cart (single-merchant — seller tenant resolved from ?merchant=<slug>):
//   POST   /v1/public/market/cart                       ?merchant= → create (x-cart-token)
//   GET    /v1/public/market/cart/:cartId               ?merchant=
//   POST   /v1/public/market/cart/:cartId/items         ?merchant= { variantId, quantity }
//   PATCH  /v1/public/market/cart/:cartId/items/:itemId ?merchant= { quantity }
//   DELETE /v1/public/market/cart/:cartId/items/:itemId ?merchant=
//
// Checkout (?merchant=, channel 'sparx_market' → platform MoR + settlement accrual):
//   POST /v1/public/market/checkout                     { cartId, email? } → session
//   GET  /v1/public/market/checkout/:sessionId
//   POST /v1/public/market/checkout/:sessionId/contact
//   POST /v1/public/market/checkout/:sessionId/shipping-quote
//   POST /v1/public/market/checkout/:sessionId/shipping
//   POST /v1/public/market/checkout/:sessionId/payment-intent
//   POST /v1/public/market/checkout/:sessionId/payment
//   POST /v1/public/market/checkout/:sessionId/complete → { orderId, orderNumber }
//
// Order status (no login):
//   GET  /v1/public/market/orders/:orderId              ?merchant= → safe public view
//
// Ownership of a cart/checkout is proven exactly as on the storefront: the cart's
// guest token (issued on create) echoed via the `x-cart-token` header.

import { randomUUID } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  cartService,
  checkoutService,
  marketService,
  shippingService,
  type ServiceContext,
} from '@sparx/commerce';
import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { notFound } from '@sparx/api-core/errors';

import { assertCartToken, publicMarketContext } from '../../../lib/public-market-context.js';

// ── Param / body / query schemas ─────────────────────────────────────────────────

const SlugParam = z.object({ slug: z.string().min(1).max(255) });
const CartParam = z.object({ cartId: z.string().uuid() });
const ItemParam = z.object({ cartId: z.string().uuid(), itemId: z.string().uuid() });
const SessionParam = z.object({ sessionId: z.string().uuid() });
const OrderParam = z.object({ orderId: z.string().uuid() });

// Catalog browse query: query-string values arrive as strings, so numerics and
// booleans are coerced. Shape mirrors MarketBrowseQuery (which `browseListings`
// re-validates), but we normalize here so coercion happens before the service.
const BooleanFromString = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');

const BrowseQuery = z.object({
  q: z.string().max(255).optional(),
  category: z.string().max(63).optional(),
  merchant: z.string().max(63).optional(),
  sort: z.enum(['relevance', 'newest', 'lowest_price', 'highest_price', 'rating']).optional(),
  minPriceCents: z.coerce.number().int().nonnegative().optional(),
  maxPriceCents: z.coerce.number().int().nonnegative().optional(),
  inStock: BooleanFromString.optional(),
  featured: BooleanFromString.optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(60).optional(),
});

const MerchantsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(60).optional(),
  q: z.string().max(255).optional(),
});

const CreateCartBody = z
  .object({
    variantId: z.string().uuid(),
    quantity: z.number().int().positive().max(999).default(1),
  })
  .optional();

const AddItemBody = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(999).default(1),
});
const UpdateItemBody = z.object({ quantity: z.number().int().nonnegative().max(999) });

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
  destinationCountry: z.string().length(2).optional(),
  destinationPostal: z.string().max(20).optional(),
});

const ShippingBody = z.object({
  shippingAddress: Address,
  billingAddress: Address.optional(),
  shippingRateRef: z.string().min(1).max(255),
  shippingProviderSlug: z.string().min(1).max(63),
});

const PaymentBody = z.object({
  paymentProviderSlug: z.string().min(1).max(63),
  paymentRef: z.string().min(1).max(255),
  poNumber: z.string().max(63).optional(),
});

const CompleteBody = z.object({
  idempotencyKey: z.string().min(8).max(127).optional(),
});

// ── Cart serialization (marketplace-facing line shape) ───────────────────────────
//
// Modeled on the storefront's serializePublicCart: enrich each service line with
// the product handle + primary image + variant title so the cart UI can link and
// show a thumbnail without a second round-trip.

interface PublicMarketCartLine {
  id: string;
  variantId: string;
  productId: string;
  productHandle: string | null;
  title: string;
  variantTitle: string | null;
  sku: string;
  imageMediaId: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

function totalsView(t: {
  subtotalCents: number;
  discountTotalCents: number;
  shippingTotalCents: number;
  taxTotalCents: number;
  totalCents: number;
}) {
  return {
    subtotalCents: t.subtotalCents,
    discountTotalCents: t.discountTotalCents,
    shippingTotalCents: t.shippingTotalCents,
    taxTotalCents: t.taxTotalCents,
    totalCents: t.totalCents,
  };
}

async function serializePublicMarketCart(
  ctx: ServiceContext,
  tenantId: string,
  cartId: string
): Promise<{
  cartId: string;
  currency: string;
  items: PublicMarketCartLine[];
  appliedDiscountCodes: string[];
  totals: ReturnType<typeof totalsView>;
} | null> {
  const snapshot = await cartService.get(ctx, cartId);
  if (!snapshot) return null;

  const variantIds = snapshot.items.map((i) => i.variantId);
  const variants = variantIds.length
    ? await withTenant({ tenantId }, (tx) =>
        tx.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            title: true,
            product: {
              select: {
                handle: true,
                images: {
                  take: 1,
                  orderBy: { position: 'asc' },
                  select: { mediaAssetId: true },
                },
              },
            },
          },
        })
      )
    : [];
  const byVariant = new Map(variants.map((v) => [v.id, v]));

  const items: PublicMarketCartLine[] = snapshot.items.map((i) => {
    const v = byVariant.get(i.variantId);
    return {
      id: i.cartItemId,
      variantId: i.variantId,
      productId: i.productId,
      productHandle: v?.product.handle ?? null,
      title: i.name,
      variantTitle: v?.title ?? null,
      sku: i.sku,
      imageMediaId: v?.product.images[0]?.mediaAssetId ?? null,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      lineTotalCents: i.subtotalCents,
    };
  });

  return {
    cartId: snapshot.cartId,
    currency: snapshot.currency,
    items,
    appliedDiscountCodes: snapshot.appliedDiscountCodes,
    totals: totalsView(snapshot.totals),
  };
}

// Resolve the session → its cart, and assert the caller owns that cart.
async function assertSessionOwner(
  request: Parameters<typeof assertCartToken>[0],
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

// ── Order public view ────────────────────────────────────────────────────────────
//
// A login-free order-status view. Surfaces only what the buyer themselves entered
// or already knows — order number, status, totals, line items, and the ship-to
// city/region/country (never the full street address or contact PII).

function publicAddressView(
  value: unknown
): { city: string | null; region: string | null; country: string | null } | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const city = typeof o.city === 'string' ? o.city : null;
  const region = typeof o.region === 'string' ? o.region : null;
  const country =
    typeof o.country === 'string'
      ? o.country
      : typeof o.countryCode === 'string'
        ? o.countryCode
        : null;
  if (city === null && region === null && country === null) return null;
  return { city, region, country };
}

const publicMarketRoutes: FastifyPluginAsync = async (app) => {
  // ── Browse ─────────────────────────────────────────────────────────────────────

  app.get('/v1/public/market/products', async (request) => {
    const query = BrowseQuery.parse(request.query);
    const result = await marketService.browseListings(query);
    return ok(result);
  });

  app.get('/v1/public/market/products/:slug', async (request) => {
    const { slug } = SlugParam.parse(request.params);
    const detail = await marketService.getListingDetail(slug);
    if (!detail) throw notFound('Listing', slug);
    return ok(detail);
  });

  app.get('/v1/public/market/categories', () => {
    return ok({ categories: MARKET_CATEGORIES });
  });

  app.get('/v1/public/market/merchants', async (request) => {
    const query = MerchantsQuery.parse(request.query);
    const result = await marketService.listMerchants(query);
    return ok(result);
  });

  app.get('/v1/public/market/merchants/:slug', async (request) => {
    const { slug } = SlugParam.parse(request.params);
    const merchant = await marketService.getMerchant(slug);
    if (!merchant) throw notFound('Merchant', slug);
    const products = await marketService.browseListings({
      merchant: slug,
      perPage: 24,
      page: 1,
      sort: 'newest',
    });
    return ok({ merchant, products: products.items });
  });

  // ── Cart (single-merchant; seller tenant from ?merchant=) ────────────────────────

  // Create a guest cart on the seller's tenant. Returns the cart id + the guest
  // token the client must echo via x-cart-token on every later call. An initial
  // line item is optional — apps/market may create an empty cart, then add items.
  app.post('/v1/public/market/cart', async (request) => {
    const body = CreateCartBody.parse(request.body ?? undefined);
    const { tenantId, ctx } = await publicMarketContext(request);
    const token = randomUUID();
    const { cartId } = await cartService.create(ctx, {
      channel: 'sparx_market',
      currency: 'USD',
      guestToken: token,
    });
    if (body) {
      await cartService.addItem(ctx, {
        cartId,
        variantId: body.variantId,
        quantity: body.quantity,
      });
    }
    const cart = await serializePublicMarketCart(ctx, tenantId, cartId);
    return ok({ ...cart, token });
  });

  app.get('/v1/public/market/cart/:cartId', async (request) => {
    const { cartId } = CartParam.parse(request.params);
    const { tenantId, ctx } = await publicMarketContext(request);
    await assertCartToken(request, tenantId, cartId);
    const cart = await serializePublicMarketCart(ctx, tenantId, cartId);
    return ok(cart);
  });

  app.post('/v1/public/market/cart/:cartId/items', async (request) => {
    const { cartId } = CartParam.parse(request.params);
    const body = AddItemBody.parse(request.body);
    const { tenantId, ctx } = await publicMarketContext(request);
    await assertCartToken(request, tenantId, cartId);
    await cartService.addItem(ctx, { cartId, variantId: body.variantId, quantity: body.quantity });
    return ok(await serializePublicMarketCart(ctx, tenantId, cartId));
  });

  app.patch('/v1/public/market/cart/:cartId/items/:itemId', async (request) => {
    const { cartId, itemId } = ItemParam.parse(request.params);
    const body = UpdateItemBody.parse(request.body);
    const { tenantId, ctx } = await publicMarketContext(request);
    await assertCartToken(request, tenantId, cartId);
    await cartService.updateItem(ctx, { cartItemId: itemId, quantity: body.quantity });
    return ok(await serializePublicMarketCart(ctx, tenantId, cartId));
  });

  app.delete('/v1/public/market/cart/:cartId/items/:itemId', async (request) => {
    const { cartId, itemId } = ItemParam.parse(request.params);
    const { tenantId, ctx } = await publicMarketContext(request);
    await assertCartToken(request, tenantId, cartId);
    await cartService.removeItem(ctx, itemId);
    return ok(await serializePublicMarketCart(ctx, tenantId, cartId));
  });

  // ── Checkout (channel 'sparx_market' → platform MoR + settlement accrual) ─────────

  app.post('/v1/public/market/checkout', async (request) => {
    const body = StartBody.parse(request.body);
    const { tenantId, ctx } = await publicMarketContext(request);
    await assertCartToken(request, tenantId, body.cartId);
    const { sessionId } = await checkoutService.start(ctx, {
      cartId: body.cartId,
      channel: 'sparx_market',
      currency: 'USD',
      ...(body.email ? { customerEmail: body.email } : {}),
    });
    return ok({ sessionId });
  });

  app.get('/v1/public/market/checkout/:sessionId', async (request) => {
    const { sessionId } = SessionParam.parse(request.params);
    const { tenantId, ctx } = await publicMarketContext(request);
    await assertSessionOwner(request, tenantId, sessionId);
    return ok(await checkoutService.get(ctx, sessionId));
  });

  app.post('/v1/public/market/checkout/:sessionId/contact', async (request) => {
    const { sessionId } = SessionParam.parse(request.params);
    const body = ContactBody.parse(request.body);
    const { tenantId, ctx } = await publicMarketContext(request);
    await assertSessionOwner(request, tenantId, sessionId);
    await checkoutService.submitContact(ctx, {
      sessionId,
      email: body.email,
      ...(body.phone ? { phone: body.phone } : {}),
      acceptsMarketing: body.acceptsMarketing ?? false,
    });
    return ok(await checkoutService.get(ctx, sessionId));
  });

  app.post('/v1/public/market/checkout/:sessionId/shipping-quote', async (request) => {
    const { sessionId } = SessionParam.parse(request.params);
    const body = ShippingQuoteBody.parse(request.body ?? {});
    const { tenantId, ctx } = await publicMarketContext(request);
    const { cartId } = await assertSessionOwner(request, tenantId, sessionId);

    // Build a ShipmentRequest from the cart: one consolidated package summing
    // variant weights × quantity (nominal default when unset) plus the line
    // subtotal as declared value. The manual-rate matcher only reads
    // toAddress.country; the other address fields are required by the type but
    // unused for rate selection (the real ship-to is captured at the shipping
    // step), so the quote sends placeholders.
    const cart = await withTenant({ tenantId }, (tx) =>
      tx.cart.findFirst({
        where: { id: cartId },
        select: {
          currency: true,
          items: {
            select: {
              quantity: true,
              subtotalCents: true,
              variant: { select: { weightGrams: true } },
            },
          },
        },
      })
    );
    if (!cart) throw notFound('Cart', cartId);

    const totalWeight = cart.items.reduce(
      (sum, it) => sum + (it.variant.weightGrams ?? 500) * it.quantity,
      0
    );
    const totalValue = cart.items.reduce((sum, it) => sum + it.subtotalCents, 0);

    const placeholderAddress = { line1: '—', city: '—', country: 'US' };
    const rates = await shippingService.rateShipment(ctx, {
      fromAddress: placeholderAddress,
      toAddress: {
        line1: '—',
        city: '—',
        country: body.destinationCountry ?? 'US',
        ...(body.destinationPostal ? { postalCode: body.destinationPostal } : {}),
      },
      currency: cart.currency,
      signatureRequired: false,
      saturdayDelivery: false,
      packages: [
        {
          weight: totalWeight,
          dimensions: { lengthMm: 0, widthMm: 0, heightMm: 0 },
          containsHazmat: false,
          hazmatClass: 'none' as const,
          declaredValueCents: totalValue,
        },
      ],
    });

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

  app.post('/v1/public/market/checkout/:sessionId/shipping', async (request) => {
    const { sessionId } = SessionParam.parse(request.params);
    const body = ShippingBody.parse(request.body);
    const { tenantId, ctx } = await publicMarketContext(request);
    await assertSessionOwner(request, tenantId, sessionId);
    await checkoutService.submitShipping(ctx, {
      sessionId,
      shippingAddress: body.shippingAddress,
      ...(body.billingAddress ? { billingAddress: body.billingAddress } : {}),
      shippingRateRef: body.shippingRateRef,
      shippingProviderSlug: body.shippingProviderSlug,
    });
    return ok(await checkoutService.get(ctx, sessionId));
  });

  // Create the payment intent — sparx is MoR for sparx_market, so this routes to
  // the platform's MoR provider account; returns the clientSecret apps/market
  // confirms client-side.
  app.post('/v1/public/market/checkout/:sessionId/payment-intent', async (request) => {
    const { sessionId } = SessionParam.parse(request.params);
    const { tenantId, ctx } = await publicMarketContext(request);
    await assertSessionOwner(request, tenantId, sessionId);
    const intent = await checkoutService.createPaymentIntent(ctx, { sessionId });
    return ok({
      paymentRef: intent.paymentRef,
      providerSlug: intent.providerSlug,
      ...(intent.clientSecret ? { clientSecret: intent.clientSecret } : {}),
      amountCents: intent.amountCents,
      currency: intent.currency,
      status: intent.status,
    });
  });

  app.post('/v1/public/market/checkout/:sessionId/payment', async (request) => {
    const { sessionId } = SessionParam.parse(request.params);
    const body = PaymentBody.parse(request.body);
    const { tenantId, ctx } = await publicMarketContext(request);
    await assertSessionOwner(request, tenantId, sessionId);
    await checkoutService.submitPayment(ctx, {
      sessionId,
      paymentProviderSlug: body.paymentProviderSlug,
      paymentRef: body.paymentRef,
      ...(body.poNumber ? { poNumber: body.poNumber } : {}),
    });
    return ok(await checkoutService.get(ctx, sessionId));
  });

  // Finalize → creates the Order (records a sparx settlement accrual via the
  // sparx_market channel), decrements stock, fires order.placed.
  app.post('/v1/public/market/checkout/:sessionId/complete', async (request) => {
    const { sessionId } = SessionParam.parse(request.params);
    const body = CompleteBody.parse(request.body ?? {});
    const { tenantId, ctx } = await publicMarketContext(request);
    await assertSessionOwner(request, tenantId, sessionId);
    const result = await checkoutService.complete(ctx, {
      sessionId,
      idempotencyKey: body.idempotencyKey ?? randomUUID(),
    });
    return ok({ orderId: result.orderId, orderNumber: result.orderNumber });
  });

  // ── Order status (no login) ──────────────────────────────────────────────────────

  app.get('/v1/public/market/orders/:orderId', async (request) => {
    const { orderId } = OrderParam.parse(request.params);
    const { tenantId } = await publicMarketContext(request);
    const order = await withTenant({ tenantId }, (tx) =>
      tx.order.findFirst({
        where: { id: orderId },
        select: {
          orderNumber: true,
          status: true,
          paymentStatus: true,
          total: true,
          currency: true,
          placedAt: true,
          shippingAddress: true,
          items: {
            select: { name: true, quantity: true, lineTotal: true },
          },
        },
      })
    );
    if (!order) throw notFound('Order', orderId);

    return ok({
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalCents: Math.round(Number(order.total) * 100),
      currency: order.currency,
      placedAt: order.placedAt.toISOString(),
      items: order.items.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        lineTotalCents: Math.round(Number(it.lineTotal) * 100),
      })),
      shippingAddress: publicAddressView(order.shippingAddress),
    });
  });

  return Promise.resolve();
};

export default publicMarketRoutes;
