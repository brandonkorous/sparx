// Server-only Builder API readers. Thin wrappers over the api-rest client used
// by the module's server components. Mutations live in actions.ts.

import 'server-only';
import { api } from '@/lib/api-rest-client';
import type {
  BindingCatalog,
  BuilderEmailDto,
  BuilderLayoutDto,
  BuilderPageDto,
  ComponentDto,
} from '@sparx/builder-schemas';

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

// What an EMAIL can bind to (docs/52 §7): the per-recipient / per-send
// EMAIL_SOURCES (recipient, order, cart, loyalty, products, promotion) plus the
// tenant's CMS collection sources (latest posts). Drives the email editor's
// binding picker + canvas preview.
export async function getEmailBindingCatalog(): Promise<BindingCatalog> {
  return api.get<BindingCatalog>('/v1/builder/email-binding-schema');
}

// The tenant's emails — the Email Builder catalog (docs/52). The list endpoint
// seeds the curated starter set on the tenant's first call, so the email editor
// never opens empty.
export async function listEmails(): Promise<BuilderEmailDto[]> {
  const { emails } = await api.get<{ emails: BuilderEmailDto[] }>('/v1/builder/emails');
  return emails;
}

// A SITE's view of the email catalog (docs/49 Phase 7b): the tenant-wide rows
// with each default REPLACED by this site's override when one exists, plus the
// site's own custom emails. Used by the email editor when the tenant runs more
// than one site — the active site comes from the breadcrumb switcher.
export async function listEmailsForProperty(propertyId: string): Promise<BuilderEmailDto[]> {
  const { emails } = await api.get<{ emails: BuilderEmailDto[] }>(
    `/v1/builder/emails/site/${propertyId}`
  );
  return emails;
}

// The tenant's custom components WITH their latest version trees (docs/53 P-B) —
// what the editor needs to expand `custom:*` placements live on the canvas and to
// offer them in the Add palette. `?include=tree` returns the tree-bearing DTOs.
// Defensive: a failed read (Builder module off, etc.) yields [] so the editor
// still runs with only the system palette.
export async function listComponentsFull(): Promise<ComponentDto[]> {
  try {
    const { components } = await api.get<{ components: ComponentDto[] }>(
      '/v1/builder/components?include=tree'
    );
    return components;
  } catch {
    return [];
  }
}
