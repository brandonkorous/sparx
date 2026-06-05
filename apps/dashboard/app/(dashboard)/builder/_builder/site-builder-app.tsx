'use client';

// The site editor shell — the Builder surface at /builder/site (docs/45).
//
// Edits the site layout CATALOG (the chrome shells every page renders inside)
// with the SAME editing brain + body as the page editor: the `useBuilderEditor`
// hook and `BuilderWorkspace`. A tenant keeps many layouts; exactly one is ACTIVE
// — the live chrome the storefront serves. Publishing snapshots a layout's draft
// → published (a layout can be published-but-idle); a separate "Make active"
// flips which published layout is live.
//
// The shell mirrors the page editor's catalog toolbar (switcher · rename · new ·
// delete) and adds the activation affordance (a Live badge + Make active). The
// palette is the `site` surface (Outlet + chrome components); the catalog is the
// `site` sources.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  Monitor,
  Pencil,
  Plus,
  Rocket,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
} from 'lucide-react';
import { Badge, Button, Input, ModuleProvider, NativeSelect } from '@sparx/ui';
import { makeCustomNode, parseLayoutImport, toLayoutDocument } from '@sparx/builder-schemas';
import type { BindingCatalog, BuilderLayoutDto, ComponentDto } from '@sparx/builder-schemas';

import { makeId, type BuilderNode, type Device } from './model';
import { getDef } from './registry';
import { LayoutSettings } from './inspector';
import { BuilderWorkspace } from './builder-workspace';
import { ImportExportControls } from './import-export-controls';
import { useBuilderEditor, type SaveStatus } from './use-builder-editor';
import {
  activateLayout,
  createLayout,
  deleteLayout,
  publishLayout,
  renameLayout,
  saveLayoutTree,
} from '../_lib/actions';
import { copyComponent } from '../components/_lib/component-actions';

// A loaded layout reduced to the editor's working shape.
interface LayoutItem {
  id: string;
  name: string;
  tree: BuilderNode;
  published: boolean;
  isActive: boolean;
}

