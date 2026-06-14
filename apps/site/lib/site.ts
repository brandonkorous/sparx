// Server-side read of a tenant's published Site Builder snapshot.
//
// `GET /v1/public/site?tenant=<slug>` returns the published
// PublishedSnapshot (theme tokens for light + dark, ordered section list per
// page, and the header/footer/announcement layout blocks) — or `null` when the
// tenant has never published. The storefront layers this on top of the
// existing themeToCss(CommerceSiteTheme) path; a null snapshot keeps the legacy
// composed-commerce homepage as the empty-store fallback.
//
// Drafts are NOT exposed here — the authenticated /v1/sitebuilder/preview
// endpoint serves the dashboard customizer. Public storefront = published only.

// The storefront consumes the published snapshot as JSON over HTTP, so it owns
// the *consumer's view* of that payload rather than depending on the heavy
// `@sparx/sitebuilder` service package (which pulls in @sparx/db, @sparx/ui,
// react, and the whole MCP/service layer — none of which belong in this image).
// These interfaces mirror the publish output in
// packages/sitebuilder/src/services/publish-internals.ts — keep them in sync.

import type { CompiledThemeV2 } from '@sparx/site-themes';
import {
  DEFAULT_TEMPLATES,
  type SectionField,
  type TemplateNode,
} from '@sparx/sitebuilder-schemas';

// A custom-section definition pinned into the published snapshot (docs/38 Phase
// C), mirrored from packages/sitebuilder publish-internals.PinnedDefinition. The
// renderer resolves a `custom:<slug>` section's template from here.
export interface PinnedDefinition {
  slug: string;
  label: string;
  icon: string | null;
  binding: string | null;
  version: number;
  fieldSpec: SectionField[];
  template: TemplateNode;
}

export interface SectionSnapshot {
  id: string;
  // The owning layout's target id + key (docs/36 §4). Optional — absent on
  // pre-Phase-3 published snapshots, where `pageKey` is the only key; the
  // read-time fallback below maps pageKey → targetId/key for those.
  targetId?: string;
  templateKey?: string;
  templateId?: string;
  pageKey: string;
  sectionType: string;
  position: number;
  visible: boolean;
  config: Record<string, unknown>;
}

export interface LayoutSnapshot {
  slot: string;
  navigationMenuId: string | null;
  config: Record<string, unknown>;
  visible: boolean;
}

export interface PublishedSnapshot {
  versionNumber: number;
  themeKey: string;
  appearancePolicy: string;
  compiledTokens: { light: Record<string, string>; dark: Record<string, string> };
  // Token Model v2 compiled set (docs/33) — present on snapshots from a
  // v2-aware api-rest; preferred over `compiledTokens` by the theme builder.
  compiledV2?: CompiledThemeV2;
  sections: SectionSnapshot[];
  layout: LayoutSnapshot[];
  // Pinned custom-section definitions the sections reference (docs/38 Phase C).
  // Absent on pre-Phase-C snapshots; the renderer skips a custom section with no
  // matching pin.
  definitions?: PinnedDefinition[];
  // Layout resolver maps (docs/36 §6): per-target default layoutKey + per-item
  // override layoutKeys. Absent → every item uses the `default` layout.
  assignments?: {
    defaults: Record<string, string>;
    items: { targetId: string; itemRef: string; layoutKey: string }[];
  };
}

const BASE_URL = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}
interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string };
}

/**
 * Fetch the tenant's site snapshot, or null if nothing is published (or the
 * read fails — a brand-new/erroring store still renders via the commerce
 * fallback rather than throwing).
 *
 * With a `sitePreviewToken` (minted by the dashboard and forwarded from the
 * `?sparxSitePreview=` query) the api-rest endpoint returns the DRAFT
 * composition instead of the published snapshot, so the dashboard preview
 * iframe reflects unsaved work. Preview reads are uncached (`no-store`).
 */
export async function getPublishedSite(
  tenantSlug: string,
  sitePreviewToken?: string,
  // The active web PROPERTY (site) slug (docs/49 Phase 6) — selects which site's
  // published snapshot to serve. Omitted → the tenant's primary site.
  propertySlug?: string
): Promise<PublishedSnapshot | null> {
  try {
    const params = new URLSearchParams({ tenant: tenantSlug });
    if (propertySlug) params.set('property', propertySlug);
    const res = await fetch(
      `${BASE_URL}/v1/public/site?${params.toString()}`,
      sitePreviewToken
        ? { headers: { Authorization: `Preview ${sitePreviewToken}` }, cache: 'no-store' }
        : {
            // Site config changes on publish; the publish flow purges these tags
            // (see app/api/revalidate — `site:<slug>` scope). The property scopes the
            // tag so one site's publish doesn't purge a sibling. Falls back to TTL.
            next: {
              revalidate: 300,
              tags: [
                'sparx-storefront',
                `tenant:${tenantSlug}`,
                `site:${tenantSlug}${propertySlug ? `:${propertySlug}` : ''}`,
              ],
            },
          }
    );
    const json = (await res.json()) as SuccessEnvelope<PublishedSnapshot | null> | ErrorEnvelope;
    if (!res.ok || 'error' in json) return null;
    return json.data;
  } catch {
    return null;
  }
}

/** Ordered, visible sections for one page key (`"home"` or a CMS page slug). */
export function sectionsForPage(
  snapshot: PublishedSnapshot | null,
  pageKey: string
): SectionSnapshot[] {
  if (!snapshot) return [];
  return snapshot.sections
    .filter((s) => s.pageKey === pageKey && s.visible)
    .sort((a, b) => a.position - b.position);
}

