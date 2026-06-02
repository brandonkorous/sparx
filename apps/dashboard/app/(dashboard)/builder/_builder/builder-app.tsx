'use client';

// The builder app — the editor backbone at /builder/page.
//
// Owns the single source of truth (the templates + which is active + selection
// + device) and lays out the editor's working area INSIDE the dashboard shell
// (which already provides the global header, main sidebar, and module sidebar):
// a slim toolbar (template switcher + device toggle + actions), a context bar
// stating which modules this page composes from, a left rail (Layers / Add),
// the canvas, and the inspector. Below `lg` the three panes collapse to one
// column with a Build / Preview switch — the builder must work on a phone.

import * as React from 'react';
import { Eye, Layers, Monitor, Plus, Save, Smartphone, Tablet, Upload } from 'lucide-react';
import { Button, ModuleProvider, NativeSelect, ScrollArea, cn } from '@sparx/ui';

import {
  appendChild,
  cardinalityOf,
  findNode,
  removeNode,
  resolvePath,
  updateNode,
  type BoxBase,
  type BuilderNode,
  type Device,
  type LayoutBase,
  type PageTemplate,
} from './model';
import { getDef, isContainer, makeNode } from './registry';
import { MODULES, SAMPLE_DATA, SEED_TEMPLATES, makeBlankTemplate } from './sample';
import { Canvas } from './canvas';
import { Inspector } from './inspector';
import { LayersPanel } from './layers-panel';
import { AddPalette } from './add-palette';

// Ancestors root→…→node (inclusive). [] when not found.
function pathTo(root: BuilderNode, id: string, trail: BuilderNode[] = []): BuilderNode[] {
  const next = [...trail, root];
  if (root.id === id) return next;
  for (const child of root.children ?? []) {
    const hit = pathTo(child, id, next);
    if (hit.length) return hit;
  }
  return [];
}

/** Does an ancestor set an `item` scope (bound to an object or array)? */
function ancestorSetsScope(chain: BuilderNode[]): boolean {
  return chain.slice(0, -1).some((n) => {
    if (!n.binding) return false;
    if (n.binding.path.startsWith('item')) return true;
    const card = cardinalityOf(resolvePath({ root: SAMPLE_DATA }, n.binding.path));
    return card === 'array' || card === 'object';
  });
}

const DEVICES: { id: Device; label: string; icon: typeof Monitor }[] = [
  { id: 'desktop', label: 'Desktop', icon: Monitor },
  { id: 'tablet', label: 'Tablet', icon: Tablet },
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
];

function templateLabel(t: PageTemplate): string {
  if (t.kind === 'collection')
    return `${t.name} · per ${t.recordType?.split('.').pop() ?? 'record'}`;
  return t.name;
}

