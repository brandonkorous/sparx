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
  BuilderLayoutDto,
  SilicaPieceDto,
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
 *
 * NOT REFETCHED ONCE LOADED, and that is deliberate. With no `staleTime` this was stale
 * the instant it landed, so react-query re-read the WHOLE site tree on every window
 * focus — every alt-tab, every devtools click — for a document the editor is already
 * the authority on. `<Builder>` reads `document` once at mount, so a successful refetch
 * changes nothing; all a refetch could do was FAIL and, with `retry: false`, flip an
 * open editor to the error state and take the author's unsaved work with it. A read
 * whose success is a no-op and whose failure is destructive should not be on a hair
 * trigger. The live-agent path (docs/126 §4.5) refetches EXPLICITLY via `reload()`,
 * which is the one time fresh server state is actually wanted.
 */
export function useBuilderSite() {
  return useQuery({
    queryKey: SITE_KEY,
    queryFn: () =>
      api.get<{ site: StoredSilicaSite | null }>('/v1/builder/site').then((r) => r.site),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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

/** The draft site config — which theme the site is on, the theme's own preset, and
 *  the v2 presentation overlay the theme inspector edits.
 *
 *  `themePreset` is the theme itself (`{v, v1, v2}`); `themeKey` only NAMES it.
 *  Reading the key alone is what left the canvas painting the platform base under
 *  every site's brand — see brand-theme.ts. */
export interface SiteConfigDto {
  themeKey: string;
  draftSettings: { presentation?: unknown; themePreset?: unknown };
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

// ── Page settings (how one page appears in search, and what chrome wraps it) ──
//
// These columns live on the `BuilderPage` ROW, not in the silica tree: silica's `Page`
// is deliberately flat (`{id,name,slug,root}`) and has no home for domain metadata. The
// silica page id IS the row id, so the same `/v1/builder/pages/:id` endpoints serve
// both. This is the gap that made the whole SEO chain dead weight — the storefront read
// these fields on every render, the audit graded them, and nothing in the editor could
// ever set them.
//
// `frameId` arrived the same way and had the same gap in reverse: the column, the
// resolver and the storefront read all shipped, `PATCH` accepted it, and nothing in the
// editor could point a page at a different shell or turn the chrome off.

/** One page's row-level settings: how it describes itself to search engines and social
 *  cards, and which chrome wraps it. */
export interface PageSettingsDto {
  /** `null` = the site default, `'none'` = bare, otherwise a layout id (docs/silicaui/01 §5). */
  frameId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonical: string | null;
  ogImage: string | null;
  noindex: boolean;
}

export const PAGE_SETTINGS_KEY = (pageId: string) => ['builder', 'page-settings', pageId];

/** The stored settings for ONE page. Fetched only while the drawer is open, and only
 *  for a page the server actually has — a page created in this session has no row until
 *  the next Save, so asking for it would 404. */
export function usePageSettings(pageId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: PAGE_SETTINGS_KEY(pageId ?? 'none'),
    queryFn: () => api.get<PageSettingsDto>(`/v1/builder/pages/${encodeURIComponent(pageId!)}`),
    enabled: enabled && Boolean(pageId),
    staleTime: 10_000,
  });
}

/** Persist one page's settings. Separate from the site sync on purpose: the site
 *  reconcile owns TREES, these are row columns, and folding them into that payload
 *  would widen a contract the op-log and the live relay both speak. The studio still
 *  presents ONE Save — it flushes these right after the sync. */
export function useUpdatePageSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, settings }: { pageId: string; settings: Partial<PageSettingsDto> }) =>
      api.patch<unknown>(`/v1/builder/pages/${encodeURIComponent(pageId)}`, settings),
    onSuccess: (_data, { pageId }) => {
      void queryClient.invalidateQueries({ queryKey: PAGE_SETTINGS_KEY(pageId) });
    },
  });
}

// ── The chrome catalog (what the per-page frame picker chooses from) ─────────

export const LAYOUTS_KEY = ['builder', 'layouts'];

/** The property's header/footer designs — id, name, and which one is live.
 *
 *  This reads the ordinary catalog endpoint, which returns each layout's full draft
 *  tree, and uses only the names. That is deliberate rather than an oversight: a
 *  tree-less projection exists for PAGES because that read ran on the busiest list in
 *  the builder over every page in the property (docs/127 §3). This one runs when a
 *  drawer opens, over a handful of header/footer trees, so a second list endpoint
 *  would cost more in API surface than it saves on the wire. */
