import type { Metadata } from 'next';
import { SITE_CATALOG, type BuilderLayoutDto } from '@sparx/builder-schemas';
import { buildThemeCssV2, compileThemeForTenant } from '@sparx/site-themes';

import { getBrand, getConfig } from '../_brand/lib/api';
import { listComponentsFull, listLayouts } from '../_lib/api';
import { SiteBuilderApp } from '../_builder/site-builder-app';
import '../builder.css';

// /builder/site — the site LAYOUT editor (docs/45): the chrome shell (header ·
// outlet · footer) every page renders inside. Same editor as /builder/page, but
// pointed at the tenant's layout CATALOG and the `site` binding sources. A tenant
// keeps many layouts; exactly one is ACTIVE (the live chrome), flipped by a
// separate "make active" action.
//
// Like the page editor, we compile the tenant brand to CSS scoped to the canvas
// so the chrome previews in the real brand. The list endpoint seeds the starter
// header · outlet · footer (active) on first load.

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

// The tenant's layout catalog (the endpoint seeds the starter shell, active, on
// first call). Defensive: a failed read yields [] so the route can show a
// recoverable message rather than 500.
async function loadLayouts(): Promise<BuilderLayoutDto[]> {
  try {
    return await listLayouts();
  } catch {
    return [];
  }
}

export default async function BuilderSiteRoute() {
  const [themeCss, layouts, components] = await Promise.all([
    canvasThemeCss(),
    loadLayouts(),
    listComponentsFull(),
  ]);
  if (layouts.length === 0) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <div className="rounded-xl border border-dashed border-[var(--color-border-default)] p-12 text-center text-sm text-[var(--color-text-muted)]">
          Couldn’t load your site layouts. Check that the Builder module is enabled, then reload.
        </div>
      </div>
    );
  }
  return (
    <>
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      <SiteBuilderApp
        initialLayouts={layouts}
        bindingCatalog={SITE_CATALOG}
        components={components}
      />
    </>
  );
}
