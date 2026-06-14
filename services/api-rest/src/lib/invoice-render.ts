// Invoice print brand resolution (docs/87 §10, Phase 5).
//
// The invoicing default renderer (@sparx/crm's renderBillingDocumentHtml) is
// brand-free; the composition root resolves the tenant's brand and hands it in.
// We reuse the SAME tenant brand the email platform resolves (brandService) for the
// VISUAL identity (colours/logo/type) — TenantBrand is the platform-wide source of
// truth (docs/30 §6). But the NAME printed on an invoice is the TENANT's business
// name — the legal entity that issues the document — NOT a site name: a businessName
// belongs to the tenant, not its sites (docs/49). So that one field is resolved
// separately from TenantBrand.businessName (→ tenant legal name), never from the
// email's site name.

import { withTenant } from '@sparx/db';
import { brandService } from '@sparx/email-platform';
import {
  billingTemplateService,
  renderBillingDocumentHtml,
  type BillingRenderBrand,
  type BillingRenderData,
  type ServiceContext,
} from '@sparx/crm';
import type { BuilderNode } from '@sparx/builder-schemas';

import { renderInvoiceTree } from './invoice-tree-render.js';

/** Resolve the tenant brand into the invoice renderer's brand shape: the visual
 *  identity from the shared brand resolver, but the printed NAME from the tenant's
 *  business name (TenantBrand.businessName → tenant legal name), never a site name.
 *  Returns just the name (or `{}`) when the tenant has no visual brand identity. */
export async function resolveInvoiceBrand(ctx: ServiceContext): Promise<BillingRenderBrand> {
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
  // The business/legal name of the issuing tenant — never the site name.
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- `||` is intended: an empty trimmed name must fall through to the next source, which `??` would not do.
  const businessName = tenantBrand?.businessName?.trim() || tenant?.name?.trim() || undefined;
  const nameField = businessName ? { businessName } : {};
  if (!brand) return nameField;
  return {
    primary: brand.primary,
    primaryForeground: brand.primaryForeground,
    accent: brand.accent,
    background: brand.background,
    foreground: brand.foreground,
    muted: brand.muted,
    border: brand.border,
    fontHeading: brand.fontHeading,
    fontBody: brand.fontBody,
    ...(brand.logoUrl ? { logoUrl: brand.logoUrl } : {}),
    ...nameField,
  };
}

/** Render a document's print-HTML through the tenant's ACTIVE published template
 *  (the builder-authored path, §10), or the built-in code default renderer when no
 *  template is published. The single render entry point for the `…/pdf` routes. */
export async function renderTenantInvoiceHtml(
  ctx: ServiceContext,
  data: BillingRenderData,
  brand: BillingRenderBrand
): Promise<string> {
  const active = await billingTemplateService.getActivePublishedTree(ctx);
  if (active) return renderInvoiceTree(active.tree as unknown as BuilderNode, data, brand);
  return renderBillingDocumentHtml(data, brand);
}
