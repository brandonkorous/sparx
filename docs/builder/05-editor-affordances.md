# 05 — Phase 5: Editor affordances

> ⚠️ **SUPERSEDED 2026-07-22.** This plan predates the silicaui `<Builder>` adoption — sparx now HOSTS silica's engine (Insert palette, canvas, layers, inspector, undo/redo) instead of building its own. See **docs/118-builder-silicaui-html-migration.md** for the current architecture. Kept for historical context.

Version: 1.1
Author: Brandon Korous
Last Updated: 2026-07-22

> A great visual builder lets you work directly and never lose work. Today the
> editor has neither: **no undo/redo** (autosave-only, no history stack), **no
> multi-select**, **no canvas drag** (reorder is layers-tree-only), no alignment
> guides, no copy-styles, and almost no keyboard shortcuts
> ([evaluation Findings 3 & 5, §4](../evaluations/builder-eval-findings-2026-06-14.md)).
> This phase adds the direct-manipulation and safety-net layer that makes the
> builder feel like a real design tool.
>
> Engine-level and shell-independent: drops into the unified shell
> ([03](03-unified-builder-shell.md)) and the current editor identically. Best
> after [02](02-canvas-live-renderer-unification.md) so canvas drag operates on the
> real rendered tree.

## 1. The problem

All mutations flow through `use-builder-editor` as immutable tree ops with a
debounced autosave and a single `selectedId` — no inverse stack, no selection set,
no canvas-level pointer manipulation:

- **Undo/redo:** absent. A bad delete/retype/move is unrecoverable except by
  re-authoring or re-importing JSON.
- **Multi-select:** `selectedId` is a single id; no shift/ctrl-click, no bulk
  move/delete.
- **Canvas drag:** reorder/re-parent works only in the Layers tree (dnd-kit,
  `layers-panel.tsx`); the canvas is click-to-select only.
- **Alignment guides / snapping:** none.
- **Copy styles:** none (only "save as component" for a whole subtree).
- **Keyboard:** only rail-resize arrows; no delete, copy/paste, undo, save, nudge,
  duplicate.

## 2. Decisions

**2.1 Undo/redo over the tree-op layer.** Every mutation already produces a new
immutable tree; keep a bounded history (e.g. last 100 states or op-inverse pairs)
in `use-builder-editor`. Wire `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` + toolbar buttons.
History must cover **all** mutations — move, retype, prop edit, class edit, add,
delete, paste, multi-op. Autosave persists the resulting tree as today; undo is a
client-side time-travel over the local tree, then the restored tree autosaves.
Selection is restored with each step where sensible.

**2.2 Multi-select with a selection set.** Replace `selectedId: string` with a
selection set (keep a "primary" for the inspector focus). Shift-click range,
Cmd/Ctrl-click toggle, marquee (optional, later within this phase). Bulk
operations: delete, move/reparent, duplicate, and **apply a class change to all
selected** (the inspector shows the common subset; edits fan out). Guard: a mixed
selection shows only controls valid for all.

**2.3 Canvas drag/drop/reparent reusing the tree move logic.** The canvas gets
pointer-based drag that calls the _same_ `moveNode` logic the layers tree uses
(`model.ts`), with drop targets computed from the rendered geometry (insert
before/after a sibling; drop into a container). Because the canvas now renders the
real tree ([02](02-canvas-live-renderer-unification.md)), drop zones map cleanly
to node wrappers (`data-bx-id`). The interaction shield already owns canvas
pointer events — drag is layered on it.

**2.4 Alignment guides + snapping.** While dragging on the canvas, show smart
guides (edges/centers align to siblings/parent) and light snapping. Scope: visual
guides during canvas drag — not a free-form absolute-position canvas (layout is
still class-driven flex/grid). This keeps guides meaningful (they help you see
alignment within the flow), not a pixel-pusher illusion.

**2.5 Copy/paste + copy-styles.** Cmd/Ctrl+C/V copies a node (or selection) as a
subtree to an in-app clipboard (and optionally the system clipboard as the same
JSON the import/export uses, so paste works across tabs). **Copy styles** copies a
node's `class` (all contexts) and pastes it onto another node, with a paste-style
target picker or a dedicated shortcut. Keep "save as component" for the
promote-to-reusable case.

**2.6 A real keymap.** A single keyboard handler for the editor: undo/redo,
delete (with the destructive-confirm rule, [feedback_destructive_actions_confirm]),
duplicate (Cmd/Ctrl+D), copy/paste/copy-styles, nudge selection in the tree
(arrow keys to move within siblings / in-out of parent), save (Cmd/Ctrl+S
force-flush), select-parent (Esc / Cmd+↑). Document the keymap in-product (a `?`
shortcuts overlay) and in the doc.

**2.7 Empty/loading states pass.** While here, fill the gaps the eval noted: a
loading state for async editor ops and clearer empty states where a surface has no
content yet. Low effort, high polish.

## 3. Work breakdown

| Step | Area                    | Change                                                                                       |
| ---- | ----------------------- | -------------------------------------------------------------------------------------------- |
| 1    | `use-builder-editor.ts` | Undo/redo history over the tree-op layer; covers all mutations; wires keys + toolbar.        |
| 2    | `use-builder-editor.ts` | Selection set (primary + set); shift/ctrl semantics; bulk delete/move/duplicate/class-apply. |
| 3    | `canvas.tsx` + shield   | Pointer drag → `moveNode`; drop-zone geometry from node wrappers; reparent.                  |
| 4    | canvas overlay          | Alignment guides + snapping during drag.                                                     |
| 5    | clipboard               | Copy/paste subtree (in-app + JSON to system clipboard); copy-styles (class across contexts). |
| 6    | keymap                  | One editor keyboard handler + a `?` shortcuts overlay.                                       |
| 7    | polish                  | Loading + empty states for editor surfaces.                                                  |

## 4. Acceptance criteria

- Any mutation (move/delete/retype/prop/class/add/paste/bulk) is undoable and
  redoable via keyboard and toolbar; the restored tree persists.
- Shift/Cmd-click selects multiple nodes; delete/move/duplicate and a class change
  apply to all selected; a mixed selection shows only valid controls.
- A node can be dragged on the canvas to reorder and reparent, with alignment
  guides showing during the drag; the result matches a layers-tree move.
- Copy a node and paste it elsewhere (including a fresh tab via JSON clipboard);
  copy a node's styles onto another node.
- The documented keymap works; a `?` overlay lists it.
- Destructive shortcuts (delete) honor the confirm rule.

## 5. Risks & notes

- **Undo correctness is the load-bearing piece.** A history that misses a mutation
  type, or that desyncs from the autosaved server tree, causes "lost work" — the
  exact thing this phase exists to prevent. Test every mutation type through
  undo→redo→reload.
- **Selection-set refactor touches a lot.** `selectedId` is read widely (inspector,
  layers, canvas). Migrate to the set behind a `primarySelectedId` accessor to
  contain the blast radius.
- **Keep guides honest.** Don't imply free-form absolute positioning; layout stays
  class-driven. Guides assist alignment _within the flow_.
- **System-clipboard JSON** must match the import/export schema so cross-tab paste
  and import are the same path.
