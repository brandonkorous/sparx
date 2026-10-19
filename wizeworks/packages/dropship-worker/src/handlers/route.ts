// Order routing handler — triggered by dropship.order.route.
// Inspects an order's line items; those with a dropshipSourceId on the variant
// are grouped by supplier and dispatched as dropship_orders rows. Each supplier
// group gets one adapter.submitOrder() call. Results are written back to the
// dropship_orders rows and the appropriate event is published.
//
// A supplier with no system of its own (the business's own supplier, sparx persona
// issue 171) is EMAILED the order instead: `adapter.orderRecipient` says where.

import type { Logger } from 'pino';
import { withTenant } from '@wizeworks/db';
import { createPublisher, publishEvent } from '@wizeworks/events';
import { createAdapter, handVersionsOf, supplierLineFor } from '@wizeworks/dropship';
import type { Order, OrderLineItem, ShippingAddress } from '@wizeworks/dropship';
import { feedDeps } from '../feed-host.js';
import { supplierOrderEmail, type SupplierOrderLine } from './supplier-order-email.js';
import { shipToOf } from './ship-to.js';

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
  const order = await withTenant({ tenantId }, async (tx) => {
    return tx.order.findFirst({
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
    log.warn({ orderId }, 'dropship route: order not found, acking');
    return;
  }

  // Group line items by dropshipSourceId (== supplierId on the variant).
  const bySupplier = new Map<
    string,
    {
      sku: string;
      quantity: number;
      unitPriceCents: number;
      name: string;
      productId: string | null;
      variantId: string | null;
      costCents: number | null;
    }[]
  >();

  for (const item of order.items) {
    const supplierId = item.variant?.dropshipSourceId;
    if (!supplierId) continue;
    const bucket = bySupplier.get(supplierId) ?? [];
    bucket.push({
      sku: item.variant?.sku ?? '',
      quantity: item.quantity,
      unitPriceCents: item.variant?.costCents ?? Number(item.unitPrice) * 100,
      name: item.name,
      productId: item.productId,
      variantId: item.variant?.id ?? null,
      costCents: item.variant?.costCents ?? null,
    });
    bySupplier.set(supplierId, bucket);
  }

  if (bySupplier.size === 0) {
    log.info({ orderId }, 'dropship route: no dropship line items, skipping');
    return;
  }

  // The address as the order stores it (sparx persona issue 214).
  const shipping: ShippingAddress = shipToOf(
    order.shippingAddress as Record<string, unknown> | null
  );

  const publisher = createPublisher({
    logger: log,
  });

  for (const [supplierId, lineItems] of bySupplier) {
    const supplier = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.findFirst({
        where: { id: supplierId, tenantId, deletedAt: null },
      });
    });

    if (!supplier) {
      log.warn({ supplierId, orderId }, 'dropship route: supplier not found');
      continue;
    }

    // Create the dropship_orders row before calling the adapter (idempotent: skip if exists).
    const existing = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipOrder.findFirst({
        where: { tenantId, orderId, supplierId },
      });
    });
    if (existing) {
      log.info({ supplierId, orderId }, 'dropship route: order already exists for supplier');
      continue;
    }

    const dsOrder = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipOrder.create({
        data: {
          tenantId,
          orderId,
          supplierId,
          status: 'pending',
          lineItems: lineItems,
        },
      });
    });

    const adapterOrder: Order = {
      sparxOrderId: orderId,
      sparxOrderNumber: order.orderNumber,
      lineItems: lineItems.map((l): OrderLineItem => ({
        supplierSku: l.sku,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
      })),
      shippingAddress: shipping,
      customerNote: order.customerNote ?? undefined,
    };

    try {
      const adapter = createAdapter(
        supplier.type,
        supplier.credentials as Record<string, string>,
        feedDeps
      );

      if (adapter.orderRecipient) {
        await emailOrderToSupplier({
          tenantId,
          orderId,
          dropshipOrderId: dsOrder.id,
          supplier: { id: supplierId, name: supplier.name },
          recipient: adapter.orderRecipient(),
          order: {
            orderNumber: order.orderNumber,
            currency: order.currency,
            propertyId: order.propertyId,
            customerNote: order.customerNote,
          },
          shipTo: shipping,
          lines: lineItems,
          publisher,
          log,
        });
        continue;
      }

      const result = await adapter.submitOrder(adapterOrder);

      await withTenant({ tenantId }, async (tx) => {
        await tx.dropshipOrder.update({
          where: { id: dsOrder.id },
          data: {
            supplierOrderId: result.supplierOrderId,
            // `pending` is an order waiting on someone (a supplier the owner orders
            // from by hand), not one the supplier has (sparx persona issue 170).
            status: result.status,
            errorMessage: result.errorMessage ?? null,
            submittedAt: result.status === 'submitted' ? new Date() : null,
          },
        });
      });

      if (result.status === 'pending') {
        log.info({ dsOrderId: dsOrder.id, supplierId }, 'dropship order waits for the owner');
      } else if (result.status === 'failed') {
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
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error({ supplierId, orderId, err: errMsg }, 'dropship adapter.submitOrder threw');
      await withTenant({ tenantId }, async (tx) => {
        await tx.dropshipOrder.update({
          where: { id: dsOrder.id },
          data: { status: 'failed', errorMessage: errMsg },
        });
      });
      await publishEvent(
        publisher,
        'dropship.order.failed',
        tenantId,
        null,
        { dropshipOrderId: dsOrder.id, orderId, supplierId, error: errMsg },
        log
      );
    }
  }
}

