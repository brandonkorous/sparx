'use client';

// Editor data — the silica-native site the visual builder loads, saves, and
// publishes.
//
// silica's `<Builder>` owns the whole multi-page site in memory (pages + frame +
// symbols + theme) and hands it back on every edit; sparx persists it through ONE
// whole-site reconcile (`PUT /v1/builder/site`, docs/118), and publishing
// snapshots every draft tree (`POST /v1/builder/site/publish`). The editor is
// explicit-save only — the operator's Save is what writes, never an autosave.
//
// The load endpoints are the same api-rest routes the dashboard studio reads,
// called here from the browser through the workbench's token-vending client.

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import type {
  BindingCatalog,
  SitePublishState,
  SiteSyncInput,
  StoredSilicaSite,
} from '@sparx/builder-schemas';
import { api } from '../../../lib/api/client';
import { getTokenState } from '../../../lib/api/token';
import type { BrandColumns } from './brand-theme';
import type { SitePreviewData } from './preview-data';

export type { BindingCatalog, SitePublishState, StoredSilicaSite, SiteSyncInput };

export const SITE_KEY = ['builder', 'silica-site'];
export const PUBLISH_STATE_KEY = ['builder', 'publish-state'];
export const CATALOG_KEY = ['builder', 'binding-catalog'];

/**
 * The property's stored silica site (pages + frame + symbols + theme), or `null`
 * when none is materialized yet — in which case the editor opens on the starter
 * seed and the first Save materializes it.
 *
 * A read FAILURE must surface as an error, never degrade to `null`: `null` means
 * "empty, seed the starter", so swallowing a failure would seed a starter over the
 * tenant's real site and Save would then persist it. `retry: false` keeps a genuine
 * failure fast to the error state rather than retrying into a spinner.
 */
export function useBuilderSite() {
  return useQuery({
    queryKey: SITE_KEY,
    queryFn: () =>
      api.get<{ site: StoredSilicaSite | null }>('/v1/builder/site').then((r) => r.site),
    retry: false,
  });
}

/** What differs between the draft and what visitors are served — the "not live
 *  yet" signal. Degrades to "nothing outstanding" on failure (it drives a badge; a
 *  failed read must never invent a scary warning). */
export function usePublishState() {
  return useQuery({
    queryKey: PUBLISH_STATE_KEY,
    queryFn: () =>
      api.get<SitePublishState>('/v1/builder/site/publish-state').catch<SitePublishState>(() => ({
        hasUnpublished: false,
        unpublishedPages: 0,
        frameUnpublished: false,
        lastPublishedAt: null,
        neverPublished: false,
      })),
  });
}

/** What a page can bind to — the tenant's real CMS content types plus the
 *  code-defined commerce/CRM sources. Drives the binding picker + canvas preview
 *  data. Degrades to an empty catalog (the editor still runs on the code sources). */
export function useBindingCatalog() {
  return useQuery({
    queryKey: CATALOG_KEY,
    queryFn: () =>
      api.get<BindingCatalog>('/v1/builder/binding-schema').catch<BindingCatalog>(() => ({
        sources: [],
      })),
    staleTime: 300_000,
  });
}

// ── Brand + theme (the canvas opens on the tenant's real look) ────────────────

/** The tenant brand — identity colours, fonts, logos (docs/30 §6). Ungated
 *  (`/v1/brand` is platform-level like `/v1/tenant`). */
export interface BrandDto extends BrandColumns {
  businessName: string | null;
}

/** A neutral brand so a failed read degrades to a bare, working editor rather than
 *  throwing — the compiled theme then falls through to a preset. */
export const FALLBACK_BRAND: BrandDto = {
  businessName: null,
  tagline: null,
  logoLightMediaId: null,
  logoDarkMediaId: null,
  faviconMediaId: null,
  colorPrimary: null,
  colorPrimaryForeground: null,
  colorSecondary: null,
  colorSecondaryForeground: null,
  colorAccent: null,
  colorAccentForeground: null,
  fontHeading: null,
  fontBody: null,
  tokens: null,
};

export function useBrand() {
  return useQuery({
    queryKey: ['builder', 'brand'],
    queryFn: () => api.get<BrandDto>('/v1/brand').catch(() => FALLBACK_BRAND),
    staleTime: 300_000,
  });
}

