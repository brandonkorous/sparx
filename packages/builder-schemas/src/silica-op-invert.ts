// Inverse ops — the arithmetic that makes UNDO survive a shared editing session
// (docs/126 §4.5, docs/builder-audit slice 5).
//
// THE PROBLEM. silica's built-in undo is a whole-SITE snapshot restore: every edit
// pushes a `structuredClone(site)` and undo swaps the whole document back. That is
// exactly right for one author alone, and unusable the moment anyone else is in the
// room — restoring a snapshot taken before a co-editor's paragraph landed would
// delete that paragraph, on a page the person pressing Ctrl+Z never opened. The
// engine knows this, so `applyRemoteOps` DROPS the local undo stack on the way in
// (`if (!this.historyDelegate) { this.past = []; this.future = [] }`). Safe, but the
// cost lands on the author: in sparx an agent editing alongside you over MCP is a
// designed-for workflow, so in practice the undo history evaporates mid-session with
// nothing on screen to explain why.
//
// THE FIX. silica offers `setHistoryDelegate` for exactly this: a host that owns an
// authoritative history drives undo itself and feeds the result back through
// `applyRemoteOps`. What a host needs to do that is the INVERSE of an action's ops —
// the ops that put the document back — and that is what this module computes.
//
// An inverse is TARGETED. Undoing "I set this heading's class" emits one
// `node.setClass` against one node; everything else in the site — including work that
// arrived from someone else in between — is untouched. That is the whole difference
// from a snapshot restore, and it is why the delegate can keep the stack alive across
// a co-editor's edit instead of throwing it away.
//
// PURE + EXACT. `invertOps(before, ops)` reads prior values out of `before` — the
// document as it stood immediately before that action — and mirrors `Editor.applyOp`
// case for case, so an inverse composed here means precisely what the engine will do
// with it. Anything it cannot invert faithfully returns `null` for the WHOLE batch
// rather than a partial inverse: half an undo is a corrupted document, and a cleared
// history is merely a disappointment.
//
// The `Op` union is published only from `@wizeworks/silicaui-builder/react`, so the
// import below is type-only — erased at build, no runtime edge, and this package
// stays React-free. Re-declaring the union locally was the alternative and it would
// drift from the engine silently, which is the one failure this file cannot afford.

import { ordAt } from '@wizeworks/silicaui-html';
import type { Op } from '@wizeworks/silicaui-builder/react';
import type { SilicaNode, SilicaSite } from './site-sync';

/** A node found in a tree, with where it sits — an inverse of a removal or a move
 *  has to restore the POSITION, not just the content. */
interface Located {
  node: SilicaNode;
  /** Null for the tree root, which has no position to restore. */
  parent: SilicaNode | null;
  index: number;
}

/** `children` lives on `NodeBase`, which `OutletNode` deliberately doesn't extend —
 *  so the union has no such property and every read goes through here. */
function childrenOf(node: SilicaNode): unknown[] {
  const kids = (node as { children?: unknown }).children;
  return Array.isArray(kids) ? kids : [];
}

function idOf(node: SilicaNode): string | undefined {
  const id = (node as { id?: unknown }).id;
  return typeof id === 'string' && id ? id : undefined;
}

/** A text child is a bare string (`Child = Node | string`) — it has no id, so it is
 *  never a target and never a parent. */
function isNode(child: unknown): child is SilicaNode {
  return typeof child === 'object' && child !== null;
}

function locate(root: SilicaNode, id: string): Located | null {
  const walk = (node: SilicaNode, parent: SilicaNode | null, index: number): Located | null => {
    if (idOf(node) === id) return { node, parent, index };
    const kids = childrenOf(node);
    for (let i = 0; i < kids.length; i += 1) {
      const child = kids[i];
      if (!isNode(child)) continue;
      const hit = walk(child, node, i);
      if (hit) return hit;
    }
    return null;
  };
  return walk(root, null, -1);
}

/** The tree an op addresses. `site`-scoped ops (pages, symbols, theme) carry their
 *  own ids and never reach here. */
function rootFor(site: SilicaSite, target: Op['target']): SilicaNode | null {
  if (target.scope === 'page') return site.pages.find((p) => p.id === target.id)?.root ?? null;
  if (target.scope === 'frame') return site.frame?.root ?? null;
  if (target.scope === 'symbol') return site.symbols?.[target.id]?.root ?? null;
  return null;
}

