// cartService — cart CRUD + line management + merge + abandonment.
//
// Storefront and B2B portal write through this service; never directly
// to Prisma. Every mutation goes through:
//
//   1. Validate input via @sparx/commerce-schemas
//   2. withTenant() transaction with RLS context
//   3. writeAuditLog inside the same transaction
//   4. Recompute cached totals on the cart row
//   5. (post-commit) publish a cart.* event
//
// Pricing math defers to pricingService.resolve(); discount + gift-card
// + account-credit application defers to discountService. This file is the
// orchestrator only.

import {
  AddCartItemInput,
  type CartItemSnapshot,
  type CartTotals,
  type CartItemAttributes,
  type ResolvedConfiguration,
  CreateCartInput,
  MergeCartsInput,
  UpdateCartItemInput,
} from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { Prisma, TxClient } from '@sparx/db';
import { inventoryService } from '@sparx/inventory';

import { writeAuditLog } from '../audit';
import { CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';
import { isInventoryActive } from '../inventory-gate';

import * as configuratorService from './configurator-service';
import * as pricingService from './pricing-service';
import { CUSTOMER_NAME_SELECT, customerDisplayName } from './customer-name';

const DEFAULT_CART_TTL_MIN = 60 * 24 * 14; // 14 days

export interface CartSnapshot {
  cartId: string;
  customerId: string | null;
  customerName: string | null;
  channel: string;
  currency: string;
  items: CartItemSnapshot[];
  appliedDiscountCodes: string[];
  appliedGiftCardCodes: string[];
  accountCreditAppliedCents: number;
  totals: CartTotals;
  expiresAt: string;
  abandonedAt: string | null;
}

// ─── create ──────────────────────────────────────────────────────────

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<{ cartId: string }> {
  const input = CreateCartInput.parse(rawInput);
  if (!input.customerId && !input.guestToken) {
    throw new CommerceValidationError('Either customerId or guestToken is required');
  }

  const result = await withTenant(ctx, async (tx) => {
    const expiresAt = new Date(Date.now() + DEFAULT_CART_TTL_MIN * 60_000);
    const cart = await tx.cart.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: input.customerId ?? null,
        guestToken: input.guestToken ?? null,
        channel: input.channel,
        currency: input.currency,
        // Origin site (docs/58 D1) — carried onto the order at checkout.
        propertyId: input.propertyId ?? null,
        fromDocumentId: input.fromDocumentId ?? null,
        fromSubscriptionId: input.fromSubscriptionId ?? null,
        expiresAt,
      },
      select: { id: true },
    });

    // Bootstrap lines from an accepted quote when carried over (B2B path).
    if (input.fromDocumentId) {
      await bootstrapFromDocument(tx, ctx, cart.id, input.fromDocumentId);
      await recomputeTotals(tx, ctx, cart.id);
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.cart.created',
      entityType: 'Cart',
      entityId: cart.id,
      diff: { after: { channel: input.channel, currency: input.currency } },
    });

    return cart.id;
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'cart.created',
    data: { cartId: result, channel: input.channel, currency: input.currency },
  });

  return { cartId: result };
}

// ─── reads ───────────────────────────────────────────────────────────

export async function get(ctx: ServiceContext, cartId: string): Promise<CartSnapshot | null> {
  return withTenant(ctx, async (tx) => {
    const row = await loadCart(tx, cartId);
    return row ? serializeCart(row) : null;
  });
}

