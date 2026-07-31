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
// sparx defaultBrand).
//
// Light palette is the base; the brand also carries its site's DARK neutrals
// (`BrandTokens.dark`, from the preset's dark tokens) so the silica send can emit an
// `@media (prefers-color-scheme: dark)` block aligned to the site (docs/impl
// transactional-email §10) — progressive enhancement for Apple/Outlook-Mac, ignored by
// Gmail/Outlook.com. We read concrete token values — never CSS custom properties —
// because React Email inlines styles and `var(--…)` doesn't survive in Gmail/Outlook.
// Theme compilation is delegated to @sparx/site-themes; we never fork a second registry.

import { withTenant } from '@sparx/db';
import {
  brandIdentityOverlay,
  colorToHex,
  compileTokens,
  DEFAULT_THEME_KEY,
  type ThemeTokens,
} from '@sparx/site-themes';
import type { BrandTokens } from '@sparx/email';

import type { ServiceContext } from '../errors';

// The site's PUBLISHED silica theme (builder_site.silicaPublishedTheme) — the single
// source of the look (docs/impl theming-spine plan). A flat `--*` token bag: light in
// `tokens`, the dark color delta in `dark`. Read loosely (it's a JSON column); email
// only needs the handful of role/surface/font tokens below.
interface SilicaThemeRow {
  tokens?: Record<string, string> | null;
  dark?: Record<string, string> | null;
}

function parseSilicaTheme(value: unknown): SilicaThemeRow | null {
  if (!value || typeof value !== 'object') return null;
  const t = value as SilicaThemeRow;
  return t.tokens && typeof t.tokens === 'object' ? t : null;
}

// A silica font token is a full stack (`'Inter', system-ui, …`); email wants the
// family name so `fontStack` can rebuild an email-safe stack (Arial/Helvetica).
function firstFamily(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  // The family is the first entry, unquoted. An empty result is harmless — the
  // caller feeds it to `fontStack`, which falls back to the email-safe stack.
  return stack
    .split(',')[0]
    ?.trim()
    .replace(/^['"]|['"]$/g, '');
}

// A resolved silica theme → email `BrandTokens`, every color flattened to hex
// (Gmail/Outlook can't parse `oklch()`, and React Email inlines concrete values —
// so this is a format conversion of the ONE source, not a second source of truth).
// Identity (logo/name/socials) is threaded in from `brand`/property, unchanged.
export function siteThemeToBrand(
  theme: SilicaThemeRow,
  extras: { logoUrl?: string; siteName?: string; socials?: { platform: string; url: string }[] }
): BrandTokens {
  const light = theme.tokens ?? {};
  const dark = { ...light, ...(theme.dark ?? {}) };
  const hex = (bag: Record<string, string>, key: string, fallback: string): string =>
    colorToHex(bag[key]) ?? fallback;
  const headStack = light['--font-heading'] ?? light['--font-head'];
  return {
    primary: hex(light, '--color-primary', '#111111'),
    primaryForeground: hex(light, '--color-primary-content', '#ffffff'),
    accent: hex(light, '--color-accent', hex(light, '--color-primary', '#111111')),
    background: hex(light, '--color-base-100', '#ffffff'),
    foreground: hex(light, '--color-base-content', '#111111'),
    muted: hex(light, '--color-base-200', '#f4f4f5'),
    border: hex(light, '--color-border', '#e4e4e7'),
    fontHeading: fontStack(firstFamily(headStack) ?? ''),
    fontBody: fontStack(firstFamily(light['--font-sans']) ?? ''),
    ...(extras.logoUrl ? { logoUrl: extras.logoUrl } : {}),
    ...(extras.siteName ? { siteName: extras.siteName } : {}),
    ...(extras.socials?.length ? { socials: extras.socials } : {}),
    dark: {
      background: hex(dark, '--color-base-100', '#0b0b0c'),
      foreground: hex(dark, '--color-base-content', '#e4e4e7'),
      muted: hex(dark, '--color-base-200', '#18181b'),
      border: hex(dark, '--color-border', '#27272a'),
      primary: hex(dark, '--color-primary', '#ffffff'),
      primaryForeground: hex(dark, '--color-primary-content', '#0b0b0c'),
      accent: hex(dark, '--color-accent', hex(dark, '--color-primary', '#ffffff')),
    },
  };
}

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
  // The per-site light logo. `logoLightMediaId` is what the Builder Brand page
  // writes today; `logoMediaId` is the legacy single-logo field kept so
  // pre-expansion overrides still resolve. Read BOTH (new field wins) exactly as
  // property-brand.ts `mergeBrandIdentity` does — reading only the legacy field
  // silently ignored every current per-site logo and fell back to the tenant's,
  // so a non-primary site's booking/order email wore the tenant's logo.
  logoLightMediaId?: string | null;
  logoMediaId?: string | null;
}

function parseBrandOverride(value: unknown): BrandOverride | null {
  return value && typeof value === 'object' ? value : null;
}

/** The site's social links out of its free-form `settings` JSON — the SAME shape the
 *  storefront reads (`{ platform, url }[]`) — so the footer's social row matches the
 *  live site. Defensive: the column is unvalidated, so anything malformed is dropped. */
function extractSocials(settings: unknown): { platform: string; url: string }[] {
  const raw = (settings as { socials?: unknown } | null)?.socials;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is { platform: string; url: string } =>
      !!s &&
      typeof s === 'object' &&
      typeof (s as { platform?: unknown }).platform === 'string' &&
      typeof (s as { url?: unknown }).url === 'string'
  );
}

