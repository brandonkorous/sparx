import { ModuleProvider } from '@sparx/ui';
import { getActiveProperty } from '@/lib/sites';
import { getBrand, getConfig, resolveMediaUrl } from '../_brand/lib/api';
import { applyBrandOverride } from '../_brand/lib/site-brand';
import type { BrandDto, SiteDto } from '../_brand/lib/types';
import { SiteSettings } from './_components/site-settings';

// The Builder's bx-toolbar/bx-ctx classes — loaded here so Site settings wears
// the SAME toolbar as the rest of the Builder (docs/45).
import '../builder.css';

// Site settings — the active web property's IDENTITY, on its own Builder nav row
// (docs/49 per-site brand). Authors the fields the silica frame binds through
// `site.identity` / `site.social`: the customer-facing NAME (Property.name), the
// TAGLINE, light/dark LOGO, FAVICON, and SOCIAL links. Theme (colours, fonts,
// shape) is owned by the silica builder itself now, so this surface is identity
// only — the former Brand & Theme surface split its identity half here.
//
// Switching sites (breadcrumb) swaps everything the page shows: a non-primary
// site edits ITS override, a primary site edits the tenant base brand + Property.
export default async function BuilderSitePage() {
  const [baseBrand, activeProperty, config] = await Promise.all([
    getBrand(),
    getActiveProperty(),
    getConfig(),
  ]);

  // The identity fields the page edits: the tenant base for the primary site,
  // else the base with this site's override applied (so a non-primary site shows
  // ITS tagline/logos/favicon, not the tenant's).
  const isPrimary = activeProperty?.isPrimary ?? true;
  const effectiveBrand: BrandDto = isPrimary
    ? baseBrand
    : applyBrandOverride(baseBrand, activeProperty?.brandOverride);

  const [logoLight, logoDark, favicon] = await Promise.all([
    resolveMediaUrl(effectiveBrand.logoLightMediaId),
    resolveMediaUrl(effectiveBrand.logoDarkMediaId),
    resolveMediaUrl(effectiveBrand.faviconMediaId),
  ]);

  // The active site's per-property fields — its customer-facing name + own
  // socials (stored under Property.settings.socials). Defaults cover a brand-new
  // tenant with no property yet (the primary is always seeded in practice).
  const settings = activeProperty?.settings;
  const socials =
    settings &&
    typeof settings === 'object' &&
    Array.isArray((settings as { socials?: unknown }).socials)
      ? ((settings as { socials?: { platform: string; url: string }[] }).socials ?? [])
      : [];
  const site: SiteDto = {
    id: activeProperty?.id ?? '',
    name: activeProperty?.name ?? baseBrand.businessName ?? '',
    isPrimary,
    socials,
  };

  return (
    <ModuleProvider module="builder">
      {/* Key on the active site id so switching sites remounts the form with the
          new site's identity (docs/49) — otherwise useState initializers keep the
          prior site's values even though the server passes fresh props. */}
      <SiteSettings
        key={site.id || 'no-site'}
        site={site}
        brand={effectiveBrand}
        baseBrand={baseBrand}
        media={{ logoLight, logoDark, favicon }}
        appearancePolicy={config.appearancePolicy}
      />
    </ModuleProvider>
  );
}
