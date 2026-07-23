'use client';

// The Editor — the visual, drag-and-drop site builder (builder.studio).
//
// This is silicaui's `<Builder>`: silica owns the whole editor (the Insert
// palette, the canvas, the Navigator/layers, the Design inspector, undo/redo, page
// switching, the frame/Outlet chrome, symbols, and theme). sparx supplies the
// HOST — what a binding means, the commerce/site composites, the pinned functional
// cores — and everything AROUND the editor: the pane shell, Save/Preview, the
// "not live yet" signal, and the unsaved-work net.
//
// EXPLICIT SAVE, on purpose. silica hands back the whole `Site` on every edit; we
// hold it and mark the pane dirty, and nothing reaches the server until the
// operator presses Save (`PUT /v1/builder/site`). Publish snapshots that draft.
// That is the platform rule for every editor, and it is exactly why this is a
// PANE, never a modal: the dirty dot, the close-guard and the per-site layout are
// the safety net a modal sits outside of.
//
// Params: `{pageId}` opens that page on mount; `{componentId}` opens the site (a
// saved piece is a site symbol, edited in the Navigator); neither falls back to
// the site's first page.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Builder, useEditor } from '@wizeworks/silicaui-builder/react';
import type { Op, OpMeta, PublishPayload } from '@wizeworks/silicaui-builder/react';
import { THEME_PRESETS, type Site, type Theme } from '@wizeworks/silicaui-html';
import { ensureUniqueIds, starterSite, upgradeFrameChrome } from '@sparx/silica-catalog';
import {
  COMMERCE_SOURCES,
  SITE_SOURCES,
  toSilicaDataSources,
  type DataSource,
} from '@sparx/builder-schemas';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  useToast,
} from '@wizeworks/silicaui-react';
import { Eye, Save } from 'lucide-react';
import { useDirtySource } from '../../../lib/workbench/dirty';
import { useActiveSiteId, useModuleStates, useTenant } from '../../../lib/api/shell-data';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import {
  builderErrorMessage,
  useActiveProperty,
  useBindingCatalog,
  useBrand,
  useBuilderSite,
  usePreviewToken,
  usePublishSite,
  usePublishState,
  useSiteConfig,
  useSiteOrigin,
  useSitePreview,
  useSyncSite,
  type ActiveProperty,
  type BrandDto,
  type SiteConfigDto,
  type SitePublishState,
  type SiteSyncInput,
  type StoredSilicaSite,
} from './data';
import { themeFontFamilies } from '@sparx/site-themes';
import { applyBrandOverride, tenantTheme, type BrandColumns } from './brand-theme';
import { useCanvasBrandFonts } from './canvas-fonts';
import { buildStudioHost } from './host';
import { makeRenderHostNode } from './host-cores';
import { buildPreviewRoot, type SitePreviewData } from './preview-data';

/** A blank brand — the fallback when `/v1/brand` hasn't resolved, so theming +
 *  font loading degrade to bare defaults rather than crashing. */
const EMPTY_BRAND: BrandColumns = {
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

export function StudioSurface({ ctx }: { ctx: SurfaceContext }) {
  const site = useBuilderSite();
  const catalog = useBindingCatalog();
  const publishState = usePublishState();
  const modules = useModuleStates();
  const brand = useBrand();
  const config = useSiteConfig();
  const tenant = useTenant();

  const { data: siteState } = useActiveSiteId();
  const propertyId = siteState?.propertyId ?? null;
  const property = useActiveProperty(propertyId);
  // Scope the chrome preview to the ACTIVE site so a per-site brand override
  // previews correctly.
  const sitePreview = useSitePreview(tenant.data?.slug ?? null, property.data?.slug ?? null);

  useEffect(() => {
    ctx.setTitle('Editor');
  }, [ctx]);

  // A failed SITE read replaces the editor — never a blank canvas over a starter
  // seed that Save would then persist on top of the real site.
  if (site.isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Alert color="error" variant="soft" className="max-w-md">
          <AlertContent>
            <AlertTitle>Could not load your site</AlertTitle>
            <AlertDescription>
              This is a problem reaching the server, or the site builder is switched off for this
              account. Your site itself is unaffected.
            </AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            color="error"
            variant="soft"
            onClick={() => {
              void site.refetch();
            }}
          >
            Try again
          </Button>
        </Alert>
      </div>
    );
  }

  // `site.data` is `undefined` while loading and `null` when the property has no
  // silica site yet (a valid state — the starter seeds). So gate on the query
  // status, not on the value. Brand/config/property/site-preview all degrade
  // gracefully (they self-catch to fallbacks), so they never hold the editor shut —
  // but wait for them to settle so the canvas opens on the real brand, not a flash
  // of preset then a re-theme.
  const loading =
    site.isPending ||
    catalog.isPending ||
    publishState.isPending ||
    modules.isPending ||
    brand.isPending ||
    config.isPending ||
    sitePreview.isPending;
  if (loading) {
    return (
      <p className="p-4 text-base" role="status">
        Loading the editor…
      </p>
    );
  }

  return (
    <StudioEditor
      ctx={ctx}
      propertyId={propertyId}
      storedSite={site.data ?? null}
      sources={catalog.data?.sources ?? []}
      publishState={publishState.data!}
      brand={brand.data ?? null}
      config={config.data ?? null}
      property={property.data ?? null}
      sitePreview={sitePreview.data ?? null}
      moduleFlags={{
        commerce: modules.data?.find((m) => m.slug === 'commerce')?.enabled ?? true,
        scheduling: modules.data?.find((m) => m.slug === 'scheduling')?.enabled ?? false,
        cms: modules.data?.find((m) => m.slug === 'cms')?.enabled ?? false,
      }}
    />
  );
}