/** The draft site config — which theme preset the tenant is on, plus the v2
 *  presentation overlay the theme inspector edits. */
export interface SiteConfigDto {
  themeKey: string;
  draftSettings: { presentation?: unknown };
}

export const FALLBACK_CONFIG: SiteConfigDto = { themeKey: 'default', draftSettings: {} };

export function useSiteConfig() {
  return useQuery({
    queryKey: ['builder', 'site-config'],
    queryFn: () => api.get<SiteConfigDto>('/v1/sitebuilder/config').catch(() => FALLBACK_CONFIG),
    staleTime: 300_000,
  });
}

/** The active web property, WITH its per-site brand override (docs/49) — which
 *  decides whether the canvas opens on the tenant base brand (primary site) or this
 *  site's overridden look. */
export interface ActiveProperty {
  id: string;
  slug: string;
  isPrimary: boolean;
  brandOverride: unknown;
}

export function useActiveProperty(propertyId: string | null) {
  return useQuery({
    queryKey: ['builder', 'active-property', propertyId],
    queryFn: async () => {
      const rows = await api.get<ActiveProperty[]>('/v1/properties');
      return rows.find((p) => p.id === propertyId) ?? rows.find((p) => p.isPrimary) ?? null;
    },
    enabled: Boolean(propertyId),
    staleTime: 300_000,
  });
}

/** A media id → the public media redirect URL (the browser <img> loads it), or an
 *  absolute ref passed through. Null for an empty id. Uses the public API origin
 *  the token route resolves. */
function publicMediaUrl(apiUrl: string, assetId: string | null, tenantSlug: string): string | null {
  if (!assetId) return null;
  if (/^(?:https?:|data:)/i.test(assetId)) return assetId;
  return `${apiUrl}/v1/public/media/${encodeURIComponent(assetId)}?tenant=${encodeURIComponent(tenantSlug)}`;
}

/** The tenant's REAL site-chrome data — resolved exactly like the storefront's
 *  `site.*` roots so the canvas header/footer match the live site: the display name
 *  + tagline + public logo URLs, and the social links. Overlaid onto the canvas
 *  preview data so a bound Wordmark/logo/name/socials resolve to real values.
 *
 *  Degrades to a bare "Brand" with no social on any failure, so the canvas still
 *  renders. `propertySlug` scopes it to the active site (a per-site brand override
 *  previews correctly). */
export function useSitePreview(tenantSlug: string | null, propertySlug: string | null) {
  return useQuery({
    queryKey: ['builder', 'site-preview', tenantSlug, propertySlug],
    queryFn: async (): Promise<SitePreviewData> => {
      try {
        const { apiUrl } = await getTokenState();
        const propertyParam = propertySlug ? `?property=${encodeURIComponent(propertySlug)}` : '';
        const payload = await api.get<PublicTenantChrome>(
          `/v1/public/tenants/${encodeURIComponent(tenantSlug ?? '')}${propertyParam}`
        );
        // The customer-facing SITE name wins (docs/49): the active site's name, then
        // the legacy business name, then the tenant name. First non-empty value.
        const name =
          [payload.propertyName, payload.businessName].map((s) => s?.trim()).find((s) => s) ??
          payload.name;
        // `/v1/public/media/:id?tenant=` resolves the asset by tenant SLUG (not the
        // display name) — passing payload.name silently 404s the logo while the name
        // still renders, which read as "logo missing".
        const logoUrl = publicMediaUrl(
          apiUrl,
          payload.theme?.logoMediaId ?? null,
          tenantSlug ?? ''
        );
        const logoDarkUrl = publicMediaUrl(
          apiUrl,
          payload.theme?.logoDarkMediaId ?? null,
          tenantSlug ?? ''
        );
        const social = (payload.socials ?? []).filter(
          (s) =>
            typeof s?.platform === 'string' && typeof s?.url === 'string' && s.url.trim() !== ''
        );
        return {
          identity: {
            name,
            tagline: payload.tagline?.trim() ? payload.tagline : null,
            logo: logoUrl ? { url: logoUrl, alt: name } : null,
            logoDark: logoDarkUrl ? { url: logoDarkUrl, alt: name } : null,
          },
          social,
        };
      } catch {
        return {
          identity: { name: 'Brand', tagline: null, logo: null, logoDark: null },
          social: [],
        };
      }
    },
    enabled: Boolean(tenantSlug),
    staleTime: 300_000,
  });
}