export async function getByGuestToken(
  ctx: ServiceContext,
  guestToken: string
): Promise<CartSnapshot | null> {
  return withTenant(ctx, async (tx) => {
    const cart = await tx.cart.findFirst({
      where: { guestToken, abandonedAt: null, customerId: null },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (!cart) return null;
    const full = await loadCart(tx, cart.id);
    return full ? serializeCart(full) : null;
  });
}

// ─── line items ──────────────────────────────────────────────────────

export async function addItem(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ cartItemId: string }> {
  const input = AddCartItemInput.parse(rawInput);
  const inventoryActive = await isInventoryActive(ctx.tenantId);

  const cartItemId = await withTenant(ctx, async (tx) => {
    const cart = await tx.cart.findFirst({
      where: { id: input.cartId, abandonedAt: null },
      select: {
        id: true,
        channel: true,
        currency: true,
        customerId: true,
        customer: { select: { b2bAccountId: true } },
      },
    });
    if (!cart) throw new CommerceNotFoundError('Cart', input.cartId);

    let variantId = input.variantId;
    let resolvedConfig: ResolvedConfiguration | null = null;
    let configurationPayload: Prisma.InputJsonValue | undefined;

    if (input.configuration) {
      // Re-resolve through the configurator engine so we trust the
      // server's view of price + add-ons, never the client's payload.
      const resolved = await configuratorService.resolve(ctx, {
        templateId: input.configuration.templateId,
        selections: input.configuration.selections,
      });
      if (resolved.errors.length > 0) {
        throw new CommerceValidationError(
          `Configurator rejected the selection: ${resolved.errors.join('; ')}`
        );
      }
      resolvedConfig = resolved;
      if (resolved.resolvedVariantId) {
        variantId = resolved.resolvedVariantId;
      }
      configurationPayload = {
        templateId: resolved.templateId,
        resolvedSku: resolved.resolvedSku,
        resolvedVariantId: resolved.resolvedVariantId,
        resolvedComponentVariantIds: resolved.resolvedComponentVariantIds,
        addOnLines: resolved.addOnLines,
        basePriceCents: resolved.basePriceCents,
        totalAdjustmentCents: resolved.totalAdjustmentCents,
        selectionsEcho: input.configuration.selections,
      };
    }

    const priced = await pricingService.resolve(ctx, {
      variantId,
      quantity: input.quantity,
      channel: cart.channel as 'storefront' | 'b2b_portal' | 'admin' | 'subscription',
      currency: cart.currency,
      customerId: cart.customerId ?? undefined,
      b2bAccountId: cart.customer?.b2bAccountId ?? undefined,
      customerSegmentIds: [],
    });

    // Configurator price adjustments are layered on top of the resolved
    // base variant price. We trust the configurator's adjustment because
    // its rule engine already validated against the option matrix.
    let unitPriceCents = priced.unitPriceCents;
    if (resolvedConfig) {
      unitPriceCents = Math.max(0, unitPriceCents + resolvedConfig.totalAdjustmentCents);
    }
    const subtotalCents = unitPriceCents * input.quantity;

    const item = await tx.cartItem.create({
      data: {
        tenantId: ctx.tenantId,
        cartId: input.cartId,
        variantId,
        quantity: input.quantity,
        unitPriceCents,
        subtotalCents,
        ...(configurationPayload ? { configurationPayload } : {}),
        attributes: serializeAttributes(input.attributes),
        unitPriceTrace: priced.trace,
      },
      select: { id: true },
    });

    // Soft-hold the stock against this line (docs/100 §2.4). Atomic with the
    // line write: a `deny`-policy shortfall throws InventoryOutOfStockError and
    // rolls the whole add back, so a customer can never add more than is
    // available. No-op when inventory is off (untracked = always available) OR
    // the variant is dropship-sourced — the supplier holds the stock, so
    // reserving against a local warehouse would auto-vivify a phantom
    // inventory_levels row for a product the warehouse never actually carries.
    const isDropshipVariant = Boolean(
      (
        await tx.productVariant.findFirst({
          where: { id: variantId },
          select: { dropshipSourceId: true },
        })
      )?.dropshipSourceId
    );
    if (inventoryActive && !isDropshipVariant) {
      const hold = await inventoryService.reserveOnTx(tx, ctx, {
        variantId,
        quantity: input.quantity,
        holderType: 'cart',
        holderId: input.cartId,
      });
      await tx.cartItem.update({
        where: { id: item.id },
        data: { inventoryReservationId: hold.reservationId },
      });
    }

    await recomputeTotals(tx, ctx, input.cartId);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'customer',
      action: 'commerce.cart.item_added',
      entityType: 'Cart',
      entityId: input.cartId,
      diff: { after: { cartItemId: item.id, variantId, quantity: input.quantity } },
    });

    return item.id;
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'cart.updated',
    data: { cartId: input.cartId, reason: 'item_added', cartItemId },
  });

  return { cartItemId };
}

