// Commerce activity slice — customers, orders (full lifecycle), and returns.
//
// `applyCustomers` creates the CRM spine for every persona (retail + b2b) and is
// run whenever any consuming module is on (orders, bookings, reviews, quotes all
// hang off a customer). `applyOrders` (commerce-gated) generates a lifecycle
// spread off a GENERIC template — placed/fulfilled/delivered/cancelled/refunded —
// plus a returns flow (requested→approved→received→inspecting→refunded with
// inspections + labels), so Orders, Returns, and Customers render real data.
// Denormalized customer stats are computed here because no order-event consumer
// runs against a loaded tenant.

import { sampleEmail, SAMPLE_ORDER_PREFIX, withSampleMeta } from '../markers';
import type { SampleDataPack, SamplePersona } from '../types';
import { type ApplyCtx, daysAgo, round2 } from './context';

const TAX_RATE = 0.0825;

// Generic order lifecycle — the delivered/fulfilled ones back returns + verified
// reviews. `customerIdx` indexes the retail-persona list (mod its length).
interface OrderSpec {
  customerIdx: number;
  status: string;
  paymentStatus: string;
  daysAgo: number;
  lineCount: number;
  shipFlat: number;
}
const ORDER_SPECS: OrderSpec[] = [
  {
    customerIdx: 0,
    status: 'delivered',
    paymentStatus: 'paid',
    daysAgo: 34,
    lineCount: 2,
    shipFlat: 14.5,
  },
  {
    customerIdx: 0,
    status: 'delivered',
    paymentStatus: 'paid',
    daysAgo: 12,
    lineCount: 1,
    shipFlat: 9.95,
  },
  {
    customerIdx: 1,
    status: 'delivered',
    paymentStatus: 'paid',
    daysAgo: 27,
    lineCount: 3,
    shipFlat: 0,
  },
  {
    customerIdx: 2,
    status: 'delivered',
    paymentStatus: 'paid',
    daysAgo: 19,
    lineCount: 2,
    shipFlat: 14.5,
  },
  {
    customerIdx: 3,
    status: 'fulfilled',
    paymentStatus: 'paid',
    daysAgo: 6,
    lineCount: 2,
    shipFlat: 14.5,
  },
  {
    customerIdx: 4,
    status: 'fulfilled',
    paymentStatus: 'paid',
    daysAgo: 4,
    lineCount: 1,
    shipFlat: 9.95,
  },
  {
    customerIdx: 5,
    status: 'placed',
    paymentStatus: 'paid',
    daysAgo: 2,
    lineCount: 2,
    shipFlat: 14.5,
  },
  {
    customerIdx: 1,
    status: 'placed',
    paymentStatus: 'unpaid',
    daysAgo: 1,
    lineCount: 1,
    shipFlat: 9.95,
  },
  {
    customerIdx: 2,
    status: 'cancelled',
    paymentStatus: 'unpaid',
    daysAgo: 9,
    lineCount: 2,
    shipFlat: 14.5,
  },
  {
    customerIdx: 3,
    status: 'refunded',
    paymentStatus: 'refunded',
    daysAgo: 22,
    lineCount: 1,
    shipFlat: 9.95,
  },
];

interface ReturnSpec {
  orderIdx: number;
  status: string;
  preferredOutcome: string;
  requestedBy: string;
  reasonCode: string;
  daysAgo: number;
  refund?: { restockingFeeCents: number; issuedAs: string };
  inspection?: { condition: string; restockable: boolean; note: string };
  label?: { provider: string; tracking: string };
}
const RETURN_SPECS: ReturnSpec[] = [
  {
    orderIdx: 0,
    status: 'requested',
    preferredOutcome: 'refund',
    requestedBy: 'customer',
    reasonCode: 'wrong_item',
    daysAgo: 5,
  },
  {
    orderIdx: 2,
    status: 'approved',
    preferredOutcome: 'exchange',
    requestedBy: 'customer',
    reasonCode: 'defective',
    daysAgo: 8,
    label: { provider: 'ups', tracking: '1Z999AA10123456784' },
  },
  {
    orderIdx: 3,
    status: 'received',
    preferredOutcome: 'refund',
    requestedBy: 'customer',
    reasonCode: 'not_as_described',
    daysAgo: 11,
    label: { provider: 'fedex', tracking: '7712 3456 7890' },
  },
  {
    orderIdx: 1,
    status: 'inspecting',
    preferredOutcome: 'account_credit',
    requestedBy: 'staff',
    reasonCode: 'damaged_in_transit',
    daysAgo: 6,
    inspection: {
      condition: 'damaged',
      restockable: false,
      note: 'Damaged in transit; not resellable.',
    },
  },
  {
    orderIdx: 0,
    status: 'refunded',
    preferredOutcome: 'refund',
    requestedBy: 'customer',
    reasonCode: 'no_longer_needed',
    daysAgo: 30,
    refund: { restockingFeeCents: 500, issuedAs: 'original_payment' },
    inspection: { condition: 'unopened', restockable: true, note: 'Sealed; returned to stock.' },
  },
];