/**
 * The node's ordering key — its transportable position among its siblings.
 *
 * `ord` is optional in the schema (trees authored before ordering keys existed lack
 * it, and `assignOrds` backfills at load), so a missing one is derived from the
 * node's current index instead. Without a key an insert has no address, and the
 * restored node would land wherever the array happened to put it.
 */
function ordOf(found: Located): string {
  const ord = (found.node as { ord?: unknown }).ord;
  if (typeof ord === 'string' && ord) return ord;
  if (!found.parent || found.index < 0) return ordAt([], 0);
  return ordAt(childrenOf(found.parent) as never, found.index);
}

/** Every node id inside a subtree — what "this batch created it" has to cover, since
 *  an op later in the same action can target a descendant of a node inserted earlier. */
function collectIds(node: SilicaNode, out: Set<string>): void {
  const id = idOf(node);
  if (id) out.add(id);
  for (const child of childrenOf(node)) if (isNode(child)) collectIds(child, out);
}

/** What this action brought into existence. An op that touches one of these needs no
 *  inverse: undoing the creation removes the thing wholesale, so restoring its prior
 *  class or text first would be describing a node that is about to stop existing —
 *  and its "prior" value doesn't exist in `before` to read anyway. */
interface CreatedInBatch {
  nodes: Set<string>;
  pages: Set<string>;
}

function createdInBatch(before: SilicaSite, ops: readonly Op[]): CreatedInBatch {
  const nodes = new Set<string>();
  const pages = new Set<string>();
  for (const op of ops) {
    if (op.kind === 'node.insert') collectIds(op.node, nodes);
    else if (op.kind === 'page.create') {
      pages.add(op.page.id);
      collectIds(op.page.root, nodes);
    } else if (op.kind === 'symbol.set' && !before.symbols?.[op.symbol.id]) {
      collectIds(op.symbol.root, nodes);
    }
  }
  return { nodes, pages };
}

/** Old values are handed to the engine, which stores ops verbatim and clones on
 *  apply — but this walks a `before` snapshot the caller still holds, so anything
 *  carried out is cloned rather than aliased into their document. */
function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * The ops that put the document back the way it was before `ops` ran, newest first.
 *
 * `before` must be the site as it stood immediately BEFORE this action — the value
 * the host held from the previous `onChange`, which silica hands out as a defensive
 * `structuredClone`, so it is a genuine snapshot rather than a live reference.
 *
 * Returns `null` when any op in the batch cannot be inverted faithfully. The caller's
 * only correct response is to drop its undo history: an action it cannot reverse is a
 * point the document can no longer be walked back past, and offering an undo that
 * skips it would silently produce a document nobody authored.
 */
export function invertOps(before: SilicaSite, ops: readonly Op[]): Op[] | null {
  const created = createdInBatch(before, ops);
  const inverse: Op[] = [];
  // Reverse order: the last thing done is the first thing undone. An action that
  // inserts a wrapper and then moves a node into it must un-move before the wrapper
  // is removed, or the move would be addressing a parent that is already gone.
  for (let i = ops.length - 1; i >= 0; i -= 1) {
    const op = ops[i];
    if (!op) continue;
    const step = invertOne(before, op, created);
    if (step === null) return null;
    inverse.push(...step);
  }
  return inverse;
}

/** One op's inverse — zero ops (nothing to restore), one or more ops, or `null`
 *  (not faithfully invertible, which fails the whole batch). */
