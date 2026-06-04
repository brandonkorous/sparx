'use client';

// useBuilderEditor — the editing BRAIN shared by every Builder surface (docs/45
// §2.2). It owns the per-tree concerns that are identical whether you're editing
// a page's content (/builder/page) or the site's chrome (/builder/site):
// selection, the responsive pane state, the derived scope / drop-target, the
// debounced autosave, and every tree mutation.
//
// What it does NOT own is where the tree comes from or how it's persisted — the
// owning shell passes the current `tree`, a `save(tree)` persister, and an
// `onTreeChange(next)` to push optimistic edits back into its own state. That
// split is what lets the page shell (a catalog of pages) and the site shell (one
// layout) share this without either knowing the other's storage shape.

import * as React from 'react';
import { useConfirm } from '@sparx/ui';
import {
  customKeyOf,
  makeCustomNode,
  type BindingCatalog,
  type ComponentDto,
} from '@sparx/builder-schemas';

import {
  appendChild,
  findNode,
  makeId,
  moveNode,
  removeNode,
  updateNode,
  type BoxBase,
  type BuilderNode,
  type DataSources,
  type Device,
  type LayoutBase,
} from './model';
import { buildPreviewData, scopeAt, type ScopeInfo } from './binding-catalog';
import { acceptsChildren, getDef, makeNode, retypeDropsChildren, retypeNode } from './registry';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type RailTab = 'layers' | 'add' | 'fields';
export type MobilePane = 'edit' | 'preview';

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

