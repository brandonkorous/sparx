'use client';

// SiteStudio — the unified builder shell for the SITE surface (docs/builder/03).
//
// One editor, three ownership zones, one canvas: the brand `Theme` wraps the site
// `layout` chrome, which wraps the active `page` at its Outlet — exactly the stack
// the storefront ships ([45], [36]). You edit the page INSIDE its real header and
// footer, themed by the live brand; switching the page swaps only the Outlet; the
// Theme node opens the brand controls and re-themes the canvas live.
//
// The editing brain is `useStudioEditor` (the three-zone autosave router — a layout
// edit, a page edit, and a theme edit each persist to their OWN store on their OWN
// debounce, so none can stomp another). The Theme zone is the ThemeCenter panel in
// its `inspector` variant, reporting its compiled theme up so the canvas re-themes.
// The canvas is the Phase-2 unified renderer with `chromeLocked={false}` so the
// chrome is selectable alongside the page.
//
// Catalog scope: SiteStudio edits the tenant's ACTIVE layout + a switchable page,
// publishes the visible stack, and owns the full page catalog (switch/new/rename/
// delete) + SEO + saved themes. Layout-catalog switching, duplicate, and import/
// export remain on the per-surface routes until the Phase-7 cutover.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  Layers,
  Monitor,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Save,
  Settings2,
  Smartphone,
  Table2,
  Tablet,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  ModuleProvider,
  NativeSelect,
  ScrollArea,
  cn,
  toast,
  useConfirm,
  useMediaQuery,
} from '@sparx/ui';
import { makeCustomNode, SITE_CATALOG } from '@sparx/builder-schemas';
import type {
  BindingCatalog,
  BuilderLayoutDto,
  BuilderPageDto,
  ComponentDto,
} from '@sparx/builder-schemas';

import { makeId, type BuilderNode, type Device, type PageSeo, type PageTemplate } from './model';
import { getDef } from './registry';
import { Inspector, LayoutSettings, PageSettings } from './inspector';
import { AddPalette } from './add-palette';
import { Canvas } from './canvas';
import { StudioLayers } from './studio-layers';
import { FieldsPanel } from './fields-panel';
import { deriveFieldKey, makeFieldDef, type CreatableType } from './field-kinds';
import { useStudioEditor } from './use-studio-editor';
import type { SaveStatus } from './use-builder-editor';
import { UndoRedoButtons } from './editor-undo-redo';
import { useEditorKeymap } from './editor-keymap';
import { ShortcutsOverlay } from './shortcuts-overlay';
import { useComponentVersions } from './use-component-versions';
import { useSurfacePreview } from './use-surface-preview';
import type { SitePreviewData } from './binding-catalog';
import {
  activateLayout,
  createPage,
  deletePage,
  mintBuilderPreviewToken,
  publishLayout,
  publishPage,
  renamePage,
  retargetPage,
  savePageTree,
  saveLayoutTree,
  setPageDefault,
  setPageSlug,
  updatePageSeo,
} from '../_lib/actions';
import { publishNow } from '../_brand/lib/actions';
import { copyComponent } from '../components/_lib/component-actions';
import { getContentTypeSchema, saveContentTypeSchema } from '../_lib/schema-actions';
import { ThemeCenter } from '../_brand/components/theme-center';
import type {
  BrandDto,
  BrandMediaUrls,
  SiteConfigDto,
  SiteDto,
  SitePreviewConfig,
  SiteThemeDto,
} from '../_brand/lib/types';

// ── Working shapes ────────────────────────────────────────────────────────────

interface LayoutItem {
  id: string;
  name: string;
  tree: BuilderNode;
  published: boolean;
  isActive: boolean;
}

function toLayoutItem(l: BuilderLayoutDto): LayoutItem {
  return { id: l.id, name: l.name, tree: l.tree, published: l.published, isActive: l.isActive };
}

function toTemplate(p: BuilderPageDto): PageTemplate {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    kind: p.kind,
    recordType: p.recordType ?? undefined,
    isDefault: p.isDefault,
    tree: p.tree,
    seo: {
      title: p.seoTitle ?? '',
      description: p.seoDescription ?? '',
      canonical: p.canonical ?? '',
      ogImage: p.ogImage ?? '',
      noindex: p.noindex,
    },
  };
}

