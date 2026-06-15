// DTO shapes for the Builder's Brand & Theme surface. Kept as plain interfaces
// (not the Prisma row types) so client components can import them without
// pulling the service package / Prisma into the browser bundle.

import type { BrandTokenDoc, PresentationOverlayV2 } from '@sparx/site-themes';

export type AppearancePolicy = 'light-only' | 'dark-only' | 'auto' | 'toggle';

// The captured brand "look" stored on a saved theme (docs/33): identity colours,
// fonts, and the shape/feel token doc. Null on legacy rows saved before themes
// carried a snapshot. Applying a theme writes these onto the tenant brand.
export interface SavedThemeBrandDto {
  colorPrimary?: string | null;
  colorPrimaryForeground?: string | null;
  colorAccent?: string | null;
  colorAccentForeground?: string | null;
  colorSecondary?: string | null;
  colorSecondaryForeground?: string | null;
  fontHeading?: string | null;
  fontBody?: string | null;
  tokens?: BrandTokenDoc | null;
}

// A tenant-saved theme variant (docs/33 saved-themes contract). The tenant's
// own named theme snapshots — distinct from the read-only prebuilt presets.
// `presentation` is the v2 surface overlay; `basePresetKey` is the preset it
// layers on; `brand` is the captured identity look so the theme is
// self-contained. Backed by /v1/sitebuilder/saved-themes (editor-gated).
export interface SiteThemeDto {
  id: string;
  name: string;
  basePresetKey: string;
  presentation: PresentationOverlayV2;
  brand: SavedThemeBrandDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface SiteSettingsDto {
  tokens?: { light?: Record<string, string>; dark?: Record<string, string> };
  customCss?: string;
  // Token Model v2 presentation overlay (docs/33), edited by the theme inspector.
  presentation?: PresentationOverlayV2;
  // The currently-applied saved theme (the theme switcher selection), so it
  // survives a reload. Null/absent = editing a prebuilt preset base directly.
  activeSavedThemeId?: string | null;
}

export interface SiteConfigDto {
  tenantId: string;
  themeKey: string;
  appearancePolicy: AppearancePolicy;
  draftSettings: SiteSettingsDto;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SiteVersionDto {
  id: string;
  versionNumber: number;
  themeKey: string;
  appearancePolicy: AppearancePolicy;
  note: string | null;
  publishedById: string | null;
  createdAt: string;
}

export interface TenantDto {
  id: string;
  name: string;
  slug: string;
}

// Tenant brand — the platform-wide source of truth for brand identity
// (docs/30 §6). Tenant-level, above every module: read-only to consumers
// (email, CRM, the site theme). Edited here in the Builder, but the record is
// owned at the tenant level, not by the Builder module. Media fields store
// asset ids; the panel resolves them to URLs for the brand board preview via
// `resolveMediaUrl`.
export interface BrandDto {
  tenantId: string;
  businessName: string | null;
  tagline: string | null;
  logoLightMediaId: string | null;
  logoDarkMediaId: string | null;
  faviconMediaId: string | null;
  colorPrimary: string | null;
  colorPrimaryForeground: string | null;
  colorAccent: string | null;
  // The `*Foreground` fields are the optional `-content` overrides (null =
  // auto-derive); `colorSecondary` is the brand's second identity colour
  // (null = falls back to primary). docs/33 §3.1.
  colorAccentForeground: string | null;
  colorSecondary: string | null;
  colorSecondaryForeground: string | null;
  fontHeading: string | null;
  fontBody: string | null;
  // Brand-owned Token Model v2 shape/rhythm/effect (docs/33). Null = inherit the
  // theme preset. Colour/type stay in the dedicated fields above.
  // (Social links are NOT brand — they're a site setting on the tenant, edited
  // in /settings/general; see Tenant.socials, docs/45 §3.)
  tokens: BrandTokenDoc | null;
}

// Best-fit asset URLs for the three brand images, resolved server-side so the
// board preview can render logos on first paint without a client round-trip.
export interface BrandMediaUrls {
  logoLight: string | null;
  logoDark: string | null;
  favicon: string | null;
}

// The active site the Builder is authoring (docs/49). The Brand page edits this
// site's customer-facing NAME (Property.name), its own SOCIAL links, and — for a
// non-primary site — its brand OVERRIDE. `isPrimary` decides where brand edits
// land: the tenant base brand (primary) or this site's override (non-primary).
export interface SiteDto {
  id: string;
  name: string;
  isPrimary: boolean;
  socials: { platform: string; url: string }[];
}

// What the brand page's "Site" preview iframe needs to load the ACTIVE site live
// (docs/49). The iframe points at the tenant's web property and re-themes on every
// brand edit via the storefront PreviewBridge postMessage channel (no reload).
// `origin` is null when it can't be resolved (no tenant slug, or a prod localhost
// iframe we deliberately skip) — the page then shows only the component showcase.
export interface SitePreviewConfig {
  origin: string | null;
  tenantSlug: string;
  propertySlug: string | null;
}
