// Public customer-account surface for the storefront (Layer 2 — shoppers).
// See docs/27 v2 — Layer 2 runs on a dedicated tenant-scoped Better Auth instance
// (@wizeworks/customer-auth). This route layer keeps its external contract unchanged
// (paths, envelopes, the sparx_customer_session cookie, enumeration-safety, rate
// limits, the docs/58 `recognized` signal, cart-claim) so wizeworks/apps/site is untouched.
//
//   POST   /v1/public/commerce/account/register ?tenant=  { email, password, firstName?, lastName? }
//   POST   /v1/public/commerce/account/login    ?tenant=  { email, password }
//   POST   /v1/public/commerce/account/logout   ?tenant=
//   GET    /v1/public/commerce/account/me        ?tenant=
//   PATCH  /v1/public/commerce/account/me        ?tenant=  { firstName?, lastName?, phone? }
//   POST   /v1/public/commerce/account/password/forgot ?tenant=  { email }
//   POST   /v1/public/commerce/account/password/reset  ?tenant=  { token, password }
//   GET    /v1/public/commerce/account/orders    ?tenant=  (paged, customer-scoped)
//   GET    /v1/public/commerce/account/orders/:orderId   (ownership-checked)
//   GET/POST/PATCH/DELETE /v1/public/commerce/account/addresses[/:addressId]
//   GET/POST/DELETE       /v1/public/commerce/account/wishlist[/:variantId]

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { isModuleEnabled } from '@wizeworks/auth';
import { cartService } from '@wizeworks/commerce';
import { orderService, orderFulfillmentsService } from '@wizeworks/crm';
import { withTenant } from '@wizeworks/db';
import {
  CustomerAuthError,
  ensureMembership,
  sendCustomerPasswordReset,
  resetCustomerPassword,
  signInCustomer,
  signOutCustomer,
  signUpCustomer,
  type CustomerAuthContext,
  type SessionMeta,
} from '@wizeworks/customer-auth';
import { ok, paged } from '@wizeworks/api-core/envelope';
import {
  conflict,
  moduleDisabled,
  notFound,
  unauthorized,
  validationError,
} from '@wizeworks/api-core/errors';

import { resolvePublicPropertyId } from '../../../lib/property.js';
import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { requireCustomerId, relaySetCookies } from '../../../lib/customer-session.js';

const RegisterBody = z.object({
  email: z.string().min(3).max(255),
  password: z.string().min(1).max(200),
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
});
const LoginBody = z.object({
  email: z.string().min(3).max(255),
  password: z.string().min(1).max(200),
});

const OrdersQuery = z.object({
  tenant: z.string(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
});
const OrderParam = z.object({ orderId: z.string().uuid() });
const AddressParam = z.object({ addressId: z.string().uuid() });

const AddressBody = z.object({
  type: z.enum(['shipping', 'billing', 'both']).default('shipping'),
  label: z.string().max(120).optional(),
  recipientName: z.string().max(255).optional(),
  company: z.string().max(255).optional(),
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).optional(),
  city: z.string().min(1).max(120),
  region: z.string().max(120).optional(),
  postalCode: z.string().max(32).optional(),
  country: z.string().length(2),
  phone: z.string().max(50).optional(),
  isDefault: z.boolean().optional(),
});
const ProfileBody = z.object({
  firstName: z.string().max(255).nullable().optional(),
  lastName: z.string().max(255).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
});

const ForgotBody = z.object({ email: z.string().min(3).max(255) });
const ResetBody = z.object({
  token: z.string().min(1).max(512),
  password: z.string().min(8).max(200),
});

// Wishlist items key on a variant (DB unique is (wishlistId, variantId)); the
// UI is product-centric, so responses also carry the parent productId.
const WishlistAddBody = z.object({ variantId: z.string().uuid() });
const WishlistParam = z.object({ variantId: z.string().uuid() });

