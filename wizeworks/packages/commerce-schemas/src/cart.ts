// Cart + cart-item shapes. Cart is the only place storefront/B2B writes
// before checkout; once a CheckoutSession is created the cart freezes.

import { z } from 'zod';

import { Uuid } from '@wizeworks/crm-schemas';

import { ConfigurationSelection, ResolvedConfiguration } from './bundles';
import { Channel, Currency, MoneyCents } from './common';
import { PriceTraceStep } from './pricing';
import { RepeatCadence } from './repeat';

export const CartItemAttributes = z
  .object({
    giftMessage: z.string().max(2000).optional(),
    deliveryInstructions: z.string().max(2000).optional(),
    engraving: z.string().max(255).optional(),
    customFields: z.record(z.string(), z.string().max(2000)).optional(),
  })
  .partial();
export type CartItemAttributes = z.infer<typeof CartItemAttributes>;

export const AddCartItemInput = z.object({
  cartId: Uuid,
  variantId: Uuid,
  quantity: z.number().int().positive().default(1),
  configuration: ConfigurationSelection.optional(),
  attributes: CartItemAttributes.optional(),
  /** Deliver this again on a schedule (issue 739). Must be one the product
   *  offers; omitted = bought once. */
  repeat: RepeatCadence.optional(),
  /** Bought by sending the old part FIRST instead of paying the core deposit
   *  (issue 057): no deposit on the line, and it ships when the old part
   *  arrives. Only on a part that offers it; omitted = pay the deposit. */
  coreFirst: z.boolean().optional(),
});
export type AddCartItemInput = z.infer<typeof AddCartItemInput>;

export const UpdateCartItemInput = z.object({
  cartItemId: Uuid,
  /** The basket the caller proved it owns. When given, the line must be in it. */
  cartId: Uuid.optional(),
  quantity: z.number().int().nonnegative(), // 0 = remove
  attributes: CartItemAttributes.optional(),
  /** Change how often this line repeats; null makes it a one-off again.
   *  Omitted leaves it as it is. */
  repeat: RepeatCadence.nullable().optional(),
  /** Switch between paying the core deposit and sending the old part first.
   *  Omitted leaves it as it is. */
  coreFirst: z.boolean().optional(),
});
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemInput>;

export const CreateCartInput = z.object({
  channel: Channel,
  currency: Currency,
  customerId: Uuid.nullish(),
  // Cookie-bound guest token; set when no customer is authenticated.
  guestToken: z.string().min(8).max(127).nullish(),
  // Optional carry-over: when a B2B contact starts a cart from an accepted
  // billing document (a quote).
  fromDocumentId: Uuid.nullish(),
  fromSubscriptionId: Uuid.nullish(),
  // Origin site (docs/58 D1) — the storefront property this cart belongs to, so
  // the order placed from it inherits the site. Omitted for admin / MCP carts.
  propertyId: Uuid.nullish(),
});
export type CreateCartInput = z.infer<typeof CreateCartInput>;

export const MergeCartsInput = z.object({
  targetCartId: Uuid, // typically the authenticated user's cart
  sourceCartId: Uuid, // typically the guest cart
  conflictPolicy: z
    .enum(['sum_quantities', 'prefer_source', 'prefer_target'])
    .default('sum_quantities'),
});
export type MergeCartsInput = z.infer<typeof MergeCartsInput>;

// Snapshot returned by cartService.get() and used by the storefront UI.
// Includes the priced state — line items, totals, applied discounts.
// What one made-to-order line asks for (issue 026). Present only on a line whose
// product carries a rule, so an ordinary basket says nothing about any of this.
export const CartItemMadeToOrder = z.object({
  /** Days of notice this line needs. Null when it needs none. */
  orderAheadDays: z.number().int().nullable(),
  /** Of this line's subtotal, what is taken at checkout. */
  depositCents: MoneyCents,
  /** And what is left owing on collection. Zero when there is no deposit. */
  balanceCents: MoneyCents,
});
export type CartItemMadeToOrder = z.infer<typeof CartItemMadeToOrder>;

export const CartItemSnapshot = z.object({
  cartItemId: Uuid,
  variantId: Uuid,
  productId: Uuid,
  sku: z.string(),
  name: z.string(),
  imageUrl: z.string().url().optional(),
  quantity: z.number().int().positive(),
  unitPriceCents: MoneyCents,
  subtotalCents: MoneyCents,
  /** Refundable core deposit per unit on a rebuilt part, on top of the price;
   *  null = no core. Not in `subtotalCents`. */
  coreChargeCents: MoneyCents.nullish(),
  /** Bought by sending the old part first: no deposit, ships when it arrives. */
  coreFirst: z.boolean().default(false),
  /** Present when this part can be bought EITHER way, so the basket can offer the
   *  switch: the deposit paying it would cost per unit. Null otherwise. */
  coreChoice: z.object({ depositCents: MoneyCents }).nullish(),
  configuration: ResolvedConfiguration.optional(),
  attributes: CartItemAttributes.optional(),
  unitPriceTrace: z.array(PriceTraceStep),
  madeToOrder: CartItemMadeToOrder.nullish(),
  /** How often this line is delivered again (issue 739); null = bought once. */
  repeat: RepeatCadence.nullish(),
});
export type CartItemSnapshot = z.infer<typeof CartItemSnapshot>;

// The whole basket's made-to-order answer (issue 026) — what is paid now, what
// is owed later, and the earliest day it can all be handed over.
export const CartMadeToOrder = z.object({
  /** `YYYY-MM-DD` in the BUSINESS's zone, or null when nothing asked for
   *  notice. Null is not "ready today" and must not be rendered as one. */
  readyOn: z.string().nullable(),
  noticeDays: z.number().int().nullable(),
  dueNowCents: MoneyCents,
  balanceCents: MoneyCents,
  depositCents: MoneyCents,
});
export type CartMadeToOrder = z.infer<typeof CartMadeToOrder>;

export const CartTotals = z.object({
  subtotalCents: MoneyCents,
  discountTotalCents: MoneyCents,
  shippingTotalCents: MoneyCents,
  taxTotalCents: MoneyCents,
  giftCardAppliedCents: MoneyCents,
  accountCreditAppliedCents: MoneyCents,
  /** Refundable core deposits (Σ core × quantity). Part of `totalCents`; never
   *  discounted or taxed, so it is not in `subtotalCents`. */
  coreChargeTotalCents: MoneyCents,
  totalCents: MoneyCents,
});
export type CartTotals = z.infer<typeof CartTotals>;