export function useLayouts(enabled: boolean) {
  return useQuery({
    queryKey: LAYOUTS_KEY,
    queryFn: async () => {
      const { layouts } = await api.get<{ layouts: BuilderLayoutDto[] }>('/v1/builder/layouts');
      return layouts.map(({ id, name, isActive }) => ({ id, name, isActive }));
    },
    enabled,
    staleTime: 30_000,
  });
}

/** One entry in the frame picker — the catalog stripped to what a chooser shows. */
export interface LayoutChoice {
  id: string;
  name: string;
  isActive: boolean;
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

/** Where Preview should open this site, and anything the target needs in the query
 *  string to know WHICH site it is. `extraQuery` is empty everywhere but local dev. */
export interface SitePreviewTarget {
  origin: string;
  extraQuery: string;
}

/** The local storefront, for development only.
 *
 *  A tenant's canonical domain is REAL DNS pointing at production, so in local dev the
 *  editor's Preview opened `https://<tenant>.sparx.zone` — the live site — and handed it a
 *  preview JWT minted by the LOCAL api-rest. The draft was therefore never shown (prod
 *  rejects a token it cannot verify), and a local credential left the machine to an
 *  external host on every click. Observed 2026-08-02.
 *
 *  Set `NEXT_PUBLIC_STOREFRONT_ORIGIN=http://localhost:3004` and Preview stays here. Unset —
 *  which is every deployed environment — this whole branch is dead and behaviour is
 *  unchanged, so production still previews against the tenant's real address. */
const DEV_STOREFRONT_ORIGIN = (process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN ?? '').replace(/\/+$/, '');

/** The site's public origin for THIS property — its canonical address, preferring a
 *  live one. Null when the site has no reachable host yet. */
export function useSiteOrigin(propertyId: string | null) {
  return useQuery<SitePreviewTarget | null>({
    queryKey: ['builder', 'site-origin', propertyId, DEV_STOREFRONT_ORIGIN],
    queryFn: async () => {
      // Local dev has no per-tenant DNS, so the storefront identifies the site from
      // `?tenant=`/`?property=` (its proxy stashes them as headers + cookies). Without
      // them a fresh preview tab resolves nothing and renders "Store not found".
      if (DEV_STOREFRONT_ORIGIN) {
        const [tenant, properties] = await Promise.all([
          api.get<{ slug: string }>('/v1/tenant'),
          api.get<{ id: string; slug: string }[]>('/v1/properties'),
        ]);
        const params = new URLSearchParams({ tenant: tenant.slug });
        const property = properties.find((p) => p.id === propertyId);
        if (property) params.set('property', property.slug);
        return { origin: DEV_STOREFRONT_ORIGIN, extraQuery: `&${params.toString()}` };
      }
      const domains = await api.get<DomainRow[]>('/v1/domains');
      const mine = domains.filter((d) => d.propertyId === propertyId);
      const live = mine.find(
        (d) => d.isCanonical && (d.status === 'active' || d.type === 'subdomain')
      );
      const chosen = live ?? mine.find((d) => d.isCanonical) ?? mine[0] ?? null;
      return chosen ? { origin: `https://${chosen.host}`, extraQuery: '' } : null;
    },
    enabled: Boolean(propertyId),
    staleTime: 300_000,
  });
}

/* ── Publish history (docs/126 §5.3) ──────────────────────────────────────── */

export const RELEASES_KEY = ['builder', 'site', 'releases'] as const;

/** One immutable publish. Shape mirrors `artifactService.ReleaseSummary`. */
export interface ReleaseDto {
  id: string;
  hash: string;
  pageCount: number;
  /** publish | restore — a restore republishes an old manifest forward as a new release. */
  source: string;
  restoredFromId: string | null;
  actorId: string | null;
  createdAt: string;
  /** True for the release visitors are being served RIGHT NOW (the newest). */
  current: boolean;
}

/** What a restore actually moved — `artifactService.RestoreResult`. Surfaced so the
 *  toast can be specific rather than saying "restored" and leaving the author to
 *  discover that three pages went dark. */
export interface RestoreReleaseResult {
  releaseId: string;
  hash: string;
  pagesRestored: number;
  pagesUnpublished: number;
  entriesSkipped: number;
}

/** The property's publish history, newest first. Fetched only while the drawer is
 *  open, like the draft versions beside it. */
export function useReleases(enabled: boolean) {
  return useQuery({
    queryKey: RELEASES_KEY,
    queryFn: () => api.get<ReleaseDto[]>('/v1/builder/site/releases'),
    enabled,
    staleTime: 10_000,
  });
}

/**
 * Roll the LIVE site back to an earlier release.
 *
 * Unlike a draft restore, this changes what visitors see the moment it returns —
 * there is no publish step between. History stays append-only (the old manifest is
 * republished FORWARD as a new release), so the rollback is itself rollbackable.
 *
 * Invalidates the publish state too: "Published / not live yet" is computed from the
 * draft-vs-published comparison, and a rollback almost always makes the draft differ
 * from what is live again.
 */
export function useRestoreRelease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (releaseId: string) =>
      api.post<RestoreReleaseResult>(
        `/v1/builder/site/releases/${encodeURIComponent(releaseId)}/restore`
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RELEASES_KEY });
      void queryClient.invalidateQueries({ queryKey: PUBLISH_STATE_KEY });
    },
  });
}

