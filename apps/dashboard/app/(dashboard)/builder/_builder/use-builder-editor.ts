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
//
// Phase 5 (docs/builder/05) layered the direct-manipulation + safety net on top of
// that flow, WITHOUT changing the tree-op or autosave contracts:
//   · undo/redo — a bounded snapshot history (editor-history) records every
//     mutation; undo replays a prior tree, then autosaves it like any edit.
//   · multi-select — `selectedId` is now the PRIMARY of a selection SET; shift/
//     cmd-click build the set, and bulk delete/duplicate/move/style-apply fan out.
//   · clipboard — copy/paste subtrees (editor-clipboard) + copy-styles across
//     nodes; keyboard nudge reorders the selected node in the tree.

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
  cloneWithFreshIds,
  findNode,
  findParent,
  idRange,
  insertAfter,
  makeId,
  moveNode,
  moveNodes,
  removeNode,
  topLevelSelected,
  updateNode,
  type Binding,
  type BuilderNode,
  type DataSources,
  type Device,
} from './model';
import { buildPreviewData, scopeAt, type ScopeInfo, type SitePreviewData } from './binding-catalog';
import { useCommercePreview } from './use-commerce-preview';
import { acceptsChildren, getDef, makeNode, retypeDropsChildren, retypeNode } from './registry';
import { useHistory } from './editor-history';
import { parseClipboard, serializeClipboard } from './editor-clipboard';
import { applyClassChangeToSibling } from './class-conflicts';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type RailTab = 'layers' | 'add' | 'fields';
export type MobilePane = 'edit' | 'preview';

/** How a click changes the selection (docs/builder/05 §2.2). Plain = replace;
 *  `additive` (Cmd/Ctrl-click) toggles one node; `range` (Shift-click) spans from
 *  the anchor to the clicked node in document order. */
export interface SelectMods {
  additive?: boolean;
  range?: boolean;
}

/** A point-in-time snapshot the undo history stores + replays (docs/builder/05
 *  §2.1): the whole tree plus the selection to restore with it. */
interface EditorSnapshot {
  tree: BuilderNode;
  ids: string[];
  primary: string | null;
}