export function BuilderApp() {
  // Many page templates: Sparx ships a seeded handful; the user adds N more.
  // The editor edits ONE at a time (the active template); the toolbar switches.
  const [templates, setTemplates] = React.useState<PageTemplate[]>(SEED_TEMPLATES);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [device, setDevice] = React.useState<Device>('desktop');
  const [railTab, setRailTab] = React.useState<'layers' | 'add'>('layers');
  const [mobilePane, setMobilePane] = React.useState<'edit' | 'preview'>('preview');

  const active = templates.find((t) => t.id === activeId) ?? templates[0];
  const tree = active?.tree ?? null;

  const selectedNode = tree && selectedId ? findNode(tree, selectedId) : null;
  const chain = React.useMemo(
    () => (tree && selectedId ? pathTo(tree, selectedId) : []),
    [tree, selectedId]
  );
  const inScope = ancestorSetsScope(chain);

  // Where a palette drop lands: the selected container, else its nearest
  // container ancestor, else the root.
  const target = React.useMemo<BuilderNode | null>(() => {
    if (!tree) return null;
    if (!selectedNode) return tree;
    if (isContainer(selectedNode.type)) return selectedNode;
    return chain[chain.length - 2] ?? tree;
  }, [tree, selectedNode, chain]);

  // Mutations rewrite the ACTIVE template's tree.
  const updateTree = (fn: (t: BuilderNode) => BuilderNode) => {
    if (!active) return;
    setTemplates((ts) => ts.map((t) => (t.id === active.id ? { ...t, tree: fn(t.tree) } : t)));
  };

  const mutateSelected = (fn: (n: BuilderNode) => BuilderNode) => {
    if (!selectedId) return;
    updateTree((t) => updateNode(t, selectedId, fn));
  };

  const onBox = (patch: Partial<BoxBase>) =>
    mutateSelected((n) => ({ ...n, box: { ...n.box, ...patch } }));
  const onLayout = (patch: Partial<LayoutBase>) =>
    mutateSelected((n) => (n.layout ? { ...n, layout: { ...n.layout, ...patch } } : n));
  const onProp = (key: string, value: unknown) =>
    mutateSelected((n) => ({ ...n, props: { ...n.props, [key]: value } }));
  const onName = (name: string) =>
    mutateSelected((n) => ({ ...n, box: { ...n.box, name: name || undefined } }));
  const onBind = (path: string | null) =>
    mutateSelected((n) => {
      if (!path) {
        const next = { ...n };
        delete next.binding;
        return next;
      }
      return { ...n, binding: { path } };
    });

  const onAdd = (type: string) => {
    if (!target) return;
    const child = makeNode(type);
    updateTree((t) => appendChild(t, target.id, child));
    setSelectedId(child.id);
    setRailTab('layers');
  };

  const onRemove = (id: string) => {
    updateTree((t) => removeNode(t, id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const onSelectTemplate = (id: string) => {
    setActiveId(id);
    setSelectedId(null);
  };
  const onNewTemplate = () => {
    const created = makeBlankTemplate();
    setTemplates((ts) => [...ts, created]);
    setActiveId(created.id);
    setSelectedId(created.tree.id);
    setRailTab('add');
  };

  const activeModules = MODULES.filter((m) => m.on);
  const offModules = MODULES.filter((m) => !m.on);
  const targetDef = target ? getDef(target.type) : undefined;
  const targetName = target?.box.name ?? targetDef?.label ?? 'page';

  if (!active || !tree) return null;

  return (
    <ModuleProvider module="builder">
      <div className="bx-shell">
        {/* Editor toolbar — builder-specific actions only. The global header,
            main sidebar, and module sidebar are provided by the dashboard
            shell; this page renders inside that chrome. */}
        <div className="bx-toolbar">
          <div className="bx-toolbar__templates">
            <NativeSelect
              size="sm"
              className="bx-tplselect"
              value={active.id}
              aria-label="Page template"
              onChange={(e) => onSelectTemplate(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {templateLabel(t)}
                </option>
              ))}
            </NativeSelect>
            <button
              type="button"
              className="bx-newtpl"
              aria-label="New page template"
              onClick={onNewTemplate}
            >
              <Plus aria-hidden />
            </button>
          </div>
          <div className="bx-toolbar__devices">
            {DEVICES.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.id}
                  type="button"
                  className="bx-device"
                  data-on={device === d.id}
                  aria-label={d.label}
                  aria-pressed={device === d.id}
                  onClick={() => setDevice(d.id)}
                >
                  <Icon aria-hidden />
                </button>
              );
            })}
          </div>
          <div className="bx-toolbar__actions">
            <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />}>
              Preview
            </Button>
            <Button size="sm" variant="soft" leftIcon={<Save className="h-3.5 w-3.5" />}>
              Save
            </Button>
            <Button size="sm" variant="solid" leftIcon={<Upload className="h-3.5 w-3.5" />}>
              Publish
            </Button>
          </div>
        </div>

        {/* Context bar — what this page composes from */}
        <div className="bx-ctx">
          <span className="bx-ctx__lead">This page composes data from</span>
          {activeModules.map((m) => (
            <span
              key={m.key}
              className="bx-ctx__chip"
              style={{ '--chip': m.color } as React.CSSProperties}
            >
              <span className="bx-ctx__dot" />
              {m.label}
            </span>
          ))}
          {offModules.map((m) => (
            <span key={m.key} className="bx-ctx__chip bx-ctx__chip--off">
              {m.label}
              <span className="bx-ctx__enable">+ enable</span>
            </span>
          ))}
          <span className="bx-ctx__note">
            Commerce is one module among many — turn it off and its sections just hide.
          </span>
        </div>

        {/* Mobile pane switch */}
        <div className="bx-paneswitch">
          {(['edit', 'preview'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className="bx-paneswitch__btn"
              data-on={mobilePane === p}
              onClick={() => setMobilePane(p)}
            >
              {p === 'edit' ? 'Build' : 'Preview'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="bx-body">
          {/* Left rail */}
          <aside
            className={cn('bx-rail', mobilePane === 'edit' ? 'bx-pane--show' : 'bx-pane--hide')}
          >
            <div className="bx-rail__tabs">
              <button
                type="button"
                className="bx-rail__tab"
                data-on={railTab === 'layers'}
                onClick={() => setRailTab('layers')}
              >
                <Layers aria-hidden /> Layers
              </button>
              <button
                type="button"
                className="bx-rail__tab"
                data-on={railTab === 'add'}
                onClick={() => setRailTab('add')}
              >
                <Plus aria-hidden /> Add
              </button>
            </div>
            <ScrollArea className="bx-rail__body">
              {railTab === 'layers' ? (
                <LayersPanel
                  tree={tree}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onRemove={onRemove}
                />
              ) : (
                <AddPalette targetName={targetName} onAdd={onAdd} />
              )}
            </ScrollArea>
          </aside>

          {/* Canvas */}
          <main
            className={cn('bx-stage', mobilePane === 'preview' ? 'bx-pane--show' : 'bx-pane--hide')}
          >
            <Canvas
              tree={tree}
              data={SAMPLE_DATA}
              device={device}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </main>

          {/* Inspector */}
          <aside
            className={cn('bx-side', mobilePane === 'edit' ? 'bx-pane--show' : 'bx-pane--hide')}
          >
            <ScrollArea className="bx-side__scroll">
              <Inspector
                node={selectedNode}
                inScope={inScope}
                onName={onName}
                onBind={onBind}
                onProp={onProp}
                onLayout={onLayout}
                onBox={onBox}
              />
            </ScrollArea>
          </aside>
        </div>
      </div>
    </ModuleProvider>
  );
}