interface EditorProps {
  ctx: SurfaceContext;
  propertyId: string | null;
  storedSite: StoredSilicaSite | null;
  sources: DataSource[];
  publishState: SitePublishState;
  brand: BrandDto | null;
  config: SiteConfigDto | null;
  property: ActiveProperty | null;
  sitePreview: SitePreviewData | null;
  moduleFlags: { commerce: boolean; scheduling: boolean; cms: boolean };
}

function StudioEditor({
  ctx,
  propertyId,
  storedSite,
  sources,
  publishState,
  brand,
  config,
  property,
  sitePreview,
  moduleFlags,
}: EditorProps) {
  const toast = useToast();
  const sync = useSyncSite();
  const publish = usePublishSite();
  const previewToken = usePreviewToken();
  const siteOrigin = useSiteOrigin(propertyId);

  const pageIdParam = typeof ctx.params.pageId === 'string' ? ctx.params.pageId : null;

  const [dirty, setDirty] = useState(false);
  // Seeded from the load EXACTLY ONCE; then owned by silica's onChange and held in
  // a ref so Save/Publish read the CURRENT site and a re-render never re-seeds the
  // canvas over in-progress edits.
  const seededRef = useRef(false);

  // The active site's EFFECTIVE brand (a non-primary site layers its override on
  // the tenant base) — the source for both the compiled theme and the fonts the
  // canvas must load. Reacts to brand/property so a site switch re-themes.
  const effectiveBrand = useMemo<BrandColumns>(() => {
    const base: BrandColumns = brand ?? EMPTY_BRAND;
    return property && !property.isPrimary
      ? applyBrandOverride(base, property.brandOverride)
      : base;
  }, [brand, property]);

  // The document silica edits, built once: heal legacy id-less trees, apply the
  // tenant's brand-compiled theme (an authored theme wins if the site already has
  // one), and frame the chrome — or seed the starter when the property has no silica
  // site yet. Memoized so `<Builder>` reads it once at mount.
  const site = useMemo<Site>(() => {
    // The theme the canvas opens on: the author's SAVED theme if the site has one,
    // else the tenant's EFFECTIVE brand compiled to a silica theme (the primary
    // site's base brand, or a non-primary site's overridden look), else a preset if
    // the compile throws.
    const brandTheme =
      tenantTheme(effectiveBrand, {
        themeKey: config?.themeKey ?? 'default',
        presentation: config?.draftSettings?.presentation,
      }) ?? THEME_PRESETS[0]!;
    const theme: Theme = storedSite?.theme ?? brandTheme;
    if (!storedSite) {
      return starterSite(theme, {
        commerceEnabled: moduleFlags.commerce,
        schedulingEnabled: moduleFlags.scheduling,
        cmsEnabled: moduleFlags.cms,
      });
    }
    return {
      version: '1.0.0',
      ...storedSite,
      theme,
      // Heal legacy trees that predate id-stamping before the engine edits them,
      // so the Navigator never collides two id-less nodes on one React key.
      pages: storedSite.pages.map((p) => ({ ...p, root: ensureUniqueIds(p.root) })),
      ...(storedSite.frame
        ? {
            frame: {
              ...storedSite.frame,
              root: ensureUniqueIds(upgradeFrameChrome(storedSite.frame.root).root),
            },
          }
        : {}),
    };
    // Built once from the load — later edits flow through onChange, not a re-memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const siteRef = useRef<Site>(site);

  // The page ids this client KNOWS the server holds — seeded from the load (the
  // starter is empty here: a fresh property has nothing persisted yet). A save may
  // only delete pages that were in this baseline and the operator has since removed;
  // a page absent for any other reason (an agent authored it over MCP after we loaded)
  // is never in the baseline, so we never delete it out from under them. Advanced to
  // the current set after each successful save.
  const baselineIdsRef = useRef<Set<string>>(new Set((storedSite?.pages ?? []).map((p) => p.id)));

  // The host: the resolver over the canvas data root (placeholder records with the
  // tenant's REAL site.identity/site.social overlaid, so a bound Wordmark/logo/name
  // resolves to the actual brand) + the tenant's data sources + the commerce/site
  // composites + pinned cores + the host-node renderer (which DRAWS the site.brand
  // mark from that same root, instead of silica's grey placeholder). Built once.
  const host = useMemo(() => {
    const pageSources: DataSource[] = sources.length > 0 ? sources : [...COMMERCE_SOURCES];
    // ONE root, shared by the resolver and the host-node renderer, so the brand mark
    // draws the exact identity a bound node resolves.
    const root = buildPreviewRoot(pageSources, sitePreview);
    return buildStudioHost({
      root,
      dataSources: toSilicaDataSources([...pageSources, ...SITE_SOURCES]),
      renderHostNode: makeRenderHostNode(root),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The webfont families the canvas must LOAD, tracked from the LIVE theme so a
  // saved theme's face — and any Design-inspector typeface/heading edit — loads
  // too (silica draws the canvas in the plain workbench DOM; a family it hasn't
  // loaded falls back to Geist). Seeded from the mounted theme, updated on edit.
  const [themeFonts, setThemeFonts] = useState<(string | null)[]>(() =>
    themeFontFamilies(site.theme)
  );
  useCanvasBrandFonts(themeFonts);

  useDirtySource(dirty, 'Your site has unsaved changes. Close it anyway?');

  const onChange = useCallback((next: Site, _ops: readonly Op[], _meta: OpMeta) => {
    seededRef.current = true;
    // Re-load fonts only when the theme reference actually changes (a typeface/
    // heading pick), not on every content edit.
    if (next.theme !== siteRef.current.theme) setThemeFonts(themeFontFamilies(next.theme));
    siteRef.current = next;
    setDirty(true);
  }, []);

  const doSync = useCallback(async () => {
    const next = siteRef.current;
    const currentIds = new Set(next.pages.map((p) => p.id));
    // The pages we loaded (or last saved) that the operator has since removed — the
    // ONLY deletions this save may perform. Anything else absent from `currentIds`
    // (e.g. a page an agent just created over MCP) is not ours to delete.
    const deletedPageIds = [...baselineIdsRef.current].filter((id) => !currentIds.has(id));
    await sync.mutateAsync(toSyncInput(next, deletedPageIds));
    // The server now holds our current set (having deleted only what we named); advance
    // the baseline so the next removal is computed against the truth, not the load.
    baselineIdsRef.current = currentIds;
    setDirty(false);
  }, [sync]);

  const onSave = useCallback(async () => {
    try {
      await doSync();
    } catch (error) {
      toast.add({
        title: 'Could not save',
        description: builderErrorMessage(error, 'Nothing was saved. Try again in a moment.'),
        type: 'error',
      });
    }
  }, [doSync, toast]);

  // silica's own Publish button drives this: persist the current draft first (so
  // the publish reflects the newest edit), then snapshot draft → live.
  const onPublish = useCallback(
    async (payload: PublishPayload) => {
      try {
        siteRef.current = payload.site;
        await doSync();
        await publish.mutateAsync();
        toast.add({
          title: 'Your site is published',
          description: 'Visitors now see this version.',
          type: 'success',
        });
      } catch (error) {
        toast.add({
          title: 'Could not publish',
          description: builderErrorMessage(error, 'Your draft is still saved. Try again.'),
          type: 'error',
        });
      }
    },
    [doSync, publish, toast]
  );

  const onPreview = useCallback(async () => {
    // Open the tab synchronously (pop-up-blocker-safe), then point it at the
    // draft-preview URL once the token is minted. Save first so the server draft
    // the preview serves reflects the current edits.
    const tab = window.open('', '_blank', 'noopener,noreferrer');
    try {
      if (dirty) await doSync();
      const [{ token }, origin] = await Promise.all([
        previewToken.mutateAsync(),
        siteOrigin.refetch().then((r) => r.data ?? siteOrigin.data ?? null),
      ]);
      if (!origin) {
        tab?.close();
        toast.add({
          title: 'No web address yet',
          description: 'Connect a domain to this site to preview it.',
          type: 'warning',
        });
        return;
      }
      const url = `${origin}/?sparxSitePreview=${encodeURIComponent(token)}`;
      if (tab) tab.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      tab?.close();
      toast.add({ title: 'Could not open preview', type: 'error' });
    }
  }, [dirty, doSync, previewToken, siteOrigin, toast]);

  const status = liveStatus(publishState, dirty);
  const validPageIds = useMemo(() => new Set(site.pages.map((p) => p.id)), [site]);

  // ONE toolbar. The status badge + Preview + Save are HOST concerns (silica owns
  // only local edits, not whether our onChange persistence succeeded), so they ride
  // in `toolbarSlot` — silica renders it in the editor header, right before its own
  // Publish button. A separate PaneToolbar above the canvas would just stack a
  // second bar on silica's; the whole point is that the operator sees one row of
  // controls, not two. `ApplyInitialPage` renders nothing and rides along here.
  return (
    <div className="h-full">
      <Builder
        key={propertyId ?? 'site'}
        document={site}
        host={host}
        persistKey={null}
        dataToggle={false}
        onChange={onChange}
        onPublish={onPublish}
        toolbarSlot={
          <div className="flex items-center gap-2">
            <Badge color={status.tone} variant="soft" size="sm">
              {status.label}
            </Badge>
            <Button
              data-tour="builder-preview"
              size="sm"
              variant="outline"
              color="neutral"
              loading={previewToken.isPending}
              onClick={() => {
                void onPreview();
              }}
            >
              <Eye className="size-4" aria-hidden />
              Preview
            </Button>
            <Button
              data-tour="builder-save"
              size="sm"
              color="module"
              disabled={!dirty || sync.isPending}
              loading={sync.isPending}
              onClick={() => {
                void onSave();
              }}
            >
              <Save className="size-4" aria-hidden />
              {dirty ? 'Save' : 'Saved'}
            </Button>
            {pageIdParam && validPageIds.has(pageIdParam) ? (
              <ApplyInitialPage pageId={pageIdParam} />
            ) : null}
          </div>
        }
      />
    </div>
  );
}

/** Silica's engine owns which page is open; this opens the page named by the
 *  `{pageId}` deep link once on mount. Rendered inside `toolbarSlot`, which sits
 *  within the Editor provider, so `useEditor()` resolves. Renders nothing. */
function ApplyInitialPage({ pageId }: { pageId: string }) {
  const editor = useEditor();
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    try {
      editor.setActivePage(pageId);
    } catch {
      // The page isn't in the site (a stale link) — leave the engine on its
      // default first page rather than crashing the editor.
    }
  }, [editor, pageId]);
  return null;
}

/** Map the whole extracted `Site` onto the sync wire shape. Single-author,
 *  explicit-save semantics: the full roster goes every time (last-write-wins), no
 *  ops, no optimistic-concurrency map. Deletions are stated EXPLICITLY via
 *  `deletedPageIds` — the server never infers a removal from an absent page, so a
 *  page an agent authored over MCP while this editor was open survives the save. */
function toSyncInput(site: Site, deletedPageIds: string[]): SiteSyncInput {
  return {
    pages: site.pages.map((p) => ({ id: p.id, name: p.name, slug: p.slug, root: p.root })),
    pageIds: site.pages.map((p) => p.id),
    ...(deletedPageIds.length > 0 ? { deletedPageIds } : {}),
    ...(site.frame ? { frame: { root: site.frame.root } } : {}),
    ...(site.symbols ? { symbols: site.symbols } : {}),
    ...(site.theme ? { theme: site.theme } : {}),
    ...(site.savedThemes ? { savedThemes: site.savedThemes } : {}),
  };
}

/** The "is this live?" badge — local unsaved work first (the operator's own edit),
 *  then the server's draft-vs-published truth. */
function liveStatus(
  state: SitePublishState,
  dirty: boolean
): { label: string; tone: 'success' | 'warning' | 'info' | 'neutral' } {
  if (dirty) return { label: 'Unsaved changes', tone: 'warning' };
  if (state.neverPublished) return { label: 'Not published yet', tone: 'neutral' };
  if (state.hasUnpublished) return { label: 'Saved · not live yet', tone: 'info' };
  return { label: 'Published', tone: 'success' };
}
