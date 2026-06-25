import 'server-only';

import { api } from '@/lib/api-rest-client';

import type { CategoryParentOption } from './category-create-form';

// Server loader for the create form's parent picker. `/v1/commerce/categories`
// returns the nested tree (each node carrying its `depth`); we flatten it into
// a depth-annotated list so the form can indent options. Shared by the
// full-page /new route and the `@detail` overlay wrapper so both seed the same
// options. Failures degrade to "top level only" rather than blocking creation.

interface CategoryTreeNode {
  id: string;
  name: string;
  depth: number;
  path: string;
  /** Sort priority among siblings — surfaced so the edit form can show sibling
   *  context for the Priority field. Optional: degrades to "—" if the tree
   *  endpoint omits it. */
  position?: number;
  children: CategoryTreeNode[];
}

export async function loadCategoryParents(): Promise<CategoryParentOption[]> {
  let tree: CategoryTreeNode[] = [];
  try {
    tree = await api.get<CategoryTreeNode[]>('/v1/commerce/categories');
  } catch {
    tree = [];
  }

  const out: CategoryParentOption[] = [];
  function walk(list: CategoryTreeNode[]): void {
    for (const node of list) {
      out.push({
        id: node.id,
        name: node.name,
        depth: node.depth,
        path: node.path,
        position: node.position,
      });
      walk(node.children);
    }
  }
  walk(tree);
  return out;
}
