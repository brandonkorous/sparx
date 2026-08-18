// The node-index extractor (docs/126 §5.4) — flattens a silica tree into the rows
// `builder_node_index` stores.
//
// A silica tree is one JSONB blob, so nothing about its CONTENTS is queryable. That
// leaves three real questions unanswerable without loading and walking every tree in
// a property:
//
//   · "what breaks if I change or delete this saved component?" — a symbol master is
//     referenced by `instanceOf` from any number of nodes on any number of pages.
//   · "what shows this product?" — the blast radius of deleting a bound record.
//   · "which pages contain a node type this renderer can't draw?" — the queryable
//     half of the silent-unknown-type problem (docs/125 §2.2).
//
// The rows are a CACHE. Every one is derivable by re-walking the owning tree, and a
// write rebuilds one owner wholesale, so the index can never drift into a
// half-updated state — the worst case is staleness until the next write.
//
// React-free and DB-free (silicaui-html types + the shared binding codec only), so
// the service layer and any future prerender share ONE extraction pass.

import { decodeBindingRef } from './binding-ref';
import type { SilicaNode } from './site-sync';

/** Which tree a row belongs to. All three are node trees and all three can hold
 *  symbol instances and bindings, so all three index identically. */
export type NodeIndexOwnerKind = 'page' | 'layout' | 'symbol';

/** One indexed node — the flattened row shape, minus the tenant/property/owner
 *  columns the caller stamps on. */
export interface NodeIndexEntry {
  /** Absent on template/block nodes: a silica node `id` is optional. Such a node can
   *  still carry a binding, so it is indexed with a null id rather than skipped. */
  nodeId: string | null;
  /** `element` | `component` | `outlet` | `host`. */
  kind: string;
  /** The element tag or the component name — whichever names this node's TYPE. */
  type: string;
  /** `NodeBase.instanceOf` — the symbol master this node instantiates. */
  symbolId: string | null;
  /** A binding that pins a SPECIFIC record, split so "everything showing product X"
   *  is an index seek. Null for scope-relative refs (`title`, `item.price`) and for
   *  collection sources, which name a source rather than a record. */
  bindingEntity: string | null;
  bindingId: string | null;
}

function childrenOf(node: SilicaNode): SilicaNode[] {
  const kids = (node as { children?: unknown }).children;
  if (!Array.isArray(kids)) return [];
  // `Child = Node | string` — text children are bare strings with no id or kind, so
  // they index nothing and are dropped here rather than guarded at every read.
  return kids.filter((c): c is SilicaNode => typeof c === 'object' && c !== null);
}

/** The node's TYPE — the tag for an element, the component name for a component,
 *  else the kind itself (`outlet`, `host`) which is its own type. */
function typeOf(node: SilicaNode): string {
  const n = node as { kind?: unknown; tag?: unknown; component?: unknown };
  if (typeof n.tag === 'string' && n.tag) return n.tag;
  if (typeof n.component === 'string' && n.component) return n.component;
  return typeof n.kind === 'string' ? n.kind : 'unknown';
}

/** The pinned record a node binds, if any. Only ENTITY pins (`{ entity, id }`)
 *  identify a record; a bare or scope-relative path names a field, and a collection
 *  source names a source — neither is a record whose deletion this node depends on. */
function pinnedRecordOf(node: SilicaNode): { entity: string; id: string } | null {
  const data = (node as { data?: { ref?: unknown } }).data;
  const ref = data?.ref;
  if (typeof ref !== 'string' || !ref) return null;
  const binding = decodeBindingRef(ref);
  if (binding.entity && binding.id) return { entity: binding.entity, id: binding.id };
  return null;
}

/**
 * Flatten a silica tree into index rows.
 *
 * Every node is emitted, not just the interesting ones: the type census ("which pages
 * contain a node type this renderer can't draw?") needs the full population, and a
 * node with no symbol and no pin still contributes to it. Trees are authored by hand,
 * so the row count is bounded by authoring effort — hundreds per page, not millions.
 */
export function extractNodeIndex(tree: SilicaNode): NodeIndexEntry[] {
  const rows: NodeIndexEntry[] = [];

  const visit = (node: SilicaNode): void => {
    const n = node as { id?: unknown; kind?: unknown; instanceOf?: unknown };
    const pin = pinnedRecordOf(node);
    rows.push({
      nodeId: typeof n.id === 'string' && n.id ? n.id : null,
      kind: typeof n.kind === 'string' ? n.kind : 'unknown',
      type: typeOf(node),
      symbolId: typeof n.instanceOf === 'string' && n.instanceOf ? n.instanceOf : null,
      bindingEntity: pin?.entity ?? null,
      bindingId: pin?.id ?? null,
    });
    // A symbol INSTANCE holds no meaningful children of its own — it expands to a
    // clone of the master at render. Recursing into it would double-count the
    // master's nodes against every instance; the master is indexed once, as its own
    // owner, which is what makes "where is this symbol used" a single-row answer.
    if (n.instanceOf) return;
    for (const child of childrenOf(node)) visit(child);
  };
  visit(tree);

  return rows;
}
