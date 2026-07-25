// Channel-order ingest (docs/106 §4.3 + docs/27 §6) — the inbound seam that turns
// an external marketplace order (TikTok Shop, Etsy, …) into a native sparx order +
// inventory decrement, in ONE atomic transaction. The api-rest channel webhook
// resolves the tenant + connection, normalizes the payload via the channel adapter
// (`adapter.ingestOrder`), and hands the result here.
//
// This mirrors checkout's order+inventory composition (the order row is written
// directly, then `commitSaleOnTx` decrements stock on the SAME tx so a marketplace
// sale can never be recorded without moving inventory — the docs/27 §7 oversell
// invariant). Platform events fire AFTER the commit, never inside it.
//
// Idempotency: marketplaces re-deliver order webhooks. The order's deterministic
// `orderNumber` (`{prefix}-{externalId}`) rides the existing (tenant, order_number)
// unique, and we pre-check (tenant, channel, externalId) — so a re-ingest returns
// the existing order and never double-decrements (the ledger is idempotency-keyed
// too, belt-and-suspenders).

import { randomUUID } from 'node:crypto';

import { withTenant } from '@sparx/db';
import type { Prisma, TxClient } from '@sparx/db';
import { inventoryService, type CommittedSale } from '@sparx/inventory';
import { publishPlatformEvent } from '@sparx/crm';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';

export interface ChannelOrderIngestLine {
  /** The channel's seller SKU — resolved to a sparx variant via the product mapping. */
  externalSku: string;
  externalVariantId?: string;
  quantity: number;
  unitPriceCents: number;
}

export interface ChannelOrderIngestAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
}

export interface ChannelOrderIngestInput {
  /** The channel slug (`tiktok_shop`, …) — stored as the order `source`. */
  channel: string;
  /** The marketplace's own order id — the idempotency key. */
  externalId: string;
  externalStatus: string;
  /** ISO placement time from the channel. */
  placedAt: string;
  currency: string;
  customer: { email: string | null; name: string | null; phone?: string | null };
  shippingAddress: ChannelOrderIngestAddress | null;
  lines: ChannelOrderIngestLine[];
  /** Marketplace commission (cents) — stored so net revenue reconciles. */
  channelFeeCents?: number;
}

export interface ChannelOrderIngestResult {
  orderId: string;
  orderNumber: string;
  /** True when the order already existed (a re-delivered webhook) — no new writes. */
  deduped: boolean;
  /** SKUs with no product mapping — recorded as free-text lines, no stock moved. */
  unmappedSkus: string[];
}

const CHANNEL_PREFIX: Record<string, string> = {
  tiktok_shop: 'TT',
  etsy: 'ET',
  amazon: 'AZ',
  walmart: 'WM',
  ebay: 'EB',
  faire: 'FA',
  sparx_market: 'SX',
};

/** A human-readable, deterministic order number that doubles as the idempotency
 *  backstop via the (tenant, order_number) unique. */
function channelOrderNumber(channel: string, externalId: string): string {
  const prefix = CHANNEL_PREFIX[channel] ?? channel.slice(0, 2).toUpperCase();
  return `${prefix}-${externalId}`.slice(0, 63);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface AggregatedLine {
  externalSku: string;
  externalVariantId?: string;
  quantity: number;
  unitPriceCents: number;
}

/** Many marketplaces emit one line per UNIT (TikTok does). Collapse to one row per
 *  SKU with a summed quantity so the order + the inventory decrement read normally. */
function aggregateLines(lines: ChannelOrderIngestLine[]): AggregatedLine[] {
  const bySku = new Map<string, AggregatedLine>();
  for (const line of lines) {
    const existing = bySku.get(line.externalSku);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      bySku.set(line.externalSku, { ...line });
    }
  }
  return [...bySku.values()];
}

/** Find-or-create the buyer's customer membership, keyed on email + the primary
 *  site (marketplace orders aren't site-scoped, so they default to primary — the
 *  same membership a later site registration would resolve to). A buyer with no
 *  email (some channels mask it) gets a per-order synthetic so orders never
 *  collapse onto one shared customer. */
