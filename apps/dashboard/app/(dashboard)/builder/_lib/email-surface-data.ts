import { brandIdentityOverlay, compileTokens, DEFAULT_THEME_KEY } from '@sparx/site-themes';

import { getBrand, getTenant, publicMediaUrl } from '../_brand/lib/api';
import type { BrandDto } from '../_brand/lib/types';
import { getEmailBindingCatalog, listEmails, listEmailsForProperty } from './api';
import { resolveSiteScope, type BrandOverride } from '@/lib/sites';
import type { EmailBuilderAppProps } from '../_builder/email-builder-app';

// Shared server data-loading for the EMAIL surface (docs/52, docs/93) — used by
// both the standalone /builder/email route AND the unified builder studio's Email
// sibling surface (docs/builder/03 §2.7). Extracted so the per-site brand merge,
// the email-exact canvas theme, and the sender identity stay in ONE place (the
// per-site brand correctness is load-bearing — docs/49 — and must not diverge).

// A font NAME → an email-safe family stack (no webfont reliance). Mirrors the
// email-platform brand-service's `fontStack` so the canvas font matches the send.
function fontStack(name: string | undefined): string {
  const clean = (name ?? '').replace(/['"]/g, '').trim();
  return clean ? `'${clean}', Arial, Helvetica, sans-serif` : 'Helvetica, Arial, sans-serif';
}

// Merge the active site's `brand_override` (docs/49 §3) OVER the tenant brand,
// field-by-field — IDENTICAL to the send path (brand-service.resolveEmailBrand):
// an absent/null override field inherits the tenant brand. Identity-only.
function mergeEmailBrandIdentity(brand: BrandDto, override: BrandOverride | null) {
  return {
    businessName: override?.businessName ?? brand.businessName,
    logoMediaId: override?.logoMediaId ?? brand.logoLightMediaId,
    colorPrimary: override?.colorPrimary ?? brand.colorPrimary,
    colorPrimaryForeground: override?.colorPrimaryForeground ?? brand.colorPrimaryForeground,
    colorAccent: override?.colorAccent ?? brand.colorAccent,
    fontHeading: override?.fontHeading ?? brand.fontHeading,
    fontBody: override?.fontBody ?? brand.fontBody,
  };
}

// The EMAIL brand resolves DIFFERENTLY from the site theme (docs/93): the email
// brand-service overlays the tenant's brand IDENTITY on the DEFAULT preset — it
// never inherits the tenant's chosen SITE theme. Resolve it the SAME way and emit
// it as a `.bx-canvas[data-surface='email']` override — higher specificity than
// the site theme's `.bx-canvas`, so the email leaves + chrome paint the SEND's
// fonts / hairlines / accent. Defensive: '' on a failed read.
async function emailBrandCanvasCss(override: BrandOverride | null): Promise<string> {
  try {
    const brand = await getBrand();
    const identity = mergeEmailBrandIdentity(brand, override);
    const t = compileTokens(DEFAULT_THEME_KEY, { light: brandIdentityOverlay(identity) }).light;
    const vars = [
      `--st-base-100:${t.colorBackground}`,
      `--st-base-200:${t.colorMuted}`,
      `--st-base-content:${t.colorForeground}`,
      `--st-primary:${t.colorPrimary}`,
      `--st-primary-content:${t.colorPrimaryForeground}`,
      `--st-border:${t.colorBorder}`,
      `--st-font-heading:${fontStack(t.fontHeading)}`,
      `--st-font-body:${fontStack(t.fontBody)}`,
    ].join(';');
    return `.bx-canvas[data-surface='email']{${vars}}`;
  } catch {
    return '';
  }
}

// The emails the editor opens — the active site's view for a multi-site tenant
// (docs/49 Phase 7b), else the tenant-wide catalog. Defensive cascade to [].
async function loadEmails(propertyId: string | undefined) {
  try {
    return propertyId ? await listEmailsForProperty(propertyId) : await listEmails();
  } catch {
    try {
      return await listEmails();
    } catch {
      return [];
    }
  }
}

async function loadCatalog() {
  try {
    return await getEmailBindingCatalog();
  } catch {
    return { sources: [] };
  }
}

// The tenant's sending identity for the canvas inbox-envelope `From` row (docs/49,
// docs/52). The name is the SITE name (Property.name); the address is the default
// Sparx sending subdomain; the per-site override's logo wins (same merge as send).
async function loadSender(
  override: BrandOverride | null,
  siteName: string
): Promise<{ name: string; address: string | null; logoUrl: string | null; siteName: string }> {
  try {
    const [brand, tenant] = await Promise.all([getBrand(), getTenant()]);
    const identity = mergeEmailBrandIdentity(brand, override);
    const address = tenant.slug ? `hello@${tenant.slug}.sparx.email` : null;
    const logoUrl = tenant.slug ? publicMediaUrl(identity.logoMediaId, tenant.slug) : null;
    return { name: siteName, address, logoUrl, siteName };
  } catch {
    return { name: siteName, address: null, logoUrl: null, siteName };
  }
}

/** The fully-resolved Email surface: the EmailBuilderApp props + the email-exact
 *  canvas theme CSS, or `empty` when no emails could be loaded. */
export type EmailSurfaceData =
  | { kind: 'ok'; props: EmailBuilderAppProps; emailBrandCss: string }
  | { kind: 'empty' };

export async function loadEmailSurfaceData(): Promise<EmailSurfaceData> {
  // The active site (docs/49): a multi-site tenant authors ONE site at a time (the
  // breadcrumb switcher's cookie); a single-site tenant gets `undefined` and the
  // tenant-wide catalog. `activeSite` gates the per-site fork affordance + override.
  const scope = await resolveSiteScope().catch(() => null);
  const activePropertyId = scope?.activePropertyId;
  const activeSite =
    scope && activePropertyId ? scope.sites.find((s) => s.id === activePropertyId) : undefined;
  const brandOverride = activeSite?.brandOverride ?? null;
  const siteName =
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- `||` is intended: an empty trimmed name must fall through to the primary site's name, then the placeholder, which `??` would not do.
    activeSite?.name?.trim() || scope?.sites.find((s) => s.isPrimary)?.name?.trim() || 'Your site';

  const [emailBrandCss, emails, catalog, sender] = await Promise.all([
    emailBrandCanvasCss(brandOverride),
    loadEmails(activePropertyId),
    loadCatalog(),
    loadSender(brandOverride, siteName),
  ]);

  if (emails.length === 0) return { kind: 'empty' };

  return {
    kind: 'ok',
    emailBrandCss,
    props: {
      initialEmails: emails,
      bindingCatalog: catalog,
      senderName: sender.name,
      senderAddress: sender.address,
      senderLogoUrl: sender.logoUrl,
      tenant: { name: sender.siteName, supportEmail: sender.address },
      site:
        activePropertyId && activeSite
          ? { propertyId: activePropertyId, name: activeSite.name }
          : undefined,
    },
  };
}