export async function updateItem(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = UpdateCartItemInput.parse(rawInput);
  const inventoryActive = await isInventoryActive(ctx.tenantId);

  const cartId = await withTenant(ctx, async (tx) => {
    const item = await tx.cartItem.findFirst({
      where: { id: input.cartItemId },
      select: {
        id: true,
        cartId: true,
        variantId: true,
        unitPriceCents: true,
        quantity: true,
        inventoryReservationId: true,
        variant: { select: { dropshipSourceId: true } },
      },
    });
    if (!item) throw new CommerceNotFoundError('CartItem', input.cartItemId);
    const isDropshipVariant = Boolean(item.variant.dropshipSourceId);

    if (input.quantity === 0) {
      // Remove — release the soft hold first, then drop the line.
      if (inventoryActive && item.inventoryReservationId) {
        await inventoryService.releaseOnTx(tx, ctx, item.inventoryReservationId);
      }
      await tx.cartItem.delete({ where: { id: input.cartItemId } });
    } else {
      // Re-hold on a quantity change: release the prior hold and reserve the new
      // quantity (a `deny` shortfall throws and rolls back the increase). When
      // the quantity is unchanged the existing hold stands. Skipped for
      // dropship-sourced variants (see addItem) — never had a hold to begin with.
      let reservationId = item.inventoryReservationId;
      if (inventoryActive && !isDropshipVariant && item.quantity !== input.quantity) {
        if (item.inventoryReservationId) {
          await inventoryService.releaseOnTx(tx, ctx, item.inventoryReservationId);
        }
        const hold = await inventoryService.reserveOnTx(tx, ctx, {
          variantId: item.variantId,
          quantity: input.quantity,
          holderType: 'cart',
          holderId: item.cartId,
        });
        reservationId = hold.reservationId;
      }
      await tx.cartItem.update({
        where: { id: input.cartItemId },
        data: {
          quantity: input.quantity,
          subtotalCents: item.unitPriceCents * input.quantity,
          ...(input.attributes ? { attributes: serializeAttributes(input.attributes) } : {}),
          ...(reservationId !== item.inventoryReservationId
            ? { inventoryReservationId: reservationId }
            : {}),
        },
      });
    }

    await recomputeTotals(tx, ctx, item.cartId);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'customer',
      action: input.quantity === 0 ? 'commerce.cart.item_removed' : 'commerce.cart.item_updated',
      entityType: 'Cart',
      entityId: item.cartId,
      diff: { after: { cartItemId: input.cartItemId, quantity: input.quantity } },
    });

    return item.cartId;
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'cart.updated',
    data: { cartId, reason: 'item_updated', cartItemId: input.cartItemId },
  });
}

export async function removeItem(ctx: ServiceContext, cartItemId: string): Promise<void> {
  await updateItem(ctx, { cartItemId, quantity: 0 });
}