// A snapshot section's (targetId, key) — explicit on post-P-B snapshots, mapped
// from the legacy `pageKey` on pre-Phase-3 ones (the orthogonal read-time
// fallback; "home" → site:home, any other slug → cms:content-page).
function targetKeyOf(s: SectionSnapshot): { targetId: string; key: string } {
  if (s.targetId) return { targetId: s.targetId, key: s.templateKey ?? 'default' };
  return s.pageKey === 'home'
    ? { targetId: 'site:home', key: 'default' }
    : { targetId: 'cms:content-page', key: s.pageKey };
}

/** Ordered, visible sections for a target's layout (defaults to the `default` key). */
export function sectionsForTarget(
  snapshot: PublishedSnapshot | null,
  targetId: string,
  key = 'default'
): SectionSnapshot[] {
  if (!snapshot) return [];
  return snapshot.sections
    .filter((s) => {
      const tk = targetKeyOf(s);
      return tk.targetId === targetId && tk.key === key && s.visible;
    })
    .sort((a, b) => a.position - b.position);
}

// Resolve the layoutKey for a (target, item) via the cascade (docs/36 §6):
// per-item override → per-target default → the `default` key.
function resolveLayoutKey(
  snapshot: PublishedSnapshot | null,
  targetId: string,
  itemRef?: string
): string {
  const a = snapshot?.assignments;
  if (!a) return 'default';
  if (itemRef) {
    const hit = a.items.find((i) => i.targetId === targetId && i.itemRef === itemRef);
    if (hit) return hit.layoutKey;
  }
  return a.defaults[targetId] ?? 'default';
}

/**
 * The sections to render for a product/collection page: the layout that resolves
 * for THIS item (per-item override → per-target default → `default` key), or —
 * when that layout has no published sections — the code-defined seeded default
 * (day-one parity, no DB rows). Synthesizes renderable SectionSnapshots from the
 * default composition. `itemRef` is the record's stable id (docs/36 §6).
 *
 * `forcedKey` (editor preview only, gated to a preview token) renders a SPECIFIC
 * named layout directly, bypassing the cascade — so the dashboard canvas can show
 * the exact alternate layout being edited. The code-default fallback applies ONLY
 * to the canonical `default` key: a named alternate with no sections previews as
 * empty (the tenant is building it), never as the seeded default.
 */
export function resolveTemplateSections(
  snapshot: PublishedSnapshot | null,
  targetId: 'commerce:product' | 'commerce:collection',
  itemRef?: string,
  forcedKey?: string
): SectionSnapshot[] {
  const layoutKey = forcedKey ?? resolveLayoutKey(snapshot, targetId, itemRef);
  const published = sectionsForTarget(snapshot, targetId, layoutKey);
  if (published.length > 0) return published;
  if (layoutKey !== 'default') return [];
  return DEFAULT_TEMPLATES[targetId].map((s, i) => ({
    id: `default-${targetId}-${i}`,
    targetId,
    templateKey: 'default',
    pageKey: targetId,
    sectionType: s.sectionType,
    position: i,
    visible: true,
    config: s.config,
  }));
}

// ── Navigation ──────────────────────────────────────────────────────────

export interface NavNode {
  id: string;
  label: string;
  href: string;
  openInNewTab: boolean;
  children: NavNode[];
}

interface NavMenu {
  id: string;
  location: string;
  name: string;
  items: NavNode[];
}

/** Resolve a CMS NavigationMenu id into renderable, href-resolved nav nodes.
 *  Returns [] on any failure so the layout falls back to its default links. */
export async function getNavigationMenu(tenantSlug: string, menuId: string): Promise<NavNode[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/public/content/navigation/${encodeURIComponent(menuId)}?tenant=${encodeURIComponent(tenantSlug)}`,
      {
        next: {
          revalidate: 300,
          tags: ['sparx-storefront', `content:${tenantSlug}`, `site:${tenantSlug}`],
        },
      }
    );
    const json = (await res.json()) as SuccessEnvelope<NavMenu> | ErrorEnvelope;
    if (!res.ok || 'error' in json) return [];
    return json.data.items;
  } catch {
    return [];
  }
}

/** Resolve a CMS NavigationMenu BY LOCATION ('header' / 'footer') into nav nodes.
 *  The Builder site layout (docs/45) binds its chrome nav to a location, not a
 *  menu id. Passes `?property=<slug>` so the API tries the site-specific menu
 *  first and falls back to the tenant-wide one. Returns [] when neither exists
 *  (or on failure) so the chrome nav renders empty. */
export async function getNavByLocation(
  tenantSlug: string,
  location: string,
  propertySlug?: string
): Promise<NavNode[]> {
  try {
    const params = new URLSearchParams({ tenant: tenantSlug });
    if (propertySlug) params.set('property', propertySlug);
    const res = await fetch(
      `${BASE_URL}/v1/public/content/navigation/by-location/${encodeURIComponent(location)}?${params}`,
      {
        next: {
          revalidate: 300,
          tags: ['sparx-storefront', `content:${tenantSlug}`, `site:${tenantSlug}`],
        },
      }
    );
    const json = (await res.json()) as SuccessEnvelope<NavMenu> | ErrorEnvelope;
    if (!res.ok || 'error' in json) return [];
    return json.data.items;
  } catch {
    return [];
  }
}
