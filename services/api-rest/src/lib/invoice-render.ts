// Invoice print brand resolution (docs/87 §10, Phase 5).
//
// The invoicing default renderer (@sparx/crm's renderBillingDocumentHtml) is
// brand-free; the composition root resolves the tenant's brand and hands it in.
// We reuse the SAME tenant brand the email platform resolves (brandService) so a
// printed invoice and a tenant email carry one identity — TenantBrand is the
// platform-wide source of truth (docs/30 §6), never re-derived per surface. The
// email BrandTokens shape maps 1:1 onto the renderer's BillingRenderBrand.

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

/** Resolve the tenant brand into the invoice renderer's brand shape. Returns `{}`
 *  (renderer falls back to Sparx defaults) when the tenant has no brand identity. */
export async function resolveInvoiceBrand(ctx: ServiceContext): Promise<BillingRenderBrand> {
  const brand = await brandService.resolveEmailBrand(ctx);
  if (!brand) return {};
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
    ...(brand.siteName ? { businessName: brand.siteName } : {}),
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
