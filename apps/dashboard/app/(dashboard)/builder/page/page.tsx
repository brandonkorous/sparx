import type { Metadata } from 'next';
import type { BindingCatalog, BuilderLayoutDto, BuilderPageDto } from '@sparx/builder-schemas';
import { buildThemeCssV2, compileThemeForTenant } from '@sparx/site-themes';

import { getBrand, getConfig, getTenant } from '../_brand/lib/api';
import { propertyOrigin } from '../_brand/lib/property';
import { getActiveLayout, getBindingCatalog, listComponentsFull, listPages } from '../_lib/api';
import { BuilderApp } from '../_builder/builder-app';
import '../builder.css';
// The Surface RECIPE — @sparx/site-ui's `sf-*` component/color/variant classes,
// PRE-SCOPED to `.bx-canvas` by site-ui's build (styles.canvas.css = the recipe
// wrapped in `@scope (.bx-canvas)`). Loaded here so the Color/Variant a node is
// authored with renders LIVE on the canvas, identical to the published site —
// without the sheet's generic utilities / `:root` tokens touching the dashboard
// chrome (docs/47 §5; the site loads the unscoped sibling globally).
import '@sparx/site-ui/styles.canvas.css';

// /builder/page — the page-editing surface of the Builder. The builder home
// lives at /builder; sibling surfaces (brand, site, component) slot in beside
// this one and reuse the shared internals under /builder/_builder.
//
// UI-FIRST: the editor runs on the in-memory node model with mock module data
// (see _builder/sample.ts) — no backend is wired for the page tree yet. Two
// pieces of real data we pull:
//  · the tenant BRAND — we compile the tenant's saved brand + theme and scope it
//    to the canvas, so the preview renders in the real brand (the same
//    compileThemeForTenant → buildThemeCssV2 the /builder/brand showcase and the
//    live storefront use). builder.css aliases the canvas's `--bxc-*` vars onto
//    the compiled `--sf-*` set.
// The Surface recipe (`sf-*` classes) is loaded separately via a side-effect CSS
// import below — see that import's note.

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

// The tenant slug + live-site origin, so the editor's "Preview" tab can open the
// page's draft on the real site (docs/45 §2.6). Defensive: a failed read yields
// null → the Preview button stays disabled, the rest of the editor is unaffected.
async function loadSiteContext(): Promise<{ slug: string; origin: string } | null> {
  try {
    const tenant = await getTenant();
    return { slug: tenant.slug, origin: propertyOrigin(tenant.slug) };
  } catch {
    return null;
  }
}

interface BuilderPageRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BuilderPageRoute({ searchParams }: BuilderPageRouteProps) {
  const [sp, themeCss, pages, catalog, layout, site, components] = await Promise.all([
    searchParams,
    canvasThemeCss(),
    loadPages(),
    loadCatalog(),
    loadLayout(),
    loadSiteContext(),
    listComponentsFull(),
  ]);
  // Deep-link target: `?page=<id>` opens that page active on mount (the SEO
  // overview's "Open in builder" link points here). The editor falls back to
  // the first page when it's absent or not found.
  const initialPageId = typeof sp.page === 'string' ? sp.page : undefined;
  return (
    <>
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      <BuilderApp
        initialPages={pages}
        bindingCatalog={catalog}
        layoutTree={layout?.tree ?? null}
        tenantSlug={site?.slug}
        siteOrigin={site?.origin}
        initialPageId={initialPageId}
        components={components}
      />
    </>
  );
}
