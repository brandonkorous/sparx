// Repair a stored silica tree whose nodes lack ids (or carry a duplicate) before the
// builder edits it. A tree authored before id-stamping (an old seed / legacy→silica bridge /
// pre-stamping frame) or one carrying a colliding id crashes silica's Navigator: the layer
// panel keys each row by the node's id and falls back to the TAG when the id is missing, so
// several id-less `<a>` links all become React key "a" — the "Encountered two children with
// the same key" crash. The STOREFRONT tolerates id-less chrome (it renders without
// `data-sui-id`), so this heal is needed only on the editing path.

import { walk, type Node } from '@wizeworks/silicaui-html';

/** A globally-unique id — mirrors silicaui's `defaultMakeId` (crypto UUID, Math.random
 *  fallback) so a healed id is indistinguishable from a freshly-stamped one. */
function makeId(): string {
  const c = globalThis.crypto;
  return c?.randomUUID
    ? c.randomUUID()
    : `n_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Return a clone of `root` in which every non-outlet node has a UNIQUE id: a fresh id is
 *  assigned to any node whose id is missing OR already seen earlier in the walk; existing
 *  unique ids are preserved (React keys / dnd-kit ids / per-record refs stay stable — only
 *  bad ids change). Idempotent: a fully, uniquely-stamped tree passes through unchanged. The
 *  `outlet` node is intentionally skipped (it never carries an id, by silica's contract). */
export function ensureUniqueIds(root: Node): Node {
  const clone = structuredClone(root);
  const seen = new Set<string>();
  walk(clone, (n) => {
    if (n.kind === 'outlet') return;
    const node = n as { id?: string };
    let id = node.id;
    if (!id || seen.has(id)) {
      id = makeId();
      node.id = id;
    }
    seen.add(id);
  });
  return clone;
}