function invertOne(before: SilicaSite, op: Op, created: CreatedInBatch): Op[] | null {
  switch (op.kind) {
    // ── site-scoped: the whole document, the theme, the page roster ──────────
    case 'site.replace':
      return [
        {
          target: op.target,
          kind: 'site.replace',
          pages: clone(before.pages),
          frame: before.frame ? clone(before.frame) : undefined,
          symbols: clone(before.symbols ?? {}),
          theme: clone(before.theme),
          savedThemes: clone(before.savedThemes ?? []),
        },
      ];

    case 'theme.set':
      return [{ target: op.target, kind: 'theme.set', theme: clone(before.theme) }];

    case 'savedThemes.set':
      return [
        {
          target: op.target,
          kind: 'savedThemes.set',
          savedThemes: clone(before.savedThemes ?? []),
        },
      ];

    case 'frame.setEditable':
      // A frame that didn't exist can't have its flag restored — but the engine
      // refuses the forward op in that case too, so there is nothing to undo.
      if (!before.frame) return [];
      return [{ target: op.target, kind: 'frame.setEditable', editable: before.frame.editable }];

    // ── pages ────────────────────────────────────────────────────────────────
    case 'page.create':
      return [{ target: op.target, kind: 'page.delete', pageId: op.page.id }];

    case 'page.delete': {
      const page = before.pages.find((p) => p.id === op.pageId);
      if (!page) return [];
      // `page.create` appends, so restoring the page alone would put it last in the
      // switcher. The roster op that follows puts it back where the author had it.
      return [
        { target: op.target, kind: 'page.create', page: clone(page) },
        { target: op.target, kind: 'page.reorder', pageIds: before.pages.map((p) => p.id) },
      ];
    }

    case 'page.rename': {
      if (created.pages.has(op.pageId)) return [];
      const page = before.pages.find((p) => p.id === op.pageId);
      if (!page) return null;
      return [{ target: op.target, kind: 'page.rename', pageId: op.pageId, name: page.name }];
    }

    case 'page.setSlug': {
      if (created.pages.has(op.pageId)) return [];
      const page = before.pages.find((p) => p.id === op.pageId);
      if (!page) return null;
      return [{ target: op.target, kind: 'page.setSlug', pageId: op.pageId, slug: page.slug }];
    }

    case 'page.reorder':
      return [{ target: op.target, kind: 'page.reorder', pageIds: before.pages.map((p) => p.id) }];

    // ── symbols (saved components) ───────────────────────────────────────────
    case 'symbol.set': {
      const previous = before.symbols?.[op.symbol.id];
      if (previous) return [{ target: op.target, kind: 'symbol.set', symbol: clone(previous) }];
      // Undoing the CREATION of a saved component means deleting the master and
      // turning every instance of it back into a plain subtree. `symbol.delete`
      // carries that cascade as `detach`, and it cannot be derived here: silica
      // mints fresh node ids for each detached copy, and a cascade built with
      // different ids would leave two clients holding documents that look identical
      // and no longer merge. Refusing is the honest answer — see docs/139 §8 for the
      // engine-side seam that would make it invertible.
      return null;
    }

    case 'symbol.delete': {
      const symbol = before.symbols?.[op.symbolId];
      if (!symbol) return [];
      const steps: Op[] = [{ target: op.target, kind: 'symbol.set', symbol: clone(symbol) }];
      // Each detachment swapped an instance node for an independent copy IN PLACE.
      // Reversing one is remove-the-copy + re-insert-the-instance at the position it
      // held, which the `before` tree still records.
      for (const detach of op.detach) {
        const root = rootFor(before, detach.target);
        if (!root) return null;
        const found = locate(root, detach.nodeId);
        if (!found?.parent) return null;
        const parentId = idOf(found.parent);
        const copyId = idOf(detach.node);
        if (!parentId || !copyId) return null;
        steps.push(
          { target: detach.target, kind: 'node.remove', nodeId: copyId },
          {
            target: detach.target,
            kind: 'node.insert',
            parentId,
            ord: ordOf(found),
            node: clone(found.node),
          }
        );
      }
      return steps;
    }

    // ── nodes ────────────────────────────────────────────────────────────────
    case 'node.insert': {
      const insertedId = idOf(op.node);
      // An outlet carries no id, so nothing can address it for removal. The engine
      // never inserts one through this path, but a batch that did would be
      // un-undoable rather than wrongly undone.
      if (!insertedId) return null;
      return [{ target: op.target, kind: 'node.remove', nodeId: insertedId }];
    }

    default:
      return invertNodeEdit(before, op, created);
  }
}

/** The id-addressed node ops — everything that names a `nodeId` and edits it in
 *  place, plus remove/move, which also need the position `before` records. */
