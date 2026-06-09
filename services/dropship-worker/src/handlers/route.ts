// Order routing handler — triggered by dropship.order.route.
// Inspects an order's line items; those with a dropshipSourceId on the variant
// are grouped by supplier and dispatched as dropship_orders rows. Each supplier
// group gets one adapter.submitOrder() call. Results are written back to the
// dropship_orders rows and the appropriate event is published.

import type { Logger } from 'pino';
import { withTenant, type TxClient } from '@sparx/db';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import { createAdapter } from '@sparx/dropship';
import type { Order, OrderLineItem, ShippingAddress } from '@sparx/dropship';

type AnyTx = TxClient & Record<string, any>;

export interface OrderRoutePayload {
  orderId: string;
}

export async function handleOrderRoute(
  payload: OrderRoutePayload,
  tenantId: string,
  log: Logger
): Promise<void> {
  const { orderId } = payload;
  log.info({ orderId, tenantId }, 'dropship order.route');

  // Load order + line items + variant dropshipSourceId in one pass.
  const order = await withTenant({ tenantId } as any, async (tx) => {
    return (tx as AnyTx).order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: {
          include: {
            variant: { select: { id: true, sku: true, dropshipSourceId: true, costCents: true } },
          },
        },
      },
    });
  });

  if (!order) {
    log.warn({ orderId }, 'dropship route: order not found — acking');
    return;
  }

  // Group line items by dropshipSourceId (== supplierId on the variant).
  const bySupplier = new Map<
    string,
    Array<{ sku: string; quantity: number; unitPriceCents: number }>
  >();

  for (const item of order.items) {
    const supplierId = item.variant?.dropshipSourceId;
    if (!supplierId) continue;
    const bucket = bySupplier.get(supplierId) ?? [];
    bucket.push({
      sku: item.variant?.sku ?? '',
      quantity: item.quantity,
      unitPriceCents: item.variant?.costCents ?? Number(item.unitPrice) * 100,
    });
    bySupplier.set(supplierId, bucket);
  }

  if (bySupplier.size === 0) {
    log.info({ orderId }, 'dropship route: no dropship line items — skipping');
    return;
  }

  const shippingAddr = order.shippingAddress as Record<string, any> | null;
  const shipping: ShippingAddress = {
    name: shippingAddr?.name ?? '',
    line1: shippingAddr?.line1 ?? shippingAddr?.address1 ?? '',
    line2: shippingAddr?.line2 ?? shippingAddr?.address2 ?? undefined,
    city: shippingAddr?.city ?? '',
    region: shippingAddr?.province ?? shippingAddr?.region ?? undefined,
    postalCode: shippingAddr?.zip ?? shippingAddr?.postalCode ?? '',
    countryCode: shippingAddr?.country ?? shippingAddr?.countryCode ?? 'US',
    phone: shippingAddr?.phone ?? undefined,
  };

  const publisher = createPublisher(log as unknown as PublisherLogger);

  for (const [supplierId, lineItems] of bySupplier) {
    const supplier = await withTenant({ tenantId } as any, async (tx) => {
      return (tx as AnyTx).dropshipSupplier.findFirst({
        where: { id: supplierId, tenantId, deletedAt: null },
      });
    });

    if (!supplier) {
      log.warn({ supplierId, orderId }, 'dropship route: supplier not found');
      continue;
    }

    // Create the dropship_orders row before calling the adapter (idempotent: skip if exists).
    const existing = await withTenant({ tenantId } as any, async (tx) => {
      return (tx as AnyTx).dropshipOrder.findFirst({
        where: { tenantId, orderId, supplierId },
      });
    });
    if (existing) {
      log.info({ supplierId, orderId }, 'dropship route: order already exists for supplier');
      continue;
    }

    const dsOrder = await withTenant({ tenantId } as any, async (tx) => {
      return (tx as AnyTx).dropshipOrder.create({
        data: {
          tenantId,
          orderId,
          supplierId,
          status: 'pending',
          lineItems: lineItems as any,
        },
      });
    });

    const adapterOrder: Order = {
      sparxOrderId: orderId,
      sparxOrderNumber: order.orderNumber,
      lineItems: lineItems.map(
        (l): OrderLineItem => ({
          supplierSku: l.sku,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
        })
      ),
      shippingAddress: shipping,
      customerNote: order.customerNote ?? undefined,
    };

    try {
      const adapter = createAdapter(supplier.type, supplier.credentials as Record<string, string>);
      const result = await adapter.submitOrder(adapterOrder);

      await withTenant({ tenantId } as any, async (tx) => {
        await (tx as AnyTx).dropshipOrder.update({
          where: { id: dsOrder.id },
          data: {
            supplierOrderId: result.supplierOrderId,
            status: result.status === 'failed' ? 'failed' : 'submitted',
            errorMessage: result.errorMessage ?? null,
            submittedAt: result.status !== 'failed' ? new Date() : null,
          },
        });
      });

      if (result.status === 'failed') {
        await publishEvent(
          publisher,
          'dropship.order.failed',
          tenantId,
          null,
          {
            dropshipOrderId: dsOrder.id,
            orderId,
            supplierId,
            error: result.errorMessage,
          },
          log
        );
      } else {
        await publishEvent(
          publisher,
          'dropship.order.submitted',
          tenantId,
          null,
          {
            dropshipOrderId: dsOrder.id,
            orderId,
            supplierId,
            supplierOrderId: result.supplierOrderId,
          },
          log
        );
      }

      log.info(
        { dsOrderId: dsOrder.id, status: result.status, supplierId },
        'dropship order submitted'
      );
    } catch (err: any) {
      log.error({ supplierId, orderId, err: err?.message }, 'dropship adapter.submitOrder threw');
      await withTenant({ tenantId } as any, async (tx) => {
        await (tx as AnyTx).dropshipOrder.update({
          where: { id: dsOrder.id },
          data: { status: 'failed', errorMessage: err?.message ?? 'adapter error' },
        });
      });
      await publishEvent(
        publisher,
        'dropship.order.failed',
        tenantId,
        null,
        { dropshipOrderId: dsOrder.id, orderId, supplierId, error: err?.message },
        log
      );
    }
  }
}
