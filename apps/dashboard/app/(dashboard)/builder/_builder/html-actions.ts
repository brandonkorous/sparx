// HTML import bridge (docs/98 §3.8/§4.2) — the BROWSER half of one-way HTML
// import. The PURE parser/walker lives in @sparx/builder-schemas `html-import.ts`
// (it walks a minimal DOM shape so it stays React-free + unit-testable in node);
// this thin module is where the editor-specific wiring lands, and it is the RIGHT
// home for it because:
//   · DOMParser is a browser global — the schema package must not assume it. Here,
//     in a 'use client' editor module, it is available, so we parse the fragment
//     to a real DOM and hand its top-level nodes (which structurally satisfy
//     `DomNode`) to the pure walker.
//   · The class allow-list lives in @sparx/surface-compile (server-only Tailwind
//     package) — we import its PURE `isClassAllowed` via the `./allowlist` subpath
//     (no Tailwind/lightningcss pulled into the client bundle) and inject it.
//   · `makeId` (the editor's collision-resistant id minter) is injected so stamped
//     ids never clash with a saved tree — the same guarantee the catalog stamp path
//     gives (docs/98 §4.2 "fresh ids, via the existing stamp / cloneWithFreshIds").

import { isClassAllowed } from '@sparx/surface-compile/allowlist';
import {
  importHtmlNodes,
  type DomNode,
  type ImportResult,
} from '@sparx/builder-schemas';

import { makeId, type BuilderNode } from './model';

/** Parse an HTML+Tailwind fragment string into validated `Element` nodes + a
 *  drop/change report (docs/98 §4.2). One-way: the caller inserts the nodes via
 *  the editor's stamp path; there is no reverse sync. Every tag/attr/class is
 *  validated against the §4.1 whitelist + the surface-compile class allow-list. */
export function parseHtmlFragment(html: string): ImportResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // `body.childNodes` is the fragment's top level. A real DOM Node satisfies the
  // structural `DomNode` shape (nodeType / tagName / attributes / childNodes /
  // textContent) the pure walker reads.
  const roots = doc.body.childNodes as unknown as ArrayLike<DomNode>;
  return importHtmlNodes(roots, { isClassAllowed, makeId });
}

/** A single inert root node to hand to the editor's stamp/insert path. When the
 *  import yields exactly one node it is returned directly; multiple nodes are
 *  wrapped in a plain `el:div` (so the insert is one stamp, like a catalog entry).
 *  Returns null when nothing survived the validation. */
export function importedRoot(result: ImportResult): BuilderNode | null {
  const { nodes } = result;
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0]!;
  return {
    id: makeId('el:div'),
    type: 'el:div',
    name: 'Imported HTML',
    props: {},
    children: nodes,
  };
}