// Tighter limits on the credential endpoints than the global rate-limit, to
// blunt credential-stuffing / reset-spam. Per-IP via @fastify/rate-limit.
const AUTH_RATE_LIMIT = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

/** CRM money columns are Decimal(12,2) dollars; the storefront speaks integer
 *  cents. Convert at the boundary. */
function toCents(value: unknown): number {
  return Math.round(Number(value) * 100);
}

interface CustomerProfile {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}

/**
 * Resolve the tenant and assert the Commerce module is active (404 otherwise).
 * These routes live under `/v1/public/commerce/account/*` for a reason — a
 * customer account is commerce/B2B infrastructure (cart claim, order history,
 * wishlist, the wholesale portal login), not a Builder feature. This
 * previously gated on `builder`, a leftover from when Builder was assumed
 * always-on; it 404'd registration/login entirely for any commerce-only or
 * B2B tenant that had deliberately left Builder off (b2b's own module
 * dependency graph already requires commerce, so this covers both).
 */
async function accountContext(request: FastifyRequest): Promise<CustomerAuthContext> {
  const tenantId = await resolveTenantId(request);
  if (!(await isModuleEnabled(tenantId, 'commerce'))) throw moduleDisabled('commerce');
  return { tenantId };
}

function sessionMeta(request: FastifyRequest): SessionMeta {
  const ua = request.headers['user-agent'];
  return { ipAddress: request.ip || null, userAgent: typeof ua === 'string' ? ua : null };
}

/** The active site for register/login (`?property=` or the tenant's primary). */
function activeProperty(request: FastifyRequest, tenantId: string): Promise<string | null> {
  return resolvePublicPropertyId(
    tenantId,
    (request.query as { property?: string }).property ?? null
  );
}

async function loadProfile(
  ctx: CustomerAuthContext,
  customerId: string
): Promise<CustomerProfile | null> {
  return withTenant(ctx, (tx) =>
    tx.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true },
    })
  );
}

/**
 * Reconcile the shopper's cart for a freshly-authenticated customer: merge
 * or claim their guest cart (`x-cart-token`) and re-price every line against
 * the now-known customer — so items added while anonymous pick up B2B
 * contract/price-list rates immediately, not just on the next new add
 * (cartService.reconcileCartOnAuth). Best-effort — never fail auth over the
 * cart. Returns a {cartId, guestToken} handoff when the client's cached cart
 * identity needs to change (a merge deletes the guest cart it had cached;
 * cart ownership is token-only — see assertCartToken — with no fallback to
 * "the signed-in customer owns this cart") — the caller MUST relay this to
 * the client so it can adopt the new cart instead of appearing empty.
 */
async function claimGuestCart(
  ctx: CustomerAuthContext,
  request: FastifyRequest,
  customerId: string
): Promise<cartService.CartHandoff | null> {
  const token = request.headers['x-cart-token'];
  try {
    return await cartService.reconcileCartOnAuth(ctx, {
      customerId,
      channel: 'storefront',
      ...(token && typeof token === 'string' ? { guestToken: token } : {}),
    });
  } catch {
    // Swallow — cart claiming is a convenience, not part of the auth contract.
    return null;
  }
}

