import type { Metadata } from 'next';
import { SITE_CATALOG, type BuilderLayoutDto } from '@sparx/builder-schemas';
import { buildThemeCssV2, compileThemeForTenant } from '@sparx/storefront-themes';

import { getBrand, getConfig } from '../../sitebuilder/_lib/api';
import { getLayout } from '../_lib/api';
import { SiteBuilderApp } from '../_builder/site-builder-app';
import '../builder.css';

// /builder/site — the site LAYOUT editor (docs/45): the chrome shell (header ·
// outlet · footer) every page renders inside. Same editor as /builder/page, but
// pointed at the tenant's single layout and the `site` binding sources.
//
// Like the page editor, we compile the tenant brand to CSS scoped to the canvas
// so the chrome previews in the real brand. The layout get-or-seed endpoint seeds
// the starter header · outlet · footer on first load.

export const metadata: Metadata = {
  title: 'Builder · Site',
};

// Compile the tenant brand to CSS scoped to `.bx-canvas`. Defensive: a failed
// read returns '' and the canvas falls back to its built-in studio brand.
async function canvasThemeCss(): Promise<string> {
  try {
    const [brand, config] = await Promise.all([getBrand(), getConfig()]);
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

// The tenant's single layout (the endpoint seeds the starter shell on first
// call). Defensive: a failed read yields null so the route can show a recoverable
// message rather than 500.
async function loadLayout(): Promise<BuilderLayoutDto | null> {
  try {
    return await getLayout();
  } catch {
    return null;
  }
}

export default async function BuilderSiteRoute() {
  const [themeCss, layout] = await Promise.all([canvasThemeCss(), loadLayout()]);
  if (!layout) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <div className="rounded-xl border border-dashed border-[var(--color-border-default)] p-12 text-center text-sm text-[var(--color-text-muted)]">
          Couldn’t load the site layout. Check that the Builder module is enabled, then reload.
        </div>
      </div>
    );
  }
  return (
    <>
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      <SiteBuilderApp initialLayout={layout} bindingCatalog={SITE_CATALOG} />
    </>
  );
}