function templateLabel(t: PageTemplate): string {
  if (t.kind === 'collection')
    return `${t.name} · per ${t.recordType?.split('.').pop() ?? 'record'}`;
  return t.name;
}

const DEVICES: { id: Device; label: string; icon: typeof Monitor }[] = [
  { id: 'desktop', label: 'Desktop', icon: Monitor },
  { id: 'tablet', label: 'Tablet', icon: Tablet },
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
];

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

// ── Desktop chrome prefs (mirrors BuilderWorkspace) ───────────────────────────
const RAIL_W_KEY = 'sparx:builder-rail-w';
const RAIL_W_DEFAULT = 300;
const RAIL_W_MIN = 240;
const RAIL_W_MAX = 480;
const SIDE_COLLAPSED_KEY = 'sparx:builder-side-collapsed';

function clampRail(n: number): number {
  return Math.min(RAIL_W_MAX, Math.max(RAIL_W_MIN, n));
}

function useRailWidth() {
  const [value, setValueState] = React.useState(RAIL_W_DEFAULT);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RAIL_W_KEY);
      if (raw) {
        const n = Number.parseFloat(raw);
        if (Number.isFinite(n)) setValueState(clampRail(n));
      }
    } catch {
      /* storage disabled */
    }
  }, []);
  const setValue = React.useCallback((next: number) => {
    const c = clampRail(next);
    setValueState(c);
    try {
      window.localStorage.setItem(RAIL_W_KEY, String(c));
    } catch {
      /* ignore */
    }
  }, []);
  return [value, setValue] as const;
}

