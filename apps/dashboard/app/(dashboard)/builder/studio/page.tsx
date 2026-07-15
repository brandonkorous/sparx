import type { Metadata } from 'next';
import { THEME_PRESETS, type Site, type Theme } from '@wizeworks/silicaui-html';
import { COMMERCE_SOURCES, SITE_SOURCES, toSilicaDataSources } from '@sparx/builder-schemas';
import { compileThemeForTenant, compiledToSilicaTheme } from '@sparx/site-themes';
import { starterSite } from '@sparx/silica-catalog';
import { isModuleEnabled, requireSession } from '@sparx/auth';

import { getActiveProperty } from '@/lib/sites';
import { getBindingCatalog, getBuilderSite, listPages } from '../_lib/api';
import { getBrand, getConfig } from '../_brand/lib/api';
import { applyBrandOverride } from '../_brand/lib/site-brand';
import type { BrandDto, SiteConfigDto } from '../_brand/lib/types';

import { buildPreviewData } from '../_builder/binding-catalog';
import { SilicaStudio } from '../_builder/silica-studio';

// /builder/studio — THE site editor, on the silica `<Builder>` engine (docs/118).
// The engine owns the canvas, page switching, the frame/Outlet chrome, symbols,
// theme, and undo; sparx supplies the HOST (binding resolver + the tenant's data
// sources) and the page-domain drawer, and persists the whole extracted `Site`
// through the debounced sync. The hand-rolled `.bx-*` `SiteStudio` it replaced is
// deleted — this route WAS a parallel-run proof surface at /builder/silica, and
// that route is gone now that the storefront renders silica end-to-end
// (apps/site/lib/silica.ts) with the code starter as the universal fallback.
//
// `?page=<id>` opens that page on mount (the silica page id IS the BuilderPage row
// id) — the deep link the CMS entry editor, the SEO surface, and a blueprint
// install use to jump straight to a template.

export const metadata: Metadata = {
  title: 'Builder · Studio',
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

interface BuilderStudioRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BuilderStudioRoute({ searchParams }: BuilderStudioRouteProps) {
  const session = await requireSession();
  const [
    sp,
    catalog,
    baseBrand,
    config,
    activeProperty,
    storedSite,
    pages,
    commerceEnabled,
    schedulingEnabled,
  ] = await Promise.all([
    searchParams,
    getBindingCatalog().catch(() => ({ sources: [] })),
    getBrand().catch(() => FALLBACK_BRAND),
    getConfig().catch(() => FALLBACK_CONFIG),
    getActiveProperty().catch(() => null),
    getBuilderSite().catch(() => null),
    // The page catalog with domain metadata (recordType / isDefault / SEO) — the
    // seed for the header page-settings drawer. Empty on failure (drawer still opens,
    // just without pre-filled values until the first save).
    listPages().catch(() => []),
    // Only shapes the STARTER seed (below) for a tenant with no silica site yet —
    // fails open to `true` (today's unconditional-Shop behavior) so a lookup
    // failure never hides real Commerce chrome from a paying tenant.
    isModuleEnabled(session.user.tenantId, 'commerce').catch(() => true),
    // Same, for the Scheduling module's Book link/page — fails CLOSED (opt-in).
    isModuleEnabled(session.user.tenantId, 'scheduling').catch(() => false),
  ]);

  const initialPageId = typeof sp.page === 'string' ? sp.page : undefined;

  // The tenant's real binding catalog drives the picker + the resolver root; fall
  // back to the code-defined commerce + site sources when the fetch fails so the
  // editor always opens with a working binding picker.
  const sources = catalog.sources.length ? catalog.sources : [...COMMERCE_SOURCES, ...SITE_SOURCES];
  const root = buildPreviewData(sources, null);
  const dataSources = toSilicaDataSources(sources);

  // Preview in this site's brand: the tenant base for the primary site, else the
  // base with this site's override applied (docs/49), so a non-primary site's
  // canvas opens on ITS look.
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

  // The full multi-page silica Site — the engine owns page-switching, the
  // frame/Outlet chrome, symbols, and undo. A property with no silica site yet
  // opens on the starter seed, and the first autosave materializes it into the
  // store (siteService.sync).
  const site: Site = storedSite
    ? { version: '1.0.0', ...storedSite, theme }
    : starterSite(theme, { commerceEnabled, schedulingEnabled });

  return (
    <SilicaStudio
      // Key on the active site id so switching sites (the breadcrumb switcher does a
      // soft router.refresh()) REMOUNTS the studio with the new site's document —
      // the engine reads `document` once at mount, so without this the prior site's
      // tree would stay on the canvas even though the server passed a fresh one.
      key={activeProperty?.id ?? 'no-site'}
      site={site}
      root={root}
      dataSources={dataSources}
      pages={pages}
      sources={sources}
      initialPageId={initialPageId}
    />
  );
}