/**
 * Resolve the email brand for a send, or `null` when there's no brand identity
 * (the caller then renders with @sparx/email's sparx defaults). When `propertyId`
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
            select: { name: true, brandOverride: true, settings: true },
          })
        : Promise.resolve(null),
      // The tenant's PRIMARY site — the fallback when no specific property is in
      // scope (a tenant-wide send). Only read when we don't already have the active
      // property row. Carries `brandOverride` because the primary site's brand now
      // lives on its OWN property row like every other site's; TenantBrand is only
      // the inherited default for a site that has never been branded, so a
      // tenant-wide send that read the base alone would render an unbranded email.
      propertyId
        ? Promise.resolve(null)
        : tx.property.findFirst({
            where: { isPrimary: true },
            select: { id: true, name: true, settings: true, brandOverride: true },
          }),
    ]);

    const override = parseBrandOverride((propertyRow ?? primaryProperty)?.brandOverride ?? null);
    const slug = tenant?.slug ?? '';

    // Merge the per-site override OVER the tenant brand, field-by-field — an
    // absent/null override field inherits the tenant value. logoMediaId overrides
    // the tenant's light logo. IDENTITY ONLY now (name + logo): the LOOK
    // (colours/fonts) comes from the site's silica theme below. Computed up front —
    // before any early return — because a site can carry a published silica theme
    // WITHOUT a TenantBrand, and that email should still render themed.
    const brand = {
      businessName: override?.businessName ?? brandRow?.businessName ?? null,
      colorPrimary: override?.colorPrimary ?? brandRow?.colorPrimary ?? null,
      colorPrimaryForeground:
        override?.colorPrimaryForeground ?? brandRow?.colorPrimaryForeground ?? null,
      colorAccent: override?.colorAccent ?? brandRow?.colorAccent ?? null,
      fontHeading: override?.fontHeading ?? brandRow?.fontHeading ?? null,
      fontBody: override?.fontBody ?? brandRow?.fontBody ?? null,
      // New field wins over the legacy single-logo field, then the tenant base —
      // mirrors mergeBrandIdentity so email and storefront resolve the same logo.
      logoLightMediaId:
        override?.logoLightMediaId ?? override?.logoMediaId ?? brandRow?.logoLightMediaId ?? null,
    };

    // The wordmark/footer name is the customer-facing SITE name (Property.name —
    // the active site, else the tenant's primary), NEVER the tenant's legal/org name.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- `||` is intended: an empty trimmed name must collapse to undefined, which `??` would not do.
    const siteName = (propertyRow?.name ?? primaryProperty?.name)?.trim() || undefined;
    // The active site's socials (else the primary's) — for the footer's social row.
    const socials = extractSocials(propertyRow?.settings ?? primaryProperty?.settings);
    const logoUrl = logoUrlFor(brand.logoLightMediaId, slug);

    // ── SINGLE SOURCE OF THE LOOK (docs/impl theming-spine plan) ──────────────────
    // The site's PUBLISHED silica theme drives the email's palette + fonts, flattened
    // to hex, so the email matches the storefront for that exact site. Identity
    // (logo/name/socials) threads in from `brand`. Read the theme of the send's
    // property (else the tenant's primary).
    const effectivePropertyId = propertyId ?? primaryProperty?.id ?? null;
    const themeRow = effectivePropertyId
      ? await tx.builderSite.findUnique({
          where: { propertyId: effectivePropertyId },
          select: { silicaPublishedTheme: true },
        })
      : null;
    const silicaTheme = parseSilicaTheme(themeRow?.silicaPublishedTheme);
    if (silicaTheme) {
      return siteThemeToBrand(silicaTheme, { logoUrl, siteName, socials });
    }

    // ── Fallback: brand-derived look ─────────────────────────────────────────────
    // For a site that has published no silica theme yet (an existing brand-only
    // tenant). Retires once every site's effective theme is persisted as its
    // silica theme (the Phase-5 backfill migration).
    //
    // A tenant with no brand record AND no per-site override → sparx defaults.
    if (brandRow === null && !override) return null;
    // A merged brand with no identity tokens at all → defaults. `businessName` still
    // counts: a tenant who set a brand name (but no colours/logo) keeps a branded email.
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
    // preset; unset tokens inherit the preset. Compile both modes so the send can emit
    // a dark-mode block (docs/impl transactional-email §10).
    const overlay = brandIdentityOverlay(brand);
    const compiled = compileTokens(DEFAULT_THEME_KEY, { light: overlay, dark: overlay });
    return {
      ...tokensToBrand(compiled.light, { logoUrl, siteName }),
      ...(socials.length ? { socials } : {}),
      dark: {
        background: compiled.dark.colorBackground,
        foreground: compiled.dark.colorForeground,
        muted: compiled.dark.colorMuted,
        border: compiled.dark.colorBorder,
        primary: compiled.dark.colorPrimary,
        primaryForeground: compiled.dark.colorPrimaryForeground,
        accent: compiled.dark.colorAccent,
      },
    };
  });
}
