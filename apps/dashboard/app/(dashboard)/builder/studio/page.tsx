import type { Metadata } from 'next';
import type { BindingCatalog, BuilderLayoutDto, BuilderPageDto } from '@sparx/builder-schemas';
import { buildThemeCssV2, compileThemeForTenant } from '@sparx/site-themes';

import {
  getBrand,
  getConfig,
  getSitePreviewData,
  getTenant,
  listSavedThemes,
  resolveMediaUrl,
} from '../_brand/lib/api';
import { applyBrandOverride } from '../_brand/lib/site-brand';
import { propertyOrigin } from '../_brand/lib/property';
import { getActiveProperty } from '@/lib/sites';
import { getBindingCatalog, listComponentsFull, listLayouts, listPages } from '../_lib/api';
import { loadEmailSurfaceData } from '../_lib/email-surface-data';
import type { BrandDto, SiteConfigDto, SiteDto, SitePreviewConfig } from '../_brand/lib/types';
import { StudioApp } from '../_builder/studio-app';
import '../builder.css';
// The Surface RECIPE — @sparx/site-ui's `st-*` classes pre-scoped to `.bx-canvas`,
// so the live chrome + page render exactly as the published site (docs/47 §5).
import '@sparx/site-ui/styles.canvas.css';

// /builder/studio — the UNIFIED builder shell (docs/builder/03): one editor whose
// canvas is the live stack (brand theme › site layout › active page at the Outlet),
// with the Email sibling surface alongside. It composes the data the three former
// routes each loaded on their own — the page/site catalog + binding sources, the
// brand/theme bundle, and the email surface — into one studio. The Phase-7 cutover
// (docs/builder/07) made this THE builder editor: /builder/page · /site · /brand
// redirect here (to the matching zone via `?zone=` / `?page=`); /builder/email is
// kept as a sibling route. `?page=<id>` opens that page in the Outlet on mount.

export const metadata: Metadata = {
  title: 'Builder · Studio',
};

// The server-compiled tenant theme scoped to `.bx-canvas` — first-paint brand for
// the canvas, before the live Theme panel takes over. Uses the EFFECTIVE brand
// (base, or base+override for a non-primary site) so a non-primary site previews
// in ITS brand. Defensive: '' on a failed read (the canvas falls back to studio brand).
function canvasThemeCss(brand: BrandDto, config: SiteConfigDto): string {
  try {
    const compiled = compileThemeForTenant({
      themeKey: config.themeKey,
      brand,
      presentation: config.draftSettings.presentation ?? null,
    });
    return buildThemeCssV2(compiled, { rootSelector: '.bx-canvas' });
  } catch {
    return '';
  }
}

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
    savedThemes,
    activeProperty,
    tenant,
    layouts,
    pages,
    pageCatalog,
    components,
    email,
  ] = await Promise.all([
    searchParams,
    getBrand(),
    getConfig(),
    listSavedThemes(),
    getActiveProperty().catch(() => null),
    getTenant(),
    loadLayouts(),
    loadPages(),
    loadCatalog(),
    listComponentsFull(),
    loadEmailSurfaceData(),
  ]);

  const initialPageId = typeof sp.page === 'string' ? sp.page : undefined;
  // The cutover redirects /builder/brand → ?zone=theme and /builder/site →
  // ?zone=layout (docs/builder/07 §2.2); the studio opens on that zone.
  const initialZone = sp.zone === 'theme' || sp.zone === 'layout' ? sp.zone : undefined;

  // The brand the studio authors: the tenant base for the primary site, else the
  // base with this site's override applied (so a non-primary site shows ITS look).
  const isPrimary = activeProperty?.isPrimary ?? true;
  const effectiveBrand = isPrimary
    ? baseBrand
    : applyBrandOverride(baseBrand, activeProperty?.brandOverride);

  const [logoLight, logoDark, favicon] = await Promise.all([
    resolveMediaUrl(effectiveBrand.logoLightMediaId),
    resolveMediaUrl(effectiveBrand.logoDarkMediaId),
    resolveMediaUrl(effectiveBrand.faviconMediaId),
  ]);

  // The active site's per-site socials (docs/49) — stored on the Property settings.
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

  const siteOrigin = tenant.slug ? propertyOrigin(tenant.slug, activeProperty) : undefined;
  const sitePreviewConfig: SitePreviewConfig = {
    origin: propertyOrigin(tenant.slug, activeProperty),
    tenantSlug: tenant.slug,
    propertySlug: activeProperty?.slug ?? null,
  };
  const sitePreview = await getSitePreviewData(activeProperty?.slug);
  const themeCss = canvasThemeCss(effectiveBrand, config);

  return (
    <>
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      {/* The email-brand override (docs/93) — wins on the Email surface's canvas. */}
      {email.kind === 'ok' && email.emailBrandCss ? (
        <style dangerouslySetInnerHTML={{ __html: email.emailBrandCss }} />
      ) : null}
      {/* Key on the active site id so switching sites (the breadcrumb switcher does a
          soft router.refresh()) REMOUNTS the studio with the new site's identity —
          its layouts, pages, AND the Theme form. Without it, the client useState
          initializers keep the prior site's catalog/brand even though the server
          passes fresh props (docs/49 per-site brand; matches the retired brand editor). */}
      <StudioApp
        key={site.id || 'no-site'}
        site={{
          initialLayouts: layouts,
          initialPages: pages,
          pageCatalog,
          components,
          siteOrigin,
          sitePreview,
          initialPageId,
          initialZone,
          tenantSlug: tenant.slug,
          previewPropertySlug: activeProperty?.slug,
          theme: {
            brand: effectiveBrand,
            baseBrand,
            site,
            config,
            savedThemes,
            media: { logoLight, logoDark, favicon },
            sitePreview: sitePreviewConfig,
          },
        }}
        email={email.kind === 'ok' ? email.props : null}
      />
    </>
  );
}
