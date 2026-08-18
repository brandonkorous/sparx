// Packing-slip brand resolution (docs/146 Phase 4.5).
//
// Same shape as `purchase-order-render.ts` and deliberately NOT the same
// identity. A purchase order goes to a supplier, so its masthead is the tenant's
// legal business name. A packing slip goes to a CUSTOMER, and the name a customer
// knows is the SITE's — docs/49: `Property.name` is the customer-facing name and
// `Tenant.name` is billing-only and must never be rendered to a customer. A
// tenant running two shops must not put the holding company's name in a box.
//
// The order's own site wins over the primary one, so an order placed on the
// second shop ships with the second shop's name on the paper.

import { brandService } from '@wizeworks/email-platform';
import { withTenant } from '@wizeworks/db';
import type { PackingSlipBrand } from '@wizeworks/inventory';

import { resolveBusinessIdentity } from './business-identity.js';

export async function resolvePackingSlipBrand(
  ctx: { tenantId: string },
  packageId: string
): Promise<PackingSlipBrand> {
  const [brand, identity, site] = await Promise.all([
    brandService.resolveEmailBrand(ctx),
    resolveBusinessIdentity(ctx),
    resolveSiteForPackage(ctx, packageId),
  ]);

  return {
    ...identity,
    // The site name replaces the legal one; the ADDRESS block stays the
    // business's, because that is where a return physically goes.
    ...(site ? { businessName: site } : {}),
    ...(brand
      ? {
          primary: brand.primary,
          foreground: brand.foreground,
          muted: brand.muted,
          border: brand.border,
          fontHeading: brand.fontHeading,
          fontBody: brand.fontBody,
          ...(brand.logoUrl ? { logoUrl: brand.logoUrl } : {}),
        }
      : {}),
  };
}

/** The site the order was placed on, else the tenant's primary. Empty when the
 *  tenant has no site at all, in which case the business name stands. */
async function resolveSiteForPackage(
  ctx: { tenantId: string },
  packageId: string
): Promise<string> {
  const name = await withTenant(ctx, async (tx) => {
    const box = await tx.shipmentPackage.findFirst({
      where: { id: packageId },
      select: { order: { select: { propertyId: true } } },
    });
    const propertyId = box?.order?.propertyId ?? null;
    const row = propertyId
      ? await tx.property.findUnique({ where: { id: propertyId }, select: { name: true } })
      : await tx.property.findFirst({ where: { isPrimary: true }, select: { name: true } });
    return row?.name ?? '';
  });
  return name.trim();
}
