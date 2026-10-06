// B2B customer portal: buying again on a trade account (sparx persona issue 086).
//
// The /b2b page promised three things nothing delivered:
//   "From the catalog, the buyer builds a request (quantities, delivery needs,
//    notes) and submits it. It lands in your dashboard, separate from the cart."
//   "Saved carts & one-click reorder: Accounts keep named saved carts and
//    reorder a past order in a click."
//   Portal: "order history ... one-click reorder".
//
//   Quote request being built (one open per account, see b2b-quote-request-service):
//   GET    /v1/public/b2b/portal/:accountId/quote-request          → { request | null, shopName }
//   POST   /v1/public/b2b/portal/:accountId/quote-request/items    → add an item
//   PUT    /v1/public/b2b/portal/:accountId/quote-request          → save lines + details
//   DELETE /v1/public/b2b/portal/:accountId/quote-request          → throw it away
//   POST   /v1/public/b2b/portal/:accountId/quote-request/submit   → send it as a quote
//
//   One order, and Order again:
//   GET    /v1/public/b2b/portal/:accountId/orders/:orderId        → the order
//   POST   /v1/public/b2b/portal/:accountId/orders/:orderId/reorder { cartId }
//   POST   /v1/public/account/orders/:orderId/reorder               { cartId }
//
//   Saved carts:
//   GET    /v1/public/b2b/portal/:accountId/saved-carts
//   POST   /v1/public/b2b/portal/:accountId/saved-carts             { cartId, name }
//   PATCH  /v1/public/b2b/portal/:accountId/saved-carts/:id         { name }
//   DELETE /v1/public/b2b/portal/:accountId/saved-carts/:id
//   POST   /v1/public/b2b/portal/:accountId/saved-carts/:id/add-to-cart { cartId }
//
// GUARDS. A signed-in customer for this site, with an ACTIVE contact role on the
// account in the path (403 otherwise), exactly as the rest of the portal. Every
// route here that changes something also takes a website session: a connected
// app holds only `b2b:read` and may read, never write (lib/portal-writer.ts). Only a
// role that can place orders (primary contact, buyer) may build a request, use
// saved carts or order again; a viewer or approver reads. Every service call is
// scoped by that account id, so an id from another account finds nothing.
//
// Anything that writes to a cart also needs the cart's own token
// (`x-cart-token`), the same proof of ownership every cart write needs, and goes
// through `cartRefillService`, which adds each line through the ordinary
// add-to-cart: today's account price, the account's quantity rules and the
// stock check all apply, and each skipped line comes back with its reason.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import { approvalService } from '@wizeworks/b2b';
import { b2bQuoteRequestService, heldOrderMoney } from '@wizeworks/crm';
import { poNumberOf } from '@wizeworks/crm-schemas';
import {
  cartRefillService,
  cartService,
  CommerceNotFoundError,
  pricingService,
  savedCartService,
  type RefillLine,
} from '@wizeworks/commerce';
import { ok } from '@wizeworks/api-core/envelope';
import { ApiError, forbidden } from '@wizeworks/api-core/errors';
import { type CustomerAuthContext } from '@wizeworks/customer-auth';
import {
  assertCartTokenForWrite,
  publicCommerceContext,
  resolveTenantId,
} from '../../../lib/public-commerce-context.js';
import { requireCustomerId } from '../../../lib/customer-session.js';
import { requirePortalWriter } from '../../../lib/portal-writer.js';
import { accountPricer } from '../../../lib/portal-quote-prices.js';

const PathAccountId = z.object({ accountId: z.string().uuid() });
const PathAccountOrder = z.object({ accountId: z.string().uuid(), orderId: z.string().uuid() });
const PathAccountSavedCart = z.object({ accountId: z.string().uuid(), id: z.string().uuid() });
const PathOrder = z.object({ orderId: z.string().uuid() });
const CartBody = z.object({ cartId: z.string().uuid() });
const SaveCartBody = z.object({ cartId: z.string().uuid(), name: z.string().max(200) });
const RenameBody = z.object({ name: z.string().max(200) });

/** Roles that can place orders on an account, and so build a request, keep
 *  saved carts and order again (docs/64 §5.2). The same two that may submit or
 *  accept a quote. */
