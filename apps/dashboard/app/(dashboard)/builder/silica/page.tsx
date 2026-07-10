import type { Metadata } from 'next';
import { THEME_PRESETS, type Site, type Theme } from '@wizeworks/silicaui-html';
import { COMMERCE_SOURCES, SITE_SOURCES, toSilicaDataSources } from '@sparx/builder-schemas';
import { compileThemeForTenant, compiledToSilicaTheme } from '@sparx/site-themes';

import { getActiveProperty } from '@/lib/sites';
import { getBindingCatalog, getBuilderSite } from '../_lib/api';
import { getBrand, getConfig } from '../_brand/lib/api';
import { applyBrandOverride } from '../_brand/lib/site-brand';
import type { BrandDto, SiteConfigDto } from '../_brand/lib/types';
import { starterSite } from '@sparx/silica-catalog';

import { buildPreviewData } from '../_builder/binding-catalog';
import { SilicaStudio } from '../_builder/silica-studio';

// /builder/silica — the engine-adoption studio (docs/118): silica's `<Builder>`
// engine over the sparx `BuilderHost` (resolver + dataSources + validateClass +
// the commerce catalog). Loads the tenant's STORED silica site (siteService) and
// persists edits back via the debounced site-sync autosave (SilicaStudio). The
// main /builder/studio route retires once the storefront renders silica too.

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
  const [catalog, baseBrand, config, activeProperty, storedSite] = await Promise.all([
    getBindingCatalog().catch(() => ({ sources: [] })),
    getBrand().catch(() => FALLBACK_BRAND),
    getConfig().catch(() => FALLBACK_CONFIG),
    getActiveProperty().catch(() => null),
    getBuilderSite().catch(() => null),
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
  // The theme the canvas opens on: the author's SAVED theme when they have edited
  // one (siteService round-trips it), else the tenant's brand-derived theme. Brand
  // stays the default; an authored theme is an explicit override that wins once
  // saved, and is never discarded (docs/118).
  const brandTheme = tenantTheme(effectiveBrand, config) ?? THEME_PRESETS[0]!;
  const theme: Theme = storedSite?.theme ?? brandTheme;

  // The full multi-page silica Site — silica's `<Builder>` owns page-switching, the
  // frame/Outlet chrome, symbols, and undo. Load the tenant's STORED silica site
  // (page bodies + frame + symbols + theme); a property with no silica site yet
  // opens on the starter seed, and the first autosave materializes it into the
  // store (siteService.sync).
  const site: Site = storedSite ? { version: '1.0.0', ...storedSite, theme } : starterSite(theme);

  return <SilicaStudio site={site} root={root} dataSources={dataSources} />;
}
