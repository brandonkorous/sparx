// CRM — Order input schemas.
//
// The CRM owns the order spine. Create / update at the header level here;
// payment, refund, and fulfillment subresources live in their own files
// (order-payments.ts, order-fulfillments.ts).

import { z } from 'zod';

import { AddressSnapshot, Currency, LineItemInput, Money } from './common-commerce';
import { Uuid } from './common';

export const OrderStatus = z.enum(['placed', 'fulfilled', 'delivered', 'cancelled', 'refunded']);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const OrderPaymentStatus = z.enum(['unpaid', 'partially_paid', 'paid', 'refunded']);
export type OrderPaymentStatus = z.infer<typeof OrderPaymentStatus>;

// `marketplace` is the high-level bucket for external sales channels + sparx.market
// (the specific channel lives in `source`, e.g. tiktok_shop) — docs/106 §4.4.
export const OrderChannel = z.enum([
  'storefront',
  'b2b_portal',
  'admin',
  'import',
  'mcp',
  'marketplace',
]);
export type OrderChannel = z.infer<typeof OrderChannel>;

// CreateOrderInput — full order header + initial line items in one shot.
// The service computes subtotal/total from items and writes them
// transactionally so the read-side never observes a partial order.
export const CreateOrderInput = z.object({
  customerId: Uuid,
  orderNumber: z.string().min(1).max(63).optional(), // auto-generated if absent
  channel: OrderChannel.optional(),
  source: z.string().max(63).optional(),
  // Origin site (docs/58 D1) — which property the order was placed on. Checkout
  // passes the cart's; admin / import / MCP may set it explicitly or leave null.
  propertyId: Uuid.optional(),

  currency: Currency.default('USD'),
  shippingTotal: Money.default(0),
  discountTotal: Money.default(0),
  // Header-level tax override. If omitted (undefined), the service sums
  // line-level taxAmounts; if provided, this value wins.
  taxTotal: Money.optional(),
  // Document-level surcharge (docs/48 §6) — card-fee pass-through computed at
  // checkout. `appliedSurcharges` snapshots each fee for refund proration.
  surchargeTotal: Money.default(0),
  appliedSurcharges: z.array(z.record(z.string(), z.unknown())).optional(),

  shippingAddress: AddressSnapshot.optional(),
  billingAddress: AddressSnapshot.optional(),

  placedAt: z.string().datetime().optional(), // defaults to now

  customerNote: z.string().max(10_000).optional(),
  internalNote: z.string().max(10_000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),

  items: z.array(LineItemInput).min(1).max(500),
});
export type CreateOrderInput = z.infer<typeof CreateOrderInput>;

// Header-level mutations only. Status transitions go through their own
// dedicated service methods (fulfill / deliver / cancel / refund) so the
// lifecycle invariants stay in one place and the matching events fire.
export const UpdateOrderInput = z.object({
  customerNote: z.string().max(10_000).nullable().optional(),
  internalNote: z.string().max(10_000).nullable().optional(),
  shippingAddress: AddressSnapshot.nullable().optional(),
  billingAddress: AddressSnapshot.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateOrderInput = z.infer<typeof UpdateOrderInput>;

export const ListOrdersInput = z.object({
  customerId: Uuid.optional(),
  status: OrderStatus.optional(),
  paymentStatus: OrderPaymentStatus.optional(),
  channel: OrderChannel.optional(),
  propertyId: Uuid.optional(), // origin-site filter (docs/58 — the dashboard Site filter)
  placedSince: z.string().datetime().optional(),
  placedUntil: z.string().datetime().optional(),
  q: z.string().max(255).optional(), // matches order_number prefix
  take: z.number().int().min(1).max(250).default(50),
  skip: z.number().int().min(0).default(0),
  sortBy: z.enum(['placedAt', 'total', 'createdAt', 'updatedAt']).default('placedAt'),
});
export type ListOrdersInput = z.infer<typeof ListOrdersInput>;

export const CancelOrderInput = z.object({
  orderId: Uuid,
  reason: z.string().max(500).optional(),
});
export type CancelOrderInput = z.infer<typeof CancelOrderInput>;

// ─── Channel display + consolidation (docs/106 §4.4, docs/27 §8) ──────────────
//
// An order carries a high-level `channel` bucket plus, for marketplace orders, a
// specific `source` slug (tiktok_shop, etsy, …). For revenue analytics we
// consolidate to ONE "channel key": a marketplace order keys by its source slug
// (so TikTok Shop and Etsy are distinct lines), every other order keys by its
// bucket. `deriveChannelKey` is that primitive; the label maps render it. This is
// the single source of truth shared by the reporting service (REST + MCP) and the
// dashboard — never re-hardcode these maps in a feature.

/** Human labels for the high-level order `channel` bucket. */
export const ORDER_CHANNEL_LABELS: Record<string, string> = {
  storefront: 'Storefront',
  b2b_portal: 'B2B portal',
  admin: 'Admin',
  import: 'Import',
  mcp: 'MCP / AI',
  marketplace: 'Marketplace',
  unknown: 'Other',
};

/** Human labels for the specific marketplace `source` slug (docs/106 §4.4). */
export const MARKETPLACE_SOURCE_LABELS: Record<string, string> = {
  tiktok_shop: 'TikTok Shop',
  etsy: 'Etsy',
  amazon: 'Amazon',
  walmart: 'Walmart',
  ebay: 'eBay',
  faire: 'Faire',
  meta: 'Meta',
  google: 'Google',
  pinterest: 'Pinterest',
  sparx_market: 'sparx.market',
};

/** The fixed high-level `channel` buckets (the enum values plus the `unknown`
 *  fallback used when an order has no channel). Everything NOT in this set is a
 *  marketplace source slug — which keeps channel routing robust against a new
 *  marketplace whose slug isn't in MARKETPLACE_SOURCE_LABELS yet. */
export const ORDER_CHANNEL_BUCKETS: ReadonlySet<string> = new Set<string>([
  ...OrderChannel.options,
  'unknown',
]);

/**
 * The analytics channel KEY for an order: marketplace orders key by their
 * `source` slug (tiktok_shop, etsy, …) so each marketplace is its own line;
 * everything else keys by its `channel` bucket. `unknown` when neither is set.
 */
export function deriveChannelKey(channel?: string | null, source?: string | null): string {
  if (channel === 'marketplace') return source ?? 'marketplace';
  return channel ?? 'unknown';
}

/** Display name for a raw order's (channel, source) pair — for order rows. */
export function channelDisplayName(channel?: string | null, source?: string | null): string {
  if (channel === 'marketplace') {
    if (source) return MARKETPLACE_SOURCE_LABELS[source] ?? source;
    return ORDER_CHANNEL_LABELS.marketplace ?? 'Marketplace';
  }
  const key = channel ?? 'unknown';
  return ORDER_CHANNEL_LABELS[key] ?? key;
}

/** Display name for an already-derived channel key (a bucket OR a source slug).
 *  Bucket/source slugs are disjoint, so source labels win the lookup safely. */
export function channelKeyLabel(key: string): string {
  return MARKETPLACE_SOURCE_LABELS[key] ?? ORDER_CHANNEL_LABELS[key] ?? key;
}
