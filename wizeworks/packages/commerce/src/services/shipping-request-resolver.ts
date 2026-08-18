// Resolves the real ship-from address (tenant warehouse) and package
// weight/dimensions (variant, falling back to product defaults) that a
// live ShippingProvider call needs. Checkout used to send Shippo-shaped
// stubs through (`{ line1: '—', city: '—', country: 'US' }`, all-zero
// dimensions) — this is what replaces that placeholder.

import type {
  AddressSnapshotType as AddressSnapshot,
  ShipmentPackage,
} from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import { inventoryService } from '@wizeworks/inventory';

import { CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';

const DEFAULT_ITEM_WEIGHT_GRAMS = 500;
const DEFAULT_ITEM_DIMENSION_MM = 100; // 10cm cube — used only when a merchant hasn't set real dims.

/** Resolves the tenant's ship-from address from their default (or an
 *  explicitly named) warehouse. Throws a friendly, actionable error when
 *  no warehouse is configured or its address is incomplete — callers that
 *  need a hard requirement (buying a label) should let this propagate;
 *  callers that can degrade gracefully (a rate quote) should catch it and
 *  fall back to manual rates instead of failing checkout outright. */
export async function resolveShipFromAddress(
  ctx: ServiceContext,
  opts: { warehouseId?: string; channel?: string } = {}
): Promise<AddressSnapshot> {
  const warehouseId =
    opts.warehouseId ??
    (await inventoryService.resolveDefaultWarehouseId(ctx, opts.channel ?? 'storefront'));
  if (!warehouseId) {
    throw new CommerceValidationError(
      'No active warehouse is configured — add one under Inventory → Warehouses to enable live carrier rates.'
    );
  }
  const [warehouse, tenant] = await withTenant(ctx, (tx) =>
    Promise.all([
      tx.warehouse.findFirst({
        where: { id: warehouseId },
        select: {
          name: true,
          line1: true,
          line2: true,
          city: true,
          region: true,
          postalCode: true,
          country: true,
          phone: true,
        },
      }),
      tx.tenant.findFirst({ where: { id: ctx.tenantId }, select: { email: true } }),
    ])
  );
  if (!warehouse) {
    throw new CommerceValidationError('The configured default warehouse no longer exists.');
  }
  const missing = (['line1', 'city', 'postalCode', 'country'] as const).filter(
    (field) => !warehouse[field]
  );
  if (missing.length > 0) {
    throw new CommerceValidationError(
      `Your ship-from warehouse address is incomplete (missing ${missing.join(', ')}) — finish it under Inventory → Warehouses to enable live carrier rates.`
    );
  }
  return {
    recipientName: warehouse.name,
    line1: warehouse.line1!,
    line2: warehouse.line2 ?? undefined,
    city: warehouse.city!,
    region: warehouse.region ?? undefined,
    postalCode: warehouse.postalCode!,
    country: warehouse.country!,
    phone: warehouse.phone ?? undefined,
    // The warehouse has no dedicated contact email (no column for it) — the
    // tenant's account email is a reasonable stand-in; some carriers (USPS
    // via Shippo) reject a real label purchase without a seller email+phone.
    email: tenant?.email ?? undefined,
  };
}

/** A real address has a real street line, city, postal code, and country —
 *  the placeholders checkout used to send (`line1: '—'`, `city: '—'`) fail
 *  this check, which is exactly how rateShipment() decides whether it's
 *  safe to call a live carrier or should stick to manual rates. Verified
 *  directly against Shippo: a placeholder destination address returns zero
 *  usable rates (carriers geocode the full address to rate, not just the
 *  ZIP), so `requireStreet` is NOT optional for a real quote — the caller
 *  must supply the shopper's actual street/city, which the checkout form
 *  already collects before "Get shipping rates" is even clickable. The
 *  parameter exists only for a hypothetical future caller that has a
 *  genuinely address-optional use case; every current caller wants the
 *  default (`true`). */
export function isAddressUsableForLiveRating(addr: AddressSnapshot, requireStreet = true): boolean {
  if (!addr.postalCode || !addr.country) return false;
  if (!requireStreet) return true;
  return Boolean(addr.line1 && addr.line1 !== '—' && addr.city && addr.city !== '—');
}

export interface PackagingItem {
  quantity: number;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  productWeightGrams: number | null;
  productLengthMm: number | null;
  productWidthMm: number | null;
  productHeightMm: number | null;
}

/** Consolidates cart/order line items into ONE shippable package — the
 *  simplification the rest of the shipping-quote pipeline already assumes
 *  (docs/104). Per-item weight/dimensions fall back variant → product →
 *  a nominal default when a merchant hasn't filled either in, so a quote
 *  is always obtainable. Box dimensions take the largest single item on
 *  each axis (a "biggest item sets the box size" heuristic, not true
 *  bin-packing — good enough for a rate estimate, not for freight). */
export function resolvePackageForItems(items: PackagingItem[]): ShipmentPackage {
  let weight = 0;
  let length = DEFAULT_ITEM_DIMENSION_MM;
  let width = DEFAULT_ITEM_DIMENSION_MM;
  let height = DEFAULT_ITEM_DIMENSION_MM;
  for (const item of items) {
    weight +=
      (item.weightGrams ?? item.productWeightGrams ?? DEFAULT_ITEM_WEIGHT_GRAMS) * item.quantity;
    length = Math.max(length, item.lengthMm ?? item.productLengthMm ?? DEFAULT_ITEM_DIMENSION_MM);
    width = Math.max(width, item.widthMm ?? item.productWidthMm ?? DEFAULT_ITEM_DIMENSION_MM);
    height = Math.max(height, item.heightMm ?? item.productHeightMm ?? DEFAULT_ITEM_DIMENSION_MM);
  }
  return {
    weight: Math.max(weight, 1),
    dimensions: { lengthMm: length, widthMm: width, heightMm: height },
    containsHazmat: false,
    hazmatClass: 'none',
  };
}
