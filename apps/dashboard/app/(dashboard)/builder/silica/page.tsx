import type { Metadata } from 'next';
import type { Theme } from '@wizeworks/silicaui-html';
import { COMMERCE_SOURCES, SITE_SOURCES, toSilicaDataSources } from '@sparx/builder-schemas';
import { compileThemeForTenant, compiledToSilicaTheme } from '@sparx/site-themes';

import { getActiveProperty } from '@/lib/sites';
import { getBindingCatalog } from '../_lib/api';
import { getBrand, getConfig } from '../_brand/lib/api';
import { applyBrandOverride } from '../_brand/lib/site-brand';
import type { BrandDto, SiteConfigDto } from '../_brand/lib/types';
import { buildPreviewData } from '../_builder/binding-catalog';
import { starterSilicaDocument } from '../_builder/silica-starter';
import { SilicaStudio } from '../_builder/silica-studio';

// /builder/silica — the engine-adoption studio (docs/118): the SAME editor surface
// as /builder/studio, but mounted on silica's `<Builder>` engine over the sparx
// `BuilderHost` (resolver + dataSources + validateClass + the commerce catalog).
// Additive + provable in isolation — the main /builder/studio route cuts over to
// this once persistence (onChange/onPublish) + the tenant document load are wired.

export const metadata: Metadata = {
  title: 'Builder · Studio (silica engine)',
};

const FALLBACK_BRAND: BrandDto = {
  tenantId: '',
  businessName: 'Workspace',
  tagline: null,
  logoLightMediaId: null,
  logoDarkMediaId: null,
  faviconMediaId: null,
  colorPrimary: null,
  colorPrimaryForeground: null,
  colorAccent: null,
  colorAccentForeground: null,
  colorSecondary: null,
  colorSecondaryForeground: null,
  fontHeading: null,
  fontBody: null,
  tokens: null,
};

const FALLBACK_CONFIG: SiteConfigDto = {
  tenantId: '',
  themeKey: 'default',
  appearancePolicy: 'auto',
  draftSettings: {},
  publishedVersionId: null,
  createdAt: '',
  updatedAt: '',
};

/** The tenant's compiled brand as a silica `Theme`, so the canvas previews the real
 *  brand (colors, type, rounding). Degrades to the starter's preset on any failure. */
function tenantTheme(brand: BrandDto, config: SiteConfigDto): Theme | undefined {
  try {
    const compiled = compileThemeForTenant({
      themeKey: config.themeKey,
      brand,
      presentation: config.draftSettings.presentation ?? null,
    });
    return compiledToSilicaTheme(compiled, config.themeKey);
  } catch {
    return undefined;
  }
}

export default async function SilicaBuilderRoute() {
  const [catalog, baseBrand, config, activeProperty] = await Promise.all([
    getBindingCatalog().catch(() => ({ sources: [] })),
    getBrand().catch(() => FALLBACK_BRAND),
    getConfig().catch(() => FALLBACK_CONFIG),
    getActiveProperty().catch(() => null),
  ]);

  // The tenant's real binding catalog drives the picker + the resolver root; fall
  // back to the code-defined commerce + site sources when the fetch fails so the
  // proof surface always renders.
  const sources = catalog.sources.length ? catalog.sources : [...COMMERCE_SOURCES, ...SITE_SOURCES];
  const root = buildPreviewData(sources, null);
  const dataSources = toSilicaDataSources(sources);

  // Preview in this site's brand (the base for the primary site, else the base with
  // this site's override applied), exactly like /builder/studio's canvas theme.
  const effectiveBrand =
    (activeProperty?.isPrimary ?? true)
      ? baseBrand
      : applyBrandOverride(baseBrand, activeProperty?.brandOverride);
  const theme = tenantTheme(effectiveBrand, config);

  return <SilicaStudio doc={starterSilicaDocument(theme)} root={root} dataSources={dataSources} />;
}