// Subtree size beneath `node` (every descendant, excluding the node itself) —
// used to tell the user how much a delete takes with it.
function countDescendants(node: BuilderNode): number {
  return (node.children ?? []).reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

export interface UseBuilderEditorArgs {
  /** The tree being edited (null while nothing is loaded). */
  tree: BuilderNode | null;
  /** What this surface can bind to (the page catalog, or SITE_CATALOG). */
  catalog: BindingCatalog;
  /** The tenant's custom components, keyed by component key (docs/53 P-B) — used
   *  to pin the right version when a `custom:*` placement is added. Omitted ⇒ no
   *  custom components available on this surface. */
  components?: ReadonlyMap<string, ComponentDto>;
  /** Debounced autosave on every edit (default true). The component editor sets
   *  this false: editing a component COMMITS a new version (docs/53), so it saves
   *  explicitly, not per-keystroke. Mutations still flow through `onTreeChange`. */
  autosave?: boolean;
  /** Persist a changed tree. Debounced for edits, immediate on flush. ok=true. */
  save: (tree: BuilderNode) => Promise<boolean>;
  /** Apply a new tree to the owner's state (synchronous / optimistic). */
  onTreeChange: (next: BuilderNode) => void;
}

export interface BuilderEditor {
  // Responsive chrome state (read by the shell's toolbar + the workspace).
  device: Device;
  setDevice: (d: Device) => void;
  railTab: RailTab;
  setRailTab: (t: RailTab) => void;
  mobilePane: MobilePane;
  setMobilePane: (p: MobilePane) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  // Derived from the current tree + selection.
  selectedNode: BuilderNode | null;
  scope: ScopeInfo;
  target: BuilderNode | null;
  targetName: string;
  previewData: DataSources;
  // Persistence.
  saveStatus: SaveStatus;
  setSaveStatus: (s: SaveStatus) => void;
  /** Force-persist any pending edit now (await before switching trees). */
  flushSave: () => Promise<void>;
  // Mutations (each updates the tree optimistically + schedules an autosave).
  onBox: (patch: Partial<BoxBase>) => void;
  onLayout: (patch: Partial<LayoutBase>) => void;
  onProp: (key: string, value: unknown) => void;
  onName: (name: string) => void;
  /** Set (or clear, with '') the node's class-first styling string (docs/47). */
  onClass: (value: string) => void;
  onBind: (path: string | null) => void;
  onAdd: (type: string) => void;
  /** Replace the node `id` with `next` (same position), selecting it. Used by
   *  "Save as component" to swap a subtree for a `custom:*` placement. */
  replaceNode: (id: string, next: BuilderNode) => void;
  onRemove: (id: string) => void;
  /** Re-parent / reorder from the Layers tree: move `dragId` to be child `index`
   *  of `parentId`. A no-op for an illegal move (see model.moveNode). */
  onMove: (dragId: string, parentId: string, index: number) => void;
  /** Change the selected node's type (Card→Section, Button→Badge). Confirms first
   *  when the change would drop nested items. */
  onRetype: (targetType: string) => void;
}

export function useBuilderEditor({
  tree,
  catalog,
  components,
  autosave = true,
  save,
  onTreeChange,
}: UseBuilderEditorArgs): BuilderEditor {
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [device, setDevice] = React.useState<Device>('desktop');
  const [railTab, setRailTab] = React.useState<RailTab>('layers');
  const [mobilePane, setMobilePane] = React.useState<MobilePane>('preview');
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');

  // ── Autosave (debounced) ────────────────────────────────────────────────────
  // The pending payload is the TREE (not an id), so a flush always persists the
  // exact tree that was scheduled. `save` is held in a ref so the latest closure
  // (which may capture the owner's current target row) is used at flush time.
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = React.useRef<BuilderNode | null>(null);
  const saveRef = React.useRef(save);
  saveRef.current = save;

  const flushSave = React.useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setSaveStatus('saving');
    const okFlag = await saveRef.current(next);
    setSaveStatus(okFlag ? 'saved' : 'error');
  }, []);

  const scheduleSave = React.useCallback(
    (next: BuilderNode) => {
      pending.current = next;
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const previewData = React.useMemo(() => buildPreviewData(catalog.sources), [catalog]);

  const selectedNode = tree && selectedId ? findNode(tree, selectedId) : null;
  const chain = React.useMemo(
    () => (tree && selectedId ? pathTo(tree, selectedId) : []),
    [tree, selectedId]
  );
  const scope = React.useMemo(() => scopeAt(catalog, chain), [catalog, chain]);

  // Where a palette drop lands: the selected container, else its nearest
  // container ancestor, else the root.
  const target = React.useMemo<BuilderNode | null>(() => {
    if (!tree) return null;
    if (!selectedNode) return tree;
    if (acceptsChildren(selectedNode.type)) return selectedNode;
    return chain[chain.length - 2] ?? tree;
  }, [tree, selectedNode, chain]);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const updateTree = React.useCallback(
    (fn: (t: BuilderNode) => BuilderNode) => {
      if (!tree) return;
      const next = fn(tree);
      onTreeChange(next);
      if (autosave) scheduleSave(next);
    },
    [tree, onTreeChange, scheduleSave, autosave]
  );

  const mutateSelected = React.useCallback(
    (fn: (n: BuilderNode) => BuilderNode) => {
      if (!selectedId) return;
      updateTree((t) => updateNode(t, selectedId, fn));
    },
    [selectedId, updateTree]
  );

  const onBox = (patch: Partial<BoxBase>) =>
    mutateSelected((n) => ({ ...n, box: { ...n.box, ...patch } }));
  const onLayout = (patch: Partial<LayoutBase>) =>
    mutateSelected((n) => (n.layout ? { ...n, layout: { ...n.layout, ...patch } } : n));
  const onProp = (key: string, value: unknown) =>
    mutateSelected((n) => ({ ...n, props: { ...n.props, [key]: value } }));
  const onName = (name: string) =>
    mutateSelected((n) => ({ ...n, box: { ...n.box, name: name || undefined } }));
  // The class-first styling surface (docs/47): a brand-governed class string on
  // the node. Empty → undefined so a blank field stores no class (cf. onName).
  const onClass = (value: string) => mutateSelected((n) => ({ ...n, class: value || undefined }));
  const onBind = (path: string | null) =>
    mutateSelected((n) => {
      if (!path) {
        const next = { ...n };
        delete next.binding;
        return next;
      }
      return { ...n, binding: { path } };
    });

  // Add a node inside the current target. A `custom:<key>` type drops a tenant
  // component placement pinned to its latest version (docs/53 P-B); everything
  // else builds a fresh system node from the registry. An unknown custom key
  // (component vanished mid-session) is a no-op rather than a crash.
  const onAdd = (type: string) => {
    if (!target) return;
    const key = customKeyOf(type);
    let child: BuilderNode;
    if (key) {
      const comp = components?.get(key);
      if (!comp) return;
      child = makeCustomNode(key, comp.latestVersion, makeId('custom'));
    } else {
      child = makeNode(type);
    }
    updateTree((t) => appendChild(t, target.id, child));
    setSelectedId(child.id);
    setRailTab('layers');
  };

  // Swap the node `id` for `next` (same position) — "Save as component" replaces a
  // subtree with its `custom:*` placement. Selects the new node.
  const replaceNode = (id: string, next: BuilderNode) => {
    updateTree((t) => updateNode(t, id, () => next));
    setSelectedId(next.id);
  };

  // Deleting a node removes its WHOLE subtree, so confirm first — and say how
  // much goes with it. The Layers root has no delete control, so `id` is always
  // a removable, non-root node.
  const onRemove = (id: string) => {
    if (!tree) return;
    const node = findNode(tree, id);
    if (!node) return;
    const ckey = customKeyOf(node.type);
    const label =
      node.box.name ??
      getDef(node.type)?.label ??
      (ckey ? components?.get(ckey)?.name : undefined) ??
      node.type;
    const nested = countDescendants(node);
    void (async () => {
      const ok = await confirm({
        title: `Delete “${label}”?`,
        description:
          nested > 0
            ? `This also removes its ${nested} nested item${nested === 1 ? '' : 's'}. This can’t be undone.`
            : 'This can’t be undone.',
        confirmLabel: 'Delete',
        tone: 'danger',
      });
      if (!ok) return;
      updateTree((t) => removeNode(t, id));
      setSelectedId((cur) => (cur === id ? null : cur));
    })();
  };

  // Re-parent / reorder. moveNode is a no-op for illegal moves (root / cycle), so
  // a bad drop just leaves the tree untouched.
  const onMove = (dragId: string, parentId: string, index: number) =>
    updateTree((t) => moveNode(t, dragId, parentId, index));

  // Change the selected node's type. Same-kind targets keep children where the new
  // type can hold them; the one lossy case (a leaf target that can't nest) is
  // confirmed first, counting what goes with it.
  const onRetype = (targetType: string) => {
    if (!selectedNode || !selectedId) return;
    const to = getDef(targetType);
    if (!to || targetType === selectedNode.type) return;
    const apply = () => mutateSelected((n) => retypeNode(n, targetType));
    if (retypeDropsChildren(selectedNode, targetType)) {
      const lost = countDescendants(selectedNode);
      void (async () => {
        const ok = await confirm({
          title: `Change to ${to.label}?`,
          description: `A ${to.label} can’t hold the ${lost} nested item${lost === 1 ? '' : 's'} inside this — ${lost === 1 ? 'it' : 'they'} will be removed. This can’t be undone.`,
          confirmLabel: 'Change type',
          tone: 'danger',
        });
        if (ok) apply();
      })();
    } else {
      apply();
    }
  };

  const targetDef = target ? getDef(target.type) : undefined;
  const targetName = target?.box.name ?? targetDef?.label ?? 'page';

  return {
    device,
    setDevice,
    railTab,
    setRailTab,
    mobilePane,
    setMobilePane,
    selectedId,
    setSelectedId,
    selectedNode,
    scope,
    target,
    targetName,
    previewData,
    saveStatus,
    setSaveStatus,
    flushSave,
    onBox,
    onLayout,
    onProp,
    onName,
    onClass,
    onBind,
    onAdd,
    replaceNode,
    onRemove,
    onMove,
    onRetype,
  };
}