interface SelectionState {
  /** The selected node ids, in selection order (the LAST is the primary). */
  ids: string[];
  /** The node whose properties the inspector shows. */
  primary: string | null;
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
  /** The tenant's real site-chrome data (brand identity + social links). Overlaid
   *  onto the canvas preview data so the header (Logo/Wordmark) AND footer
   *  (SocialLinks) preview the actual brand — parity with the live site (apps/site
   *  loadSiteData). Omitted ⇒ generic placeholders. */
  sitePreview?: SitePreviewData | null;
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
  // ── Selection (a SET with a primary; docs/builder/05 §2.2) ──────────────────
  /** The PRIMARY selected id (the inspector's focus) — the back-compat accessor
   *  that single-select callers keep reading. */
  selectedId: string | null;
  /** The full selection set, in selection order. */
  selectedIds: string[];
  /** Replace the selection with `id` (or clear with null). Back-compat alias for
   *  `select(id)` with no modifiers. */
  setSelectedId: (id: string | null) => void;
  /** Change the selection with click modifiers (plain / additive / range). */
  select: (id: string | null, mods?: SelectMods) => void;
  /** Select every node under the root (excluding the root) — Cmd/Ctrl+A. */
  selectAll: () => void;
  /** Move the selection to the primary's parent (Cmd/Ctrl+↑); clears at the root. */
  selectParent: () => void;
  // Derived from the current tree + selection.
  selectedNode: BuilderNode | null;
  scope: ScopeInfo;
  target: BuilderNode | null;
  targetName: string;
  previewData: DataSources;
  // ── Undo / redo (docs/builder/05 §2.1) ──────────────────────────────────────
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // Persistence.
  saveStatus: SaveStatus;
  setSaveStatus: (s: SaveStatus) => void;
  /** Force-persist any pending edit now (await before switching trees). */
  flushSave: () => Promise<void>;
  // Mutations (each updates the tree optimistically + schedules an autosave).
  onProp: (key: string, value: unknown) => void;
  onName: (name: string) => void;
  /** Set (or clear, with '') the node's class-first styling string (docs/47). In a
   *  multi-selection the change FANS OUT to the rest (docs/builder/05 §2.2). */
  onClass: (value: string) => void;
  onBind: (target: string | Binding | null) => void;
  onAdd: (type: string) => void;
  /** Replace the node `id` with `next` (same position), selecting it. Used by
   *  "Save as component" to swap a subtree for a `custom:*` placement. */
  replaceNode: (id: string, next: BuilderNode) => void;
  onRemove: (id: string) => void;
  /** Re-parent / reorder from the Layers tree: move `dragId` to be child `index`
   *  of `parentId`. When `dragId` is part of the multi-selection the whole set
   *  moves together. A no-op for an illegal move (see model.moveNode). */
  onMove: (dragId: string, parentId: string, index: number) => void;
  /** Change the selected node's type (Card→Section, Button→Badge). Confirms first
   *  when the change would drop nested items. */
  onRetype: (targetType: string) => void;
  // ── Clipboard + bulk (docs/builder/05 §2.5) ─────────────────────────────────
  /** Copy the selection (subtree JSON) to the in-app + system clipboard. */
  copySelection: () => void;
  /** Paste clipboard subtrees after the primary (or into the root), selecting them. */
  paste: () => Promise<void>;
  /** Duplicate each selected node in place, selecting the clones (Cmd/Ctrl+D). */
  duplicateSelection: () => void;
  /** Delete the whole selection (confirm-gated), clearing it. */
  deleteSelection: () => void;
  /** Copy the primary node's styles (its full class, all contexts). */
  copyStyles: () => void;
  /** Paste the copied styles onto every selected node. */
  pasteStyles: () => void;
  /** Whether a style string has been copied (enables Paste styles). */
  canPasteStyles: boolean;
  /** Reorder the primary node in the tree by keyboard (docs/builder/05 §2.6):
   *  up/down among siblings, left out to the grandparent, right into the previous
   *  sibling (when it's a container). */
  nudge: (dir: 'up' | 'down' | 'left' | 'right') => void;
}

