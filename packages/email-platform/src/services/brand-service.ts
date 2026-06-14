// brandService — resolves a tenant's email brand (the BrandTokens that
// @sparx/email threads through every template/atom).
//
// Brand is the tenant-level source of truth (docs/30 §6): email READS it, never
// overrides it. We read `TenantBrand` directly — the old cascade (Commerce
// CommerceSiteTheme → EmailSettings.brandingOverride → defaults) is gone; those
// sources were consolidated into TenantBrand by migration 20260610000000 and
// `brandingOverride` is removed. The brand's identity palette/typography overlay
// the default theme preset; unset tokens fall back to the preset, and a tenant
// with no brand identity at all yields null (caller renders @sparx/email's
// Sparx defaultBrand).
//
// Light palette only (email-client dark mode is unreliable). We read concrete
// token values — never CSS custom properties — because React Email inlines
// styles and `var(--…)` doesn't survive in Gmail/Outlook. Theme compilation is
// delegated to @sparx/site-themes; we never fork a second registry.

import { withTenant } from '@sparx/db';
import {
  brandIdentityOverlay,
  compileTokens,
  DEFAULT_THEME_KEY,
  type ThemeTokens,
} from '@sparx/site-themes';
import type { BrandTokens } from '@sparx/email';

import type { ServiceContext } from '../errors';

// Public origin of api-rest — where GET /v1/public/media/:id lives. NOT a
// generic "the API" url: media bytes are a REST concern; GraphQL
// (graphql.sparx.works) doesn't and shouldn't serve them. Falls back to the
// internal REST url only for local/dev, where there's no public origin.
const PUBLIC_API_BASE =
  process.env.SPARX_PUBLIC_API_REST_URL ??
  process.env.SPARX_API_REST_URL ??
  'http://localhost:3100';

// Public, cacheable media redirect (mirrors apps/site/lib/media.ts) — an
// absolute URL so an <img> renders in any mail client.
function logoUrlFor(mediaId: string | null | undefined, tenantSlug: string): string | undefined {
  if (!mediaId) return undefined;
  return `${PUBLIC_API_BASE}/v1/public/media/${encodeURIComponent(mediaId)}?tenant=${encodeURIComponent(
    tenantSlug
  )}`;
}

