// Public cart write surface for the storefront.
//
//   POST   /v1/public/commerce/cart                       ?tenant=  → create (issues x-cart-token)
//   GET    /v1/public/commerce/cart/:cartId               ?tenant=
//   POST   /v1/public/commerce/cart/:cartId/items         ?tenant=  { variantId, quantity }
//   PATCH  /v1/public/commerce/cart/:cartId/items/:itemId ?tenant=  { quantity }
//   DELETE /v1/public/commerce/cart/:cartId/items/:itemId ?tenant=
//   POST   /v1/public/commerce/cart/:cartId/code          ?tenant=  { code }
//   POST   /v1/public/commerce/cart/:cartId/discount      ?tenant=  { code }  (older name)
//   DELETE /v1/public/commerce/cart/:cartId/discount/:code?tenant=
//   DELETE /v1/public/commerce/cart/:cartId/gift-card     ?tenant=
//
// A shopper has A CODE. She does not know, and should not have to know, whether
// what is printed on it is a discount or a gift card — so `/code` takes either
// and reports back which one it turned out to be. `/discount` is the older name
// for the same handler, kept so an existing client keeps working; both run the
// one implementation, so they cannot drift apart.
//
// Ownership: cart creation issues an opaque guest token returned in the body
// AND surfaced for the client to store; every later call must echo it via the
// `x-cart-token` header (assertCartToken). RLS scopes all reads to the tenant.
//
// Every WRITE goes through assertCartTokenForWrite, which also records that a
// shopper acting on a basket the abandonment sweep had marked quiet has come
// back. The GET stays a pure read - a basket still sitting in a browser tab is
// not somebody returning to buy it.
//
// A basket that has been bought answers 410 `CART_ALREADY_BOUGHT`, to the GET
// and to every write (the writes are refused in the cart service), and the
// site starts a fresh basket on it (sparx persona issue 087).

import { randomUUID } from 'node:crypto';

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  CommerceCartBoughtError,
  cartService,
  type CartAccountRules,
  type CartSnapshot,
  discountService,
  commerceSiteService,
  paymentMethodService,
  type ServiceContext,
} from '@wizeworks/commerce';
import { readRepeatOptions, RepeatCadence } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import { ok } from '@wizeworks/api-core/envelope';
import { badRequest } from '@wizeworks/api-core/errors';

import { optionalCustomer } from '../../../lib/customer-session.js';
import {
  assertCartToken,
  assertCartTokenForWrite,
  publicCommerceContext,
  resolveTenantId,
  toPublicCommerceContext,
} from '../../../lib/public-commerce-context.js';

const CartParam = z.object({ cartId: z.string().uuid() });
const ItemParam = z.object({ cartId: z.string().uuid(), itemId: z.string().uuid() });
const CodeParam = z.object({ cartId: z.string().uuid(), code: z.string().min(1).max(64) });
// Origin site (docs/58 D1): the storefront passes its active property SLUG on
// cart creation so the order placed from it inherits the site.
const CreateCartQuery = z.object({ property: z.string().optional() });

const AddItemBody = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(999).default(1),
  // Deliver this again on a schedule (issue 739). The service checks it is one
  // the product offers and that the shop can keep a card.
  repeat: RepeatCadence.optional(),
  // Send the old part first instead of paying the core deposit (issue 057). The
  // service checks the part offers it.
  coreFirst: z.boolean().optional(),
});
const UpdateItemBody = z.object({
  quantity: z.number().int().nonnegative().max(999),
  // A new schedule, or null to buy it once instead. Omitted leaves it alone.
  repeat: RepeatCadence.nullable().optional(),
  // Switch between paying the core deposit and sending the old part first.
  coreFirst: z.boolean().optional(),
});
const DiscountBody = z.object({ code: z.string().min(1).max(64) });

// Storefront-facing line shape: the service snapshot enriched with the product
// handle + primary image so the cart UI can link + show a thumbnail without a
// second round-trip.
interface PublicCartLine {
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
  /** Refundable core deposit per unit on a rebuilt part, on top of the price and
   *  not in `lineTotalCents`; null = no core (issue 051). */
  coreChargeCents: number | null;
  /** Bought by sending the old part first: no deposit, and it ships when the old
   *  part arrives (issue 057). */
  coreFirst: boolean;
  /** Present when the part can be bought either way, so the basket can offer the
   *  switch: the deposit per unit paying it would cost. Null otherwise. */
  coreChoice: { depositCents: number } | null;
  /** How often this line is delivered again; null = bought once (issue 739). */
  repeat: RepeatCadence | null;
  /** The schedules this line could be switched to, so the basket can offer a
   *  change without a trip back to the product. Empty when the product is
   *  bought once only or the shop cannot keep a card. */
  repeatOptions: RepeatCadence[];
}