export const ORDERING_ROLES: ReadonlySet<string> = new Set(['primary_contact', 'buyer']);

export function canOrderOnAccount(role: string): boolean {
  return ORDERING_ROLES.has(role);
}

/** Whose orders a contact sees on an account: a viewer only their own, every
 *  other role the whole account's (the same rule as the portal's orders list). */
export function accountOrderCustomers(
  role: string,
  customerId: string,
  contactIds: readonly string[]
): string[] {
  return role === 'viewer' ? [customerId] : [...contactIds];
}

/** One order, only when one of `customerIds` placed it. */
export function portalOrderWhere(orderId: string, customerIds: readonly string[]) {
  return { id: orderId, customerId: { in: [...customerIds] } };
}

function requirePortalCustomer(request: FastifyRequest, ctx: CustomerAuthContext): Promise<string> {
  return requireCustomerId(request, ctx, 'b2b:read');
}

/** The customer's active role on THIS account, or 403. */
async function requireContactRole(
  ctx: CustomerAuthContext,
  customerId: string,
  accountId: string
): Promise<string> {
  const contact = await withTenant(ctx, (tx) =>
    tx.b2bAccountContact.findFirst({
      where: { customerId, accountId, isActive: true },
      select: { role: true },
    })
  );
  if (!contact) throw forbidden('You do not have access to this B2B account.');
  return contact.role;
}

function requireOrderingRole(role: string): void {
  if (!canOrderOnAccount(role)) {
    throw forbidden(
      'Your role on this account can see it but not order on it. A buyer or the primary contact can.'
    );
  }
}

/** The signed-in contact and their role on the account in the path. A route
 *  that changes something passes `write`, which refuses a connected app: its
 *  only B2B grant is `b2b:read` (lib/portal-writer.ts). */
async function portalContact(request: FastifyRequest, access: 'read' | 'write' = 'read') {
  const tenantId = await resolveTenantId(request);
  const ctx: CustomerAuthContext = { tenantId };
  const customerId =
    access === 'write'
      ? await requirePortalWriter(request, ctx)
      : await requirePortalCustomer(request, ctx);
  const { accountId } = PathAccountId.parse(request.params);
  const role = await requireContactRole(ctx, customerId, accountId);
  return { tenantId, ctx, customerId, accountId, role };
}

async function activeContactIds(ctx: CustomerAuthContext, accountId: string): Promise<string[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.b2bAccountContact.findMany({
      where: { accountId, isActive: true },
      select: { customerId: true },
    })
  );
  return rows.map((r) => r.customerId);
}

/**
 * Put `lines` into the caller's cart: proves the cart is theirs (its token),
 * links an anonymous cart to them first so every line prices at THEIR account
 * price (the same claim the add-to-cart route makes), then adds each line.
 */
async function refillOwnCart(
  request: FastifyRequest,
  customerId: string,
  cartId: string,
  lines: RefillLine[]
) {
  const { tenantId, ctx } = await publicCommerceContext(request);
  await assertCartTokenForWrite(request, ctx, tenantId, cartId);
  await cartService.claim(ctx, { cartId, customerId });
  return cartRefillService.refillCart(ctx, cartId, lines);
}