async function ensureChannelCustomer(
  tx: TxClient,
  tenantId: string,
  customer: { email: string | null; name: string | null },
  fallbackKey: string
): Promise<string> {
  const primary = await tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } });
  const propertyId = primary?.id ?? null;
  const trimmedEmail = customer.email?.trim().toLowerCase() ?? '';
  const email = (
    trimmedEmail.length > 0 ? trimmedEmail : `${fallbackKey}@marketplace.invalid`
  ).slice(0, 255);

  const existing = await tx.customer.findFirst({
    where: { propertyId, email, deletedAt: null },
    select: { id: true, lifecycleStage: true },
  });
  if (existing) {
    // A marketplace order makes them a customer (see checkout-service).
    if (existing.lifecycleStage !== 'customer' && existing.lifecycleStage !== 'evangelist') {
      await tx.customer.update({
        where: { id: existing.id },
        data: { lifecycleStage: 'customer', leadStatus: null },
      });
    }
    return existing.id;
  }

  const [firstName, ...rest] = (customer.name ?? '').trim().split(/\s+/).filter(Boolean);
  const created = await tx.customer.create({
    data: {
      tenantId,
      propertyId,
      email,
      type: 'retail',
      lifecycleStage: 'customer',
      firstName: firstName ?? null,
      lastName: rest.length ? rest.join(' ') : null,
    },
    select: { id: true },
  });
  return created.id;
}

interface IngestLineRow {
  productId: string | null;
  variantId: string | null;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  /** Dropship-sourced variants are supplier-fulfilled — never decrement local stock. */
  isDropshipVariant: boolean;
}

/** Resolve each aggregated SKU to a sparx variant (via the channel product mapping)
 *  and a readable item name. Unmapped SKUs become free-text lines (no variant → no
 *  stock decrement) so the order is still complete and visible. */
async function resolveLineRows(
  tx: TxClient,
  channel: string,
  lines: AggregatedLine[]
): Promise<{ rows: IngestLineRow[]; unmappedSkus: string[] }> {
  const rows: IngestLineRow[] = [];
  const unmappedSkus: string[] = [];

  for (const line of lines) {
    const mapping = await tx.channelProductMapping.findFirst({
      where: { channel, externalSku: line.externalSku },
      select: { productId: true, variantId: true },
    });
    let name = line.externalSku;
    let isDropshipVariant = false;
    if (mapping) {
      const variant = await tx.productVariant.findUnique({
        where: { id: mapping.variantId },
        select: { title: true, dropshipSourceId: true, product: { select: { title: true } } },
      });
      if (variant) {
        name =
          variant.title && variant.title !== variant.product.title
            ? `${variant.product.title} - ${variant.title}`
            : variant.product.title;
        isDropshipVariant = variant.dropshipSourceId !== null;
      }
    } else {
      unmappedSkus.push(line.externalSku);
    }
    rows.push({
      productId: mapping?.productId ?? null,
      variantId: mapping?.variantId ?? null,
      sku: line.externalSku,
      name: name.slice(0, 255),
      quantity: line.quantity,
      unitPrice: round2(line.unitPriceCents / 100),
      lineSubtotal: round2((line.unitPriceCents / 100) * line.quantity),
      isDropshipVariant,
    });
  }
  return { rows, unmappedSkus };
}

function toAddressSnapshot(
  address: ChannelOrderIngestAddress | null
): Prisma.InputJsonValue | undefined {
  if (!address) return undefined;
  return {
    name: address.name,
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city,
    region: address.region ?? null,
    postalCode: address.postalCode,
    country: address.countryCode,
    phone: address.phone ?? null,
  };
}

/**
 * Ingest one normalized marketplace order: link/create the customer, resolve the
 * lines to variants, write the order + items, and decrement inventory — all in one
 * tenant transaction — then emit the post-commit platform events. Idempotent on
 * re-delivery.
 */