/* ── Tenant-wide saved pieces ─────────────────────────────────────────────── */

export const SILICA_PIECES_KEY = ['builder', 'components', 'silica'] as const;

/**
 * The tenant's PLACEABLE saved pieces — the ones with a silica master. Merged into
 * the document's symbol map before `<Builder>` mounts (`withTenantPieces`), which is
 * why this has to settle alongside the site read rather than stream in later: a
 * symbol map arriving after mount would not reach the engine, which reads `document`
 * once.
 *
 * Degrades to an EMPTY list on failure, deliberately. A failed piece read means the
 * author's library is missing from the Components board for this session — annoying,
 * and recoverable by reloading. Holding the whole editor shut over it would turn a
 * secondary feature's outage into "you cannot edit your website", which is a far
 * worse trade for the same cause.
 *
 * The endpoint is TENANT-scoped (docs/53) — no `?property=`. That is the entire
 * point: the same library reaches every site the business owns.
 */
export function useSilicaPieces() {
  return useQuery({
    queryKey: SILICA_PIECES_KEY,
    queryFn: () =>
      api
        .get<{ components: SilicaPieceDto[] }>('/v1/builder/components?include=silica')
        .then((r) => r.components)
        .catch<SilicaPieceDto[]>(() => []),
  });
}

export interface SavePieceInput {
  key: string;
  name: string;
  root: unknown;
}

/**
 * Write a tenant master back to the library — one call per piece whose design
 * actually changed (`changedTenantMasters`), issued as part of the studio's single
 * Save. Each one snapshots a new version server-side, so a piece keeps the same
 * version history any other editor here would give it.
 *
 * The list is invalidated but NOT refetched into the open editor: the engine already
 * holds the edited master on its canvas, and pushing a server copy back into a live
 * document would either be a no-op or clobber an edit made in the meantime.
 */
export function useSaveSilicaPiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, name, root }: SavePieceInput) =>
      api.patch(`/v1/builder/components/${encodeURIComponent(key)}`, { name, silicaTree: root }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SILICA_PIECES_KEY });
      // The Saved-pieces LIST pane docks beside the studio often enough that a
      // stale "last updated" there after a save reads as the save not landing.
      void queryClient.invalidateQueries({ queryKey: ['builder', 'components'] });
    },
  });
}

/* ── The pre-publish check ────────────────────────────────────────────────── */

/** How much a finding matters. NEVER whether a publish may proceed — the server
 *  route says the same thing, and the publish endpoint does not consult it. */
export type CheckSeverity = 'error' | 'warning' | 'suggestion';

/** Which authored tree a finding lives in — the tree the fix happens in, which is
 *  not always the page it was seen on. */
export type CheckScope = 'page' | 'frame' | 'symbol' | 'site';

/** Where a finding is, precisely enough to open the right thing and select the right
 *  block. `ownerId` is a page id for `page`, a symbol id for `symbol`, null otherwise. */
