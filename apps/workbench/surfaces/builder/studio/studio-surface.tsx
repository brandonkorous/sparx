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
// Params: `{pageId}` opens that page on mount. `{componentId}` names a TENANT-WIDE
// saved piece and opens its master for editing — the library is materialized into
// this document's symbol map (`saved-pieces.ts`), so the deep link is a plain
// `enterSymbol` and the piece is edited with silica's own component machinery.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Builder, useEditor } from '@wizeworks/silicaui-builder/react';
import type { Op, OpMeta, PageMeta, PublishPayload } from '@wizeworks/silicaui-builder/react';
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
import { useConfirm } from '../../../lib/confirm';
import { useDirtySource } from '../../../lib/workbench/dirty';
import { MediaPickerProvider, useMediaPicker } from '../../cms/media-picker';
import { useActiveSiteId, useModuleStates, useTenant } from '../../../lib/api/shell-data';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import {
  builderErrorMessage,
  getSiteCheck,
  useActiveProperty,
  useBindingCatalog,
  useBrand,
  useBuilderSite,
  usePreviewToken,
  usePublishSite,
  usePublishState,
  useUpdatePageSeo,
  useSiteConfig,
  useSiteOrigin,
  useSitePreview,
  useSilicaPieces,
  useSaveSilicaPiece,
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
import { BuilderLiveSync } from './builder-live';
import {
  CollaborativeHistory,
  HISTORY_LIMIT,
  type HistoryStacks,
  type InvertOps,
} from './undo-history';
import { SiteCheck } from './site-check';
import { VersionHistory } from './version-history';
import { PageSettings, draftToPatch, type PageSeoDraft } from './page-settings';
import { buildStudioHost } from './host';
import {
  changedTenantMasters,
  partitionSymbols,
  tenantSymbolId,
  withTenantPieces,
  type SilicaPiece,
} from './saved-pieces';
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
  const pieces = useSilicaPieces();

  const { data: siteState } = useActiveSiteId();
  const propertyId = siteState?.propertyId ?? null;
  const property = useActiveProperty(propertyId);
  // Scope the chrome preview to the ACTIVE site so a per-site brand override
  // previews correctly.
  const sitePreview = useSitePreview(tenant.data?.slug ?? null, property.data?.slug ?? null);

  useEffect(() => {
    ctx.setTitle('Editor');
  }, [ctx]);

  // Live "reload to see the agent's change" (docs/126 §4.5): refetch the site, then bump a
  // nonce so the editor remounts on the fresh load. Bumping AFTER the refetch settles means
  // the remount reads the new snapshot, not the stale cache.
  const [reloadNonce, setReloadNonce] = useState(0);
  const reload = useCallback(() => {
    void site.refetch().finally(() => setReloadNonce((n) => n + 1));
  }, [site]);

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
    pieces.isPending ||
    sitePreview.isPending;
  if (loading) {
    return (
      <p className="p-4 text-base" role="status">
        Loading the editor…
      </p>
    );
  }

  return (
    // The shared media browser, mounted ABOVE the editor so `useMediaPicker()` resolves
    // inside it and the host's `pickAsset` can hand silica a real picture. `content` is
    // where a picture chosen here is filed in the library (docs/49 auto-groups).
    <MediaPickerProvider source="content">
      <StudioEditor
        // Remount (fresh load) when the operator accepts a live "reload to see the agent's
        // change" — the faithful response to a body/frame REPLACE that has no delta op.
        key={reloadNonce}
        ctx={ctx}
        propertyId={propertyId}
        storedSite={site.data ?? null}
        sources={catalog.data?.sources ?? []}
        publishState={publishState.data!}
        brand={brand.data ?? null}
        config={config.data ?? null}
        property={property.data ?? null}
        sitePreview={sitePreview.data ?? null}
        pieces={pieces.data ?? []}
        onReload={reload}
        moduleFlags={{
          commerce: modules.data?.find((m) => m.slug === 'commerce')?.enabled ?? true,
          scheduling: modules.data?.find((m) => m.slug === 'scheduling')?.enabled ?? false,
          cms: modules.data?.find((m) => m.slug === 'cms')?.enabled ?? false,
        }}
      />
    </MediaPickerProvider>
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
  onReload: () => void;
  moduleFlags: { commerce: boolean; scheduling: boolean; cms: boolean };
  /** The tenant-wide saved-piece library, already settled. Passed as a prop rather
   *  than read inside so the document memo can merge it at BUILD time — `<Builder>`
   *  reads `document` once at mount, so a library that arrives later never lands. */
  pieces: SilicaPiece[];
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
  onReload,
  moduleFlags,
  pieces,
}: EditorProps) {
  const toast = useToast();
  const sync = useSyncSite();
  const publish = usePublishSite();
  const updatePageSeo = useUpdatePageSeo();
  const previewToken = usePreviewToken();
  const siteOrigin = useSiteOrigin(propertyId);

  const pageIdParam = typeof ctx.params.pageId === 'string' ? ctx.params.pageId : null;
  // The Saved-pieces pane's "Edit design" hands us a library KEY. It resolves to the
  // symbol that key was materialized under, which `ApplyInitialPiece` then enters.
  const componentIdParam =
    typeof ctx.params.componentId === 'string' ? ctx.params.componentId : null;

  const savePiece = useSaveSilicaPiece();
  // The library AS LOADED — the baseline `changedTenantMasters` diffs against, so a
  // Save only writes masters the author actually touched. A ref, not state: it is
  // advanced by a save and must never re-render the editor or re-seed the canvas.
  const piecesRef = useRef<SilicaPiece[]>(pieces);

  const confirm = useConfirm();
  // The pre-publish check panel. Opened by its toolbar button and by the publish
  // confirm's "Let me look first" — both AFTER a save, because the endpoint reads the
  // saved draft (see `SiteCheck.onRequestOpen`).
  const [checkOpen, setCheckOpen] = useState(false);

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
      return withTenantPieces(
        starterSite(theme, {
          commerceEnabled: moduleFlags.commerce,
          schedulingEnabled: moduleFlags.scheduling,
          cmsEnabled: moduleFlags.cms,
        }),
        pieces
      );
    }
    return withTenantPieces(
      {
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
      },
      pieces
    );
    // Built once from the load — later edits flow through onChange, not a re-memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const siteRef = useRef<Site>(site);

  // The document as it stood immediately BEFORE the action being reported — what
  // `invertOps` reads prior values out of. Kept separate from `siteRef` (which
  // tracks the newest state for saving) because an inverse can only be computed
  // against the state the action started from. silica hands `onChange` a defensive
  // `structuredClone`, so this is a genuine snapshot, not a live reference that
  // would quietly become the after-state.
  const prevSiteRef = useRef<Site>(site);

  // Host-owned undo/redo (docs/126 §4.5). The stacks live here because the studio is
  // what learns about each action; `<CollaborativeHistory>` drives them. `historyRev`
  // is how a ref mutation reaches that component — it re-announces the delegate so
  // silica re-reads whether Undo is available.
  const historyRef = useRef<HistoryStacks>({ undo: [], redo: [] });
  const [historyRev, setHistoryRev] = useState(0);
  // Filled by `<CollaborativeHistory>` with the engine's `inverseOf`, which is only
  // reachable from inside `<Builder>` — and this is outside it.
  const invertRef = useRef<InvertOps | null>(null);

  // The page ids this client KNOWS the server holds — seeded from the load (the
  // starter is empty here: a fresh property has nothing persisted yet). A save may
  // only delete pages that were in this baseline and the operator has since removed;
  // a page absent for any other reason (an agent authored it over MCP after we loaded)
  // is never in the baseline, so we never delete it out from under them. Advanced to
  // the current set after each successful save.
  const baselineIdsRef = useRef<Set<string>>(new Set((storedSite?.pages ?? []).map((p) => p.id)));

  // The page currently open, so Page settings knows which row it is editing. State (not
  // a ref) because the drawer must re-render when the operator switches page.
  const [activePage, setActivePage] = useState<{ id: string; name: string } | null>(null);

  // Pending per-page settings edits, keyed by page id, flushed on Save. `seoDirty`
  // mirrors "the map is non-empty" into render so the Save button lights up for a
  // settings-only change — silica never fires `onChange` for these, so without it an
  // operator could type a page description and find Save still greyed out.
  const seoEditsRef = useRef<Map<string, PageSeoDraft>>(new Map());
  const [seoDirty, setSeoDirty] = useState(false);

  // The slug of the page currently open in the editor, so Preview opens THAT page.
  // silica owns which page is active and reports it through `onActivePageChange` (on
  // mount and on every switch), so a ref is the honest place for it — reading it in a
  // callback must not re-create the callback on every page switch.
  const activeSlugRef = useRef<string>('/');

  // Batch ids THIS client authored, so live-sync skips the echo of its own relayed ops.
  const ownBatchesRef = useRef<Set<string>>(new Set());
  // The ops silica emitted since the last save, and the idempotency id they'll flush
  // under — sent with the next Save so co-editors fold this operator's edits in live.
  const opsBufferRef = useRef<Op[]>([]);
  const batchIdRef = useRef<string | null>(null);

  // The media browser, resolved from the provider mounted above this component. Held
  // in a ref so the host — built ONCE at mount — can call the current picker without
  // taking it as a dependency and re-creating itself on every render.
  const pickPicture = useMediaPicker();
  const pickPictureRef = useRef(pickPicture);
  pickPictureRef.current = pickPicture;

  /** silica's `pickAsset` seam: open the tenant's library, hand back the chosen
   *  picture's URL.
   *
   *  Returns the URL, not a media id, because the published tree's `src` is emitted
   *  verbatim by `toHtml` and fetched by a browser that has no app to resolve an id
   *  through — the same reason the email builder writes URLs.
   *
   *  `alt` is deliberately NOT filled from the filename. "IMG_2381.jpg" read aloud by a
   *  screen reader is worse than silence, and auto-filling it would make the alt-text
   *  check pass on every image while helping nobody. The author writes real alt text;
   *  a missing one is a finding for the pre-publish check, not something to paper over.
   *
   *  0.35.0 only ever asks for `"image"`; the `kind` is honoured anyway so a future
   *  video request doesn't silently get a picture. */
  const pickAsset = useCallback(async (kind: 'image' | 'video') => {
    if (kind !== 'image') return null;
    const picked = await pickPictureRef.current();
    // A library asset with no resolvable URL cannot render — treat it as a cancel
    // rather than writing an empty `src` that blanks the image on the live site.
    return picked?.url ? { url: picked.url } : null;
  }, []);
  const pickAssetRef = useRef(pickAsset);
  pickAssetRef.current = pickAsset;

  // The host: the resolver over the canvas data root (placeholder records with the
  // tenant's REAL site.identity/site.social overlaid, so a bound Wordmark/logo/name
  // resolves to the actual brand) + the tenant's data sources + the commerce/site
  // composites + pinned cores + the host-node renderer (which DRAWS the site.brand
  // mark from that same root, instead of silica's grey placeholder) + the media
  // picker. Built once.
  const host = useMemo(() => {
    const pageSources: DataSource[] = sources.length > 0 ? sources : [...COMMERCE_SOURCES];
    // ONE root, shared by the resolver and the host-node renderer, so the brand mark
    // draws the exact identity a bound node resolves.
    const root = buildPreviewRoot(pageSources, sitePreview);
    return buildStudioHost({
      root,
      dataSources: toSilicaDataSources([...pageSources, ...SITE_SOURCES]),
      renderHostNode: makeRenderHostNode(root),
      // Through the ref, so the once-built host always reaches the live picker.
      pickAsset: (kind) => pickAssetRef.current(kind),
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

  // ONE notion of "unsaved work", whatever produced it: a tree edit silica reported, or
  // a page-settings edit it knows nothing about. The dirty dot, the close-guard, the
  // status badge and the Save button all read this, so a settings-only change is as
  // protected as a canvas one.
  const unsaved = dirty || seoDirty;

  useDirtySource(unsaved, 'Your site has unsaved changes. Close it anyway?');

  /** Fold one action into the undo history, while the document it started from is
   *  still in hand. */
  const recordHistory = useCallback(
    (ops: readonly Op[]) => {
      const stacks = historyRef.current;
      // The engine's own inverter (silicaui 0.36.0). It replaced sparx's
      // `invertOps`, which could not faithfully reverse a symbol-creating
      // `symbol.set` or a `node.setText` — see undo-history.tsx. `?? null` folds a
      // not-yet-mounted inverter into the same conservative path as an
      // un-invertible batch; the toast below is already suppressed on an empty
      // stack, which is what that case is.
      const inverse = invertRef.current?.(ops, prevSiteRef.current) ?? null;
      if (inverse) {
        stacks.undo.push({ ops: [...ops], inverse });
        // Bounded: each entry can carry whole subtrees, so a long session would
        // otherwise grow the tab's memory without limit.
        if (stacks.undo.length > HISTORY_LIMIT) stacks.undo.shift();
      } else {
        // An action nothing can faithfully reverse is a point the document cannot be
        // walked back past. Keeping the entries beneath it would offer an undo that
        // SKIPS it — producing a document nobody authored — so the stack goes instead.
        //
        // And it is SAID, not just done. A history that empties itself with no
        // explanation is the exact complaint this whole slice exists to fix; doing
        // the same thing quietly here would only make it rarer, not honest.
        if (stacks.undo.length > 0) {
          toast.add({
            title: 'Undo history cleared',
            description:
              "That step can't be undone, so the steps before it are no longer available. Nothing you have made is lost.",
            type: 'info',
          });
        }
        stacks.undo.length = 0;
      }
      // A new action always forks the timeline; the redo branch no longer applies.
      stacks.redo.length = 0;
      setHistoryRev((n) => n + 1);
    },
    [toast]
  );

  /** The history delegate moved the document. Take the result as the site to save,
   *  and put its ops on the same relay buffer an ordinary edit uses — to the server
   *  and to everyone else in the session, an undo is just another edit. */
  const onHistoryApplied = useCallback((next: Site, ops: Op[]) => {
    setThemeFonts(themeFontFamilies(next.theme));
    siteRef.current = next;
    prevSiteRef.current = next;
    if (ops.length) {
      batchIdRef.current ??= `wb-${crypto.randomUUID()}`;
      opsBufferRef.current.push(...ops);
    }
    setDirty(true);
    setHistoryRev((n) => n + 1);
  }, []);

  /** Someone else's edit just landed on this canvas. It never reaches `onChange`
   *  (a remote op must not echo back to its sender), so the before-snapshot would
   *  otherwise go stale and the NEXT local action's inverse would be computed
   *  against a document that no longer exists. */
  const onRemoteApplied = useCallback((next: Site) => {
    prevSiteRef.current = next;
  }, []);

  const onChange = useCallback(
    (next: Site, ops: readonly Op[], _meta: OpMeta) => {
      seededRef.current = true;
      recordHistory(ops);
      // Re-load fonts only when the theme reference actually changes (a typeface/
      // heading pick), not on every content edit.
      if (next.theme !== siteRef.current.theme) setThemeFonts(themeFontFamilies(next.theme));
      siteRef.current = next;
      prevSiteRef.current = next;
      // Buffer this edit's ops (docs/126 §4.5). Explicit-save holds them until Save, then
      // sends them alongside the snapshot so a human co-editor's canvas folds them in live —
      // the same relay path an agent's write takes. One batch id spans the whole buffer so a
      // retried save stays idempotent; minted lazily on the first op after a save.
      if (ops.length) {
        batchIdRef.current ??= `wb-${crypto.randomUUID()}`;
        opsBufferRef.current.push(...ops);
      }
      setDirty(true);
    },
    [recordHistory]
  );

  // A view signal, not persistence — silica fires it on mount and on every page
  // switch/rename/slug edit. Preview reads the slug; Page settings keys off the id.
  const onActivePageChange = useCallback((page: PageMeta) => {
    activeSlugRef.current = page.slug;
    setActivePage({ id: page.id, name: page.name });
  }, []);

  /** Record (or clear) a page's pending settings edit. Held here rather than written
   *  immediately so the editor keeps ONE Save button — `doSync` flushes these right
   *  after the site reconcile. A null clears the entry, which is how the dirty flag
   *  goes back down when the operator undoes their own typing. */
  const onPageSeoChange = useCallback((pageId: string, next: PageSeoDraft | null) => {
    if (next) seoEditsRef.current.set(pageId, next);
    else seoEditsRef.current.delete(pageId);
    setSeoDirty(seoEditsRef.current.size > 0);
  }, []);

  const doSync = useCallback(async () => {
    const next = siteRef.current;
    const currentIds = new Set(next.pages.map((p) => p.id));
    // The pages we loaded (or last saved) that the operator has since removed — the
    // ONLY deletions this save may perform. Anything else absent from `currentIds`
    // (e.g. a page an agent just created over MCP) is not ours to delete.
    const deletedPageIds = [...baselineIdsRef.current].filter((id) => !currentIds.has(id));
    const ops = opsBufferRef.current;
    const batchId = ops.length > 0 ? batchIdRef.current : null;
    // Record our own batch so live-sync skips its echo when the relay comes back around.
    if (batchId) ownBatchesRef.current.add(batchId);

    // Tenant masters FIRST, then the site. A saved piece is shared across every site
    // the business owns, so it is the more consequential half — and if the site sync
    // fails the author retries the same Save, whereas a library write that never
    // happened leaves the other sites showing an old design with nothing on screen
    // to say so. Only masters whose design actually changed are sent.
    const changed = changedTenantMasters(partitionSymbols(next.symbols), piecesRef.current);
    if (changed.length > 0) {
      await Promise.all(
        changed.map((piece) =>
          savePiece.mutateAsync({ key: piece.key, name: piece.name, root: piece.root })
        )
      );
      // Advance the baseline so the NEXT save compares against what was just stored
      // rather than the load — otherwise every subsequent save re-sends the same
      // master and mints a version per click.
      piecesRef.current = piecesRef.current.map((p) => {
        const hit = changed.find((c) => c.key === p.key);
        return hit ? { ...p, name: hit.name, root: structuredClone(hit.root) } : p;
      });
    }

    await sync.mutateAsync(toSyncInput(next, deletedPageIds, ops, batchId));
    // Committed — drop the buffer (a failed save threw above, keeping ops + batch id for a
    // retry under the SAME id, so the op log never double-appends).
    opsBufferRef.current = [];
    batchIdRef.current = null;
    // The server now holds our current set (having deleted only what we named); advance
    // the baseline so the next removal is computed against the truth, not the load.
    baselineIdsRef.current = currentIds;
    setDirty(false);

    // Page settings (title/description/social picture/indexing) land AFTER the sync, and
    // that order is load-bearing: a page created in this session has no row until the
    // sync creates it, so patching first would 404 and lose the operator's words.
    // Deletions are honoured too — settings for a page removed in this same save have
    // nothing left to attach to.
    const edits = [...seoEditsRef.current].filter(([id]) => currentIds.has(id));
    if (edits.length > 0) {
      await Promise.all(
        edits.map(([pageId, draft]) =>
          updatePageSeo.mutateAsync({ pageId, seo: draftToPatch(draft) })
        )
      );
    }
    // Cleared only AFTER the patches resolve. Clearing first would mean a failed
    // request threw with the operator's words already discarded — they would reopen the
    // drawer to find their description gone and the error blaming the save.
    for (const [id] of edits) seoEditsRef.current.delete(id);
    setSeoDirty(seoEditsRef.current.size > 0);
  }, [sync, updatePageSeo, savePiece]);

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

  /** Save, then open the check panel. Both routes in go through here so the endpoint
   *  — which reads the SAVED draft — is never describing a version the author has
   *  already edited past. */
  const openCheck = useCallback(async () => {
    try {
      await doSync();
    } catch (error) {
      toast.add({
        title: 'Could not save before checking',
        description: builderErrorMessage(
          error,
          'The check reads your saved draft, so it was not run. Try again in a moment.'
        ),
        type: 'error',
      });
      return;
    }
    setCheckOpen(true);
  }, [doSync, toast]);

  // silica's own Publish button drives this: persist the current draft first (so
  // the publish reflects the newest edit), then snapshot draft → live.
  //
  // THE CHECK RUNS HERE, AND IT NEVER BLOCKS. It is asked only about things that are
  // BROKEN — a link to a page that does not exist, an image with no file, a page with
  // nothing on it — and only then does it interrupt, once, with a question whose
  // primary answer is "Publish anyway". Warnings and suggestions never interrupt at
  // all; they are what the Check button is for.
  //
  // The friction is deliberately at the moment of decision rather than in a badge
  // somewhere: a badge is something an author can look past for weeks, and "we
  // published a broken link" is the failure this whole wave exists to prevent. But the
  // site belongs to the person who built it — they may be publishing a link to a page
  // that goes live in an hour — so the answer is theirs and the default is yes.
  //
  // A check that FAILS to run (network, a 500) is not a reason to hold up a publish
  // that would otherwise succeed, so it degrades to null and the publish proceeds.
  const onPublish = useCallback(
    async (payload: PublishPayload) => {
      try {
        siteRef.current = payload.site;
        await doSync();

        const report = await getSiteCheck().catch(() => null);
        if (report && report.counts.error > 0) {
          const n = report.counts.error;
          const proceed = await confirm({
            title: `${String(n)} thing${n === 1 ? '' : 's'} on your site ${n === 1 ? 'is' : 'are'} broken`,
            description:
              n === 1
                ? 'One thing on your site would not work for a visitor — a link that goes nowhere, ' +
                  'an image with no picture in it, or a page with nothing on it. You can publish ' +
                  'anyway and fix it after, or look at it first.'
                : `${String(n)} things on your site would not work for a visitor — links that go ` +
                  'nowhere, images with no picture in them, or pages with nothing on them. You can ' +
                  'publish anyway and fix them after, or look at them first.',
            confirmLabel: 'Publish anyway',
            cancelLabel: 'Let me look first',
            color: 'primary',
          });
          if (!proceed) {
            // Already saved above, so the panel opens straight onto a current report.
            setCheckOpen(true);
            return;
          }
        }

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
    [confirm, doSync, publish, toast]
  );

  const onPreview = useCallback(async () => {
    // Open the tab synchronously (pop-up-blocker-safe), then point it at the
    // draft-preview URL once the token is minted. Save first so the server draft
    // the preview serves reflects the current edits.
    const tab = window.open('', '_blank', 'noopener,noreferrer');
    try {
      if (unsaved) await doSync();
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
      // Preview the page the author is LOOKING AT, not always the home page. This
      // always opened `/`, so previewing a change to the About page meant landing on
      // Home and navigating — and on a site whose home is unchanged, reading as
      // "Preview does nothing".
      const url = `${origin}${previewPath(activeSlugRef.current)}?sparxSitePreview=${encodeURIComponent(token)}`;
      if (tab) tab.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      tab?.close();
      toast.add({ title: 'Could not open preview', type: 'error' });
    }
  }, [unsaved, doSync, previewToken, siteOrigin, toast]);

  const status = liveStatus(publishState, unsaved);
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
        onActivePageChange={onActivePageChange}
        onPublish={onPublish}
        toolbarSlot={
          <div className="flex items-center gap-2">
            <CollaborativeHistory
              stacksRef={historyRef}
              invertRef={invertRef}
              revision={historyRev}
              onApplied={onHistoryApplied}
            />
            {propertyId ? (
              <BuilderLiveSync
                propertyId={propertyId}
                baselineIdsRef={baselineIdsRef}
                ownBatchesRef={ownBatchesRef}
                onRemoteApplied={onRemoteApplied}
                onReload={onReload}
              />
            ) : null}
            <Badge color={status.tone} variant="soft" size="sm">
              {status.label}
            </Badge>
            <PageSettings
              pageId={activePage?.id ?? null}
              pageName={activePage?.name ?? ''}
              siteName={sitePreview?.identity.name ?? ''}
              // A page the server already holds can load its stored settings; one added
              // in this session cannot (there is no row yet), so the form opens blank
              // and its first write rides the save that creates the row.
              saved={activePage ? baselineIdsRef.current.has(activePage.id) : false}
              pending={activePage ? (seoEditsRef.current.get(activePage.id) ?? null) : null}
              onChange={onPageSeoChange}
            />
            <SiteCheck
              open={checkOpen}
              onOpenChange={setCheckOpen}
              onRequestOpen={() => void openCheck()}
            />
            <VersionHistory onReload={onReload} />
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
              disabled={!unsaved || sync.isPending}
              loading={sync.isPending}
              onClick={() => {
                void onSave();
              }}
            >
              <Save className="size-4" aria-hidden />
              {unsaved ? 'Save' : 'Saved'}
            </Button>
            {pageIdParam && validPageIds.has(pageIdParam) ? (
              <ApplyInitialPage pageId={pageIdParam} />
            ) : null}
            {componentIdParam ? <ApplyInitialPiece pieceKey={componentIdParam} /> : null}
          </div>
        }
      />
    </div>
  );
}

/** A page's storefront path for the preview URL. silica stores a slug as `/`, `/shop`
 *  or (older trees) a bare `shop`; the storefront routes on a leading-slash path, and a
 *  collection template has no route of its own — previewing one lands on the home page,
 *  which is the honest answer for "a template, not a page". */
function previewPath(slug: string | null | undefined): string {
  const bare = (slug ?? '').trim().replace(/^\/+/, '');
  if (bare === '') return '/';
  return `/${bare}`;
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

/** Opens the saved piece named by the `{componentId}` deep link — the other half of
 *  the Saved-pieces pane's "Edit design" button, which has pointed here since it was
 *  written and had nothing listening.
 *
 *  `enterSymbol` is the whole mechanism: the tenant master was materialized into the
 *  document as `tenant:<key>` (`saved-pieces.ts`), so editing the piece IS editing a
 *  silica symbol, and the engine retargets its entire spine — canvas, Navigator,
 *  Inspector — onto that master. Every instance across the site re-renders from it
 *  live, which is what makes the pane's "changes everywhere" claim literally true.
 *
 *  A key that resolves to nothing (deleted since the link was made, or a legacy piece
 *  with no silica master) is a NO-OP by design: `enterSymbol` returns early on an
 *  unknown id, and the author lands on the normal page canvas rather than an empty
 *  editing mode with nothing in it and no way to explain itself. */
function ApplyInitialPiece({ pieceKey }: { pieceKey: string }) {
  const editor = useEditor();
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    editor.enterSymbol(tenantSymbolId(pieceKey));
  }, [editor, pieceKey]);
  return null;
}

/** Map the whole extracted `Site` onto the sync wire shape. The full roster goes every
 *  time (the snapshot stays authoritative, last-write-wins). Deletions are stated
 *  EXPLICITLY via `deletedPageIds` — the server never infers a removal from an absent
 *  page, so a page an agent authored over MCP while this editor was open survives the
 *  save. `ops` (when present) ride ALONGSIDE the snapshot: the server appends them to the
 *  log and relays them, so a co-editor folds this operator's edits in live (docs/126
 *  §4.5) — additive, never a replacement for the authoritative snapshot. */
function toSyncInput(
  site: Site,
  deletedPageIds: string[],
  ops: readonly Op[] = [],
  batchId: string | null = null
): SiteSyncInput {
  // Only the SITE-OWNED symbols persist to this property. A `tenant:*` symbol is a
  // materialized copy of a shared library master (`saved-pieces.ts`) and is sent to
  // the library instead — writing it here as well would fork the master into a
  // per-site copy on first save, and the "change it once, it changes everywhere"
  // promise the Saved-pieces pane makes would quietly stop being true.
  const symbols = partitionSymbols(site.symbols).site;
  return {
    pages: site.pages.map((p) => ({ id: p.id, name: p.name, slug: p.slug, root: p.root })),
    pageIds: site.pages.map((p) => p.id),
    ...(deletedPageIds.length > 0 ? { deletedPageIds } : {}),
    ...(ops.length > 0 && batchId
      ? { ops: ops as unknown as SiteSyncInput['ops'], batchId, baseSeq: 0 }
      : {}),
    ...(site.frame ? { frame: { root: site.frame.root } } : {}),
    // Sent even when EMPTY, unlike the other optional halves: the sync treats an
    // absent `symbols` as "not speaking about symbols" and preserves what is stored
    // (site-service `symbolsUpdateFor`). A site whose only symbols were tenant ones
    // must be able to say "none of mine", or the stale materialized copies stored
    // before this shipped would live in the property row forever.
    symbols,
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