export async function clear(ctx: ServiceContext, cartId: string): Promise<void> {
  const inventoryActive = await isInventoryActive(ctx.tenantId);
  await withTenant(ctx, async (tx) => {
    const cart = await tx.cart.findFirst({ where: { id: cartId }, select: { id: true } });
    if (!cart) throw new CommerceNotFoundError('Cart', cartId);
    // Release each line's soft hold before dropping the lines, so cleared carts
    // don't leak `allocated` until their TTL expires.
    if (inventoryActive) {
      const held = await tx.cartItem.findMany({
        where: { cartId, inventoryReservationId: { not: null } },
        select: { inventoryReservationId: true },
      });
      for (const h of held) {
        if (h.inventoryReservationId) {
          await inventoryService.releaseOnTx(tx, ctx, h.inventoryReservationId);
        }
      }
    }
    await tx.cartItem.deleteMany({ where: { cartId } });
    await tx.cartDiscount.deleteMany({ where: { cartId } });
    await tx.cart.update({
      where: { id: cartId },
      data: {
        subtotalCents: 0,
        discountTotalCents: 0,
        shippingTotalCents: 0,
        taxTotalCents: 0,
        giftCardAppliedCents: 0,
        accountCreditAppliedCents: 0,
        totalCents: 0,
        pricingTrace: {},
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'customer',
      action: 'commerce.cart.cleared',
      entityType: 'Cart',
      entityId: cartId,
      diff: null,
    });
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'cart.updated',
    data: { cartId, reason: 'cleared' },
  });
}

// ─── merge ───────────────────────────────────────────────────────────

export async function merge(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ mergedCartId: string }> {
  const input = MergeCartsInput.parse(rawInput);
  if (input.sourceCartId === input.targetCartId) {
    throw new CommerceValidationError('sourceCartId and targetCartId must differ');
  }
  const inventoryActive = await isInventoryActive(ctx.tenantId);

  await withTenant(ctx, async (tx) => {
    const [source, target] = await Promise.all([
      tx.cart.findFirst({
        where: { id: input.sourceCartId },
        include: { items: true },
      }),
      tx.cart.findFirst({
        where: { id: input.targetCartId },
        include: { items: true },
      }),
    ]);
    if (!source) throw new CommerceNotFoundError('Cart', input.sourceCartId);
    if (!target) throw new CommerceNotFoundError('Cart', input.targetCartId);
    if (source.currency !== target.currency) {
      throw new CommerceValidationError(
        `Cannot merge carts in different currencies (${source.currency} vs ${target.currency})`
      );
    }

    const targetByVariant = new Map(target.items.map((it) => [it.variantId, it]));

    for (const srcItem of source.items) {
      const existing = targetByVariant.get(srcItem.variantId);
      if (!existing) {
        await tx.cartItem.create({
          data: {
            tenantId: ctx.tenantId,
            cartId: target.id,
            variantId: srcItem.variantId,
            quantity: srcItem.quantity,
            unitPriceCents: srcItem.unitPriceCents,
            subtotalCents: srcItem.subtotalCents,
            ...(srcItem.configurationPayload !== null
              ? {
                  configurationPayload: srcItem.configurationPayload,
                }
              : {}),
            attributes: srcItem.attributes as Prisma.InputJsonValue,
            unitPriceTrace: srcItem.unitPriceTrace as Prisma.InputJsonValue,
          },
        });
        continue;
      }
      let nextQty = existing.quantity;
      if (input.conflictPolicy === 'sum_quantities') nextQty = existing.quantity + srcItem.quantity;
      else if (input.conflictPolicy === 'prefer_source') nextQty = srcItem.quantity;
      // 'prefer_target' keeps existing.quantity unchanged.
      await tx.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: nextQty,
          subtotalCents: existing.unitPriceCents * nextQty,
        },
      });
    }

    // Source cart's items moved; release their soft holds (the merged target
    // lines carry no hold — checkout decrements no-hold lines directly) so the
    // deleted source cart doesn't leak `allocated`, then delete the source so
    // future lookups can't re-merge it.
    if (inventoryActive) {
      for (const srcItem of source.items) {
        if (srcItem.inventoryReservationId) {
          await inventoryService.releaseOnTx(tx, ctx, srcItem.inventoryReservationId);
        }
      }
    }
    await tx.cartItem.deleteMany({ where: { cartId: source.id } });
    await tx.cartDiscount.deleteMany({ where: { cartId: source.id } });
    await tx.cart.delete({ where: { id: source.id } });

    await recomputeTotals(tx, ctx, target.id);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.cart.merged',
      entityType: 'Cart',
      entityId: target.id,
      diff: {
        after: {
          sourceCartId: source.id,
          conflictPolicy: input.conflictPolicy,
          itemsMoved: source.items.length,
        },
      },
    });
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'cart.updated',
    data: { cartId: input.targetCartId, reason: 'merged', sourceCartId: input.sourceCartId },
  });

  return { mergedCartId: input.targetCartId };
}

