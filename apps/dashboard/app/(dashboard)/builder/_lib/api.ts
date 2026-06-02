// Server-only Builder API readers. Thin wrappers over the api-rest client used
// by the module's server components. Mutations live in actions.ts.

import 'server-only';
import { api } from '@/lib/api-rest-client';
import type { BindingCatalog, BuilderLayoutDto, BuilderPageDto } from '@sparx/builder-schemas';

// The tenant's pages. The list endpoint seeds the curated starter set on the
// tenant's first call (docs/41 §5), so this never returns an empty editor.
// `api.get` is cache:'no-store', so a reload is always ground-truth.
export async function listPages(): Promise<BuilderPageDto[]> {
  const { pages } = await api.get<{ pages: BuilderPageDto[] }>('/v1/builder/pages');
  return pages;
}

// The tenant's site layouts — the chrome catalog (docs/45). The list endpoint
// seeds the starter header · outlet · footer (active) on first call, so the site
// editor never opens empty. Exactly one layout is `isActive` (the live chrome).
export async function listLayouts(): Promise<BuilderLayoutDto[]> {
  const { layouts } = await api.get<{ layouts: BuilderLayoutDto[] }>('/v1/builder/layouts');
  return layouts;
}

// The ACTIVE (live) layout — the page editor renders it as a locked backdrop.
// Seed-on-first-use, so it never returns null on a fresh tenant; null only if the
// read fails (handled by the caller).
export async function getActiveLayout(): Promise<BuilderLayoutDto | null> {
  return api.get<BuilderLayoutDto | null>('/v1/builder/layouts/active');
}

// What a page can bind to (docs/43, the keystone): the tenant's real CMS
// content types + the code-defined Commerce/CRM sources. The editor's binding
// picker, canvas preview, and layer chips all derive from this.
export async function getBindingCatalog(): Promise<BindingCatalog> {
  return api.get<BindingCatalog>('/v1/builder/binding-schema');
}