// A font *name* → an email-safe family stack (no webfont reliance).
function fontStack(name: string): string {
  const clean = name.replace(/['"]/g, '').trim();
  if (!clean) return 'Helvetica, Arial, sans-serif';
  return `'${clean}', Arial, Helvetica, sans-serif`;
}

function tokensToBrand(
  tokens: ThemeTokens,
  extras: { logoUrl?: string; siteName?: string }
): BrandTokens {
  return {
    primary: tokens.colorPrimary,
    primaryForeground: tokens.colorPrimaryForeground,
    accent: tokens.colorAccent,
    background: tokens.colorBackground,
    foreground: tokens.colorForeground,
    muted: tokens.colorMuted,
    border: tokens.colorBorder,
    fontHeading: fontStack(tokens.fontHeading),
    fontBody: fontStack(tokens.fontBody),
    ...(extras.logoUrl ? { logoUrl: extras.logoUrl } : {}),
    ...(extras.siteName ? { siteName: extras.siteName } : {}),
  };
}

// The per-site brand override (docs/49 §3, Property.brand_override) — the same
// presentation-only identity overlay the storefront merges. Read loosely from the
// JSON column; only the identity fields email cares about are picked. A site with
// no override (or null fields) inherits the tenant brand field-by-field.
interface BrandOverride {
  businessName?: string | null;
  colorPrimary?: string | null;
  colorPrimaryForeground?: string | null;
  colorAccent?: string | null;
  fontHeading?: string | null;
  fontBody?: string | null;
  logoMediaId?: string | null;
}

function parseBrandOverride(value: unknown): BrandOverride | null {
  return value && typeof value === 'object' ? value : null;
}

/**
 * Resolve the email brand for a send, or `null` when there's no brand identity
 * (the caller then renders with @sparx/email's Sparx defaults). When `propertyId`
 * is given (docs/49 Phase 7), the site's `brand_override` is merged field-by-field
 * OVER the tenant brand, so an email sent on behalf of a site renders that site's
 * name / colours / fonts / logo — exactly the merge the storefront payload does.
 */
export async function resolveEmailBrand(
  ctx: ServiceContext,
  propertyId?: string | null
): Promise<BrandTokens | null> {
  return withTenant(ctx, async (tx) => {
    const [brandRow, tenant, propertyRow, primaryProperty] = await Promise.all([
      tx.tenantBrand.findUnique({ where: { tenantId: ctx.tenantId } }),
      tx.tenant.findUnique({ where: { id: ctx.tenantId }, select: { slug: true } }),
      propertyId
        ? tx.property.findUnique({
            where: { id: propertyId },
            select: { name: true, brandOverride: true },
          })
        : Promise.resolve(null),
      // The tenant's PRIMARY site name — the fallback when no specific property is
      // in scope (a tenant-wide send). Only read when we don't already have the
      // active property row.
      propertyId
        ? Promise.resolve(null)
        : tx.property.findFirst({ where: { isPrimary: true }, select: { name: true } }),
    ]);

    const override = parseBrandOverride(propertyRow?.brandOverride);

    // A tenant with no brand record AND no per-site override → Sparx defaults
    // (null signals "use @sparx/email's defaultBrand").
    if (brandRow === null && !override) return null;

    // Merge the per-site override OVER the tenant brand, field-by-field — an
    // absent/null override field inherits the tenant value. logoMediaId overrides
    // the tenant's light logo. Identity-only (email never overrides shape/feel).
    const brand = {
      businessName: override?.businessName ?? brandRow?.businessName ?? null,
      colorPrimary: override?.colorPrimary ?? brandRow?.colorPrimary ?? null,
      colorPrimaryForeground:
        override?.colorPrimaryForeground ?? brandRow?.colorPrimaryForeground ?? null,
      colorAccent: override?.colorAccent ?? brandRow?.colorAccent ?? null,
      fontHeading: override?.fontHeading ?? brandRow?.fontHeading ?? null,
      fontBody: override?.fontBody ?? brandRow?.fontBody ?? null,
      logoLightMediaId: override?.logoMediaId ?? brandRow?.logoLightMediaId ?? null,
    };

    const slug = tenant?.slug ?? '';
    // The wordmark/footer name is the customer-facing SITE name (Property.name —
    // the active site, else the tenant's primary), NEVER the tenant's legal/org
    // name (docs/49). brand.businessName is no longer a name source; it stays only
    // as one signal that this tenant has a brand identity worth rendering (below).
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- `||` is intended: an empty trimmed name must collapse to undefined, which `??` would not do.
    const siteName = (propertyRow?.name ?? primaryProperty?.name)?.trim() || undefined;

    // A merged brand with no identity tokens at all → defaults. `businessName`
    // still counts: a tenant who set a brand name (but no colours/logo) keeps a
    // branded email — its wordmark just shows the SITE name now, not the name they
    // typed into brand settings.
    const hasIdentity = [
      brand.businessName,
      brand.colorPrimary,
      brand.colorPrimaryForeground,
      brand.colorAccent,
      brand.fontHeading,
      brand.fontBody,
      brand.logoLightMediaId,
    ].some(Boolean);
    if (!hasIdentity) return null;

    // Overlay the (merged) brand's identity palette/typography over the default
    // preset; unset tokens inherit the preset. Email uses the light palette only.
    const overlay = brandIdentityOverlay(brand);
    const compiled = compileTokens(DEFAULT_THEME_KEY, { light: overlay }).light;
    return tokensToBrand(compiled, {
      logoUrl: logoUrlFor(brand.logoLightMediaId, slug),
      siteName,
    });
  });
}
