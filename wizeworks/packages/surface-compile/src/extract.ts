// Tree-shake authored class literals from a Builder node tree (docs/47 §5.2).
//
// The class-first model stores each node's styling as a literal `class` string
// (docs/47 §3) — never a runtime concatenation — so the full set of utilities a
// tenant actually used is statically extractable by walking the tree. That set
// is the candidate list the Tailwind compiler turns into the tenant stylesheet.
//
// Pure + dependency-free (no Tailwind): just structural traversal + tokenizing.

import type { BuilderNode } from '@wizeworks/builder-schemas';

/**
 * Collect the unique, sorted set of class tokens authored across one or more
 * node trees (e.g. a page tree plus the site-layout chrome tree). Each node's
 * `class` string is split on whitespace; blanks are dropped. Sorted so the
 * output — and therefore the compiled CSS and its content hash — is stable for
 * a given tree regardless of traversal incidentals.
 */
export function collectClasses(roots: BuilderNode | BuilderNode[]): string[] {
  const set = new Set<string>();
  // Walks SILICA trees as well as sparx `BuilderNode` ones — both spell styling as a
  // `class` string on a node with `children`, which is all this needs. The two guards
  // are what makes that safe: a silica element's `children` may hold RAW STRINGS (a
  // text leaf), and `class` is only a class list when it is actually a string. Without
  // them a text leaf would be walked as if it were a node — harmless today only because
  // `"text".class` happens to be undefined, which is luck, not a contract.
  const visit = (node: BuilderNode): void => {
    if (typeof node !== 'object' || node === null) return;
    if (typeof node.class === 'string') {
      for (const token of node.class.split(/\s+/)) {
        if (token) set.add(token);
      }
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) visit(child);
    }
  };
  for (const root of Array.isArray(roots) ? roots : [roots]) visit(root);
  return [...set].sort();
}
