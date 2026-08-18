// Invoice print brand resolution (docs/87 §10, Phase 5).
//
// The invoicing default renderer (@wizeworks/crm's renderBillingDocumentHtml) is
// brand-free; the composition root resolves the tenant's brand and hands it in.
// We reuse the SAME tenant brand the email platform resolves (brandService) for the
// VISUAL identity (colors/logo/type) — TenantBrand is the platform-wide source of
// truth (docs/30 §6).
//
// But WHO ISSUED the document — its name and address — is not brand. An invoice
// is issued by the BUSINESS: WizeWorks issues it, even when the customer bought
// through the site called "sparx". So that half resolves from TenantBusiness
// (business-identity.ts), never from a site, and never from brand.

import { brandService } from '@wizeworks/email-platform';
import {
  billingTemplateService,
  renderBillingDocumentHtml,
  type BillingRenderBrand,
  type BillingRenderData,
  type ServiceContext,
} from '@wizeworks/crm';
import type { BuilderNode } from '@wizeworks/builder-schemas';

import { renderInvoiceTree } from './invoice-tree-render.js';
import { resolveBusinessIdentity } from './business-identity.js';

/** Resolve the tenant brand into the invoice renderer's brand shape: the visual
 *  identity from the shared brand resolver, but the printed NAME and seller
 *  ADDRESS from the BUSINESS (TenantBusiness → tenant legal name), never a site
 *  name. Returns just the identity when the tenant has no visual brand.
 *
 *  The address block is shared with purchase orders via business-identity.ts —
 *  `addressLines` had been declared on this brand shape since the renderer was
 *  written and populated by nothing, so the seller block printed empty on every
 *  invoice ever rendered. */
export async function resolveInvoiceBrand(ctx: ServiceContext): Promise<BillingRenderBrand> {
  const [brand, identity] = await Promise.all([
    brandService.resolveEmailBrand(ctx),
    resolveBusinessIdentity(ctx),
  ]);
  if (!brand) return identity;
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
    ...identity,
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
