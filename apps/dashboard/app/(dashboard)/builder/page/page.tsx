import type { Metadata } from 'next';
import type { BindingCatalog, BuilderLayoutDto, BuilderPageDto } from '@sparx/builder-schemas';
import { buildThemeCssV2, compileThemeForTenant } from '@sparx/storefront-themes';

import { getBrand, getConfig } from '../../sitebuilder/_lib/api';
import { getActiveLayout, getBindingCatalog, listPages } from '../_lib/api';
import { BuilderApp } from '../_builder/builder-app';
import '../builder.css';

// /builder/page — the page-editing surface of the Builder. The builder home
// lives at /builder; sibling surfaces (brand, site, component) slot in beside
// this one and reuse the shared internals under /builder/_builder.
//
// UI-FIRST: the editor runs on the in-memory node model with mock module data
// (see _builder/sample.ts) — no backend is wired for the page tree yet. The ONE
// piece of real data we pull is the tenant brand: we compile the tenant's saved
// brand + theme and scope it to the canvas, so the preview renders in the real
// brand (the same compileThemeForTenant → buildThemeCssV2 the /builder/brand
// showcase and the live storefront use). builder.css aliases the canvas's
// `--bxc-*` vars onto the compiled `--sf-*` set.

export const metadata: Metadata = {
  title: 'Builder · Page',
};

// Compile the tenant brand to CSS scoped to `.bx-canvas`. Defensive: a failed
// brand/config read returns '' and the canvas falls back to its built-in studio
// brand, so the editor still works (UI-first — the brand is an enhancement, not
// a hard dependency).
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

// The tenant's pages (the list endpoint seeds the curated starter set on first
// load — docs/41 §5). Defensive: if the read fails (api down / module gated),
// hand the editor an empty catalog rather than 500 the route.
async function loadPages(): Promise<BuilderPageDto[]> {
  try {
    return await listPages();
  } catch {
    return [];
  }
}

// What this page can bind to (docs/43). Defensive: a failed read yields an empty
// catalog — the editor still runs, bindings just resolve to placeholders.
async function loadCatalog(): Promise<BindingCatalog> {
  try {
    return await getBindingCatalog();
  } catch {
    return { sources: [] };
  }
}

// The tenant's ACTIVE (live) site layout — the page editor renders it as a locked
// backdrop (header/footer) around the page so you edit in the chrome it ships in.
// Defensive: a failed read just yields null (the editor renders unframed).
async function loadLayout(): Promise<BuilderLayoutDto | null> {
  try {
    return await getActiveLayout();
  } catch {
    return null;
  }
}

export default async function BuilderPageRoute() {
  const [themeCss, pages, catalog, layout] = await Promise.all([
    canvasThemeCss(),
    loadPages(),
    loadCatalog(),
    loadLayout(),
  ]);
  return (
    <>
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      <BuilderApp initialPages={pages} bindingCatalog={catalog} layoutTree={layout?.tree ?? null} />
    </>
  );
}