async function serializePublicCart(
  ctx: ServiceContext,
  tenantId: string,
  cartId: string
): Promise<{
  cartId: string;
  currency: string;
  items: PublicCartLine[];
  appliedDiscountCodes: string[];
  appliedGiftCardCodes: string[];
  totals: ReturnType<typeof totalsView>;
  /** Made to order (issue 026) — the day the basket can be collected and how
   *  the money splits between now and then. Passed straight through from the
   *  cart service so the cart, the checkout and the gateway agree. */
  madeToOrder: CartSnapshot['madeToOrder'];
  /** A signed-in trade contact's account rules on this basket: whether they may
   *  order, each line's minimum, maximum and case pack, and any shortfall under
   *  the account's minimum order. Null for everyone else (sparx persona issue 086). */
  accountRules: CartAccountRules | null;
} | null> {
  const snapshot = await cartService.get(ctx, cartId);
  if (!snapshot) return null;

  // Enrich each line with handle + variant title + primary image in one query.
  const variantIds = snapshot.items.map((i) => i.variantId);
  const variants = variantIds.length
    ? await withTenant({ tenantId }, (tx) =>
        tx.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            title: true,
            // What the shopper actually PICKED. A variant's `title` is usually null on
            // a product sold by size and color, so a basket holding an S and an XL of
            // the same garment named both of them "Marlow Knit" and left a product code
            // as the only difference (issue 194). The option values are the words the
            // shopper chose from, in the product's own option order.
            optionAssignments: {
              select: {
                optionValue: {
                  select: {
                    value: true,
                    position: true,
                    option: { select: { position: true } },
                  },
                },
              },
            },
            product: {
              select: {
                handle: true,
                repeatOptions: true,
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

  /** "S · Moss" — the version in the shopper's words, or the variant's own title when
   *  it has one that is not just a repeat of the product name. */
  const variantWords = (v: (typeof variants)[number]): string | null => {
    const picked = [...v.optionAssignments]
      .sort(
        (a, b) =>
          a.optionValue.option.position - b.optionValue.option.position ||
          a.optionValue.position - b.optionValue.position
      )
      .map((row) => row.optionValue.value);
    if (picked.length > 0) return picked.join(' · ');
    return v.title;
  };

  // Whether this shop can keep a card at all. Without it no schedule is offered,
  // the same answer the product page gives.
  const canRepeat = await paymentMethodService.canSaveMethods(ctx);

  const items: PublicCartLine[] = snapshot.items.map((i) => {
    const v = byVariant.get(i.variantId);
    return {
      id: i.cartItemId,
      variantId: i.variantId,
      productId: i.productId,
      productHandle: v?.product.handle ?? null,
      title: i.name,
      variantTitle: v ? variantWords(v) : null,
      sku: i.sku,
      imageMediaId: v?.product.images[0]?.mediaAssetId ?? null,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      lineTotalCents: i.subtotalCents,
      coreChargeCents: i.coreChargeCents ?? null,
      coreFirst: i.coreFirst,
      coreChoice: i.coreChoice ?? null,
      repeat: i.repeat ?? null,
      repeatOptions: canRepeat && v ? readRepeatOptions(v.product.repeatOptions) : [],
    };
  });

  return {
    cartId: snapshot.cartId,
    currency: snapshot.currency,
    items,
    appliedDiscountCodes: snapshot.appliedDiscountCodes,
    // The card reserved against this basket. Without its code the storefront can
    // show the money coming off and nothing that says which card did it, and no
    // way to take it back off again.
    appliedGiftCardCodes: snapshot.appliedGiftCardCodes,
    totals: totalsView(snapshot.totals),
    madeToOrder: snapshot.madeToOrder,
    accountRules: snapshot.accountRules ?? null,
  };
}

function totalsView(t: {
  subtotalCents: number;
  discountTotalCents: number;
  shippingTotalCents: number;
  taxTotalCents: number;
  giftCardAppliedCents: number;
  accountCreditAppliedCents: number;
  coreChargeTotalCents: number;
  totalCents: number;
}) {
  return {
    subtotalCents: t.subtotalCents,
    discountTotalCents: t.discountTotalCents,
    shippingTotalCents: t.shippingTotalCents,
    taxTotalCents: t.taxTotalCents,
    // Both of these are already SUBTRACTED inside totalCents. Leaving them out
    // of the view is what makes a basket summary fail to add up on the page: the
    // rows a shopper can see sum to more than the total under them, and the
    // money that closed the gap has no name.
    giftCardAppliedCents: t.giftCardAppliedCents,
    accountCreditAppliedCents: t.accountCreditAppliedCents,
    // Inside totalCents too, and named for the same reason: refundable core
    // deposits on rebuilt parts (issue 051).
    coreChargeTotalCents: t.coreChargeTotalCents,
    totalCents: t.totalCents,
  };
}

// The cart's currency comes from its ORIGIN site's settings (docs/49 Phase 6b),
// inheriting the primary's when that site has no row of its own. When the cart
// isn't site-tagged (no `?property=`), fall back to the tenant's primary site.
async function defaultCurrency(tenantId: string, propertyId: string | null): Promise<string> {
  const row = await withTenant({ tenantId }, async (tx) => {
    const effective =
      propertyId ??
      (await tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } }))?.id;
    if (!effective) return null;
    return commerceSiteService.resolveSettingsRow(tx, tenantId, effective);
  });
  return row?.defaultCurrency ?? 'USD';
}

