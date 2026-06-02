'use client';

// The builder app — the editor backbone at /builder/page.
//
// Owns the working state (the loaded pages + which is active + selection +
// device) and lays out the editor's working area INSIDE the dashboard shell
// (which already provides the global header, main sidebar, and module sidebar):
// a slim toolbar (page switcher + device toggle + actions), a context bar
// stating which modules this page composes from, a left rail (Layers / Add),
// the canvas, and the inspector. Below `lg` the three panes collapse to one
// column with a Build / Preview switch — the builder must work on a phone.
//
// PERSISTENCE (docs/41): pages load from api-rest via the server route and seed
// this component's state. Draft-tree edits autosave (debounced) through the
// savePageTree server action; New / Delete / Publish round-trip immediately.

import * as React from 'react';
import {
  Eye,
  Layers,
  Monitor,
  Pencil,
  Plus,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button, Input, ModuleProvider, NativeSelect, ScrollArea, cn } from '@sparx/ui';
import type { BindingCatalog, BuilderPageDto } from '@sparx/builder-schemas';

import {
  appendChild,
  findNode,
  removeNode,
  updateNode,
  type BoxBase,
  type BuilderNode,
  type Device,
  type LayoutBase,
  type PageTemplate,
} from './model';
import { buildPreviewData, scopeAt } from './binding-catalog';
import { getDef, isContainer, makeNode } from './registry';
import { MODULES } from './sample';
import { Canvas } from './canvas';
import { Inspector } from './inspector';
import { LayersPanel } from './layers-panel';
import { AddPalette } from './add-palette';
import { createPage, deletePage, publishPage, renamePage, savePageTree } from '../_lib/actions';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// A loaded page reduced to the editor's working shape.
function toTemplate(p: BuilderPageDto): PageTemplate {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    recordType: p.recordType ?? undefined,
    tree: p.tree,
  };
}

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

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

export interface BuilderAppProps {
  initialPages: BuilderPageDto[];
  /** What the page can bind to — the tenant's real CMS content types + the
   *  code-defined Commerce/CRM sources (docs/43, the keystone). Drives the
   *  inspector picker, the canvas preview data, and the layer chips. */
  bindingCatalog: BindingCatalog;
}

