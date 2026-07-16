import type { Metadata } from 'next';
import { THEME_PRESETS, type Site, type Theme } from '@wizeworks/silicaui-html';
import { COMMERCE_SOURCES, SITE_SOURCES, toSilicaDataSources } from '@sparx/builder-schemas';
import { compileThemeForTenant, compiledToSilicaTheme } from '@sparx/site-themes';
import { ensureUniqueIds, starterSite } from '@sparx/silica-catalog';
import { isModuleEnabled, requireSession } from '@sparx/auth';

import { getActiveProperty } from '@/lib/sites';
import { getBindingCatalog, getBuilderSite, listPages } from '../_lib/api';
import { getBrand, getConfig, getSitePreviewData } from '../_brand/lib/api';
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
    // NOT `.catch(() => null)` — see getBuilderSite. `null` means "no site yet, seed the
    // starter", so swallowing a read failure here seeds a starter OVER the tenant's real
    // site and the first autosave persists it. Let it throw to the error boundary instead.
    getBuilderSite(),
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

  // The tenant's REAL chrome data (site name + public logo URL + socials), scoped to the
  // active property so a per-site brand override previews correctly. Sequenced after the
  // batch above because it needs the resolved property slug. Overlays the synthetic
  // preview data below so a bound Wordmark/Logo on the FRAME renders the actual brand on
  // the canvas — passing `null` here left `site.identity.*` unresolved, so a bound
  // wordmark silently fell back to its literal placeholder text and an author editing the
  // layout could never see their own name or logo (docs/122). Self-defends: a failed read
  // degrades to a bare "Brand" rather than throwing.
  const sitePreview = await getSitePreviewData(activeProperty?.slug);

  // Page bindings + the page-TYPE picker (record types) come from the tenant catalog
  // (CMS/commerce/CRM/scheduling); fall back to the code commerce sources when the fetch
  // fails so the editor always opens with a working picker.
  const pageSources = catalog.sources.length ? catalog.sources : [...COMMERCE_SOURCES];
  const root = buildPreviewData(pageSources, sitePreview);
  // The BINDING picker additionally offers the site/chrome sources (site.identity.logo /
  // name, social) so an author editing the FRAME can bind the tenant logo/name onto any
  // node — the "assign the logo to the wordmark" path (docs/122). Scoped to the picker:
  // kept OUT of `pageSources` so the page-TYPE picker never lists `site.social` as a bogus
  // template record type. The canvas still RESOLVES these paths — `sitePreview` above
  // supplies their real values — so binding the logo previews the actual asset.
  const dataSources = toSilicaDataSources([...pageSources, ...SITE_SOURCES]);

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
    ? {
        version: '1.0.0',
        ...storedSite,
        theme,
        // Heal legacy stored trees that predate id-stamping (or carry a duplicate id) before
        // the engine edits them: without ids, silica's Navigator keys layer rows by TAG, so
        // several id-less <a> links collide on key "a" ("two children with the same key").
        // Idempotent for already-stamped trees; the healed ids persist on the next autosave,
        // so the stored data self-corrects after one edit.
        pages: storedSite.pages.map((p) => ({ ...p, root: ensureUniqueIds(p.root) })),
        ...(storedSite.frame
          ? { frame: { ...storedSite.frame, root: ensureUniqueIds(storedSite.frame.root) } }
          : {}),
      }
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
      sources={pageSources}
      initialPageId={initialPageId}
    />
  );
}