// ─── abandonment lifecycle ───────────────────────────────────────────

export async function markAbandoned(ctx: ServiceContext, cartId: string): Promise<void> {
  const now = new Date();
  await withTenant(ctx, async (tx) => {
    const cart = await tx.cart.findFirst({
      where: { id: cartId, abandonedAt: null },
      select: { id: true },
    });
    if (!cart) return;
    await tx.cart.update({ where: { id: cartId }, data: { abandonedAt: now } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'system',
      action: 'commerce.cart.abandoned',
      entityType: 'Cart',
      entityId: cartId,
      diff: null,
    });
  });
  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'cart.abandoned',
    data: { cartId, abandonedAt: now.toISOString() },
  });
}

export async function markRecovered(ctx: ServiceContext, cartId: string): Promise<void> {
  const now = new Date();
  await withTenant(ctx, async (tx) => {
    const cart = await tx.cart.findFirst({
      where: { id: cartId },
      select: { id: true, abandonedAt: true },
    });
    if (!cart?.abandonedAt) return;
    await tx.cart.update({
      where: { id: cartId },
      data: { recoveredAt: now, abandonedAt: null },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'customer',
      action: 'commerce.cart.recovered',
      entityType: 'Cart',
      entityId: cartId,
      diff: null,
    });
  });
  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'cart.recovered',
    data: { cartId, recoveredAt: now.toISOString() },
  });
}

/** Worker sweep — returns cart ids that have been idle longer than
 *  `cutoffMinutes` and are eligible to be marked abandoned. */
export async function findIdleCarts(ctx: ServiceContext, cutoffMinutes: number): Promise<string[]> {
  if (cutoffMinutes <= 0) return [];
  const cutoff = new Date(Date.now() - cutoffMinutes * 60_000);
  return withTenant(ctx, async (tx) => {
    const rows = await tx.cart.findMany({
      where: {
        abandonedAt: null,
        recoveredAt: null,
        updatedAt: { lt: cutoff },
        items: { some: {} },
      },
      orderBy: { updatedAt: 'asc' },
      take: 500,
      select: { id: true },
    });
    return rows.map((r) => r.id);
  });
}

// ─── helpers ─────────────────────────────────────────────────────────

type CartWithRelations = Prisma.CartGetPayload<{
  include: {
    items: { include: { variant: { include: { product: true } } } };
    discounts: { include: { discount: { select: { code: true } } } };
    customer: { select: typeof CUSTOMER_NAME_SELECT };
  };
}>;

async function loadCart(tx: TxClient, cartId: string): Promise<CartWithRelations | null> {
  return tx.cart.findFirst({
    where: { id: cartId },
    include: {
      items: { include: { variant: { include: { product: true } } } },
      discounts: { include: { discount: { select: { code: true } } } },
      customer: { select: CUSTOMER_NAME_SELECT },
    },
  });
}