const publicCartRoutes: FastifyPluginAsync = async (app) => {
  // Create a guest cart. Returns the cart id + the guest token the client must
  // echo via x-cart-token on every later call.
  app.post('/v1/public/commerce/cart', async (request) => {
    const { tenantId, ctx } = await publicCommerceContext(request);
    // Resolve the origin site (docs/58 D1). The storefront identifies the PRIMARY
    // site by the ABSENCE of `?property=` — wizeworks/apps/site's resolveActivePropertySlug()
    // returns null for it — so "no slug" means "primary", not "unknown". Default to
    // primary accordingly, exactly as `defaultCurrency` below and checkout's
    // `ensureCheckoutCustomer` already do for the same reason. Leaving it null made
    // EVERY primary-site order site-less, which hid it from every site-scoped money
    // view: a paid order showed up as "No payments yet" in Finance → Payments
    // (BUG-004). A genuinely UNKNOWN slug still resolves to null rather than being
    // mis-tagged onto primary — that's the case the old comment was guarding.
    const { property } = CreateCartQuery.parse(request.query);
    const propertyId = await withTenant({ tenantId }, async (tx) => {
      if (property) {
        return (
          (await tx.property.findFirst({ where: { slug: property }, select: { id: true } }))?.id ??
          null
        );
      }
      return (
        (await tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } }))?.id ??
        null
      );
    });
    const token = randomUUID();
    const currency = await defaultCurrency(tenantId, propertyId);
    // A signed-in shopper's cart is linked to their customer record from the
    // start — this is what lets addItem resolve their B2B pricing (contract
    // price → price list → bulk tier) instead of always defaulting to retail.
    // A guestToken still rides along regardless, since ownership (x-cart-token)
    // is checked on every later call whether or not the cart is customer-linked.
    const customer = await optionalCustomer(request, { tenantId });
    const { cartId } = await cartService.create(ctx, {
      channel: 'storefront',
      currency,
      guestToken: token,
      ...(customer ? { customerId: customer.customerId } : {}),
      ...(propertyId ? { propertyId } : {}),
    });
    const cart = await serializePublicCart(ctx, tenantId, cartId);
    return ok({ ...cart, token });
  });

  app.get('/v1/public/commerce/cart/:cartId', async (request) => {
    const { cartId } = CartParam.parse(request.params);
    const { tenantId, ctx } = await publicCommerceContext(request);
    await assertCartToken(request, tenantId, cartId);
    // A bought basket is gone as far as the shopper is concerned: the site
    // forgets it and starts a fresh one, rather than showing what was already
    // ordered as if it could still be changed (sparx persona issue 087).
    await cartService.assertCartOpen(ctx, cartId);
    const cart = await serializePublicCart(ctx, tenantId, cartId);
    return ok(cart);
  });

  app.post('/v1/public/commerce/cart/:cartId/items', async (request) => {
    const { cartId } = CartParam.parse(request.params);
    const body = AddItemBody.parse(request.body);
    const { tenantId, ctx } = await publicCommerceContext(request);
    await assertCartTokenForWrite(request, ctx, tenantId, cartId);
    // Claim an anonymous cart the shopper started browsing before signing in —
    // a no-op once the cart is already linked (cartService.claim never
    // reassigns an existing link) — so the item this call adds prices off
    // their B2B membership rather than the stale anonymous default.
    const customer = await optionalCustomer(request, { tenantId });
    if (customer) await cartService.claim(ctx, { cartId, customerId: customer.customerId });
    await cartService.addItem(ctx, {
      cartId,
      variantId: body.variantId,
      quantity: body.quantity,
      ...(body.repeat ? { repeat: body.repeat } : {}),
      ...(body.coreFirst ? { coreFirst: true } : {}),
    });
    return ok(await serializePublicCart(ctx, tenantId, cartId));
  });

  app.patch('/v1/public/commerce/cart/:cartId/items/:itemId', async (request) => {
    const { cartId, itemId } = ItemParam.parse(request.params);
    const body = UpdateItemBody.parse(request.body);
    const { tenantId, ctx } = await publicCommerceContext(request);
    await assertCartTokenForWrite(request, ctx, tenantId, cartId);
    await cartService.updateItem(ctx, {
      cartItemId: itemId,
      // The line must be in the basket the token was checked against.
      cartId,
      quantity: body.quantity,
      ...(body.repeat !== undefined ? { repeat: body.repeat } : {}),
      ...(body.coreFirst !== undefined ? { coreFirst: body.coreFirst } : {}),
    });
    return ok(await serializePublicCart(ctx, tenantId, cartId));
  });

  app.delete('/v1/public/commerce/cart/:cartId/items/:itemId', async (request) => {
    const { cartId, itemId } = ItemParam.parse(request.params);
    const { tenantId, ctx } = await publicCommerceContext(request);
    await assertCartTokenForWrite(request, ctx, tenantId, cartId);
    await cartService.removeItem(ctx, itemId, cartId);
    return ok(await serializePublicCart(ctx, tenantId, cartId));
  });

  // One box, either kind of code.
  //
  // A shopper who is handed a gift card types its code into the only code box on
  // the page. That box used to be a discount box, so a live card came back "No
  // active discount for code …" and the money on it was unreachable — the whole
  // gift-card feature ended at that sentence. So: try the discount table, and
  // when the code is not one, try the cards before giving up.
  //
  // Order matters. A discount is checked FIRST because it is the cheaper thing
  // to be wrong about: an unknown discount code costs the shopper nothing, while
  // reserving the wrong gift card takes money off somebody's balance.
  const applyCode = async (request: FastifyRequest) => {
    const { cartId } = CartParam.parse(request.params);
    const body = DiscountBody.parse(request.body);
    const { tenantId, ctx } = await publicCommerceContext(request);
    await assertCartTokenForWrite(request, ctx, tenantId, cartId);

    let discountError: Error | null = null;
    try {
      await discountService.redeemCode(ctx, { cartId, code: body.code });
      return ok({ ...(await serializePublicCart(ctx, tenantId, cartId)), kind: 'discount' });
    } catch (err) {
      // A bought basket takes no code of either kind, and the site needs its
      // own code to start a fresh basket, not a "can't be applied".
      if (err instanceof CommerceCartBoughtError) throw err;
      discountError = err as Error;
    }

    try {
      const applied = await discountService.applyGiftCardToCart(ctx, {
        cartId,
        code: body.code,
      });
      return ok({
        ...(await serializePublicCart(ctx, tenantId, cartId)),
        kind: 'gift_card',
        giftCard: {
          code: applied.code,
          appliedCents: applied.appliedCents,
          remainingBalanceCents: applied.remainingBalanceCents,
        },
      });
    } catch {
      // The DISCOUNT failure is the one worth reporting. "No gift card with that
      // code" would be a confusing thing to tell somebody holding a mistyped
      // discount code, and the discount attempt is the one that ran first.
      throw badRequest(discountError?.message || 'That code can’t be applied.');
    }
  };

  app.post('/v1/public/commerce/cart/:cartId/code', applyCode);

  // The older name for the same handler. Kept working rather than broken; it
  // shares the implementation above so the two can never answer differently.
  app.post('/v1/public/commerce/cart/:cartId/discount', applyCode);

  app.delete('/v1/public/commerce/cart/:cartId/gift-card', async (request) => {
    const { cartId } = CartParam.parse(request.params);
    const { tenantId, ctx } = await publicCommerceContext(request);
    await assertCartTokenForWrite(request, ctx, tenantId, cartId);
    // Nothing has been debited yet — the card is only reserved until the order is
    // placed — so taking it off is the cart scalar and the trace entry, and the
    // balance is untouched either way.
    await discountService.removeGiftCardFromCart(ctx, { cartId });
    return ok(await serializePublicCart(ctx, tenantId, cartId));
  });

  app.delete('/v1/public/commerce/cart/:cartId/discount/:code', async (request) => {
    const { cartId, code } = CodeParam.parse(request.params);
    const { ctx, tenantId } = await publicCommerceContext(request);
    await assertCartTokenForWrite(request, ctx, tenantId, cartId);
    // Through the service, which puts the money back. Dropping the join row
    // here and trusting a "lazy recompute on the next read" left the saving on
    // the basket after the code came off — nothing recomputes on a read.
    await discountService.removeCode(ctx, { cartId, code });
    return ok(await serializePublicCart(ctx, tenantId, cartId));
  });

  return Promise.resolve();
};

// Re-export to keep the module's intent obvious where it's registered.
export { resolveTenantId, toPublicCommerceContext };
export default publicCartRoutes;
