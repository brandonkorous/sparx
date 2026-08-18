// Purchase-order print brand resolution (docs/100 P3b). The PO document renderer
// (@wizeworks/inventory's renderPurchaseOrderHtml) is brand-free; the composition root
// resolves the BUYER's identity (the tenant issuing the PO) and hands it in —
// mirroring how invoice-render.ts resolves the issuing tenant's brand. The seller
// masthead NAME and address come from the BUSINESS (TenantBusiness → tenant legal
// name), never a site name (docs/49); the visual identity comes from the shared
// brand resolver the email platform owns.
//
// Identity resolution is shared with invoice-render.ts (business-identity.ts) so
// a PO and an invoice from the same business cannot disagree about who sent
// them — and so the seller ADDRESS block, which this renderer has always read
// but nothing ever populated, is filled from one place.

import { brandService } from '@wizeworks/email-platform';
import type { PurchaseOrderDocumentBrand } from '@wizeworks/inventory';
import { resolveBusinessIdentity } from './business-identity.js';

export async function resolvePurchaseOrderBrand(ctx: {
  tenantId: string;
}): Promise<PurchaseOrderDocumentBrand> {
  const [brand, identity] = await Promise.all([
    brandService.resolveEmailBrand(ctx),
    resolveBusinessIdentity(ctx),
  ]);
  if (!brand) return identity;
  return {
    primary: brand.primary,
    foreground: brand.foreground,
    muted: brand.muted,
    border: brand.border,
    fontHeading: brand.fontHeading,
    fontBody: brand.fontBody,
    ...(brand.logoUrl ? { logoUrl: brand.logoUrl } : {}),
    ...identity,
  };
}