function splitName(name: string): { firstName: string; lastName: string } {
  const i = name.indexOf(' ');
  return i < 0
    ? { firstName: name, lastName: '' }
    : { firstName: name.slice(0, i), lastName: name.slice(i + 1) };
}

/** Create a CRM customer (+ default address) per persona. Find-or-create by the
 *  sample-domain email so a re-load reuses the row. */
export async function applyCustomers(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  const { tx, tenantId } = ctx;
  for (const persona of pack.personas) {
    const email = sampleEmail(persona.email);
    const { firstName, lastName } = splitName(persona.name);
    let customer = await tx.customer.findFirst({ where: { email }, select: { id: true } });
    customer ??= await tx.customer.create({
      data: {
        tenantId,
        propertyId: ctx.propertyId,
        type: persona.kind === 'b2b' ? 'b2b' : 'retail',
        email,
        firstName,
        lastName,
        company: persona.company ?? null,
        phone: persona.phone ?? null,
        metadata: withSampleMeta(),
      },
      select: { id: true },
    });
    ctx.customerIdByPersona.set(persona.key, customer.id);
    ctx.counts.customers += 1;

    const hasAddress = await tx.customerAddress.findFirst({
      where: { customerId: customer.id },
      select: { id: true },
    });
    if (!hasAddress && persona.line1 && persona.city) {
      await tx.customerAddress.create({
        data: {
          tenantId,
          customerId: customer.id,
          type: 'both',
          isDefault: true,
          recipientName: persona.name,
          line1: persona.line1,
          city: persona.city,
          region: persona.region,
          postalCode: persona.postalCode,
          country: persona.country ?? 'US',
          phone: persona.phone ?? null,
        },
      });
    }
  }
}

interface CreatedOrder {
  id: string;
  customerId: string;
  status: string;
  total: number;
  placedAt: Date;
  itemIds: { id: string }[];
}

/** Generate the order lifecycle + returns. Commerce-gated; needs catalog variants
 *  + retail customers (run after applyCatalog + applyCustomers). */