const publicAccountRoutes: FastifyPluginAsync = async (app) => {
  app.post('/v1/public/commerce/account/register', AUTH_RATE_LIMIT, async (request, reply) => {
    const body = RegisterBody.parse(request.body);
    const ctx = await accountContext(request);
    const propertyId = await activeProperty(request, ctx.tenantId);
    let outcome;
    try {
      outcome = await signUpCustomer(ctx, body, sessionMeta(request));
    } catch (err) {
      if (err instanceof CustomerAuthError) {
        if (err.code === 'EMAIL_TAKEN') throw conflict(err.message);
        throw validationError(err.message);
      }
      throw err;
    }
    // Per-site membership (docs/58 D2). `recognized` (D6): true when a fresh
    // membership was created for a user who already had a login (on this or a
    // sister site) — the storefront surfaces a "separate account on this site" notice.
    const { customerId, created } = await ensureMembership(
      ctx,
      propertyId,
      outcome.userId,
      outcome.email,
      { firstName: body.firstName, lastName: body.lastName }
    );
    relaySetCookies(reply, outcome.setCookies);
    const cart = await claimGuestCart(ctx, request, customerId);
    return ok({
      customer: await loadProfile(ctx, customerId),
      recognized: outcome.userPreexisted && created,
      cart,
    });
  });

  app.post('/v1/public/commerce/account/login', AUTH_RATE_LIMIT, async (request, reply) => {
    const body = LoginBody.parse(request.body);
    const ctx = await accountContext(request);
    const propertyId = await activeProperty(request, ctx.tenantId);
    const outcome = await signInCustomer(ctx, body, sessionMeta(request));
    if (!outcome) throw unauthorized('Invalid email or password.');
    // Recognition (docs/58 D6): a first sign-in on this site creates a fresh
    // membership (created) because the account lived on a sister site until now.
    const { customerId, created } = await ensureMembership(
      ctx,
      propertyId,
      outcome.userId,
      outcome.email,
      {}
    );
    relaySetCookies(reply, outcome.setCookies);
    const cart = await claimGuestCart(ctx, request, customerId);
    return ok({ customer: await loadProfile(ctx, customerId), recognized: created, cart });
  });

  app.post('/v1/public/commerce/account/logout', async (request, reply) => {
    const ctx = await accountContext(request);
    // Better Auth emits the correctly-named clear-cookie (incl. any `__Secure-`
    // prefix in prod); relay it rather than clearing a fixed name ourselves.
    relaySetCookies(reply, await signOutCustomer(ctx, request.headers.cookie));
    return ok({ ok: true });
  });

  app.get('/v1/public/commerce/account/me', async (request) => {
    const ctx = await accountContext(request);
    const customerId = await requireCustomerId(request, ctx, 'account:read');
    const customer = await loadProfile(ctx, customerId);
    if (!customer) throw notFound('Customer', customerId);
    return ok({ customer });
  });

  app.patch('/v1/public/commerce/account/me', async (request) => {
    const body = ProfileBody.parse(request.body);
    const ctx = await accountContext(request);
    const customerId = await requireCustomerId(request, ctx, 'account:write');
    await withTenant(ctx, (tx) =>
      tx.customer.updateMany({
        where: { id: customerId, deletedAt: null },
        data: {
          ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
          ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
        },
      })
    );
    return ok({ customer: await loadProfile(ctx, customerId) });
  });

  // ── Password reset ──────────────────────────────────────────────────────
  // Enumeration-safe: forgot always returns 200; Better Auth only sends mail
  // (sendResetPassword → email.send) when the account exists.
  app.post('/v1/public/commerce/account/password/forgot', AUTH_RATE_LIMIT, async (request) => {
    const body = ForgotBody.parse(request.body);
    const ctx = await accountContext(request);
    await sendCustomerPasswordReset(ctx, body);
    return ok({ ok: true });
  });

  app.post('/v1/public/commerce/account/password/reset', AUTH_RATE_LIMIT, async (request) => {
    const body = ResetBody.parse(request.body);
    const ctx = await accountContext(request);
    const okReset = await resetCustomerPassword(ctx, body);
    if (!okReset) throw validationError('This reset link is invalid or has expired.');
    return ok({ ok: true });
  });

  // ── Orders ────────────────────────────────────────────────────────────
  app.get('/v1/public/commerce/account/orders', async (request) => {
    const { page, pageSize } = OrdersQuery.parse(request.query);
    const ctx = await accountContext(request);
    const customerId = await requireCustomerId(request, ctx, 'orders:read');
    const { items, total } = await orderService.list(ctx, {
      customerId,
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
    return paged(
      items.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        totalCents: toCents(o.total),
        currency: o.currency,
        placedAt: o.placedAt.toISOString(),
      })),
      { page, per_page: pageSize, total, total_pages: Math.ceil(total / pageSize) }
    );
  });

  app.get('/v1/public/commerce/account/orders/:orderId', async (request) => {
    const { orderId } = OrderParam.parse(request.params);
    const ctx = await accountContext(request);
    const customerId = await requireCustomerId(request, ctx, 'orders:read');
    const order = await orderService.get(ctx, orderId);
    // get() scopes to tenant, not customer — enforce ownership without leaking
    // existence of other customers' orders.
    if (order.customerId !== customerId) throw notFound('Order', orderId);
    // Shipments carry per-parcel tracking so the timeline can render a real
    // "track your package" link once a fulfillment ships.
    const fulfillments = await orderFulfillmentsService.listForOrder(ctx, orderId);
    return ok({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      placedAt: order.placedAt.toISOString(),
      // Lifecycle timestamps drive the order-status timeline. Nullable until the
      // order reaches each stage.
      paidAt: order.paidAt?.toISOString() ?? null,
      fulfilledAt: order.fulfilledAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
      subtotalCents: toCents(order.subtotal),
      taxTotalCents: toCents(order.taxTotal),
      shippingTotalCents: toCents(order.shippingTotal),
      discountTotalCents: toCents(order.discountTotal),
      totalCents: toCents(order.total),
      shippingAddress: order.shippingAddress ?? null,
      items: order.items.map((it) => ({
        id: it.id,
        name: it.name,
        sku: it.sku,
        quantity: it.quantity,
        unitPriceCents: toCents(it.unitPrice),
        lineTotalCents: toCents(it.lineTotal),
      })),
      fulfillments: fulfillments.map((f) => ({
        id: f.id,
        status: f.status,
        carrier: f.carrier,
        service: f.service,
        trackingNumber: f.trackingNumber,
        trackingUrl: f.trackingUrl,
        shippedAt: f.shippedAt?.toISOString() ?? null,
        deliveredAt: f.deliveredAt?.toISOString() ?? null,
      })),
    });
  });

  // ── Addresses ─────────────────────────────────────────────────────────
  app.get('/v1/public/commerce/account/addresses', async (request) => {
    const ctx = await accountContext(request);
    const customerId = await requireCustomerId(request, ctx, 'account:read');
    const addresses = await withTenant(ctx, (tx) =>
      tx.customerAddress.findMany({
        where: { customerId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      })
    );
    return ok({ addresses });
  });

  app.post('/v1/public/commerce/account/addresses', async (request) => {
    const body = AddressBody.parse(request.body);
    const ctx = await accountContext(request);
    const customerId = await requireCustomerId(request, ctx, 'account:write');
    const address = await withTenant(ctx, async (tx) => {
      if (body.isDefault) {
        await tx.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
      }
      return tx.customerAddress.create({
        data: { tenantId: ctx.tenantId, customerId, ...body, country: body.country.toUpperCase() },
      });
    });
    return ok({ address });
  });

  app.patch('/v1/public/commerce/account/addresses/:addressId', async (request) => {
    const { addressId } = AddressParam.parse(request.params);
    const body = AddressBody.partial().parse(request.body);
    const ctx = await accountContext(request);
    const customerId = await requireCustomerId(request, ctx, 'account:write');
    const updated = await withTenant(ctx, async (tx) => {
      const owned = await tx.customerAddress.findFirst({
        where: { id: addressId, customerId },
        select: { id: true },
      });
      if (!owned) return null;
      if (body.isDefault) {
        await tx.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
      }
      return tx.customerAddress.update({
        where: { id: addressId },
        data: { ...body, ...(body.country ? { country: body.country.toUpperCase() } : {}) },
      });
    });
    if (!updated) throw notFound('Address', addressId);
    return ok({ address: updated });
  });

  app.delete('/v1/public/commerce/account/addresses/:addressId', async (request) => {
    const { addressId } = AddressParam.parse(request.params);
    const ctx = await accountContext(request);
    const customerId = await requireCustomerId(request, ctx, 'account:write');
    await withTenant(ctx, (tx) =>
      tx.customerAddress.deleteMany({ where: { id: addressId, customerId } })
    );
    return ok({ ok: true });
  });

  // ── Wishlist (variant-keyed; responses carry the parent product) ────────
  app.get('/v1/public/commerce/account/wishlist', async (request) => {
    const ctx = await accountContext(request);
    const customerId = await requireCustomerId(request, ctx, 'account:read');
    // Read the list for THIS storefront (docs/131 §4) — must match the site the
    // POST scopes to, or the shopper's saved items appear to vanish when viewed.
    const propertyId = await activeProperty(request, ctx.tenantId);
    const items = await withTenant(ctx, async (tx) => {
      const wishlist = await tx.wishlist.findFirst({
        where: { customerId, propertyId },
        orderBy: { createdAt: 'asc' },
        select: {
          items: { orderBy: { createdAt: 'desc' }, select: { variantId: true } },
        },
      });
      const variantIds = wishlist?.items.map((i) => i.variantId) ?? [];
      if (variantIds.length === 0) return [];
      // WishlistItem.variantId is a bare column (no relation) — resolve the
      // variants + their product in one query, then preserve wishlist order.
      const variants = await tx.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          priceCents: true,
          product: {
            select: {
              id: true,
              handle: true,
              title: true,
              images: { take: 1, orderBy: { position: 'asc' }, select: { mediaAssetId: true } },
            },
          },
        },
      });
      const byId = new Map(variants.map((v) => [v.id, v]));
      return variantIds.flatMap((vid) => {
        const v = byId.get(vid);
        if (!v) return [];
        return [
          {
            variantId: vid,
            productId: v.product.id,
            handle: v.product.handle,
            title: v.product.title,
            imageMediaId: v.product.images[0]?.mediaAssetId ?? null,
            priceCents: v.priceCents,
          },
        ];
      });
    });
    return ok({ items });
  });

  app.post('/v1/public/commerce/account/wishlist', async (request) => {
    const body = WishlistAddBody.parse(request.body);
    const ctx = await accountContext(request);
    const customerId = await requireCustomerId(request, ctx, 'account:write');
    // A shopper's saved items belong to the storefront they were browsing
    // (docs/131 §4): the donut-site list and the parts-site list are separate.
    // Scoping the find AND the create by site is what keeps them apart.
    const propertyId = await activeProperty(request, ctx.tenantId);
    await withTenant(ctx, async (tx) => {
      let wishlist = await tx.wishlist.findFirst({
        where: { customerId, propertyId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      wishlist ??= await tx.wishlist.create({
        data: { tenantId: ctx.tenantId, customerId, propertyId },
        select: { id: true },
      });
      // Unique (wishlistId, variantId) — skip if already saved.
      const existing = await tx.wishlistItem.findFirst({
        where: { wishlistId: wishlist.id, variantId: body.variantId },
        select: { id: true },
      });
      if (!existing) {
        await tx.wishlistItem.create({
          data: { tenantId: ctx.tenantId, wishlistId: wishlist.id, variantId: body.variantId },
        });
      }
    });
    return ok({ ok: true });
  });

  app.delete('/v1/public/commerce/account/wishlist/:variantId', async (request) => {
    const { variantId } = WishlistParam.parse(request.params);
    const ctx = await accountContext(request);
    const customerId = await requireCustomerId(request, ctx, 'account:write');
    // Remove from THIS storefront's list (docs/131 §4) — without the site filter,
    // removing an item on one site would also pull it from the other's list when
    // the same variant is saved on both.
    const propertyId = await activeProperty(request, ctx.tenantId);
    await withTenant(ctx, (tx) =>
      tx.wishlistItem.deleteMany({
        where: { variantId, wishlist: { customerId, propertyId } },
      })
    );
    return ok({ ok: true });
  });

  return Promise.resolve();
};

export default publicAccountRoutes;
