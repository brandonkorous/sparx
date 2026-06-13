'use client';

// BuilderWorkspace — the editor's working BODY, shared by every Builder surface
// (docs/45 §2.2): the mobile Build/Preview switch, the left rail (Layers / Add),
// the canvas, and the inspector. Identical for /builder/page and /builder/site —
// only the toolbar + context bar above it differ per surface, so those stay in
// each shell while this is rendered once here.
//
// All editing state + handlers come from the `useBuilderEditor` hook; the shell
// supplies the surface (which palette to show) and the inspector's no-selection
// `settings` panel (page settings vs. layout settings).

import * as React from 'react';
import { Layers, PanelRightClose, PanelRightOpen, Plus, Table2 } from 'lucide-react';
import { ScrollArea, cn, useMediaQuery } from '@sparx/ui';
import type { BindingCatalog, BuilderNode, ComponentDto, MergeTag } from '@sparx/builder-schemas';

import type { BuilderEditor } from './use-builder-editor';
import type { EditorSurface } from './registry';
import type { CreatableType } from './field-kinds';
import { Canvas, type CanvasFrame } from './canvas';
import { Inspector, type SlotEditor } from './inspector';
import { LayersPanel } from './layers-panel';
import { AddPalette } from './add-palette';
import { useComponentVersions } from './use-component-versions';
import { useSurfacePreview } from './use-surface-preview';

export interface BuilderWorkspaceProps {
  tree: BuilderNode;
  editor: BuilderEditor;
  catalog: BindingCatalog;
  surface: EditorSurface;
  /** The inspector's panel when no node is selected (page vs. layout settings). */
  settings: React.ReactNode;
  /** The site layout tree to frame the page in (page surface only): renders as a
   *  locked backdrop with the page dropped at its Outlet. Omitted on the site
   *  editor (it IS the layout). */
  chrome?: BuilderNode | null;
  /** How the canvas is framed (docs/45, docs/52): a browser window / device bezel
   *  for site + page, an inbox envelope for email. Omitted ⇒ the bare canvas. */
  frame?: CanvasFrame;
  /** The tenant's custom components keyed by key (docs/53 P-B) — the Add palette
   *  lists them, and the canvas/layers/inspector expand + label `custom:*` nodes.
   *  Omitted ⇒ no custom components on this surface. */
  components?: ReadonlyMap<string, ComponentDto>;
  /** The "Fields" rail-tab panel (docs/51 keystone) — present only when the
   *  active page is a collection template targeting a content type. Absent ⇒ the
   *  tab is hidden and `fields` falls back to Layers. */
  fields?: React.ReactNode;
  /** The active template's content-type key (recordType `cms.<key>`) — powers the
   *  inspector's inline "+ New field". Null for singletons / non-CMS targets. */
  contentTypeKey?: string | null;
  /** Add a field to `contentTypeKey` and resolve its key (or null on failure) —
   *  the inspector binds the node to the new field. Omit when not authoring CMS. */
  onAddField?: (label: string, kind: CreatableType) => Promise<string | null>;
  /** "Save as component" (docs/53 P-C) — turn the selected subtree into a tenant
   *  component. Omitted on the component editor (no nesting). */
  onSaveAsComponent?: (node: BuilderNode) => void;
  /** Slot authoring (docs/53 P-D) — present only in the component editor: a node's
   *  text prop can be turned into a configurable field. */
  slotEditor?: SlotEditor;
  /** Merge tags for the inspector's inline `{{` autocomplete (email surface only).
   *  Omitted on page/site, whose renderers don't interpolate `{{token}}`. */
  tokens?: MergeTag[];
}

// ── Chrome layout prefs (desktop) ───────────────────────────────────────────
// The left rail is drag-resizable and the inspector is collapsible, so the
// canvas can take back width on a design-centric surface. Both persist in
// localStorage (same `sparx:*` convention as the dashboard shell). Read in an
// effect so SSR + first paint use the defaults and never mismatch hydration.
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
      // storage disabled — keep the default
    }
  }, []);
  const setValue = React.useCallback((next: number) => {
    const c = clampRail(next);
    setValueState(c);
    try {
      window.localStorage.setItem(RAIL_W_KEY, String(c));
    } catch {
      // ignore — in-memory state still updates
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
      // storage disabled — stay expanded
    }
  }, []);
  const setValue = React.useCallback((next: boolean) => {
    setValueState(next);
    try {
      window.localStorage.setItem(SIDE_COLLAPSED_KEY, String(next));
    } catch {
      // ignore — in-memory state still updates
    }
  }, []);
  return [value, setValue] as const;
}

