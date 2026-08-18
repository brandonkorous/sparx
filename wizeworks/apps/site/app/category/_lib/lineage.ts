// Derive a category's browse-node context from the flat tenant tree: its
// breadcrumb ancestors (parents, root → self-excluded) and its direct children
// (the subcategory strip). Handles are unique per tenant and the materialized
// `path` is a dot-separated handle path, so the ancestry re-derives from `path`
// without a recursive query.

import type { PublicCategoryNode, PublicCategory } from '@/lib/commerce';

export interface CategoryLineage {
  ancestors: PublicCategoryNode[];
  children: PublicCategoryNode[];
}

export function categoryLineage(
  all: PublicCategoryNode[],
  category: Pick<PublicCategory, 'id' | 'path'>
): CategoryLineage {
  const byHandle = new Map(all.map((c) => [c.handle, c]));
  // path = `root.child.self`; ancestor handles are every segment but the last.
  const segments = category.path.split('.');
  const ancestors = segments
    .slice(0, -1)
    .map((h) => byHandle.get(h))
    .filter((c): c is PublicCategoryNode => Boolean(c));
  const children = all
    .filter((c) => c.parentId === category.id)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  return { ancestors, children };
}
