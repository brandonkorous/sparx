import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { BindingCatalog, ComponentDto } from '@sparx/builder-schemas';
import { buildThemeCssV2, compileThemeForTenant } from '@sparx/site-themes';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { getBrand, getConfig } from '../../../_brand/lib/api';
import { getBindingCatalog } from '../../../_lib/api';
import { ComponentBuilderApp } from '../../../_builder/component-builder-app';
import '../../../builder.css';
// The Surface recipe, pre-scoped to `.bx-canvas` — so a component authored with
// `sf-*` classes previews exactly as it will ship (parity with /builder/page).
import '@sparx/site-ui/styles.canvas.css';

// /builder/components/[type]/edit — the component tree editor (docs/53 P-C). Edits
// ONE tenant component's node tree with the shared Builder editor. System
// components (PascalCase ids, in-code) aren't editable here — only tenant
// components (lowercase keys) resolve; anything else 404s. The `[type]` segment is
// the component key.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Builder · Edit component',
};

// Compile the tenant brand to CSS scoped to `.bx-canvas` (parity with the page
// editor). Defensive: a failed read returns '' and the canvas uses its studio brand.
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

async function loadComponent(key: string): Promise<ComponentDto> {
  try {
    return await api.get<ComponentDto>(`/v1/builder/components/${encodeURIComponent(key)}`);
  } catch (err) {
    if ((err as ApiRestError)?.status === 404) notFound();
    throw err;
  }
}

async function loadCatalog(): Promise<BindingCatalog> {
  try {
    return await getBindingCatalog();
  } catch {
    return { sources: [] };
  }
}

interface PageProps {
  params: Promise<{ type: string }>;
}

export default async function BuilderComponentEditRoute({ params }: PageProps) {
  const { type } = await params;
  const key = decodeURIComponent(type);
  const [themeCss, component, catalog] = await Promise.all([
    canvasThemeCss(),
    loadComponent(key),
    loadCatalog(),
  ]);
  return (
    <>
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      <ComponentBuilderApp component={component} bindingCatalog={catalog} />
    </>
  );
}
