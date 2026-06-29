import type { Metadata } from 'next';
import type { BindingCatalog, BuilderLayoutDto, BuilderPageDto } from '@sparx/builder-schemas';

import { getBrand, getConfig, getSitePreviewData, getTenant } from '../_brand/lib/api';
import { applyBrandOverride } from '../_brand/lib/site-brand';
import { propertyOrigin } from '../_brand/lib/property';
import { getActiveProperty } from '@/lib/sites';
import {
  getBindingCatalog,
  listArchetypes,
  listComponentsFull,
  listLayouts,
  listPages,
} from '../_lib/api';
import { canvasThemeCss } from '../_lib/canvas-theme';
import type { BrandDto, SiteConfigDto } from '../_brand/lib/types';
import { StudioApp } from '../_builder/studio-app';
import '../builder.css';
// The Surface RECIPE — @sparx/site-ui's `st-*` classes pre-scoped to `.bx-canvas`,
// so the live chrome + page render exactly as the published site (docs/47 §5).
import '@sparx/site-ui/styles.canvas.css';

// /builder/studio — the UNIFIED builder shell (docs/builder/03): one editor whose
// canvas is the live stack (site layout › active page at the Outlet), themed by the
// SAVED brand theme (compiled server-side into a static `.bx-canvas` style). It
// composes the page/site catalog + binding sources into one studio. The Phase-7
// cutover (docs/builder/07) made this THE site editor: /builder/page · /site
// redirect here (to the matching zone via `?zone=` / `?page=`). BRAND & THEME are
// edited on their own surface, /builder/brand, and EMAIL on /builder/email — neither
// is a surface of this studio. `?page=<id>` opens that page in the Outlet on mount.

export const metadata: Metadata = {
  title: 'Builder · Studio',
};

const FALLBACK_TENANT = {
  id: '',
  name: 'Workspace',
  slug: '',
} as const;

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

async function loadLayouts(): Promise<BuilderLayoutDto[]> {
  try {
    return await listLayouts();
  } catch {
    return [];
  }
}

async function loadPages(): Promise<BuilderPageDto[]> {
  try {
    return await listPages();
  } catch {
    return [];
  }
}

async function loadCatalog(): Promise<BindingCatalog> {
  try {
    return await getBindingCatalog();
  } catch {
    return { sources: [] };
  }
}

interface BuilderStudioRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BuilderStudioRoute({ searchParams }: BuilderStudioRouteProps) {
  const [
    sp,
    baseBrand,
    config,
    activeProperty,
    tenant,
    layouts,
    pages,
    pageCatalog,
    components,
    archetypes,
  ] = await Promise.all([
    searchParams,
    getBrand().catch(() => FALLBACK_BRAND),
    getConfig().catch(() => FALLBACK_CONFIG),
    getActiveProperty().catch(() => null),
    getTenant().catch(() => FALLBACK_TENANT),
    loadLayouts(),
    loadPages(),
    loadCatalog(),
    listComponentsFull(),
    listArchetypes(),
  ]);

  const initialPageId = typeof sp.page === 'string' ? sp.page : undefined;
  // The cutover redirects /builder/site → ?zone=layout (docs/builder/07 §2.2); the
  // studio opens on that zone. (/builder/brand is its own surface — no redirect.)
  const initialZone = sp.zone === 'layout' ? 'layout' : undefined;

  // The brand the canvas previews: the tenant base for the primary site, else the
  // base with this site's override applied (so a non-primary site shows ITS look).
  // Compiled to a static `.bx-canvas` style below — the editor doesn't edit it.
  const isPrimary = activeProperty?.isPrimary ?? true;
  const effectiveBrand = isPrimary
    ? baseBrand
    : applyBrandOverride(baseBrand, activeProperty?.brandOverride);

  const siteOrigin = tenant.slug ? propertyOrigin(tenant.slug, activeProperty) : undefined;
  const sitePreview = await getSitePreviewData(activeProperty?.slug);
  const themeCss = canvasThemeCss(effectiveBrand, config);

  return (
    <>
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      {/* Key on the active site id so switching sites (the breadcrumb switcher does a
          soft router.refresh()) REMOUNTS the studio with the new site's identity —
          its layouts + pages. Without it, the client useState initializers keep the
          prior site's catalog even though the server passes fresh props (docs/49). */}
      <StudioApp
        key={activeProperty?.id ?? 'no-site'}
        site={{
          initialLayouts: layouts,
          initialPages: pages,
          pageCatalog,
          components,
          archetypes,
          siteOrigin,
          sitePreview,
          initialPageId,
          initialZone,
          tenantSlug: tenant.slug,
          previewPropertySlug: activeProperty?.slug,
        }}
      />
    </>
  );
}
