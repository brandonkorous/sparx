import type { Metadata } from 'next';
import { buildThemeCssV2, compileThemeForTenant } from '@sparx/storefront-themes';

import { getBrand, getConfig } from '../../sitebuilder/_lib/api';
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

export default async function BuilderPageRoute() {
  const themeCss = await canvasThemeCss();
  return (
    <>
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      <BuilderApp />
    </>
  );
}
