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
import { Layers, Plus } from 'lucide-react';
import { ScrollArea, cn } from '@sparx/ui';
import type { BindingCatalog, BuilderNode } from '@sparx/builder-schemas';

import type { BuilderEditor } from './use-builder-editor';
import type { EditorSurface } from './registry';
import { Canvas } from './canvas';
import { Inspector } from './inspector';
import { LayersPanel } from './layers-panel';
import { AddPalette } from './add-palette';

export interface BuilderWorkspaceProps {
  tree: BuilderNode;
  editor: BuilderEditor;
  catalog: BindingCatalog;
  surface: EditorSurface;
  /** The inspector's panel when no node is selected (page vs. layout settings). */
  settings: React.ReactNode;
}

export function BuilderWorkspace({
  tree,
  editor,
  catalog,
  surface,
  settings,
}: BuilderWorkspaceProps) {
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
          className={cn('bx-rail', editor.mobilePane === 'edit' ? 'bx-pane--show' : 'bx-pane--hide')}
        >
          <div className="bx-rail__tabs">
            <button
              type="button"
              className="bx-rail__tab"
              data-on={editor.railTab === 'layers'}
              onClick={() => editor.setRailTab('layers')}
            >
              <Layers aria-hidden /> Layers
            </button>
            <button
              type="button"
              className="bx-rail__tab"
              data-on={editor.railTab === 'add'}
              onClick={() => editor.setRailTab('add')}
            >
              <Plus aria-hidden /> Add
            </button>
          </div>
          <ScrollArea className="bx-rail__body">
            {editor.railTab === 'layers' ? (
              <LayersPanel
                tree={tree}
                catalog={catalog}
                selectedId={editor.selectedId}
                onSelect={editor.setSelectedId}
                onRemove={editor.onRemove}
              />
            ) : (
              <AddPalette targetName={editor.targetName} onAdd={editor.onAdd} surface={surface} />
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
          <Canvas
            tree={tree}
            data={editor.previewData}
            catalog={catalog}
            device={editor.device}
            selectedId={editor.selectedId}
            onSelect={editor.setSelectedId}
          />
        </main>

        {/* Inspector */}
        <aside
          className={cn('bx-side', editor.mobilePane === 'edit' ? 'bx-pane--show' : 'bx-pane--hide')}
        >
          <ScrollArea className="bx-side__scroll">
            <Inspector
              node={editor.selectedNode}
              catalog={catalog}
              scope={editor.scope}
              settings={settings}
              onName={editor.onName}
              onBind={editor.onBind}
              onProp={editor.onProp}
              onLayout={editor.onLayout}
              onBox={editor.onBox}
            />
          </ScrollArea>
        </aside>
      </div>
    </>
  );
}
