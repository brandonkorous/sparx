// Tree-shake authored class literals from a Builder node tree (docs/47 §5.2).
//
// The class-first model stores each node's styling as a literal `class` string
// (docs/47 §3) — never a runtime concatenation — so the full set of utilities a
// tenant actually used is statically extractable by walking the tree. That set
// is the candidate list the Tailwind compiler turns into the tenant stylesheet.
//
// Pure + dependency-free (no Tailwind): just structural traversal + tokenizing.

import type { BuilderNode } from '@sparx/builder-schemas';

/**
 * Collect the unique, sorted set of class tokens authored across one or more
 * node trees (e.g. a page tree plus the site-layout chrome tree). Each node's
 * `class` string is split on whitespace; blanks are dropped. Sorted so the
 * output — and therefore the compiled CSS and its content hash — is stable for
 * a given tree regardless of traversal incidentals.
 */
export function collectClasses(roots: BuilderNode | BuilderNode[]): string[] {
  const set = new Set<string>();
  const visit = (node: BuilderNode): void => {
    if (node.class) {
      for (const token of node.class.split(/\s+/)) {
        if (token) set.add(token);
      }
    }
    if (node.children) {
      for (const child of node.children) visit(child);
    }
  };
  for (const root of Array.isArray(roots) ? roots : [roots]) visit(root);
  return [...set].sort();
}