function useSideCollapsed() {
  const [value, setValueState] = React.useState(false);
  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(SIDE_COLLAPSED_KEY) === 'true') setValueState(true);
    } catch {
      /* storage disabled */
    }
  }, []);
  const setValue = React.useCallback((next: boolean) => {
    setValueState(next);
    try {
      window.localStorage.setItem(SIDE_COLLAPSED_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);
  return [value, setValue] as const;
}

function RailResizeHandle({ width, onChange }: { width: number; onChange: (n: number) => void }) {
  const start = React.useRef<{ x: number; w: number } | null>(null);
  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    start.current = { x: e.clientX, w: width };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    function onMove(ev: MouseEvent) {
      if (!start.current) return;
      onChange(clampRail(start.current.w + (ev.clientX - start.current.x)));
    }
    function onUp() {
      start.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(clampRail(width - 16));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(clampRail(width + 16));
    }
  }
  return (
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuemin={RAIL_W_MIN}
      aria-valuemax={RAIL_W_MAX}
      aria-valuenow={width}
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
      className="bx-resize"
    />
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SiteStudioProps {
  initialLayouts: BuilderLayoutDto[];
  initialPages: BuilderPageDto[];
  /** What the active page can bind to (the tenant's CMS/commerce/CRM sources). */
  pageCatalog: BindingCatalog;
  components?: ComponentDto[];
  /** The active web property's live origin — the canvas browser-frame address bar. */
  siteOrigin?: string;
  /** Real site-chrome data (brand identity + social) for the canvas preview. */
  sitePreview?: SitePreviewData | null;
  /** Deep-link: open this page in the Outlet on mount. */
  initialPageId?: string;
  /** Tenant slug + active property slug for the Preview tab. */
  tenantSlug?: string;
  previewPropertySlug?: string;
  /** The Theme zone's data (docs/49) — feeds the ThemeCenter inspector panel. */
  theme: {
    brand: BrandDto;
    baseBrand: BrandDto;
    site: SiteDto;
    config: SiteConfigDto;
    savedThemes: SiteThemeDto[];
    media: BrandMediaUrls;
    sitePreview: SitePreviewConfig;
  };
}

export function SiteStudio({
  initialLayouts,
  initialPages,
  pageCatalog,
  components = [],
  siteOrigin,
  sitePreview,
  initialPageId,
  tenantSlug,
  previewPropertySlug,
  theme,
}: SiteStudioProps) {
  const router = useRouter();
  const confirm = useConfirm();

  // ── Catalog state (the active layout + the page catalog) ────────────────────
  const [layoutItem, setLayoutItem] = React.useState<LayoutItem | null>(() => {
    const active = initialLayouts.find((l) => l.isActive) ?? initialLayouts[0];
    return active ? toLayoutItem(active) : null;
  });
  const [pages, setPages] = React.useState<PageTemplate[]>(() => initialPages.map(toTemplate));
  const [activePageId, setActivePageId] = React.useState<string | null>(() =>
    initialPageId && initialPages.some((p) => p.id === initialPageId)
      ? initialPageId
      : (initialPages[0]?.id ?? null)
  );
  const [busy, setBusy] = React.useState(false);

  const activePage = pages.find((p) => p.id === activePageId) ?? pages[0] ?? null;
  const componentsByKey = React.useMemo(
    () => new Map(components.map((c) => [c.key, c])),
    [components]
  );

  // The content type a collection template renders, if any — drives the Fields tab
  // + inline "+ New field" (docs/51), exactly like the page editor.
  const contentTypeKey =
    activePage?.kind === 'collection' && activePage.recordType?.startsWith('cms.')
      ? activePage.recordType.slice('cms.'.length)
      : null;

  // The home singleton serves at "/" — used to resolve the Preview path.
  const homeId = pages.find((p) => p.kind === 'singleton' && !p.slug)?.id ?? null;

  // ── Theme zone wiring (ThemeCenter inspector → canvas CSS + flush) ──────────
  const [themeCanvasCss, setThemeCanvasCss] = React.useState('');
  const themeFlushRef = React.useRef<(() => Promise<void>) | null>(null);

  // ── The three-zone editing brain ────────────────────────────────────────────
  const studio = useStudioEditor({
    layoutTree: layoutItem?.tree ?? null,
    pageTree: activePage?.tree ?? null,
    layoutCatalog: SITE_CATALOG,
    pageCatalog,
    components: componentsByKey,
    sitePreview,
    saveLayout: async (next) =>
      layoutItem ? (await saveLayoutTree(layoutItem.id, next)).ok : false,
    savePage: async (next) => (activePage ? (await savePageTree(activePage.id, next)).ok : false),
    onLayoutChange: (next) => setLayoutItem((l) => (l ? { ...l, tree: next } : l)),
    onPageChange: (next) =>
      setPages((ps) => ps.map((p) => (p.id === activePage?.id ? { ...p, tree: next } : p))),
    flushTheme: async () => {
      await themeFlushRef.current?.();
    },
  });

  // A synthetic root over BOTH trees so the live-utility compile + component-version
  // resolution cover the whole canvas (chrome + page) in one pass.
  const combinedTree = React.useMemo<BuilderNode>(
    () => ({
      id: '__studio_combined',
      type: 'Section',
      props: {},
      children: [
        ...(layoutItem ? [layoutItem.tree] : []),
        ...(activePage ? [activePage.tree] : []),
      ],
    }),
    [layoutItem, activePage]
  );
  const previewCss = useSurfacePreview(combinedTree);
  const resolveVersion = useComponentVersions(componentsByKey, combinedTree);

  // ── Desktop chrome (resizable rail + collapsible inspector) ─────────────────
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [railW, setRailW] = useRailWidth();
  const [sideCollapsed, setSideCollapsed] = useSideCollapsed();
  const effectiveCollapsed = sideCollapsed && isDesktop;
  // Any selection (a node OR the Theme/settings zones) surfaces the inspector.
  React.useEffect(() => {
    setSideCollapsed(false);
  }, [studio.selection.zone, studio.selection.id, setSideCollapsed]);

  // Editor keymap + `?` overlay (docs/builder/05 §2.6), wired to the studio brain.
  const [showShortcuts, setShowShortcuts] = React.useState(false);
  useEditorKeymap({
    undo: studio.undo,
    redo: studio.redo,
    copy: studio.copySelection,
    paste: studio.paste,
    duplicate: studio.duplicateSelection,
    remove: studio.deleteSelection,
    copyStyles: studio.copyStyles,
    pasteStyles: studio.pasteStyles,
    selectAll: studio.selectAll,
    selectParent: studio.selectParent,
    clear: () => studio.selectNode(null),
    nudge: studio.nudge,
    save: () => void studio.flushAll(),
    toggleHelp: () => setShowShortcuts((v) => !v),
    hasSelection: studio.selection.zone !== 'theme' && studio.selection.id !== null,
  });

  // The Fields tab only exists for a CMS collection template; fall back to Layers.
  const railTab = studio.railTab === 'fields' && !contentTypeKey ? 'layers' : studio.railTab;
  // The Add palette only makes sense in a node zone (you don't add nodes to a theme).
  const showAddTab = studio.activeZone !== null;

  // ── Page catalog ops (parity with the page editor) ──────────────────────────
  const onSelectPage = (id: string) => {
    void studio.flushZone('page');
    setActivePageId(id);
    studio.selectZoneHome('page');
  };

  const onNewPage = async () => {
    setBusy(true);
    await studio.flushZone('page');
    const res = await createPage({ name: 'Untitled page', kind: 'singleton' });
    setBusy(false);
    if (!res.ok || !res.data) {
      studio.setSaveStatus('error');
      return;
    }
    const created = res.data;
    setPages((ps) => [...ps, toTemplate(created)]);
    setActivePageId(created.id);
    studio.selectNode(created.tree.id);
    studio.setRailTab('add');
  };

  const onDeletePage = async () => {
    if (!activePage || pages.length <= 1) return;
    const ok = await confirm({
      title: `Delete “${activePage.name}”?`,
      description: 'This permanently removes the page and everything on it. This can’t be undone.',
      confirmLabel: 'Delete page',
      tone: 'danger',
    });
    if (!ok) return;
    const removedId = activePage.id;
    setBusy(true);
    const res = await deletePage(removedId);
    setBusy(false);
    if (!res.ok) {
      studio.setSaveStatus('error');
      return;
    }
    const remaining = pages.filter((p) => p.id !== removedId);
    setPages(remaining);
    setActivePageId((cur) => (cur === removedId ? (remaining[0]?.id ?? null) : cur));
    studio.selectZoneHome('page');
  };

  // Inline page rename (the switcher swaps to a text input).
  const [renaming, setRenaming] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState('');
  const skipRenameCommit = React.useRef(false);
  const renameInputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (renaming) renameInputRef.current?.select();
  }, [renaming]);
  const startRename = () => {
    if (!activePage) return;
    setNameDraft(activePage.name);
    setRenaming(true);
  };
  const commitRename = async () => {
    if (skipRenameCommit.current) {
      skipRenameCommit.current = false;
      setRenaming(false);
      return;
    }
    setRenaming(false);
    if (!activePage) return;
    const name = nameDraft.trim();
    if (!name || name === activePage.name) return;
    const id = activePage.id;
    setPages((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)));
    studio.setSaveStatus('saving');
    const res = await renamePage(id, name);
    studio.setSaveStatus(res.ok ? 'saved' : 'error');
  };

  // ── Page settings handlers (slug / SEO / retarget / default) ────────────────
  const onSlug = async (slug: string) => {
    if (!activePage) return;
    const id = activePage.id;
    const prev = activePage.slug;
    const optimistic = slug.trim() === '' ? null : slug.trim();
    setPages((ps) => ps.map((p) => (p.id === id ? { ...p, slug: optimistic } : p)));
    studio.setSaveStatus('saving');
    const res = await setPageSlug(id, slug);
    if (res.ok && res.data) {
      const saved = res.data;
      setPages((ps) => ps.map((p) => (p.id === id ? { ...p, slug: saved.slug } : p)));
      studio.setSaveStatus('saved');
    } else {
      setPages((ps) => ps.map((p) => (p.id === id ? { ...p, slug: prev } : p)));
      studio.setSaveStatus('error');
    }
  };

  const onRetarget = async (recordType: string | null) => {
    if (!activePage) return;
    const id = activePage.id;
    const prev = activePage.recordType;
    setPages((ps) =>
      ps.map((p) => (p.id === id ? { ...p, recordType: recordType ?? undefined } : p))
    );
    studio.setSaveStatus('saving');
    const res = await retargetPage(id, recordType);
    if (res.ok && res.data) {
      const saved = res.data;
      setPages((ps) =>
        ps.map((p) => (p.id === id ? { ...p, recordType: saved.recordType ?? undefined } : p))
      );
      studio.setSaveStatus('saved');
    } else {
      setPages((ps) => ps.map((p) => (p.id === id ? { ...p, recordType: prev } : p)));
      studio.setSaveStatus('error');
    }
  };

  const onMakeDefault = async () => {
    if (!activePage?.recordType) return;
    const id = activePage.id;
    const rt = activePage.recordType;
    const prev = pages
      .filter((p) => p.recordType === rt)
      .map((p) => ({ id: p.id, isDefault: p.isDefault }));
    setPages((ps) => ps.map((p) => (p.recordType === rt ? { ...p, isDefault: p.id === id } : p)));
    studio.setSaveStatus('saving');
    const res = await setPageDefault(id);
    if (res.ok) {
      studio.setSaveStatus('saved');
    } else {
      setPages((ps) =>
        ps.map((p) => {
          const x = prev.find((y) => y.id === p.id);
          return x ? { ...p, isDefault: x.isDefault } : p;
        })
      );
      studio.setSaveStatus('error');
    }
  };

  const onSeo = async (patch: Partial<PageSeo>) => {
    if (!activePage) return;
    const id = activePage.id;
    const prev = activePage.seo;
    const next = { ...prev, ...patch };
    setPages((ps) => ps.map((p) => (p.id === id ? { ...p, seo: next } : p)));
    studio.setSaveStatus('saving');
    const res = await updatePageSeo(id, {
      seoTitle: next.title,
      seoDescription: next.description,
      canonical: next.canonical,
      ogImage: next.ogImage,
      noindex: next.noindex,
    });
    if (res.ok) {
      studio.setSaveStatus('saved');
    } else {
      setPages((ps) => ps.map((p) => (p.id === id ? { ...p, seo: prev } : p)));
      studio.setSaveStatus('error');
    }
  };

  const onAddField = async (label: string, kind: CreatableType): Promise<string | null> => {
    if (!contentTypeKey) return null;
    const cur = await getContentTypeSchema(contentTypeKey);
    if (!cur.ok || !cur.data) return null;
    const existing = cur.data.schema_json.fields ?? [];
    const key = deriveFieldKey(label, existing);
    const res = await saveContentTypeSchema(contentTypeKey, [
      ...existing,
      makeFieldDef(kind, key, label),
    ]);
    if (!res.ok) return null;
    router.refresh();
    return key;
  };

  // "Save as component" routes to the active zone's surface (docs/53 P-C).
  const onSaveAsComponent = async (node: BuilderNode) => {
    const def = getDef(node.type);
    const surface = studio.activeZone === 'layout' ? 'site' : 'page';
    setBusy(true);
    const res = await copyComponent({
      name: node.name ?? def?.label ?? 'Component',
      group: def?.group ?? 'content',
      icon: 'box',
      surfaces: [surface],
      tree: node,
    });
    if (!res.ok || !res.data) {
      setBusy(false);
      studio.setSaveStatus('error');
      return;
    }
    const created = res.data;
    studio.replaceNode(
      node.id,
      makeCustomNode(created.key, created.latestVersion, makeId('custom'))
    );
    if (studio.activeZone) await studio.flushZone(studio.activeZone);
    setBusy(false);
    studio.setSaveStatus('saved');
    router.refresh();
  };

  // ── Preview (open the page's draft on the live site) ────────────────────────
  const previewPath: string | null =
    activePage?.kind === 'singleton'
      ? activePage.slug
        ? activePage.slug.replace(/^\/+/, '')
        : activePage.id === homeId
          ? ''
          : null
      : null;
  const canPreview = previewPath !== null && Boolean(siteOrigin && tenantSlug);
  const onPreview = async () => {
    if (previewPath === null || !siteOrigin || !tenantSlug) return;
    setBusy(true);
    await studio.flushAll();
    const res = await mintBuilderPreviewToken();
    setBusy(false);
    if (!res.ok || !res.data) {
      studio.setSaveStatus('error');
      return;
    }
    const propertyQuery = previewPropertySlug
      ? `&property=${encodeURIComponent(previewPropertySlug)}`
      : '';
    const url =
      `${siteOrigin}/${previewPath}?tenant=${encodeURIComponent(tenantSlug)}` +
      propertyQuery +
      `&sparxSitePreview=${encodeURIComponent(res.data.token)}`;
    window.open(url, '_blank', 'noopener');
  };

  // ── Publish the visible site stack (theme + chrome + active page) ───────────
  const onPublish = async () => {
    if (!layoutItem || !activePage) return;
    const ok = await confirm({
      title: 'Publish your site?',
      description:
        'Publishes your brand & theme, the site layout, and the current page live across your site.',
      confirmLabel: 'Publish',
      tone: 'module',
    });
    if (!ok) return;
    setBusy(true);
    await studio.flushAll();
    const [brand, layout, page] = await Promise.all([
      publishNow(),
      publishLayout(layoutItem.id),
      publishPage(activePage.id),
    ]);
    // If the published layout isn't yet the live one, activate it (a published
    // layout can be idle; the studio edits the active one, so make it live).
    if (layout.ok && layout.data && !layoutItem.isActive) {
      const act = await activateLayout(layoutItem.id);
      if (act.ok) setLayoutItem((l) => (l ? { ...l, isActive: true } : l));
    }
    setBusy(false);
    if (brand.ok && layout.ok && page.ok) {
      if (layout.data) setLayoutItem((l) => (l ? { ...l, published: true } : l));
      if (page.data)
        setPages((ps) => ps.map((p) => (p.id === activePage.id ? toTemplate(page.data!) : p)));
      studio.setSaveStatus('saved');
      toast.success('Your site is live.');
    } else {
      studio.setSaveStatus('error');
      toast.error('Publish failed — some changes may not be live.');
    }
  };

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!layoutItem || !activePage) {
    return (
      <ModuleProvider module="builder">
        <div className="bx-shell">
          <div className="bx-noempty">
            <p className="bx-noempty__lead">
              {!layoutItem ? 'No site layout yet.' : 'No pages yet.'}
            </p>
            {!layoutItem ? (
              <Button size="sm" variant="solid" disabled>
                Couldn’t load your site layout — reload.
              </Button>
            ) : (
              <Button
                size="sm"
                variant="solid"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                disabled={busy}
                onClick={() => void onNewPage()}
              >
                Create a page
              </Button>
            )}
          </div>
        </div>
      </ModuleProvider>
    );
  }

  const zone = studio.selection.zone;
  const zoneLabel =
    zone === 'theme'
      ? 'Brand theme'
      : zone === 'layout'
        ? 'Site layout'
        : templateLabel(activePage);

  const bodyStyle = {
    '--bx-rail-w': `${railW}px`,
    '--bx-side-w': effectiveCollapsed ? '2.75rem' : '360px',
  } as React.CSSProperties;

  return (
    <ModuleProvider module="builder">
      {/* The compiled tenant theme for the canvas, reported live by the Theme panel
          (docs/builder/03 §2.3). Falls back to the route's server-compiled CSS until
          the first edit. */}
      {themeCanvasCss ? <style dangerouslySetInnerHTML={{ __html: themeCanvasCss }} /> : null}
      {previewCss ? <style dangerouslySetInnerHTML={{ __html: previewCss }} /> : null}
      <ShortcutsOverlay open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <div className="bx-shell">
        {/* Unified toolbar (docs/builder/03 §2.8): page switcher · settings · device
            · Preview · Save · Publish. The Site|Email surface switch lives one level
            up (StudioApp). */}
        <div className="bx-toolbar">
          <div className="bx-toolbar__templates">
            {renaming ? (
              <Input
                ref={renameInputRef}
                size="sm"
                className="bx-tplselect"
                value={nameDraft}
                aria-label="Page name"
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    skipRenameCommit.current = true;
                    e.currentTarget.blur();
                  }
                }}
                onBlur={() => void commitRename()}
              />
            ) : (
              <NativeSelect
                size="sm"
                className="bx-tplselect"
                value={activePage.id}
                aria-label="Page in the Outlet"
                onChange={(e) => onSelectPage(e.target.value)}
              >
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {templateLabel(p)}
                  </option>
                ))}
              </NativeSelect>
            )}
            <button
              type="button"
              className="bx-newtpl"
              aria-label="Page settings"
              title="Page settings (URL, SEO)"
              disabled={busy || renaming}
              onClick={() => studio.selectZoneHome('page')}
            >
              <Settings2 aria-hidden />
            </button>
            <button
              type="button"
              className="bx-newtpl"
              aria-label="Rename this page"
              disabled={busy || renaming}
              onClick={startRename}
            >
              <Pencil aria-hidden />
            </button>
            <button
              type="button"
              className="bx-newtpl"
              aria-label="New page"
              disabled={busy || renaming}
              onClick={() => void onNewPage()}
            >
              <Plus aria-hidden />
            </button>
            <button
              type="button"
              className="bx-newtpl"
              aria-label="Delete this page"
              disabled={busy || renaming || pages.length <= 1}
              onClick={() => void onDeletePage()}
            >
              <Trash2 aria-hidden />
            </button>
            {layoutItem.isActive ? (
              <Badge color="success" variant="soft" size="sm">
                Live
              </Badge>
            ) : null}
          </div>
          <div className="bx-toolbar__devices">
            {DEVICES.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.id}
                  type="button"
                  className="bx-device"
                  data-on={studio.device === d.id}
                  aria-label={d.label}
                  aria-pressed={studio.device === d.id}
                  onClick={() => studio.setDevice(d.id)}
                >
                  <Icon aria-hidden />
                </button>
              );
            })}
          </div>
          <div className="bx-toolbar__actions">
            <UndoRedoButtons
              canUndo={studio.canUndo}
              canRedo={studio.canRedo}
              onUndo={studio.undo}
              onRedo={studio.redo}
            />
            {studio.saveStatus !== 'idle' ? (
              <span className="bx-savestate" data-state={studio.saveStatus}>
                {SAVE_LABEL[studio.saveStatus]}
              </span>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Eye className="h-3.5 w-3.5" />}
              disabled={busy || !canPreview}
              title={
                canPreview
                  ? 'Open this page’s draft on the live site'
                  : activePage.kind === 'collection'
                    ? 'Collection templates preview per record'
                    : 'This page has no public URL yet'
              }
              onClick={() => void onPreview()}
            >
              Preview
            </Button>
            <Button
              size="sm"
              variant="soft"
              leftIcon={<Save className="h-3.5 w-3.5" />}
              disabled={busy}
              onClick={() => void studio.flushAll()}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="solid"
              leftIcon={<Upload className="h-3.5 w-3.5" />}
              disabled={busy}
              onClick={() => void onPublish()}
            >
              Publish
            </Button>
          </div>
        </div>

        {/* Mobile pane switch */}
        <div className="bx-paneswitch">
          {(['edit', 'preview'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className="bx-paneswitch__btn"
              data-on={studio.mobilePane === p}
              onClick={() => studio.setMobilePane(p)}
            >
              {p === 'edit' ? 'Build' : 'Preview'}
            </button>
          ))}
        </div>

        <div className="bx-body" style={bodyStyle}>
          {/* Left rail — Layers (the composed stack) / Add / Fields */}
          <aside
            className={cn(
              'bx-rail',
              studio.mobilePane === 'edit' ? 'bx-pane--show' : 'bx-pane--hide'
            )}
          >
            <div className="bx-rail__tabs">
              <button
                type="button"
                className="bx-rail__tab"
                data-on={railTab === 'layers'}
                onClick={() => studio.setRailTab('layers')}
              >
                <Layers aria-hidden /> Layers
              </button>
              {showAddTab ? (
                <button
                  type="button"
                  className="bx-rail__tab"
                  data-on={railTab === 'add'}
                  onClick={() => studio.setRailTab('add')}
                >
                  <Plus aria-hidden /> Add
                </button>
              ) : null}
              {contentTypeKey ? (
                <button
                  type="button"
                  className="bx-rail__tab"
                  data-on={railTab === 'fields'}
                  onClick={() => studio.setRailTab('fields')}
                >
                  <Table2 aria-hidden /> Fields
                </button>
              ) : null}
            </div>
            <ScrollArea className="bx-rail__body">
              {railTab === 'layers' ? (
                <StudioLayers
                  layoutTree={layoutItem.tree}
                  pageTree={activePage.tree}
                  layoutCatalog={SITE_CATALOG}
                  pageCatalog={pageCatalog}
                  components={componentsByKey}
                  selection={studio.selection}
                  pageLabel={activePage.name}
                  onSelectTheme={studio.selectTheme}
                  onSelectNode={studio.selectNode}
                  onRemove={studio.onRemove}
                  onMove={studio.onMove}
                />
              ) : railTab === 'fields' && contentTypeKey ? (
                <FieldsPanel typeKey={contentTypeKey} />
              ) : showAddTab ? (
                <AddPalette
                  targetName={studio.targetName}
                  onAdd={studio.onAdd}
                  surface={studio.activeZone === 'layout' ? 'site' : 'page'}
                  customComponents={components.length ? components : undefined}
                />
              ) : (
                <p className="bx-inspector__tip">Select a page or layout layer to add blocks.</p>
              )}
            </ScrollArea>
          </aside>

          <RailResizeHandle width={railW} onChange={setRailW} />

          {/* Canvas — the live stack: selectable chrome + the page at the Outlet */}
          <main
            className={cn(
              'bx-stage',
              studio.mobilePane === 'preview' ? 'bx-pane--show' : 'bx-pane--hide'
            )}
          >
            <Canvas
              tree={activePage.tree}
              data={studio.previewData}
              catalog={pageCatalog}
              components={componentsByKey}
              resolveVersion={resolveVersion}
              device={studio.device}
              selectedId={studio.selection.zone === 'theme' ? null : studio.selection.id}
              selectedIds={studio.selection.zone === 'theme' ? [] : studio.selection.ids}
              onSelect={studio.selectNode}
              onMove={studio.onMove}
              chrome={layoutItem.tree}
              chromeLocked={false}
              frame={
                siteOrigin
                  ? { kind: 'browser', origin: siteOrigin, path: activePage.slug }
                  : undefined
              }
            />
          </main>

          {/* Inspector — adapts to the selected zone (docs/builder/03 §2.5) */}
          <aside
            className={cn(
              'bx-side',
              effectiveCollapsed && 'bx-side--collapsed',
              studio.mobilePane === 'edit' ? 'bx-pane--show' : 'bx-pane--hide'
            )}
          >
            {effectiveCollapsed ? (
              <button
                type="button"
                className="bx-side__reopen"
                title="Show properties"
                aria-label="Show properties"
                onClick={() => setSideCollapsed(false)}
              >
                <PanelRightOpen aria-hidden />
                <span className="bx-side__reopen-label">Properties</span>
              </button>
            ) : (
              <>
                {isDesktop ? (
                  <div className="bx-side__bar">
                    <span className="bx-side__bar-title">
                      Properties
                      <span className="bx-zonetag" data-zone={zone}>
                        {zoneLabel}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="bx-side__hide"
                      title="Hide properties"
                      aria-label="Hide properties"
                      onClick={() => setSideCollapsed(true)}
                    >
                      <PanelRightClose aria-hidden />
                    </button>
                  </div>
                ) : null}
                <ScrollArea className="bx-side__scroll">
                  {zone === 'theme' ? (
                    <div className="bx-theme-zone">
                      <ThemeCenter
                        variant="inspector"
                        brand={theme.brand}
                        baseBrand={theme.baseBrand}
                        site={theme.site}
                        config={theme.config}
                        savedThemes={theme.savedThemes}
                        media={theme.media}
                        sitePreview={theme.sitePreview}
                        onCanvasCss={setThemeCanvasCss}
                        flushRef={themeFlushRef}
                      />
                    </div>
                  ) : (
                    <Inspector
                      node={studio.selectedNode}
                      catalog={studio.activeCatalog}
                      scope={studio.scope}
                      surface={zone === 'layout' ? 'site' : 'page'}
                      settings={
                        zone === 'layout' ? (
                          <LayoutSettings name={layoutItem.name} />
                        ) : (
                          <PageSettings
                            pageId={activePage.id}
                            name={activePage.name}
                            slug={activePage.slug}
                            kind={activePage.kind}
                            recordType={activePage.recordType ?? null}
                            isDefault={activePage.isDefault}
                            catalog={pageCatalog}
                            seo={activePage.seo}
                            onSlug={onSlug}
                            onSeo={onSeo}
                            onRetarget={onRetarget}
                            onMakeDefault={onMakeDefault}
                          />
                        )
                      }
                      components={componentsByKey}
                      contentTypeKey={zone === 'page' ? contentTypeKey : null}
                      onAddField={zone === 'page' ? onAddField : undefined}
                      onSaveAsComponent={onSaveAsComponent}
                      onBack={() => studio.selectZoneHome(zone === 'layout' ? 'layout' : 'page')}
                      onName={studio.onName}
                      onClass={studio.onClass}
                      onBind={studio.onBind}
                      onProp={studio.onProp}
                      onRetype={studio.onRetype}
                      selectionCount={studio.selection.ids.length}
                      onDuplicate={studio.duplicateSelection}
                      onDelete={studio.deleteSelection}
                      onCopy={studio.copySelection}
                      onCopyStyles={studio.copyStyles}
                      onPasteStyles={studio.pasteStyles}
                      canPasteStyles={studio.canPasteStyles}
                    />
                  )}
                </ScrollArea>
              </>
            )}
          </aside>
        </div>
      </div>
    </ModuleProvider>
  );
}