export async function applyOrders(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('commerce')) return;
  const { tx, tenantId } = ctx;

  // Orders prefer retail buyers, but an all-b2b pack (e.g. wholesale distribution)
  // still places orders — B2B customers order too, and an empty Orders surface is
  // exactly the confusion this dataset exists to prevent. Fall back to every persona.
  const retail: SamplePersona[] = pack.personas.filter((p) => p.kind !== 'b2b');
  const buyers: SamplePersona[] = retail.length ? retail : pack.personas;
  const customerIds = buyers
    .map((p) => ctx.customerIdByPersona.get(p.key))
    .filter((id): id is string => Boolean(id));
  if (customerIds.length === 0 || ctx.variantOrder.length === 0) return;

  const created: CreatedOrder[] = [];
  for (let i = 0; i < ORDER_SPECS.length; i++) {
    const spec = ORDER_SPECS[i]!;
    const customerIdx = spec.customerIdx % customerIds.length;
    const customerId = customerIds[customerIdx]!;
    const persona = buyers[customerIdx]!;
    const placedAt = daysAgo(ctx, spec.daysAgo);

    const lines = Array.from({ length: spec.lineCount }, (_, j) => {
      const vkey = ctx.variantOrder[(i + j) % ctx.variantOrder.length]!;
      const v = ctx.variantsByKey.get(vkey)!;
      const quantity = ((i + j) % 2) + 1;
      const unitPrice = round2(v.priceCents / 100);
      const lineSubtotal = round2(unitPrice * quantity);
      const taxAmount = round2(lineSubtotal * TAX_RATE);
      return {
        productId: v.productId,
        variantId: v.id,
        sku: v.sku,
        name: v.title ? `${v.productTitle} — ${v.title}` : v.productTitle,
        quantity,
        unitPrice,
        lineSubtotal,
        taxAmount,
        lineTotal: round2(lineSubtotal + taxAmount),
      };
    });

    const subtotal = round2(lines.reduce((s, l) => s + l.lineSubtotal, 0));
    const taxTotal = round2(lines.reduce((s, l) => s + l.taxAmount, 0));
    const total = round2(subtotal + taxTotal + spec.shipFlat);
    const paid = spec.paymentStatus === 'paid';
    const refunded = spec.status === 'refunded';
    const fulfilledStates = ['fulfilled', 'delivered'];
    const address = {
      recipientName: persona.name,
      line1: persona.line1 ?? '1 Demo St',
      city: persona.city ?? 'Springfield',
      region: persona.region ?? 'IL',
      postalCode: persona.postalCode ?? '62701',
      country: persona.country ?? 'US',
    };

    const order = await tx.order.create({
      data: {
        tenantId,
        customerId,
        propertyId: ctx.propertyId,
        orderNumber: `${SAMPLE_ORDER_PREFIX}${String(1001 + i)}`,
        status: spec.status,
        paymentStatus: spec.paymentStatus,
        channel: 'storefront',
        source: 'sparx_market',
        subtotal,
        taxTotal,
        shippingTotal: spec.shipFlat,
        total,
        amountPaid: paid ? total : 0,
        refundTotal: refunded ? total : 0,
        currency: 'USD',
        shippingAddress: address,
        billingAddress: address,
        placedAt,
        paidAt: paid ? placedAt : null,
        fulfilledAt: fulfilledStates.includes(spec.status) ? daysAgo(ctx, spec.daysAgo - 1) : null,
        deliveredAt: spec.status === 'delivered' ? daysAgo(ctx, spec.daysAgo - 3) : null,
        cancelledAt: spec.status === 'cancelled' ? daysAgo(ctx, spec.daysAgo - 1) : null,
        cancelledReason: spec.status === 'cancelled' ? 'Customer changed order' : null,
        refundedAt: refunded ? daysAgo(ctx, spec.daysAgo - 2) : null,
        metadata: withSampleMeta(),
        createdAt: placedAt,
        items: {
          create: lines.map((l) => ({
            tenantId,
            productId: l.productId,
            variantId: l.variantId,
            sku: l.sku,
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineSubtotal: l.lineSubtotal,
            taxAmount: l.taxAmount,
            lineTotal: l.lineTotal,
            quantityFulfilled: fulfilledStates.includes(spec.status) ? l.quantity : 0,
          })),
        },
      },
      select: { id: true, items: { select: { id: true } } },
    });
    created.push({
      id: order.id,
      customerId,
      status: spec.status,
      total,
      placedAt,
      itemIds: order.items,
    });
    ctx.counts.orders += 1;
  }

  // Denormalized customer stats from settled orders.
  for (const customerId of customerIds) {
    const own = created.filter(
      (o) => o.customerId === customerId && o.status !== 'cancelled' && o.status !== 'refunded'
    );
    if (own.length === 0) continue;
    const totalSpent = round2(own.reduce((s, o) => s + o.total, 0));
    const dates = own.map((o) => o.placedAt).sort((a, b) => a.getTime() - b.getTime());
    await tx.customer.update({
      where: { id: customerId },
      data: {
        orderCount: own.length,
        totalSpent,
        firstOrderAt: dates[0],
        lastOrderAt: dates[dates.length - 1],
      },
    });
  }

  // Returns referencing real orders + items.
  for (const spec of RETURN_SPECS) {
    const order = created[spec.orderIdx];
    if (!order || order.itemIds.length === 0) continue;
    const line = order.itemIds[0]!;
    const settled = spec.status === 'refunded';
    const approvedStates = ['approved', 'received', 'inspecting', 'inspected', 'refunded'];
    const isApproved = approvedStates.includes(spec.status);
    const requestedAt = daysAgo(ctx, spec.daysAgo);
    const lineUnitCents = Math.round((order.total / Math.max(order.itemIds.length, 1)) * 100);

    const ret = await tx.returnRequest.create({
      data: {
        tenantId,
        orderId: order.id,
        requestedBy: spec.requestedBy,
        status: spec.status,
        preferredOutcome: spec.preferredOutcome,
        staffNote:
          spec.requestedBy === 'staff' ? 'Opened by support after the customer called in.' : null,
        ...(settled
          ? {
              refundedAmountCents: Math.max(
                lineUnitCents - (spec.refund?.restockingFeeCents ?? 0),
                0
              ),
              restockingFeeCents: spec.refund?.restockingFeeCents ?? 0,
              refundIssuedAs: spec.refund?.issuedAs ?? 'original_payment',
              refundedAt: daysAgo(ctx, spec.daysAgo - 4),
            }
          : {}),
        ...(isApproved
          ? { approvedBy: ctx.ownerUserId ?? null, approvedAt: daysAgo(ctx, spec.daysAgo - 1) }
          : {}),
        ...(['received', 'inspecting', 'inspected', 'refunded'].includes(spec.status)
          ? { receivedAt: daysAgo(ctx, spec.daysAgo - 2) }
          : {}),
        createdAt: requestedAt,
        items: {
          create: [
            {
              tenantId,
              orderItemId: line.id,
              quantity: 1,
              approvedQuantity: isApproved ? 1 : 0,
              reasonCode: spec.reasonCode,
              customerNote: 'Please advise on next steps — thanks.',
            },
          ],
        },
      },
      select: { id: true, items: { select: { id: true } } },
    });
    ctx.counts.returns += 1;

    if (spec.inspection && ret.items[0]) {
      await tx.returnInspection.create({
        data: {
          tenantId,
          returnId: ret.id,
          returnLineItemId: ret.items[0].id,
          condition: spec.inspection.condition,
          restockable: spec.inspection.restockable,
          note: spec.inspection.note,
          inspectedBy: ctx.ownerUserId ?? null,
          createdAt: daysAgo(ctx, spec.daysAgo - 3),
        },
      });
    }
    if (spec.label) {
      await tx.returnLabel.create({
        data: {
          tenantId,
          returnId: ret.id,
          providerSlug: spec.label.provider,
          labelRef: `RMA-${order.id.slice(0, 8)}`,
          trackingNumber: spec.label.tracking,
          costCents: 895,
          createdAt: daysAgo(ctx, spec.daysAgo - 1),
        },
      });
    }
  }
}