function invertNodeEdit(
  before: SilicaSite,
  op: Extract<Op, { nodeId: string }>,
  created: CreatedInBatch
): Op[] | null {
  // Created by this same action: the insert's own inverse removes it, so restoring a
  // prior value first would be describing a node that is about to stop existing.
  if (created.nodes.has(op.nodeId)) return [];

  const root = rootFor(before, op.target);
  if (!root) return null;
  const found = locate(root, op.nodeId);
  if (!found) return null;
  const node = found.node;
  const target = op.target;

  switch (op.kind) {
    case 'node.remove': {
      if (!found.parent) return null;
      const parentId = idOf(found.parent);
      if (!parentId) return null;
      return [
        {
          target,
          kind: 'node.insert',
          parentId,
          ord: ordOf(found),
          node: clone(node),
        },
      ];
    }

    case 'node.move': {
      if (!found.parent) return null;
      const parentId = idOf(found.parent);
      if (!parentId) return null;
      return [{ target, kind: 'node.move', nodeId: op.nodeId, parentId, ord: ordOf(found) }];
    }

    case 'node.setClass':
      return [
        { target, kind: 'node.setClass', nodeId: op.nodeId, class: readString(node, 'class') },
      ];

    case 'node.setTag': {
      if (node.kind !== 'element') return null;
      return [{ target, kind: 'node.setTag', nodeId: op.nodeId, tag: node.tag }];
    }

    case 'node.rename':
      return [{ target, kind: 'node.rename', nodeId: op.nodeId, name: readString(node, 'label') }];

    case 'node.setBinding':
      return [
        {
          target,
          kind: 'node.setBinding',
          nodeId: op.nodeId,
          binding: clone((node as { data?: never }).data ?? null),
        },
      ];

    case 'node.setBehavior':
      return [
        {
          target,
          kind: 'node.setBehavior',
          nodeId: op.nodeId,
          behavior: clone((node as { behavior?: never }).behavior ?? null),
        },
      ];

    case 'node.setLocked':
      return [
        {
          target,
          kind: 'node.setLocked',
          nodeId: op.nodeId,
          locked: (node as { locked?: 'host' | 'author' }).locked ?? null,
        },
      ];

    case 'node.setOverride': {
      const overrides = (node as { overrides?: Record<string, unknown> }).overrides ?? {};
      return [
        {
          target,
          kind: 'node.setOverride',
          nodeId: op.nodeId,
          masterNodeId: op.masterNodeId,
          override: clone((overrides[op.masterNodeId] as never) ?? null),
        },
      ];
    }

    case 'node.setProps': {
      if (node.kind !== 'component' && node.kind !== 'host') return null;
      return [
        {
          target,
          kind: 'node.setProps',
          nodeId: op.nodeId,
          patch: priorPatch(node.props ?? {}, Object.keys(op.patch)),
        },
      ];
    }

    case 'node.setAttrs': {
      if (node.kind !== 'element') return null;
      return [
        {
          target,
          kind: 'node.setAttrs',
          nodeId: op.nodeId,
          patch: priorPatch(node.attrs ?? {}, Object.keys(op.patch)) as Record<
            string,
            string | number | boolean | null
          >,
        },
      ];
    }

    case 'node.setText':
      return invertSetText(target, op.nodeId, found);

    default:
      return null;
  }
}

/**
 * Undoing a text edit.
 *
 * On a COMPONENT the engine writes `label` when that key is present and `text`
 * otherwise, so the inverse is a props patch on whichever key the forward op chose —
 * decided from the same prior props, so the two always agree.
 *
 * On an ELEMENT the forward op replaces `children` with a single string, which is
 * lossy: `<p>Call <a href=…>us</a></p>` becomes one flat sentence and no `setText`
 * can put the link back. So a paragraph whose children were anything other than one
 * plain string is restored by re-inserting the node itself. That is a wider blast
 * radius than a scalar inverse — it discards any concurrent edit INSIDE that
 * paragraph — but the alternative is an undo that silently drops a link.
 */
function invertSetText(target: Op['target'], nodeId: string, found: Located): Op[] | null {
  const node = found.node;
  if (node.kind === 'component' || node.kind === 'host') {
    const props = node.props ?? {};
    const key = 'label' in props ? 'label' : 'text';
    return [{ target, kind: 'node.setProps', nodeId, patch: priorPatch(props, [key]) }];
  }

  const kids = childrenOf(node);
  const only = kids.length === 1 ? kids[0] : undefined;
  if (typeof only === 'string') {
    return [{ target, kind: 'node.setText', nodeId, text: only }];
  }

  if (!found.parent) return null;
  const parentId = idOf(found.parent);
  if (!parentId) return null;
  return [
    { target, kind: 'node.remove', nodeId },
    { target, kind: 'node.insert', parentId, ord: ordOf(found), node: clone(node) },
  ];
}

/** A patch restoring `keys` to what they held in `prior`. `null` is the wire-safe
 *  spelling of "delete this key" — which is what an absent key has to become, since
 *  the forward patch may have introduced it. */
function priorPatch(
  prior: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of keys) {
    const value = Object.prototype.hasOwnProperty.call(prior, key) ? prior[key] : undefined;
    patch[key] = value === undefined ? null : clone(value);
  }
  return patch;
}

/** A `NodeBase` string field as an op wants it: the value, or `null` to clear. */
function readString(node: SilicaNode, key: 'class' | 'label'): string | null {
  const value = (node as { class?: unknown; label?: unknown })[key];
  return typeof value === 'string' && value ? value : null;
}
