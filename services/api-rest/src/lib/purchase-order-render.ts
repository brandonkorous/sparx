// Purchase-order print brand resolution (docs/100 P3b). The PO document renderer
// (@sparx/inventory's renderPurchaseOrderHtml) is brand-free; the composition root
// resolves the BUYER's identity (the tenant issuing the PO) and hands it in —
// mirroring how invoice-render.ts resolves the issuing tenant's brand. The seller
// masthead NAME is the tenant's business name (TenantBrand.businessName → tenant
// legal name), never a site name (docs/49); the visual identity comes from the
// shared brand resolver the email platform owns.

import { withTenant } from '@sparx/db';
import { brandService } from '@sparx/email-platform';
import type { PurchaseOrderDocumentBrand } from '@sparx/inventory';

export async function resolvePurchaseOrderBrand(ctx: {
  tenantId: string;
}): Promise<PurchaseOrderDocumentBrand> {
  const [brand, tenant, tenantBrand] = await Promise.all([
    brandService.resolveEmailBrand(ctx),
    withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true } })
    ),
    withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.tenantBrand.findUnique({
        where: { tenantId: ctx.tenantId },
        select: { businessName: true },
      })
    ),
  ]);
  // The business/legal name of the issuing tenant — never a site name.
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- `||` is intended: an empty trimmed name must fall through to the next source, which `??` would not do.
  const businessName = tenantBrand?.businessName?.trim() || tenant?.name?.trim() || undefined;
  const nameField = businessName ? { businessName } : {};
  if (!brand) return nameField;
  return {
    primary: brand.primary,
    foreground: brand.foreground,
    muted: brand.muted,
    border: brand.border,
    fontHeading: brand.fontHeading,
    fontBody: brand.fontBody,
    ...(brand.logoUrl ? { logoUrl: brand.logoUrl } : {}),
    ...nameField,
  };
}