async function recomputeTotals(tx: TxClient, _ctx: ServiceContext, cartId: string): Promise<void> {
  const items = await tx.cartItem.findMany({
    where: { cartId },
    select: { subtotalCents: true },
  });
  const subtotal = items.reduce((sum, i) => sum + i.subtotalCents, 0);

  const discounts = await tx.cartDiscount.findMany({
    where: { cartId },
    select: { appliedCents: true },
  });
  const discountTotal = discounts.reduce((sum, d) => sum + d.appliedCents, 0);

  // Gift card + account credit applied amounts are owned by the discount
  // service; we only re-cap them against the new subtotal so a cart
  // shrink can't leave an over-applied balance dangling.
  const current = await tx.cart.findFirstOrThrow({
    where: { id: cartId },
    select: {
      giftCardAppliedCents: true,
      accountCreditAppliedCents: true,
      shippingTotalCents: true,
      taxTotalCents: true,
    },
  });

  const postDiscount = Math.max(0, subtotal - discountTotal);
  const giftCardApplied = Math.min(current.giftCardAppliedCents, postDiscount);
  const afterGc = Math.max(0, postDiscount - giftCardApplied);
  const accountCreditApplied = Math.min(current.accountCreditAppliedCents, afterGc);

  const total = Math.max(
    0,
    postDiscount -
      giftCardApplied -
      accountCreditApplied +
      current.shippingTotalCents +
      current.taxTotalCents
  );

  await tx.cart.update({
    where: { id: cartId },
    data: {
      subtotalCents: subtotal,
      discountTotalCents: discountTotal,
      giftCardAppliedCents: giftCardApplied,
      accountCreditAppliedCents: accountCreditApplied,
      totalCents: total,
    },
  });
}

async function bootstrapFromDocument(
  tx: TxClient,
  ctx: ServiceContext,
  cartId: string,
  documentId: string
): Promise<void> {
  const document = await tx.billingDocument.findFirst({
    where: { id: documentId },
    include: { lines: true },
  });
  if (!document) throw new CommerceNotFoundError('BillingDocument', documentId);

  for (const line of document.lines) {
    if (!line.variantId) continue;
    // BillingDocumentLine stores prices as Decimal(12,2); convert to integer
    // cents so the cart contract (always integer cents) stays consistent.
    const unitPriceCents = Math.round(line.unitPrice.toNumber() * 100);
    const quantity = Math.round(line.quantity.toNumber());
    await tx.cartItem.create({
      data: {
        tenantId: ctx.tenantId,
        cartId,
        variantId: line.variantId,
        quantity,
        unitPriceCents,
        subtotalCents: unitPriceCents * quantity,
        attributes: {},
      },
    });
  }
}

function serializeAttributes(attributes: CartItemAttributes | undefined): Prisma.InputJsonValue {
  if (!attributes) return {};
  return attributes;
}

function serializeCart(row: CartWithRelations): CartSnapshot {
  const items: CartItemSnapshot[] = row.items.map((it) => ({
    cartItemId: it.id,
    variantId: it.variantId,
    productId: it.variant.productId,
    sku: it.variant.sku,
    name: it.variant.product.title,
    quantity: it.quantity,
    unitPriceCents: it.unitPriceCents,
    subtotalCents: it.subtotalCents,
    configuration:
      it.configurationPayload && typeof it.configurationPayload === 'object'
        ? (it.configurationPayload as unknown as ResolvedConfiguration)
        : undefined,
    attributes:
      it.attributes && typeof it.attributes === 'object'
        ? (it.attributes as unknown as CartItemAttributes)
        : undefined,
    unitPriceTrace: Array.isArray(it.unitPriceTrace)
      ? (it.unitPriceTrace as CartItemSnapshot['unitPriceTrace'])
      : [],
  }));

  return {
    cartId: row.id,
    customerId: row.customerId,
    customerName: customerDisplayName(row.customer),
    channel: row.channel,
    currency: row.currency,
    items,
    appliedDiscountCodes: row.discounts.map((d) => d.discount.code ?? '').filter(Boolean),
    appliedGiftCardCodes: [],
    accountCreditAppliedCents: row.accountCreditAppliedCents,
    totals: {
      subtotalCents: row.subtotalCents,
      discountTotalCents: row.discountTotalCents,
      shippingTotalCents: row.shippingTotalCents,
      taxTotalCents: row.taxTotalCents,
      giftCardAppliedCents: row.giftCardAppliedCents,
      accountCreditAppliedCents: row.accountCreditAppliedCents,
      totalCents: row.totalCents,
    },
    expiresAt: row.expiresAt?.toISOString() ?? '',
    abandonedAt: row.abandonedAt?.toISOString() ?? null,
  };
}