export function BuilderApp({ initialPages, bindingCatalog }: BuilderAppProps) {
  // Pages load from the server (docs/41 §5 seeds the curated set on first use)
  // and seed this state ONCE. From here the client is authoritative for the
  // session; the server is the persistence sink (autosave + structural ops).
  const [templates, setTemplates] = React.useState<PageTemplate[]>(() =>
    initialPages.map(toTemplate)
  );
  const [activeId, setActiveId] = React.useState<string | null>(() => initialPages[0]?.id ?? null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [device, setDevice] = React.useState<Device>('desktop');
  const [railTab, setRailTab] = React.useState<'layers' | 'add'>('layers');
  const [mobilePane, setMobilePane] = React.useState<'edit' | 'preview'>('preview');
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');
  const [busy, setBusy] = React.useState(false);
  // Inline page rename: the switcher swaps to a text input. Enter/blur commits,
  // Esc cancels (skipRenameCommit suppresses the commit the cancel-blur fires).
  const [renaming, setRenaming] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState('');
  const skipRenameCommit = React.useRef(false);
  const renameInputRef = React.useRef<HTMLInputElement>(null);

  const active = templates.find((t) => t.id === activeId) ?? templates[0] ?? null;
  const tree = active?.tree ?? null;

  // ── Autosave (debounced draft-tree saves) ──────────────────────────────────
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = React.useRef<{ id: string; tree: BuilderNode } | null>(null);

  const flushSave = React.useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    setSaveStatus('saving');
    const res = await savePageTree(p.id, p.tree);
    setSaveStatus(res.ok ? 'saved' : 'error');
  }, []);

  const scheduleSave = React.useCallback(
    (id: string, next: BuilderNode) => {
      pending.current = { id, tree: next };
      setSaveStatus('saving');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void flushSave();
      }, 800);
    },
    [flushSave]
  );

  React.useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  // Focus the rename input when it opens (avoids the autoFocus prop, which the
  // a11y lint rule forbids), and select the text for quick replace.
  React.useEffect(() => {
    if (renaming) renameInputRef.current?.select();
  }, [renaming]);

  // Typed placeholder data shaped to the binding schema — every offered path
  // resolves, so the canvas previews bound nodes (real records come later).
  const previewData = React.useMemo(
    () => buildPreviewData(bindingCatalog.sources),
    [bindingCatalog]
  );

  const selectedNode = tree && selectedId ? findNode(tree, selectedId) : null;
  const chain = React.useMemo(
    () => (tree && selectedId ? pathTo(tree, selectedId) : []),
    [tree, selectedId]
  );
  // The item.* fields the selected node can read, derived from the scope its
  // ancestors establish (a list/record binding above it).
  const scope = React.useMemo(() => scopeAt(bindingCatalog, chain), [bindingCatalog, chain]);

  // Where a palette drop lands: the selected container, else its nearest
  // container ancestor, else the root.
  const target = React.useMemo<BuilderNode | null>(() => {
    if (!tree) return null;
    if (!selectedNode) return tree;
    if (isContainer(selectedNode.type)) return selectedNode;
    return chain[chain.length - 2] ?? tree;
  }, [tree, selectedNode, chain]);

  // Mutations rewrite the ACTIVE page's tree + schedule an autosave.
  const updateTree = (fn: (t: BuilderNode) => BuilderNode) => {
    if (!active) return;
    const next = fn(active.tree);
    const id = active.id;
    setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, tree: next } : t)));
    scheduleSave(id, next);
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
    void flushSave(); // persist the page we're leaving before switching
    setActiveId(id);
    setSelectedId(null);
  };

  const onNewTemplate = async () => {
    setBusy(true);
    await flushSave();
    const res = await createPage({ name: 'Untitled page', kind: 'singleton' });
    setBusy(false);
    if (!res.ok || !res.data) {
      setSaveStatus('error');
      return;
    }
    const created = res.data;
    setTemplates((ts) => [...ts, toTemplate(created)]);
    setActiveId(created.id);
    setSelectedId(created.tree.id);
    setRailTab('add');
  };

  const onDeleteActive = async () => {
    if (!active || templates.length <= 1) return; // keep at least one page
    const removedId = active.id;
    setBusy(true);
    const res = await deletePage(removedId);
    setBusy(false);
    if (!res.ok) {
      setSaveStatus('error');
      return;
    }
    const remaining = templates.filter((t) => t.id !== removedId);
    setTemplates(remaining);
    setActiveId((cur) => (cur === removedId ? (remaining[0]?.id ?? null) : cur));
    setSelectedId(null);
  };

  const onPublish = async () => {
    if (!active) return;
    setBusy(true);
    await flushSave();
    const res = await publishPage(active.id);
    setBusy(false);
    if (res.ok && res.data) {
      const published = res.data;
      setTemplates((ts) => ts.map((t) => (t.id === published.id ? toTemplate(published) : t)));
      setSaveStatus('saved');
    } else {
      setSaveStatus('error');
    }
  };

  const startRename = () => {
    if (!active) return;
    setNameDraft(active.name);
    setRenaming(true);
  };

  // Called once, on the input's blur (Enter blurs to commit; Esc blurs with the
  // skip flag set). A no-op rename (empty or unchanged) just closes the input.
  const commitRename = async () => {
    if (skipRenameCommit.current) {
      skipRenameCommit.current = false;
      setRenaming(false);
      return;
    }
    setRenaming(false);
    if (!active) return;
    const name = nameDraft.trim();
    if (!name || name === active.name) return;
    const id = active.id;
    setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, name } : t)));
    setSaveStatus('saving');
    const res = await renamePage(id, name);
    setSaveStatus(res.ok ? 'saved' : 'error');
  };

  const activeModules = MODULES.filter((m) => m.on);
  const offModules = MODULES.filter((m) => !m.on);
  const targetDef = target ? getDef(target.type) : undefined;
  const targetName = target?.box.name ?? targetDef?.label ?? 'page';

  // No pages (a failed load). Offer a way in rather than a blank editor.
  if (!active || !tree) {
    return (
      <ModuleProvider module="builder">
        <div className="bx-shell">
          <div className="bx-noempty">
            <p className="bx-noempty__lead">No pages yet.</p>
            <Button
              size="sm"
              variant="solid"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              disabled={busy}
              onClick={() => void onNewTemplate()}
            >
              Create a page
            </Button>
          </div>
        </div>
      </ModuleProvider>
    );
  }

  return (
    <ModuleProvider module="builder">
      <div className="bx-shell">
        {/* Editor toolbar — builder-specific actions only. The global header,
            main sidebar, and module sidebar are provided by the dashboard
            shell; this page renders inside that chrome. */}
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
                value={active.id}
                aria-label="Page"
                onChange={(e) => onSelectTemplate(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {templateLabel(t)}
                  </option>
                ))}
              </NativeSelect>
            )}
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
              onClick={() => void onNewTemplate()}
            >
              <Plus aria-hidden />
            </button>
            <button
              type="button"
              className="bx-newtpl"
              aria-label="Delete this page"
              disabled={busy || renaming || templates.length <= 1}
              onClick={() => void onDeleteActive()}
            >
              <Trash2 aria-hidden />
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
            {saveStatus !== 'idle' ? (
              <span className="bx-savestate" data-state={saveStatus}>
                {SAVE_LABEL[saveStatus]}
              </span>
            ) : null}
            <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} disabled>
              Preview
            </Button>
            <Button
              size="sm"
              variant="soft"
              leftIcon={<Save className="h-3.5 w-3.5" />}
              disabled={busy}
              onClick={() => void flushSave()}
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
                  catalog={bindingCatalog}
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
              data={previewData}
              catalog={bindingCatalog}
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
                catalog={bindingCatalog}
                scope={scope}
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
