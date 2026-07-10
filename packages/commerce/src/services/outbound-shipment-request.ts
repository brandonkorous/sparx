// Builds the outbound ShipmentRequest (tenant warehouse → customer) for a
// specific order fulfillment, and quotes live rates for it. The
// order-fulfillment routes use this to let staff pick a real carrier rate
// before buying a label — the return-direction counterpart is
// return-label-purchase.ts's buildReturnShipmentRequest.

import { withTenant } from '@sparx/db';
import type { AddressSnapshotType, RateOption, ShipmentRequest } from '@sparx/commerce-schemas';

import { CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { rateShipment } from './shipping-service';
import { resolvePackageForItems, resolveShipFromAddress } from './shipping-request-resolver';

export async function buildOutboundShipmentRequest(
  ctx: ServiceContext,
  fulfillmentId: string
): Promise<ShipmentRequest> {
  const built = await withTenant(ctx, async (tx) => {
    const fulfillment = await tx.orderFulfillment.findFirst({
      where: { id: fulfillmentId },
      select: { orderId: true, items: { select: { orderItemId: true, quantity: true } } },
    });
    if (!fulfillment) throw new CommerceNotFoundError('OrderFulfillment', fulfillmentId);

    const order = await tx.order.findFirst({
      where: { id: fulfillment.orderId },
      select: { shippingAddress: true, currency: true },
    });
    if (!order?.shippingAddress) {
      throw new CommerceValidationError('This order has no shipping address on file.');
    }

    const orderItemIds = fulfillment.items.map((i) => i.orderItemId);
    const orderItems = await tx.orderItem.findMany({
      where: { id: { in: orderItemIds } },
      select: { id: true, variantId: true },
    });
    const variantIdByOrderItem = new Map(orderItems.map((i) => [i.id, i.variantId]));

    const variantIds = [
      ...new Set(orderItems.map((i) => i.variantId).filter((v): v is string => Boolean(v))),
    ];
    const variants = variantIds.length
      ? await tx.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            weightGrams: true,
            lengthMm: true,
            widthMm: true,
            heightMm: true,
            product: {
              select: { weightGrams: true, lengthMm: true, widthMm: true, heightMm: true },
            },
          },
        })
      : [];
    const variantById = new Map(variants.map((v) => [v.id, v]));

    const packagingItems = fulfillment.items.map((line) => {
      const variantId = variantIdByOrderItem.get(line.orderItemId);
      const variant = variantId ? variantById.get(variantId) : undefined;
      return {
        quantity: line.quantity,
        weightGrams: variant?.weightGrams ?? null,
        lengthMm: variant?.lengthMm ?? null,
        widthMm: variant?.widthMm ?? null,
        heightMm: variant?.heightMm ?? null,
        productWeightGrams: variant?.product.weightGrams ?? null,
        productLengthMm: variant?.product.lengthMm ?? null,
        productWidthMm: variant?.product.widthMm ?? null,
        productHeightMm: variant?.product.heightMm ?? null,
      };
    });

    return {
      toAddress: order.shippingAddress as AddressSnapshotType,
      currency: order.currency,
      packagingItems,
    };
  });

  const fromAddress = await resolveShipFromAddress(ctx);

  return {
    fromAddress,
    toAddress: built.toAddress,
    packages: [resolvePackageForItems(built.packagingItems)],
    currency: built.currency,
    signatureRequired: false,
    saturdayDelivery: false,
  };
}

/** Rate options for a fulfillment, ready to render as a "pick a carrier"
 *  list. Throws (rather than degrading to manual-only) when the ship-from
 *  address or order shipping address is missing — staff buying a real
 *  label need to know why, unlike checkout's quote step which just wants
 *  *something* to show the shopper. */
export async function quoteOutboundRates(
  ctx: ServiceContext,
  fulfillmentId: string
): Promise<RateOption[]> {
  const request = await buildOutboundShipmentRequest(ctx, fulfillmentId);
  return rateShipment(ctx, request);
}
