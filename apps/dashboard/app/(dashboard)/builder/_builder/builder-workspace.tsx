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
import { Layers, Plus, Table2 } from 'lucide-react';
import { ScrollArea, cn } from '@sparx/ui';
import type { BindingCatalog, BuilderNode, ComponentDto } from '@sparx/builder-schemas';

import type { BuilderEditor } from './use-builder-editor';
import type { EditorSurface } from './registry';
import type { CreatableType } from './field-kinds';
import { Canvas } from './canvas';
import { Inspector, type SlotEditor } from './inspector';
import { LayersPanel } from './layers-panel';
import { AddPalette } from './add-palette';

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
}

export function BuilderWorkspace({
  tree,
  editor,
  catalog,
  surface,
  settings,
  chrome,
  components,
  fields,
  contentTypeKey,
  onAddField,
  onSaveAsComponent,
  slotEditor,
}: BuilderWorkspaceProps) {
  // The Fields tab only exists when this surface supplies a panel. If the rail is
  // parked on 'fields' and the panel goes away (e.g. you switch to a singleton
  // page), fall back to Layers so the rail never shows an empty body.
  const railTab = editor.railTab === 'fields' && !fields ? 'layers' : editor.railTab;
  return (
    <>
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

      <div className="bx-body">
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
                homeLabel={surface === 'site' ? 'Site' : 'Page'}
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

        {/* Canvas */}
        <main
          className={cn(
            'bx-stage',
            editor.mobilePane === 'preview' ? 'bx-pane--show' : 'bx-pane--hide'
          )}
        >
          {chrome ? (
            // Owned-elsewhere affordance: the header/footer are the site layout,
            // not editable here. A click jumps to the site editor.
            <a className="bx-frame-jump" href="/builder/site">
              Header &amp; footer come from your Site layout · Edit&nbsp;→
            </a>
          ) : null}
          <Canvas
            tree={tree}
            data={editor.previewData}
            catalog={catalog}
            components={components}
            device={editor.device}
            selectedId={editor.selectedId}
            onSelect={editor.setSelectedId}
            chrome={chrome}
          />
        </main>

        {/* Inspector */}
        <aside
          className={cn(
            'bx-side',
            editor.mobilePane === 'edit' ? 'bx-pane--show' : 'bx-pane--hide'
          )}
        >
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
              onBack={() => editor.setSelectedId(null)}
              onName={editor.onName}
              onClass={editor.onClass}
              onBind={editor.onBind}
              onProp={editor.onProp}
              onLayout={editor.onLayout}
              onBox={editor.onBox}
              onRetype={editor.onRetype}
            />
          </ScrollArea>
        </aside>
      </div>
    </>
  );
}