export interface CheckLocation {
  scope: CheckScope;
  ownerId: string | null;
  ownerName: string;
  nodeId: string | null;
  nodePath: string;
  seenOn: string[];
}

export interface CheckFinding {
  rule: string;
  severity: CheckSeverity;
  title: string;
  detail: string;
  evidence?: string;
  /** A correction the editor may apply for the author — present only when the server
   *  judged it BOTH unambiguous and safe to apply here (`@sparx/site-lint`'s `LintFix`).
   *  Most findings never carry one: "choose a destination for this link" and "pick a
   *  readable colour" are the author's decisions, not ours. */
  fix?: CheckFix;
  location: CheckLocation;
}

/** Swap one class token for another on the node the finding names. The only fix kind. */
export interface CheckFix {
  kind: 'replace-class';
  from: string;
  to: string;
  label: string;
}

/** How a page reads at a glance. Three bands, not a score — and NOT a severity:
 *  weight is a trade, so nothing here counts as a finding or changes `status`. */
export type CheckWeightBand = 'light' | 'heavy' | 'very-heavy';

export interface CheckPageWeight {
  pageId: string;
  pageName: string;
  slug: string;
  /** Bytes of the page's own markup; null if it could not be rendered. */
  htmlBytes: number | null;
  imageCount: number;
  imageBytes: number;
  /** Pictures whose weight is NOT in `imageBytes` — hosted elsewhere, or filled in
   *  from a record. Real weight that is missing from the total, which is why the
   *  panel has to say so rather than showing a tidier number. */
  imagesUnsized: number;
  /** `htmlBytes + imageBytes`. A FLOOR on what a first visit costs: styling, fonts,
   *  scripts and embeds are on top of it. */
  totalBytes: number;
  band: CheckWeightBand;
}

export interface CheckHeavyImage {
  src: string;
  bytes: number;
  pageCount: number;
}

export interface CheckBudget {
  /** Heaviest first. */
  pages: CheckPageWeight[];
  heavyImages: CheckHeavyImage[];
  /** Distinct class NAMES that emit no CSS. The findings above count BLOCKS, so a
   *  smaller number here is one typo repeated, not a disagreement. */
  unbackedClasses: string[];
  heaviestPageBytes: number;
  unsizedImages: number;
}

export interface SiteCheckReport {
  status: 'pass' | 'warn' | 'fail';
  findings: CheckFinding[];
  counts: Record<CheckSeverity, number>;
  pagesChecked: number;
  budget: CheckBudget;
}

export const SITE_CHECK_KEY = ['builder', 'site', 'check'] as const;

/**
 * Check the site the way a visitor meets it.
 *
 * Reads the SAVED DRAFT, which is why every caller here saves first: the report would
 * otherwise describe the state before the edit the author is about to publish, and a
 * check that is one save behind is worse than none — it says "clean" about work it has
 * not seen.
 *
 * IT NEVER RUNS ON ITS OWN — `enabled: false`, and the only way to a report is
 * `refetch()` behind an explicit Run/Check again. It used to fire on every open, which
 * made opening the panel cost a save plus a full walk of every page's composed document
 * and a handful of roster reads, just to glance at a list the author had already read.
 *
 * The result therefore PERSISTS between opens (`staleTime: Infinity`, a real `gcTime`)
 * rather than being thrown away, because it is now the thing the status bar reports. Its
 * freshness is not this hook's problem: the studio marks the report stale on the next
 * edit and stops showing a count that has stopped being true — a number that is either
 * right or absent, never quietly wrong.
 */
export function useSiteCheck() {
  return useQuery({
    queryKey: SITE_CHECK_KEY,
    queryFn: () => api.get<SiteCheckReport>('/v1/builder/site/check'),
    enabled: false,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });
}

/** The check, fetched imperatively — what the publish flow needs. A hook cannot be
 *  awaited inside a click handler, and the publish decision has to be made with the
 *  answer in hand rather than a render later. */
export function getSiteCheck(): Promise<SiteCheckReport> {
  return api.get<SiteCheckReport>('/v1/builder/site/check');
}

/** The server's own sentence for a 4xx (it names the exact problem); a 5xx falls
 *  back to the caller's wording. */
export function builderErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