const notOnAccount = (what: string) => new ApiError('NOT_FOUND', `${what} is not on this account.`);

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const b2bPortalBuyingRoutes: FastifyPluginAsync = async (app) => {
  // ── The quote request being built ─────────────────────────────────────────
  // A role that cannot request quotes has no request to see: it reads null.
  // `shopName` is who the request goes to: a quote a buyer sends is issued by
  // the business's primary site, so its name is the one the buyer reads.
  app.get('/v1/public/b2b/portal/:accountId/quote-request', async (request) => {
    const { ctx, accountId, role } = await portalContact(request);
    const site = await withTenant(ctx, (tx) =>
      tx.property.findFirst({ where: { isPrimary: true }, select: { name: true } })
    );
    const named = site?.name.trim() ?? '';
    const shopName = named === '' ? null : named;
    if (!canOrderOnAccount(role)) return ok({ request: null, shopName });
    return ok({ request: await b2bQuoteRequestService.getOpen(ctx, accountId), shopName });
  });

  app.post('/v1/public/b2b/portal/:accountId/quote-request/items', async (request) => {
    const { ctx, accountId, customerId, role } = await portalContact(request, 'write');
    requireOrderingRole(role);
    const view = await b2bQuoteRequestService.addItem(
      ctx,
      { accountId, customerId },
      request.body ?? {}
    );
    return ok({ request: view });
  });

  app.put('/v1/public/b2b/portal/:accountId/quote-request', async (request) => {
    const { ctx, accountId, customerId, role } = await portalContact(request, 'write');
    requireOrderingRole(role);
    const view = await b2bQuoteRequestService.save(
      ctx,
      { accountId, customerId },
      request.body ?? {}
    );
    return ok({ request: view });
  });

  app.delete('/v1/public/b2b/portal/:accountId/quote-request', async (request) => {
    const { ctx, accountId, role } = await portalContact(request, 'write');
    requireOrderingRole(role);
    await b2bQuoteRequestService.discard(ctx, accountId);
    return ok({ discarded: true });
  });

  app.post('/v1/public/b2b/portal/:accountId/quote-request/submit', async (request, reply) => {
    const { ctx, accountId, customerId, role } = await portalContact(request, 'write');
    requireOrderingRole(role);
    // Each catalog line starts at this account's price (sparx persona issue 086).
    const quote = await b2bQuoteRequestService.submit(
      ctx,
      { accountId, customerId },
      { accountPrice: accountPricer(ctx, pricingService.resolveForAccount) }
    );
    reply.code(201);
    return ok(quote);
  });

  // ── One order on the account ──────────────────────────────────────────────
  app.get('/v1/public/b2b/portal/:accountId/orders/:orderId', async (request) => {
    const { ctx, accountId, customerId, role } = await portalContact(request);
    const { orderId } = PathAccountOrder.parse(request.params);
    const customers = accountOrderCustomers(
      role,
      customerId,
      await activeContactIds(ctx, accountId)
    );
    const order = await withTenant(ctx, (tx) =>
      tx.order.findFirst({
        where: portalOrderWhere(orderId, customers),
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          currency: true,
          placedAt: true,
          subtotal: true,
          discountTotal: true,
          shippingTotal: true,
          taxTotal: true,
          surchargeTotal: true,
          coreChargeTotal: true,
          total: true,
          metadata: true,
          customerId: true,
          propertyId: true,
          customer: { select: { firstName: true, lastName: true, email: true } },
          items: {
            select: {
              id: true,
              name: true,
              sku: true,
              quantity: true,
              unitPrice: true,
              lineSubtotal: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      })
    );
    if (!order) throw notOnAccount('That order');
    const cents = (v: unknown) => Math.round(Number(v) * 100);
    const who = order.customer;
    return ok({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      placedAt: order.placedAt.toISOString(),
      placedBy: who
        ? [who.firstName, who.lastName].filter(Boolean).join(' ').trim() || who.email
        : null,
      poNumber: poNumberOf(order.metadata),
      totals: {
        subtotalCents: cents(order.subtotal),
        discountCents: cents(order.discountTotal),
        shippingCents: cents(order.shippingTotal),
        taxCents: cents(order.taxTotal),
        surchargeCents: cents(order.surchargeTotal),
        coreDepositCents: cents(order.coreChargeTotal),
        totalCents: cents(order.total),
      },
      items: order.items.map((i) => ({
        id: i.id,
        name: i.name,
        sku: i.sku,
        quantity: i.quantity,
        unitPriceCents: cents(i.unitPrice),
        lineSubtotalCents: cents(i.lineSubtotal),
      })),
      // A held order says who it is waiting on, and whether the person looking
      // may approve it now (sparx persona issue 087). Null once it is decided.
      signOff: await approvalService.accountOrderSignOff(
        { tenantId: ctx.tenantId, customerId, accountId },
        {
          id: order.id,
          status: order.status,
          customerId: order.customerId,
          propertyId: order.propertyId,
          totalCents: cents(order.total),
          metadata: order.metadata,
        }
      ),
      // Approved, but the card held for it could not be charged, so it has gone
      // ahead unpaid (sparx persona issue 087).
      cardNotCharged: await withTenant(ctx, (tx) =>
        heldOrderMoney.approvedButNotCharged(tx, order)
      ),
    });
  });

  // Order again: the order's lines into the cart at TODAY's prices.
  app.post('/v1/public/b2b/portal/:accountId/orders/:orderId/reorder', async (request) => {
    const { ctx, accountId, customerId, role } = await portalContact(request, 'write');
    requireOrderingRole(role);
    const { orderId } = PathAccountOrder.parse(request.params);
    const { cartId } = CartBody.parse(request.body);
    const lines = await savedCartService.orderLinesFor(
      ctx,
      orderId,
      await activeContactIds(ctx, accountId)
    );
    if (!lines) throw notOnAccount('That order');
    return ok(await refillOwnCart(request, customerId, cartId, lines));
  });

  // The site's own order pages (Account, Orders) for a trade contact's OWN
  // order. Offered to a contact who can order on at least one account, the same
  // people the portal offers it to; a view-only contact is refused here as on
  // the account.
  app.post('/v1/public/account/orders/:orderId/reorder', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalWriter(request, ctx);
    const { orderId } = PathOrder.parse(request.params);
    const { cartId } = CartBody.parse(request.body);
    const roles = await withTenant(ctx, (tx) =>
      tx.b2bAccountContact.findMany({
        where: { customerId, isActive: true },
        select: { role: true },
      })
    );
    if (!roles.some((r) => canOrderOnAccount(r.role))) {
      throw forbidden('Order again is for wholesale buyers. Add the items from the shop instead.');
    }
    const lines = await savedCartService.orderLinesFor(ctx, orderId, [customerId]);
    if (!lines) throw new ApiError('NOT_FOUND', 'That order is not one of yours.');
    return ok(await refillOwnCart(request, customerId, cartId, lines));
  });

  // ── Saved carts ───────────────────────────────────────────────────────────
  app.get('/v1/public/b2b/portal/:accountId/saved-carts', async (request) => {
    const { ctx, accountId, role } = await portalContact(request);
    requireOrderingRole(role);
    return ok({ savedCarts: await savedCartService.list(ctx, accountId) });
  });

  app.post('/v1/public/b2b/portal/:accountId/saved-carts', async (request, reply) => {
    const { tenantId, ctx, accountId, customerId, role } = await portalContact(request, 'write');
    requireOrderingRole(role);
    const body = SaveCartBody.parse(request.body);
    // The cart must be the caller's own; its contents become the account's list.
    await assertCartTokenForWrite(request, ctx, tenantId, body.cartId);
    const saved = await savedCartService.saveFromCart(
      ctx,
      { accountId, customerId },
      { cartId: body.cartId, name: body.name }
    );
    reply.code(201);
    return ok(saved);
  });

  app.patch('/v1/public/b2b/portal/:accountId/saved-carts/:id', async (request) => {
    const { ctx, accountId, role } = await portalContact(request, 'write');
    requireOrderingRole(role);
    const { id } = PathAccountSavedCart.parse(request.params);
    const { name } = RenameBody.parse(request.body);
    try {
      await savedCartService.rename(ctx, accountId, id, name);
    } catch (err) {
      if (err instanceof CommerceNotFoundError) throw notOnAccount('That saved cart');
      throw err;
    }
    return ok({ id });
  });

  app.delete('/v1/public/b2b/portal/:accountId/saved-carts/:id', async (request) => {
    const { ctx, accountId, role } = await portalContact(request, 'write');
    requireOrderingRole(role);
    const { id } = PathAccountSavedCart.parse(request.params);
    try {
      await savedCartService.remove(ctx, accountId, id);
    } catch (err) {
      if (err instanceof CommerceNotFoundError) throw notOnAccount('That saved cart');
      throw err;
    }
    return ok({ id });
  });

  app.post('/v1/public/b2b/portal/:accountId/saved-carts/:id/add-to-cart', async (request) => {
    const { ctx, accountId, customerId, role } = await portalContact(request, 'write');
    requireOrderingRole(role);
    const { id } = PathAccountSavedCart.parse(request.params);
    const { cartId } = CartBody.parse(request.body);
    const lines = await savedCartService.linesFor(ctx, accountId, id);
    if (!lines) throw notOnAccount('That saved cart');
    return ok(await refillOwnCart(request, customerId, cartId, lines));
  });
};

export default b2bPortalBuyingRoutes;