function toItem(l: BuilderLayoutDto): LayoutItem {
  return { id: l.id, name: l.name, tree: l.tree, published: l.published, isActive: l.isActive };
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

export interface SiteBuilderAppProps {
  initialLayouts: BuilderLayoutDto[];
  /** The `site` sources — navigation / brand / social (docs/45 §3). Constant. */
  bindingCatalog: BindingCatalog;
  /** The tenant's custom components with their latest trees (docs/53 P-B) — feeds
   *  the Add palette and the canvas's live expansion in the layout editor. */
  components?: ComponentDto[];
}

export function SiteBuilderApp({
  initialLayouts,
  bindingCatalog,
  components = [],
}: SiteBuilderAppProps) {
  const router = useRouter();
  // The catalog loads from the server (list-or-seed) and seeds this state ONCE;
  // from here the client is authoritative and the server is the persistence sink.
  // We open on the live layout (fallback: the first).
  const [items, setItems] = React.useState<LayoutItem[]>(() => initialLayouts.map(toItem));
  const [editingId, setEditingId] = React.useState<string | null>(() => {
    const active = initialLayouts.find((l) => l.isActive);
    return active?.id ?? initialLayouts[0]?.id ?? null;
  });
  const [busy, setBusy] = React.useState(false);
  // Inline rename: the switcher swaps to a text input. Enter/blur commits, Esc
  // cancels (skipRenameCommit suppresses the commit the cancel-blur fires).
  const [renaming, setRenaming] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState('');
  const skipRenameCommit = React.useRef(false);
  const renameInputRef = React.useRef<HTMLInputElement>(null);

  const editing = items.find((l) => l.id === editingId) ?? items[0] ?? null;
  const tree = editing?.tree ?? null;

  // Custom components keyed by component key — site-surface ones can be placed in
  // layout chrome (docs/53 P-B); drives insertion + the canvas's live expansion.
  const componentsByKey = React.useMemo(
    () => new Map(components.map((c) => [c.key, c])),
    [components]
  );

  // The shared editing brain. `save` persists the layout being edited;
  // `onTreeChange` writes the optimistic tree back into the catalog state.
  const editor = useBuilderEditor({
    tree,
    catalog: bindingCatalog,
    components: componentsByKey,
    save: async (next) => {
      if (!editing) return false;
      const res = await saveLayoutTree(editing.id, next);
      return res.ok;
    },
    onTreeChange: (next) => {
      if (!editing) return;
      const id = editing.id;
      setItems((ls) => ls.map((l) => (l.id === id ? { ...l, tree: next } : l)));
    },
  });

  // Focus the rename input when it opens (avoids the autoFocus prop, which the
  // a11y lint rule forbids), and select the text for quick replace.
  React.useEffect(() => {
    if (renaming) renameInputRef.current?.select();
  }, [renaming]);

  const onSelectLayout = (id: string) => {
    void editor.flushSave(); // persist the layout we're leaving before switching
    setEditingId(id);
    editor.setSelectedId(null);
  };

  const onNewLayout = async () => {
    setBusy(true);
    await editor.flushSave();
    const res = await createLayout({ name: 'Untitled layout' });
    setBusy(false);
    if (!res.ok || !res.data) {
      editor.setSaveStatus('error');
      return;
    }
    const created = res.data;
    setItems((ls) => [...ls, toItem(created)]);
    setEditingId(created.id);
    editor.setSelectedId(created.tree.id);
    editor.setRailTab('add');
  };

  const onDeleteEditing = async () => {
    // Keep at least one layout, and never delete the live one (the server refuses
    // too — make another active first).
    if (!editing || items.length <= 1 || editing.isActive) return;
    const removedId = editing.id;
    setBusy(true);
    const res = await deleteLayout(removedId);
    setBusy(false);
    if (!res.ok) {
      editor.setSaveStatus('error');
      return;
    }
    const remaining = items.filter((l) => l.id !== removedId);
    setItems(remaining);
    setEditingId((cur) => (cur === removedId ? (remaining[0]?.id ?? null) : cur));
    editor.setSelectedId(null);
  };

  const onPublish = async () => {
    if (!editing) return;
    setBusy(true);
    await editor.flushSave();
    const res = await publishLayout(editing.id);
    setBusy(false);
    if (res.ok && res.data) {
      const published = res.data;
      setItems((ls) => ls.map((l) => (l.id === published.id ? { ...l, published: true } : l)));
      editor.setSaveStatus('saved');
    } else {
      editor.setSaveStatus('error');
    }
  };

  // Make the edited layout the live one. Only published layouts can go live (the
  // storefront serves the active layout's PUBLISHED tree). On success, flip
  // isActive locally — exactly one stays live.
  const onActivate = async () => {
    if (!editing || editing.isActive || !editing.published) return;
    const id = editing.id;
    setBusy(true);
    const res = await activateLayout(id);
    setBusy(false);
    if (res.ok) {
      setItems((ls) => ls.map((l) => ({ ...l, isActive: l.id === id })));
    } else {
      editor.setSaveStatus('error');
    }
  };

  const startRename = () => {
    if (!editing) return;
    setNameDraft(editing.name);
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
    if (!editing) return;
    const name = nameDraft.trim();
    if (!name || name === editing.name) return;
    const id = editing.id;
    setItems((ls) => ls.map((l) => (l.id === id ? { ...l, name } : l)));
    editor.setSaveStatus('saving');
    const res = await renameLayout(id, name);
    editor.setSaveStatus(res.ok ? 'saved' : 'error');
  };

  // Import a layout document/tree into the EDITED layout: validate, replace its
  // tree, persist. Keeps the layout's identity (name) — only the tree is replaced.
  // Returns an error message (shown by the control) or null on success.
  const onImportText = (text: string): string | null => {
    if (!editing) return 'No layout to import into.';
    const result = parseLayoutImport(text);
    if (!result.ok) return result.error;
    const id = editing.id;
    setItems((ls) => ls.map((l) => (l.id === id ? { ...l, tree: result.tree } : l)));
    editor.setSelectedId(null);
    editor.setSaveStatus('saving');
    void saveLayoutTree(id, result.tree).then((res) =>
      editor.setSaveStatus(res.ok ? 'saved' : 'error')
    );
    return null;
  };

  // "Save as component" (docs/53 P-C): turn the selected layout subtree into a
  // reusable site-surface component, then swap it for a pinned placement. The
  // subtree may nest components (docs/53 4a) — a cycle/over-deep nesting is
  // rejected server-side on create.
  const onSaveAsComponent = async (node: BuilderNode) => {
    const def = getDef(node.type);
    setBusy(true);
    const res = await copyComponent({
      name: node.box.name ?? def?.label ?? 'Component',
      group: def?.group ?? 'content',
      icon: 'box',
      surfaces: ['site'],
      tree: node,
    });
    if (!res.ok || !res.data) {
      setBusy(false);
      editor.setSaveStatus('error');
      return;
    }
    const created = res.data;
    editor.replaceNode(
      node.id,
      makeCustomNode(created.key, created.latestVersion, makeId('custom'))
    );
    await editor.flushSave();
    setBusy(false);
    editor.setSaveStatus('saved');
    router.refresh();
  };

  // No layouts (a failed load). Offer a way in rather than a blank editor.
  if (!editing || !tree) {
    return (
      <ModuleProvider module="builder">
        <div className="bx-shell">
          <div className="bx-noempty">
            <p className="bx-noempty__lead">No layouts yet.</p>
            <Button
              size="sm"
              variant="solid"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              disabled={busy}
              onClick={() => void onNewLayout()}
            >
              Create a layout
            </Button>
          </div>
        </div>
      </ModuleProvider>
    );
  }

  return (
    <ModuleProvider module="builder">
      <div className="bx-shell">
        {/* Editor toolbar — layout catalog + activation. */}
        <div className="bx-toolbar">
          <div className="bx-toolbar__templates">
            {renaming ? (
              <Input
                ref={renameInputRef}
                size="sm"
                className="bx-tplselect"
                value={nameDraft}
                aria-label="Layout name"
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
                value={editing.id}
                aria-label="Layout"
                onChange={(e) => onSelectLayout(e.target.value)}
              >
                {items.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.isActive ? ' · Live' : ''}
                  </option>
                ))}
              </NativeSelect>
            )}
            {editing.isActive ? (
              <Badge color="success" variant="soft" size="sm">
                Live
              </Badge>
            ) : null}
            <button
              type="button"
              className="bx-newtpl"
              aria-label="Rename this layout"
              disabled={busy || renaming}
              onClick={startRename}
            >
              <Pencil aria-hidden />
            </button>
            <button
              type="button"
              className="bx-newtpl"
              aria-label="New layout"
              disabled={busy || renaming}
              onClick={() => void onNewLayout()}
            >
              <Plus aria-hidden />
            </button>
            <button
              type="button"
              className="bx-newtpl"
              aria-label="Delete this layout"
              disabled={busy || renaming || items.length <= 1 || editing.isActive}
              onClick={() => void onDeleteEditing()}
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
                  data-on={editor.device === d.id}
                  aria-label={d.label}
                  aria-pressed={editor.device === d.id}
                  onClick={() => editor.setDevice(d.id)}
                >
                  <Icon aria-hidden />
                </button>
              );
            })}
          </div>
          <div className="bx-toolbar__actions">
            {editor.saveStatus !== 'idle' ? (
              <span className="bx-savestate" data-state={editor.saveStatus}>
                {SAVE_LABEL[editor.saveStatus]}
              </span>
            ) : null}
            <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} disabled>
              Preview
            </Button>
            <ImportExportControls
              kind="layout"
              name={editing.name}
              getDocument={() => toLayoutDocument({ name: editing.name, tree })}
              onImportText={onImportText}
              disabled={busy}
            />
            <Button
              size="sm"
              variant="soft"
              leftIcon={<Save className="h-3.5 w-3.5" />}
              disabled={busy}
              onClick={() => void editor.flushSave()}
            >
              Save
            </Button>
            {!editing.isActive ? (
              <Button
                size="sm"
                variant="soft"
                color="success"
                leftIcon={<Rocket className="h-3.5 w-3.5" />}
                disabled={busy || !editing.published}
                title={
                  editing.published
                    ? 'Make this layout the live one'
                    : 'Publish this layout before making it live'
                }
                onClick={() => void onActivate()}
              >
                Make active
              </Button>
            ) : null}
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

        {/* Context bar — what the chrome binds to */}
        <div className="bx-ctx">
          <span className="bx-ctx__lead">This layout wraps every page</span>
          <span className="bx-ctx__note">
            The header and footer persist across navigation; the <strong>Page content</strong> block
            is where each routed page renders. Only the <strong>Live</strong> layout is served on
            your site — publish a layout, then make it active to switch. Navigation, brand, and
            social bind to your existing site data — editing them lives in Navigation &amp; Brand.
          </span>
        </div>

        <BuilderWorkspace
          tree={tree}
          editor={editor}
          catalog={bindingCatalog}
          surface="site"
          components={componentsByKey}
          onSaveAsComponent={onSaveAsComponent}
          settings={<LayoutSettings name={editing.name} />}
        />
      </div>
    </ModuleProvider>
  );
}