export function useBuilderEditor({
  tree,
  catalog,
  components,
  autosave = true,
  sitePreview,
  save,
  onTreeChange,
}: UseBuilderEditorArgs): BuilderEditor {
  const confirm = useConfirm();
  const [selection, setSelectionState] = React.useState<SelectionState>({ ids: [], primary: null });
  const [device, setDevice] = React.useState<Device>('desktop');
  const [railTab, setRailTab] = React.useState<RailTab>('layers');
  const [mobilePane, setMobilePane] = React.useState<MobilePane>('preview');
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');

  // Latest tree + selection in refs so the imperative handlers (clipboard, nudge,
  // history restore) read current values without re-subscribing every edit.
  const treeRef = React.useRef(tree);
  treeRef.current = tree;
  const selectionRef = React.useRef(selection);
  selectionRef.current = selection;
  // The fixed end of a range-select (the node a Shift-click extends FROM).
  const anchorRef = React.useRef<string | null>(null);

  const setSelection = React.useCallback((next: SelectionState) => {
    selectionRef.current = next;
    setSelectionState(next);
  }, []);

  // ── Undo/redo history (docs/builder/05 §2.1) ──────────────────────────────────
  const history = useHistory<EditorSnapshot>();
  // Seed (and re-seed) the history when the edited DOCUMENT changes — a tree loads,
  // or a different page/layout switches in (a new root id). Edits within a document
  // keep the same root id, so this fires only on a real document boundary, where
  // undo must not replay across an unrelated tree.
  const rootId = tree?.id ?? null;
  // history.seed is stable; this depends on the document identity (rootId) only —
  // re-running on every tree edit would wipe the undo stack.
  React.useEffect(() => {
    if (tree) history.seed({ tree, ids: [], primary: null });
  }, [rootId]);

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

  // ── Clipboard buffers (in-app fallbacks for the system clipboard) ─────────────
  const clipboardRef = React.useRef<BuilderNode[] | null>(null);
  const [stylesClip, setStylesClip] = React.useState<string | null>(null);
  const stylesClipRef = React.useRef<string | null>(null);
  stylesClipRef.current = stylesClip;

  // ── Selection ─────────────────────────────────────────────────────────────────
  const select = React.useCallback(
    (id: string | null, mods?: SelectMods) => {
      if (id === null) {
        anchorRef.current = null;
        setSelection({ ids: [], primary: null });
        return;
      }
      const cur = selectionRef.current;
      const t = treeRef.current;
      if (mods?.range && anchorRef.current && t) {
        const range = idRange(t, anchorRef.current, id);
        if (range.length) {
          setSelection({ ids: range, primary: id });
          return;
        }
      }
      if (mods?.additive) {
        const has = cur.ids.includes(id);
        const ids = has ? cur.ids.filter((x) => x !== id) : [...cur.ids, id];
        anchorRef.current = id;
        setSelection({ ids, primary: has ? (ids[ids.length - 1] ?? null) : id });
        return;
      }
      anchorRef.current = id;
      setSelection({ ids: [id], primary: id });
    },
    [setSelection]
  );

  const setSelectedId = React.useCallback((id: string | null) => select(id), [select]);

  const selectAll = React.useCallback(() => {
    const t = treeRef.current;
    if (!t) return;
    const ids: string[] = [];
    const walk = (n: BuilderNode) => {
      for (const c of n.children ?? []) {
        ids.push(c.id);
        walk(c);
      }
    };
    walk(t);
    if (ids.length === 0) return;
    anchorRef.current = ids[0]!;
    setSelection({ ids, primary: ids[ids.length - 1]! });
  }, [setSelection]);

  const selectParent = React.useCallback(() => {
    const t = treeRef.current;
    const primary = selectionRef.current.primary;
    if (!t || !primary) return;
    const parent = findParent(t, primary);
    if (!parent || parent.id === t.id) {
      setSelection({ ids: [], primary: null });
      return;
    }
    anchorRef.current = parent.id;
    setSelection({ ids: [parent.id], primary: parent.id });
  }, [setSelection]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  // Real products for any pin / collection source the tree binds, so the canvas
  // previews the published products, not the sample (docs/98 Pillar 7).
  const commerceOverlay = useCommercePreview(tree);
  const previewData = React.useMemo(
    () => ({ ...buildPreviewData(catalog.sources, sitePreview), ...commerceOverlay }),
    [catalog, sitePreview, commerceOverlay]
  );

  const selectedId = selection.primary;
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

  // ── Mutation plumbing (apply optimistically · autosave · record history) ──────
  // Every mutation funnels through `commit`: it pushes the optimistic tree to the
  // owner, schedules the autosave, optionally moves the selection, and records the
  // resulting state on the undo stack — so EVERY edit is undoable (docs/builder/05
  // §5, the load-bearing property). Undo/redo restore through `applySnapshot`,
  // which bypasses `commit` (it navigates the stack rather than growing it).
  const commit = React.useCallback(
    (next: BuilderNode, selAfter?: SelectionState) => {
      onTreeChange(next);
      if (autosave) scheduleSave(next);
      if (selAfter) setSelection(selAfter);
      const sel = selAfter ?? selectionRef.current;
      history.push({ tree: next, ids: sel.ids, primary: sel.primary });
    },
    [onTreeChange, autosave, scheduleSave, setSelection, history]
  );

  const updateTree = React.useCallback(
    (fn: (t: BuilderNode) => BuilderNode, selAfter?: SelectionState) => {
      const t = treeRef.current;
      if (!t) return;
      const next = fn(t);
      if (next === t) return; // a no-op move/edit shouldn't grow the undo stack
      commit(next, selAfter);
    },
    [commit]
  );

  const applySnapshot = React.useCallback(
    (snap: EditorSnapshot) => {
      onTreeChange(snap.tree);
      if (autosave) scheduleSave(snap.tree);
      setSelection({ ids: snap.ids, primary: snap.primary });
      anchorRef.current = snap.primary;
    },
    [onTreeChange, autosave, scheduleSave, setSelection]
  );

  const undo = React.useCallback(() => {
    const snap = history.undo();
    if (snap) applySnapshot(snap);
  }, [history, applySnapshot]);

  const redo = React.useCallback(() => {
    const snap = history.redo();
    if (snap) applySnapshot(snap);
  }, [history, applySnapshot]);

  const mutateSelected = React.useCallback(
    (fn: (n: BuilderNode) => BuilderNode) => {
      const primary = selectionRef.current.primary;
      if (!primary) return;
      updateTree((t) => updateNode(t, primary, fn));
    },
    [updateTree]
  );

  const onProp = (key: string, value: unknown) =>
    mutateSelected((n) => ({ ...n, props: { ...n.props, [key]: value } }));
  const onName = (name: string) =>
    mutateSelected((n) => {
      const next = { ...n };
      if (name) next.name = name;
      else delete next.name;
      return next;
    });

  // The class-first styling surface (docs/47): a brand-governed class string on
  // the node. Empty → undefined so a blank field stores no class (cf. onName). In
  // a multi-selection the change is applied to the primary and FANS OUT group-aware
  // to the rest (docs/builder/05 §2.2) — each sibling keeps its own other classes.
  const onClass = (value: string) => {
    const { ids, primary } = selectionRef.current;
    if (!primary) return;
    updateTree((t) => {
      const oldPrimaryClass = findNode(t, primary)?.class;
      let next = updateNode(t, primary, (n) => ({ ...n, class: value || undefined }));
      for (const id of ids) {
        if (id === primary) continue;
        next = updateNode(next, id, (n) => {
          const sib = applyClassChangeToSibling(oldPrimaryClass, value, n.class);
          return { ...n, class: sib || undefined };
        });
      }
      return next;
    });
  };

  // Accepts a bare PATH string (field picker) or a full Binding (the Data panel's
  // product pin / collection source / action, docs/98 Pillar 7); null/'' clears it.
  const onBind = (target: string | Binding | null) =>
    mutateSelected((n) => {
      if (target == null || target === '') {
        const next = { ...n };
        delete next.binding;
        return next;
      }
      return { ...n, binding: typeof target === 'string' ? { path: target } : target };
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
    const targetId = target.id;
    updateTree((t) => appendChild(t, targetId, child), { ids: [child.id], primary: child.id });
    setRailTab('layers');
  };

  // Swap the node `id` for `next` (same position) — "Save as component" replaces a
  // subtree with its `custom:*` placement. Selects the new node.
  const replaceNode = (id: string, next: BuilderNode) => {
    updateTree((t) => updateNode(t, id, () => next), { ids: [next.id], primary: next.id });
  };

  // Deleting a node removes its WHOLE subtree, so confirm first — and say how
  // much goes with it. The Layers root has no delete control, so `id` is always
  // a removable, non-root node.
  const onRemove = (id: string) => {
    const t = treeRef.current;
    if (!t) return;
    const node = findNode(t, id);
    if (!node) return;
    // A pinned node (the email_wordmark header, docs/52 §1) is present by
    // construction — never removed. The Layers panel hides its delete control, but
    // guard here too so no transport can drop it.
    if (getDef(node.type)?.pinned) return;
    const ckey = customKeyOf(node.type);
    const label =
      node.name ??
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
      const cur = selectionRef.current;
      const ids = cur.ids.filter((x) => x !== id);
      updateTree((tr) => removeNode(tr, id), {
        ids,
        primary: cur.primary === id ? (ids[ids.length - 1] ?? null) : cur.primary,
      });
    })();
  };

  // Delete the WHOLE selection (docs/builder/05 §2.2) — confirm once, naming the
  // total cost, then drop each top-level selected subtree. Honors the same pinned
  // guard + confirm rule as single delete (feedback_destructive_actions_confirm).
  const deleteSelection = () => {
    const t = treeRef.current;
    if (!t) return;
    const tops = topLevelSelected(t, new Set(selectionRef.current.ids)).filter(
      (id) => !getDef(findNode(t, id)?.type ?? '')?.pinned
    );
    if (tops.length === 0) return;
    if (tops.length === 1) {
      onRemove(tops[0]!);
      return;
    }
    const total = tops.reduce((sum, id) => {
      const n = findNode(t, id);
      return sum + 1 + (n ? countDescendants(n) : 0);
    }, 0);
    void (async () => {
      const ok = await confirm({
        title: `Delete ${tops.length} blocks?`,
        description: `This removes ${total} item${total === 1 ? '' : 's'} in total. This can’t be undone.`,
        confirmLabel: 'Delete',
        tone: 'danger',
      });
      if (!ok) return;
      updateTree((tr) => tops.reduce((acc, id) => removeNode(acc, id), tr), {
        ids: [],
        primary: null,
      });
    })();
  };

  // Re-parent / reorder. moveNode is a no-op for illegal moves (root / cycle), so
  // a bad drop just leaves the tree untouched. A leading PINNED child (the
  // email_wordmark header, docs/52 §1) keeps its slot: a drop targeting index 0 of a
  // parent whose first child is pinned is bumped below it, so nothing lands above
  // the header. When the dragged node is part of a multi-selection, the whole set
  // moves together (docs/builder/05 §2.2).
  const onMove = (dragId: string, parentId: string, index: number) =>
    updateTree((t) => {
      const parent = findNode(t, parentId);
      const firstChild = parent?.children?.[0];
      const leadPinned = Boolean(firstChild && getDef(firstChild.type)?.pinned);
      const at = leadPinned && index < 1 ? 1 : index;
      const ids = selectionRef.current.ids;
      if (ids.length > 1 && ids.includes(dragId)) return moveNodes(t, ids, parentId, at);
      return moveNode(t, dragId, parentId, at);
    });

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

  // ── Clipboard + duplicate + copy-styles (docs/builder/05 §2.5) ────────────────
  // The copied subtree(s) go to BOTH the system clipboard (cross-tab / agent paste,
  // best-effort) and an in-app ref (the always-available fallback). The serialized
  // form is the Import/Export schema, so a copy can be pasted into Import too.
  const copySelection = () => {
    const t = treeRef.current;
    if (!t) return;
    const tops = topLevelSelected(t, new Set(selectionRef.current.ids));
    const nodes = tops.map((id) => findNode(t, id)).filter((n): n is BuilderNode => n !== null);
    if (nodes.length === 0) return;
    clipboardRef.current = nodes;
    const text = serializeClipboard(nodes);
    void navigator.clipboard?.writeText(text).catch(() => {
      // Clipboard API blocked (permissions / insecure context) — the in-app ref
      // still serves same-tab paste.
    });
  };

  // Paste subtrees AFTER the primary (same parent) — or append to the root when
  // nothing is selected. Reads the system clipboard first (cross-tab), falling back
  // to the in-app buffer; each pasted subtree already has fresh ids (parseClipboard).
  const paste = async () => {
    const t = treeRef.current;
    if (!t) return;
    let nodes: BuilderNode[] | null = null;
    try {
      const text = await navigator.clipboard?.readText();
      if (text) nodes = parseClipboard(text);
    } catch {
      // ignore — fall back to the in-app buffer below
    }
    nodes ??= clipboardRef.current ? clipboardRef.current.map(cloneWithFreshIds) : null;
    if (!nodes || nodes.length === 0) return;

    const primary = selectionRef.current.primary;
    const parent = primary ? findParent(t, primary) : null;
    let next = t;
    if (primary && parent) {
      // Insert as siblings right after the primary, preserving order.
      let afterId = primary;
      for (const node of nodes) {
        next = insertAfter(next, afterId, node);
        afterId = node.id;
      }
    } else {
      // No selection (or the primary is the root) → append to the root.
      for (const node of nodes) next = appendChild(next, t.id, node);
    }
    const ids = nodes.map((n) => n.id);
    commit(next, { ids, primary: ids[ids.length - 1]! });
    setRailTab('layers');
  };

  // Duplicate each top-level selected node in place (clone after its original),
  // selecting the clones so a follow-up nudge/drag moves the copies.
  const duplicateSelection = () => {
    const t = treeRef.current;
    if (!t) return;
    const tops = topLevelSelected(t, new Set(selectionRef.current.ids));
    if (tops.length === 0) return;
    let next = t;
    const newIds: string[] = [];
    for (const id of tops) {
      const node = findNode(next, id);
      if (!node) continue;
      const clone = cloneWithFreshIds(node);
      next = insertAfter(next, id, clone);
      newIds.push(clone.id);
    }
    if (newIds.length === 0) return;
    commit(next, { ids: newIds, primary: newIds[newIds.length - 1]! });
  };

  const copyStyles = () => {
    const t = treeRef.current;
    const primary = selectionRef.current.primary;
    if (!t || !primary) return;
    const node = findNode(t, primary);
    if (!node) return;
    setStylesClip(node.class ?? '');
  };

  const pasteStyles = () => {
    const cls = stylesClipRef.current;
    if (cls === null) return;
    const ids = selectionRef.current.ids;
    if (ids.length === 0) return;
    updateTree((t) =>
      ids.reduce((acc, id) => updateNode(acc, id, (n) => ({ ...n, class: cls || undefined })), t)
    );
  };

  // Keyboard reorder of the primary node (docs/builder/05 §2.6). Pinned + root are
  // never moved. Mirrors the layers/canvas drag through the same moveNode logic.
  const nudge = (dir: 'up' | 'down' | 'left' | 'right') => {
    const t = treeRef.current;
    const primary = selectionRef.current.primary;
    if (!t || !primary) return;
    const node = findNode(t, primary);
    if (!node || getDef(node.type)?.pinned) return;
    const parent = findParent(t, primary);
    if (!parent) return; // the root doesn't move
    const siblings = parent.children ?? [];
    const i = siblings.findIndex((c) => c.id === primary);
    if (i === -1) return;

    if (dir === 'up' || dir === 'down') {
      // moveNode removes then re-inserts against the post-removal list, so the
      // target index is simply the neighbour's index in either direction.
      const to = dir === 'up' ? i - 1 : i + 1;
      if (to < 0 || to >= siblings.length) return;
      onMove(primary, parent.id, to);
    } else if (dir === 'left') {
      // Out one level: become a sibling right after the parent in the grandparent.
      const grand = findParent(t, parent.id);
      if (!grand) return;
      const pIndex = (grand.children ?? []).findIndex((c) => c.id === parent.id);
      onMove(primary, grand.id, pIndex + 1);
    } else {
      // Into the previous sibling when it can hold children.
      const prev = siblings[i - 1];
      if (!prev || !acceptsChildren(prev.type)) return;
      onMove(primary, prev.id, prev.children?.length ?? 0);
    }
  };

  const targetDef = target ? getDef(target.type) : undefined;
  const targetName = target?.name ?? targetDef?.label ?? 'page';

  return {
    device,
    setDevice,
    railTab,
    setRailTab,
    mobilePane,
    setMobilePane,
    selectedId,
    selectedIds: selection.ids,
    setSelectedId,
    select,
    selectAll,
    selectParent,
    selectedNode,
    scope,
    target,
    targetName,
    previewData,
    undo,
    redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    saveStatus,
    setSaveStatus,
    flushSave,
    onProp,
    onName,
    onClass,
    onBind,
    onAdd,
    replaceNode,
    onRemove,
    onMove,
    onRetype,
    copySelection,
    paste,
    duplicateSelection,
    deleteSelection,
    copyStyles,
    pasteStyles,
    canPasteStyles: stylesClip !== null,
    nudge,
  };
}