export async function ingestChannelOrder(
  ctx: ServiceContext,
  input: ChannelOrderIngestInput
): Promise<ChannelOrderIngestResult> {
  const orderNumber = channelOrderNumber(input.channel, input.externalId);
  const placedAtDate = new Date(input.placedAt);
  const placedAt = Number.isNaN(placedAtDate.getTime()) ? new Date() : placedAtDate;
  const aggregated = aggregateLines(input.lines);

  const outcome = await withTenant(ctx, async (tx) => {
    // Idempotency: a re-delivered webhook returns the existing order, no re-write.
    const existing = await tx.order.findFirst({
      where: { channel: 'marketplace', source: input.channel, externalId: input.externalId },
      select: { id: true, orderNumber: true },
    });
    if (existing) {
      return {
        deduped: true as const,
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        customerId: null,
        total: 0,
        committedSales: [] as CommittedSale[],
        unmappedSkus: [] as string[],
      };
    }

    const customerId = await ensureChannelCustomer(
      tx,
      ctx.tenantId,
      input.customer,
      `${input.channel}-${input.externalId}`
    );
    const { rows, unmappedSkus } = await resolveLineRows(tx, input.channel, aggregated);

    const subtotal = round2(rows.reduce((sum, r) => sum + r.lineSubtotal, 0));
    const total = subtotal; // marketplace settles tax/shipping/fees on its side

    const order = await tx.order.create({
      data: {
        tenantId: ctx.tenantId,
        customerId,
        orderNumber,
        channel: 'marketplace',
        source: input.channel,
        externalId: input.externalId,
        externalStatus: input.externalStatus,
        channelFeeCents: input.channelFeeCents ?? null,
        currency: input.currency,
        status: 'placed',
        // Marketplace orders are collected by the channel — they arrive paid.
        paymentStatus: 'paid',
        subtotal,
        total,
        amountPaid: total,
        paidAt: placedAt,
        shippingAddress: toAddressSnapshot(input.shippingAddress),
        placedAt,
        metadata: {
          channelOrderId: input.externalId,
          channelStatus: input.externalStatus,
          source: input.channel,
        },
        items: {
          create: rows.map((r) => ({
            tenantId: ctx.tenantId,
            productId: r.productId,
            variantId: r.variantId,
            sku: r.sku,
            name: r.name,
            quantity: r.quantity,
            unitPrice: r.unitPrice,
            lineSubtotal: r.lineSubtotal,
            taxAmount: 0,
            discountAmount: 0,
            lineTotal: r.lineSubtotal,
          })),
        },
      },
      include: { items: true },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: null,
      actorType: 'system',
      action: 'commerce.channel.order.ingested',
      entityType: 'Order',
      entityId: order.id,
      diff: { after: { orderNumber, source: input.channel, externalId: input.externalId } },
    });

    // Decrement stock for every mapped, non-dropship line, atomic with the
    // order write — the single sale authority (idempotency-keyed off the
    // order + line). Dropship-sourced variants are supplier-fulfilled and
    // never touch local warehouse stock (see cart-service's addItem for the
    // same rule at the earlier reserve stage).
    const dropshipVariantIds = new Set(
      rows.filter((r) => r.isDropshipVariant && r.variantId).map((r) => r.variantId)
    );
    const committedSales = await inventoryService.commitSaleOnTx(tx, ctx, {
      orderId: order.id,
      lines: order.items
        .filter((i) => i.variantId && !dropshipVariantIds.has(i.variantId))
        .map((i) => ({
          variantId: i.variantId!,
          quantity: i.quantity,
          reservationId: null,
          lineKey: i.id,
        })),
    });

    return {
      deduped: false as const,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId,
      total,
      committedSales,
      unmappedSkus,
    };
  });

  if (outcome.deduped) {
    return {
      orderId: outcome.orderId,
      orderNumber: outcome.orderNumber,
      deduped: true,
      unmappedSkus: [],
    };
  }

  // Post-commit fan-out (never inside the transaction):
  //   • inventory threshold events (inventory.adjusted → channels re-sync stock),
  //   • CRM order.created (activity feed + denormalized customer stats),
  //   • commerce order.placed (fulfillment dispatch + analytics).
  await inventoryService.emitSaleEvents(ctx, outcome.committedSales);
  await publishPlatformEvent({
    id: randomUUID(),
    topic: 'order.created',
    tenantId: ctx.tenantId,
    occurredAt: placedAt,
    payload: {
      orderId: outcome.orderId,
      customerId: outcome.customerId,
      total: outcome.total,
      currency: input.currency,
      placedAt: placedAt.toISOString(),
    },
  });
  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    topic: 'order.placed',
    data: { orderId: outcome.orderId, orderNumber: outcome.orderNumber },
  });

  return {
    orderId: outcome.orderId,
    orderNumber: outcome.orderNumber,
    deduped: false,
    unmappedSkus: outcome.unmappedSkus,
  };
}
