import { ModuleProvider } from '@sparx/ui';
import { getActiveProperty } from '@/lib/sites';
import {
  getBrand,
  getConfig,
  getTenant,
  listSavedThemes,
  resolveMediaUrl,
} from '../_brand/lib/api';
import { applyBrandOverride } from '../_brand/lib/site-brand';
import { propertyOrigin } from '../_brand/lib/property';
import { ThemeCenter } from '../_brand/components/theme-center';
import type { SiteDto, SitePreviewConfig } from '../_brand/lib/types';

// The Builder's bx-toolbar/bx-ctx classes — loaded here so the Brand & Theme
// editor wears the SAME toolbar as the unified studio (docs/45).
import '../builder.css';

// Brand & Theme — its own surface in the Builder module (a module-level nav row,
// not a zone of the editor). Authors the ACTIVE site's identity (docs/49 "full
// per-site brand"): the customer-facing NAME (Property.name), its own social
// links, and its brand — the tenant BASE brand for the primary site, or this
// site's OVERRIDE for a non-primary one. Switching sites (breadcrumb) swaps
// everything the page shows.
//
// The dedicated page is the full ThemeCenter (variant="page"): a controls column
// beside a live preview that toggles between the component SHOWCASE and the real
// SITE iframe — the richer surface the unified editor's inline Theme inspector
// couldn't host (the editor canvas is the page-in-chrome, not a theme showcase).
//
// The save/publish path: server actions → PATCH /v1/brand (primary) or PATCH
// /v1/properties/:id brandOverride (non-primary) + the per-site site config;
// publish → compiled into the live site theme (with the per-site override merged
// in services/sitebuilder overlayBrand).
export default async function BuilderBrandPage() {
  const [baseBrand, config, savedThemes, activeProperty, tenant] = await Promise.all([
    getBrand(),
    getConfig(),
    listSavedThemes(),
    getActiveProperty(),
    getTenant(),
  ]);

  // The brand the page authors: the tenant base for the primary site, else the
  // base with this site's override applied (so a non-primary site shows ITS
  // colours/logo/type, not the tenant's).
  const isPrimary = activeProperty?.isPrimary ?? true;
  const effectiveBrand = isPrimary
    ? baseBrand
    : applyBrandOverride(baseBrand, activeProperty?.brandOverride);

  const [logoLight, logoDark, favicon] = await Promise.all([
    resolveMediaUrl(effectiveBrand.logoLightMediaId),
    resolveMediaUrl(effectiveBrand.logoDarkMediaId),
    resolveMediaUrl(effectiveBrand.faviconMediaId),
  ]);

  // The active site (defaults cover a brand-new tenant with no property yet —
  // the primary is always seeded in practice, so this is belt-and-braces).
  const settingsSocials =
    activeProperty &&
    typeof activeProperty.settings === 'object' &&
    activeProperty.settings !== null &&
    Array.isArray((activeProperty.settings as { socials?: unknown }).socials)
      ? ((activeProperty.settings as { socials?: { platform: string; url: string }[] }).socials ??
        [])
      : [];
  const site: SiteDto = {
    id: activeProperty?.id ?? '',
    name: activeProperty?.name ?? baseBrand.businessName ?? '',
    isPrimary,
    socials: settingsSocials,
  };

  // The live "Site" preview iframe target (docs/49) — the active web property's
  // public origin, scoped to its slug so a non-primary site previews ITS site.
  // propertyOrigin() returns null-equivalent only via the prod-localhost guard;
  // here it always resolves (dev → localhost:3004, prod → the zone host).
  const sitePreview: SitePreviewConfig = {
    origin: propertyOrigin(tenant.slug, activeProperty),
    tenantSlug: tenant.slug,
    propertySlug: activeProperty?.slug ?? null,
  };

  return (
    <ModuleProvider module="builder">
      {/* Key on the active site id so switching sites (breadcrumb switcher, a soft
          router.refresh()) REMOUNTS the editor with the new site's identity. Without
          it, ThemeCenter's useState initializers keep the prior site's brand/name in
          the form even though the server passes fresh props (docs/49 per-site brand). */}
      <ThemeCenter
        key={site.id || 'no-site'}
        brand={effectiveBrand}
        baseBrand={baseBrand}
        site={site}
        config={config}
        savedThemes={savedThemes}
        media={{ logoLight, logoDark, favicon }}
        sitePreview={sitePreview}
      />
    </ModuleProvider>
  );
}
