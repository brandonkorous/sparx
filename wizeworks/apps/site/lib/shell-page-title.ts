// Whether a published page already carries its own page title.
//
// /book and /products let their pinned block's heading be the page's `<h1>`,
// because the code shell that wraps the block has no heading. A tenant's own
// published page can: Gillett's booking page opens with "Book your truck in",
// and the services list under it printed a second `<h1>`, "Book with us"
// (sparx persona issue 321). The block is the page title only when the page
// around it has none.

interface TreeNode {
  kind?: unknown;
  tag?: unknown;
  children?: unknown;
}

export function shellHasPageTitle(root: unknown): boolean {
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    const n = node as TreeNode;
    if (n.kind === 'element' && typeof n.tag === 'string' && n.tag.toLowerCase() === 'h1') {
      return true;
    }
    if (Array.isArray(n.children)) stack.push(...(n.children as unknown[]));
  }
  return false;
}
