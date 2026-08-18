// Auto-purchase a return shipping label on approval — the return-direction
// counterpart to checkout's rate/label flow (customer address → tenant
// warehouse, instead of warehouse → customer). Split out of
// return-service.ts to keep the lifecycle/CRUD file focused; this owns
// "how does an approved return get a label."

import { withTenant } from '@wizeworks/db';
import type { AddressSnapshotType, ShipmentRequest } from '@wizeworks/commerce-schemas';

import type { ServiceContext } from '../errors';
import { tryBuyReturnLabel, tryLiveRates } from './shipping-provider-bridge';
import { resolvePackageForItems, resolveShipFromAddress } from './shipping-request-resolver';

/** Best-effort: auto-purchase a return label from the tenant's connected
 *  carrier (cheapest live rate for the approved items, shipped from the
 *  customer's address back to the tenant's warehouse). Never throws — no
 *  carrier installed, no live rate, or an unconfigured warehouse address
 *  all just mean the dashboard falls back to its "print label manually"
 *  CTA (null), same as before this bridge existed. */
export async function attemptReturnLabel(
  ctx: ServiceContext,
  returnId: string
): Promise<string | null> {
  const request = await buildReturnShipmentRequest(ctx, returnId);
  if (!request) return null;

  const rates = await tryLiveRates(ctx, request);
  const cheapest = [...rates].sort((a, b) => a.amountCents - b.amountCents)[0];
  if (!cheapest) return null;

  const result = await tryBuyReturnLabel(ctx, { returnId, rateRef: cheapest.rateRef });
  return result?.labelMediaId ?? null;
}

async function buildReturnShipmentRequest(
  ctx: ServiceContext,
  returnId: string
): Promise<ShipmentRequest | null> {
  const built = await withTenant(ctx, async (tx) => {
    const ret = await tx.returnRequest.findFirst({
      where: { id: returnId },
      include: { items: true },
    });
    if (!ret) return null;
    const order = await tx.order.findFirst({
      where: { id: ret.orderId },
      select: {
        shippingAddress: true,
        currency: true,
        items: { select: { id: true, variantId: true } },
      },
    });
    if (!order?.shippingAddress) return null;

    const orderItemById = new Map(order.items.map((i) => [i.id, i]));
    const variantIds = [
      ...new Set(
        ret.items
          .map((li) => orderItemById.get(li.orderItemId)?.variantId)
          .filter((v): v is string => Boolean(v))
      ),
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

    const packagingItems = ret.items
      .map((li) => {
        const quantity = li.approvedQuantity > 0 ? li.approvedQuantity : 0;
        if (quantity <= 0) return null;
        const variantId = orderItemById.get(li.orderItemId)?.variantId;
        const variant = variantId ? variantById.get(variantId) : undefined;
        return {
          quantity,
          weightGrams: variant?.weightGrams ?? null,
          lengthMm: variant?.lengthMm ?? null,
          widthMm: variant?.widthMm ?? null,
          heightMm: variant?.heightMm ?? null,
          productWeightGrams: variant?.product.weightGrams ?? null,
          productLengthMm: variant?.product.lengthMm ?? null,
          productWidthMm: variant?.product.widthMm ?? null,
          productHeightMm: variant?.product.heightMm ?? null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (packagingItems.length === 0) return null;

    return {
      shippingAddress: order.shippingAddress as AddressSnapshotType,
      currency: order.currency,
      packagingItems,
    };
  });
  if (!built) return null;

  let toAddress: AddressSnapshotType;
  try {
    toAddress = await resolveShipFromAddress(ctx);
  } catch {
    return null;
  }

  return {
    fromAddress: built.shippingAddress,
    toAddress,
    packages: [resolvePackageForItems(built.packagingItems)],
    currency: built.currency,
    signatureRequired: false,
    saturdayDelivery: false,
  };
}