/**
 * Email the order to a supplier who takes orders by email (sparx persona issue
 * 171), from the business, and record it as sent. When it cannot go (no cost for
 * a line, no address) the order waits for the owner with the reason, the same as
 * an order the owner places by hand (sparx persona issue 170).
 */
async function emailOrderToSupplier(args: {
  tenantId: string;
  orderId: string;
  dropshipOrderId: string;
  supplier: { id: string; name: string };
  recipient: { email: string; contactName: string | null };
  order: {
    orderNumber: string;
    currency: string;
    propertyId: string | null;
    customerNote: string | null;
  };
  shipTo: ShippingAddress;
  lines: {
    sku: string;
    quantity: number;
    name: string;
    productId: string | null;
    variantId: string | null;
    costCents: number | null;
  }[];
  publisher: ReturnType<typeof createPublisher>;
  log: Logger;
}): Promise<void> {
  const { tenantId, supplier, log } = args;

  // Their code and their price live on the link the owner made when they said
  // this supplier ships the product; the variant's own SKU and cost stand in
  // for a product sourced some other way.
  const productIds = args.lines
    .map((line) => line.productId)
    .filter((id): id is string => id !== null);
  const [links, business, tenant] = await withTenant({ tenantId }, (tx) =>
    Promise.all([
      tx.dropshipProductLink.findMany({
        where: {
          tenantId,
          productId: { in: productIds },
          dropshipProduct: { supplierId: supplier.id },
        },
        select: {
          productId: true,
          supplierSku: true,
          dropshipProduct: { select: { costPriceCents: true, variants: true } },
        },
      }),
      tx.tenantBusiness.findUnique({ where: { tenantId }, select: { businessName: true } }),
      tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    ])
  );
  const linkOf = new Map(links.map((link) => [link.productId, link]));

  const lines: SupplierOrderLine[] = args.lines.map((line) => {
    const link = line.productId ? linkOf.get(line.productId) : undefined;
    // The version that was bought, at that version's code and price (sparx
    // persona issue 362), else the product's one code and price.
    const theirs = supplierLineFor(
      line,
      link
        ? {
            supplierSku: link.supplierSku,
            costPriceCents: link.dropshipProduct.costPriceCents,
            versions: handVersionsOf(link.dropshipProduct.variants),
          }
        : undefined
    );
    return {
      title: line.name,
      supplierSku: theirs.supplierSku,
      quantity: line.quantity,
      unitCostCents: theirs.unitCostCents,
    };
  });

  // The name the business prints on its own documents (resolveBusinessIdentity
  // in api-rest): its business name, else the account's. `||` on purpose: a name
  // that is blank after trimming falls through to the next.
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const fromName = business?.businessName?.trim() || tenant?.name.trim() || supplier.name;

  const email = supplierOrderEmail({
    fromName,
    supplierName: supplier.name,
    contactName: args.recipient.contactName,
    orderNumber: args.order.orderNumber,
    currency: args.order.currency,
    shipTo: args.shipTo,
    lines,
    customerNote: args.order.customerNote,
  });

  if (!email.ok) {
    await withTenant({ tenantId }, (tx) =>
      tx.dropshipOrder.update({
        where: { id: args.dropshipOrderId },
        data: { status: 'pending', errorMessage: email.reason },
      })
    );
    log.info(
      { dsOrderId: args.dropshipOrderId, supplierId: supplier.id },
      'dropship order waits for the owner'
    );
    return;
  }

  await publishEvent(
    args.publisher,
    'email.send',
    tenantId,
    null,
    {
      to: args.recipient.email,
      template: 'purchase-order-sent',
      sendAs: 'tenant',
      ...(args.order.propertyId ? { propertyId: args.order.propertyId } : {}),
      props: email.props,
    },
    log
  );

  await withTenant({ tenantId }, (tx) =>
    tx.dropshipOrder.update({
      where: { id: args.dropshipOrderId },
      data: { status: 'submitted', submittedAt: new Date(), errorMessage: null },
    })
  );
  await publishEvent(
    args.publisher,
    'dropship.order.submitted',
    tenantId,
    null,
    {
      dropshipOrderId: args.dropshipOrderId,
      orderId: args.orderId,
      supplierId: supplier.id,
      supplierOrderId: null,
    },
    log
  );
  log.info(
    { dsOrderId: args.dropshipOrderId, supplierId: supplier.id },
    'dropship order emailed to supplier'
  );
}