// Drag handle between the rail and the canvas — pixel width, mirrors the
// dashboard shell's detail splitter (role=separator + keyboard arrows). Hidden
// below `lg` (where the panes stack), via `.bx-resize` in builder.css.
function RailResizeHandle({
  width,
  onChange,
}: {
  width: number;
  onChange: (next: number) => void;
}) {
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

export function BuilderWorkspace({
  tree,
  editor,
  catalog,
  surface,
  settings,
  chrome,
  frame,
  components,
  fields,
  contentTypeKey,
  onAddField,
  onSaveAsComponent,
  slotEditor,
  tokens,
}: BuilderWorkspaceProps) {
  // The Fields tab only exists when this surface supplies a panel. If the rail is
  // parked on 'fields' and the panel goes away (e.g. you switch to a singleton
  // page), fall back to Layers so the rail never shows an empty body.
  const railTab = editor.railTab === 'fields' && !fields ? 'layers' : editor.railTab;

  // Resolves each placement's EXACT pinned version for the canvas preview (docs/53
  // Gap 1) — fetches older versions lazily; falls back to latest meanwhile.
  const resolveVersion = useComponentVersions(components, tree);

  // Live-compiled Surface utility CSS for the working tree, @scope-d to the canvas
  // so authored Tailwind-native utilities render in the preview exactly as they
  // will ship — without repainting the dashboard's own Tailwind chrome (docs/61
  // §10; the temp.css live-preview path, docs/47 §5.2).
  const previewCss = useSurfacePreview(tree);

  // Desktop-only chrome layout: a resizable rail + a collapsible inspector. The
  // grid (lg+) reads `--bx-rail-w` / `--bx-side-w` off `.bx-body`; below lg the
  // panes stack and these are inert. `isDesktop` gates the collapse so the
  // inspector is always full on phones (it's the "edit" pane there).
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [railW, setRailW] = useRailWidth();
  const [sideCollapsed, setSideCollapsed] = useSideCollapsed();
  const effectiveCollapsed = sideCollapsed && isDesktop;

  // Selecting a block always surfaces its properties — collapse is for browsing
  // the canvas, not for hiding the editor mid-edit (the chosen behavior).
  React.useEffect(() => {
    if (editor.selectedId) setSideCollapsed(false);
  }, [editor.selectedId, setSideCollapsed]);

  const bodyStyle = {
    '--bx-rail-w': `${railW}px`,
    '--bx-side-w': effectiveCollapsed ? '2.75rem' : '360px',
  } as React.CSSProperties;
  return (
    <>
      {previewCss ? <style dangerouslySetInnerHTML={{ __html: previewCss }} /> : null}
      {/* Mobile pane switch */}
      <div className="bx-paneswitch">
        {(['edit', 'preview'] as const).map((p) => (
          <button
            key={p}
            type="button"
            className="bx-paneswitch__btn"
            data-on={editor.mobilePane === p}
            onClick={() => editor.setMobilePane(p)}
          >
            {p === 'edit' ? 'Build' : 'Preview'}
          </button>
        ))}
      </div>

      <div className="bx-body" style={bodyStyle}>
        {/* Left rail */}
        <aside
          className={cn(
            'bx-rail',
            editor.mobilePane === 'edit' ? 'bx-pane--show' : 'bx-pane--hide'
          )}
        >
          <div className="bx-rail__tabs">
            <button
              type="button"
              className="bx-rail__tab"
              data-on={railTab === 'layers'}
              onClick={() => editor.setRailTab('layers')}
            >
              <Layers aria-hidden /> Layers
            </button>
            <button
              type="button"
              className="bx-rail__tab"
              data-on={railTab === 'add'}
              onClick={() => editor.setRailTab('add')}
            >
              <Plus aria-hidden /> Add
            </button>
            {fields ? (
              <button
                type="button"
                className="bx-rail__tab"
                data-on={railTab === 'fields'}
                onClick={() => editor.setRailTab('fields')}
              >
                <Table2 aria-hidden /> Fields
              </button>
            ) : null}
          </div>
          <ScrollArea className="bx-rail__body">
            {railTab === 'layers' ? (
              <LayersPanel
                tree={tree}
                catalog={catalog}
                components={components}
                selectedId={editor.selectedId}
                homeLabel={surface === 'site' ? 'Site' : surface === 'email' ? 'Email' : 'Page'}
                onSelect={editor.setSelectedId}
                onRemove={editor.onRemove}
                onMove={editor.onMove}
              />
            ) : railTab === 'fields' ? (
              fields
            ) : (
              <AddPalette
                targetName={editor.targetName}
                onAdd={editor.onAdd}
                surface={surface}
                customComponents={components ? [...components.values()] : undefined}
              />
            )}
          </ScrollArea>
        </aside>

        {/* Rail/canvas splitter (desktop only) */}
        <RailResizeHandle width={railW} onChange={setRailW} />

        {/* Canvas */}
        <main
          className={cn(
            'bx-stage',
            editor.mobilePane === 'preview' ? 'bx-pane--show' : 'bx-pane--hide'
          )}
        >
          <Canvas
            tree={tree}
            data={editor.previewData}
            catalog={catalog}
            components={components}
            resolveVersion={resolveVersion}
            device={editor.device}
            selectedId={editor.selectedId}
            onSelect={editor.setSelectedId}
            chrome={chrome}
            frame={frame}
          />
        </main>

        {/* Inspector (collapsible on desktop) */}
        <aside
          className={cn(
            'bx-side',
            effectiveCollapsed && 'bx-side--collapsed',
            editor.mobilePane === 'edit' ? 'bx-pane--show' : 'bx-pane--hide'
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
                  <span className="bx-side__bar-title">Properties</span>
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
                <Inspector
                  node={editor.selectedNode}
                  catalog={catalog}
                  scope={editor.scope}
                  surface={surface}
                  settings={settings}
                  components={components}
                  contentTypeKey={contentTypeKey}
                  onAddField={onAddField}
                  onSaveAsComponent={onSaveAsComponent}
                  slotEditor={slotEditor}
                  tokens={tokens}
                  onBack={() => editor.setSelectedId(null)}
                  onName={editor.onName}
                  onClass={editor.onClass}
                  onBind={editor.onBind}
                  onProp={editor.onProp}
                  onRetype={editor.onRetype}
                />
              </ScrollArea>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
