// Pure zone-routing primitives for the unified studio (docs/builder/03 §2.1–2.2).
//
// The three-zone editor's safety property — a layout edit and a page edit can
// never stomp each other — rests on routing every mutation to the zone that
// PHYSICALLY owns the node, and rejecting any reorder that would cross the Outlet
// boundary. Those decisions are pulled out here as pure, React-free functions so
// the "a mis-routed save is a data-loss class of bug" guarantee (§6) is unit-
// testable without rendering the editor. `use-studio-editor` + `studio-layers`
// import these rather than re-deriving the rules.

import { findNode, type BuilderNode } from './model';

/** The node-bearing zones the studio persists + mutates. (Brand & theme are edited
 *  on their own surface, /builder/brand — not a zone of this editor.) */
export type StudioNodeZone = 'layout' | 'page';

/** Which node-bearing zone owns `id` — derived purely from which tree physically
 *  holds it, so routing can never drift from the data. Page wins if (impossibly)
 *  an id appeared in both. null ⇒ the id is in neither tree (vanished mid-drag). */
export function studioZoneOf(
  layoutTree: BuilderNode | null,
  pageTree: BuilderNode | null,
  id: string
): StudioNodeZone | null {
  if (pageTree && findNode(pageTree, id)) return 'page';
  if (layoutTree && findNode(layoutTree, id)) return 'layout';
  return null;
}

/** The single zone a reorder stays within, or null if it must be rejected. A move
 *  is allowed only when the dragged node AND its target parent live in the SAME
 *  tree; a drop whose parent is in a different zone (across the Outlet boundary) or
 *  an unknown parent returns null, so the caller no-ops it rather than persisting a
 *  cross-zone (mis-routed) save (docs/builder/03 §6). */
export function studioMoveZone(
  layoutTree: BuilderNode | null,
  pageTree: BuilderNode | null,
  dragId: string,
  parentId: string
): StudioNodeZone | null {
  const zone = studioZoneOf(layoutTree, pageTree, dragId);
  if (!zone) return null;
  const tree = zone === 'page' ? pageTree : layoutTree;
  if (!tree || !findNode(tree, parentId)) return null; // cross-zone / unknown parent
  return zone;
}

/** The id of the first `Outlet` node in a layout tree (where the page renders). The
 *  composed Layers tree grafts the page in as this node's child. */
export function findOutletId(root: BuilderNode): string | null {
  if (root.type === 'Outlet') return root.id;
  for (const child of root.children ?? []) {
    const hit = findOutletId(child);
    if (hit) return hit;
  }
  return null;
}