/** The public tenant chrome payload the storefront resolves its header/footer from. */
interface PublicTenantChrome {
  name: string;
  businessName: string | null;
  propertyName: string | null;
  tagline?: string | null;
  theme: { logoMediaId: string | null; logoDarkMediaId?: string | null } | null;
  socials?: { platform: string; url: string }[];
}

/** Persist the whole edited site — last-write-wins whole-site reconcile, the
 *  single-author, explicit-save contract every workbench editor follows. */
export function useSyncSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SiteSyncInput) => api.put('/v1/builder/site', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PUBLISH_STATE_KEY });
    },
  });
}

/** The op log's current high-water sequence (docs/126 §4.5). Read once at mount so the
 *  live socket can `catchup` from where the loaded snapshot stands — closing the gap
 *  between the HTTP load and the socket join. Degrades to 0 (catch up from the start) on
 *  failure; the reducer drops already-applied ops, so an over-broad catch-up is safe. */
export function getSiteSeq(): Promise<number> {
  return api
    .get<{ seq: number }>('/v1/builder/site/seq')
    .then((r) => r.seq)
    .catch(() => 0);
}

// ── Draft version history (docs/126 §4.6) ─────────────────────────────────────

/** One restorable draft save, as the history drawer shows it. */
export interface DraftVersionDto {
  id: string;
  hash: string;
  pageCount: number;
  /** save | agent | restore — who/what produced this version. */
  source: string;
  restoredFromId: string | null;
  actorId: string | null;
  createdAt: string;
  /** True for the version matching the live draft right now (the newest). */
  current: boolean;
}

export const DRAFT_VERSIONS_KEY = ['builder', 'draft-versions'];

/** The property's draft-save history, newest first. Fetched only while the drawer is open
 *  (`enabled`) so a closed drawer costs nothing. */
export function useDraftVersions(enabled: boolean) {
  return useQuery({
    queryKey: DRAFT_VERSIONS_KEY,
    queryFn: () => api.get<DraftVersionDto[]>('/v1/builder/site/draft-versions'),
    enabled,
    staleTime: 10_000,
  });
}

/** Restore a draft version — non-destructive on the server (it seals a new version and
 *  leaves pages added since untouched). The caller reloads the editor to show the result. */
export function useRestoreDraftVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      api.post(`/v1/builder/site/draft-versions/${encodeURIComponent(versionId)}/restore`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DRAFT_VERSIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: PUBLISH_STATE_KEY });
    },
  });
}

/** Snapshot every silica draft tree → published, sealing a release. */
export function usePublishSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ published: boolean; releaseId: string; hash: string }>('/v1/builder/site/publish'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PUBLISH_STATE_KEY });
    },
  });
}

/** Mint a short-lived preview token so the public site can be opened showing THIS
 *  tenant's unsaved draft (the editor's Preview). */
export function usePreviewToken() {
  return useMutation({
    mutationFn: () => api.get<{ token: string }>('/v1/builder/preview-token'),
  });
}

/** A connected domain, enough to build a preview URL. */
interface DomainRow {
  propertyId: string;
  host: string;
  type: string;
  status: string;
  isCanonical: boolean;
}

/** The site's public origin for THIS property — its canonical address, preferring a
 *  live one. Null when the site has no reachable host yet. */
export function useSiteOrigin(propertyId: string | null) {
  return useQuery({
    queryKey: ['builder', 'site-origin', propertyId],
    queryFn: async () => {
      const domains = await api.get<DomainRow[]>('/v1/domains');
      const mine = domains.filter((d) => d.propertyId === propertyId);
      const live = mine.find(
        (d) => d.isCanonical && (d.status === 'active' || d.type === 'subdomain')
      );
      const chosen = live ?? mine.find((d) => d.isCanonical) ?? mine[0] ?? null;
      return chosen ? `https://${chosen.host}` : null;
    },
    enabled: Boolean(propertyId),
    staleTime: 300_000,
  });
}

/** The server's own sentence for a 4xx (it names the exact problem); a 5xx falls
 *  back to the caller's wording. */
export function builderErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
