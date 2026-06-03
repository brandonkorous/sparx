/* Throwaway verification of the Layers tree pure ops. Run, read, delete. */
import { appendChild, findNode, moveNode, type BuilderNode } from './app/(dashboard)/builder/_builder/model';
import { makeNode } from './app/(dashboard)/builder/_builder/registry';
import {
  ancestorIds,
  collapsibleIds,
  flattenTree,
  projectDrop,
} from './app/(dashboard)/builder/_builder/layers-tree';

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    console.error('  ✗ FAIL:', name);
  }
}

// Build: root Section > [ hero Section > [Heading, Button > Icon], grid Grid > [cardA Card, cardB Card] ]
const root = makeNode('Section');
const hero = makeNode('Section');
const heading = makeNode('Heading');
const button = makeNode('Button');
const icon = makeNode('Icon');
const grid = makeNode('Grid');
const cardA = makeNode('Card');
const cardB = makeNode('Card');

let tree: BuilderNode = root;
tree = appendChild(tree, root.id, hero);
tree = appendChild(tree, hero.id, heading);
tree = appendChild(tree, hero.id, button);
tree = appendChild(tree, button.id, icon); // Button nests an Icon
tree = appendChild(tree, root.id, grid);
tree = appendChild(tree, grid.id, cardA);
tree = appendChild(tree, grid.id, cardB);

const childIds = (t: BuilderNode, id: string) =>
  (findNode(t, id)?.children ?? []).map((c) => c.id);

// ── flattenTree ───────────────────────────────────────────────────────────────
{
  const flat = flattenTree(tree, new Set());
  ok('flatten lists all 8 nodes in DFS order', flat.length === 8);
  ok('flatten depth: root=0, hero=1, heading=2, icon=3', flat[0]!.depth === 0 && flat[3]!.depth === 3);
  ok('flatten parentId: heading→hero', flat.find((f) => f.node.id === heading.id)!.parentId === hero.id);

  const collapsedFlat = flattenTree(tree, new Set([hero.id]));
  ok('collapsing hero hides its 3 descendants', collapsedFlat.length === 8 - 3);
  ok('collapsed hero row itself still present', collapsedFlat.some((f) => f.node.id === hero.id));
}

// ── collapsibleIds / ancestorIds ────────────────────────────────────────────────
{
  const c = collapsibleIds(tree);
  ok('collapsible = hero, button, grid (have children + acceptsChildren), not root', c.length === 3 && c.includes(hero.id) && c.includes(button.id) && c.includes(grid.id) && !c.includes(root.id));
  ok('cardA not collapsible (no children)', !c.includes(cardA.id));

  ok('ancestors of icon = [root, hero, button]', JSON.stringify(ancestorIds(tree, icon.id)) === JSON.stringify([root.id, hero.id, button.id]));
  ok('ancestors of root = []', ancestorIds(tree, root.id).length === 0);
}

// ── moveNode ────────────────────────────────────────────────────────────────────
{
  // Move cardA out of grid, into hero at index 0.
  const t = moveNode(tree, cardA.id, hero.id, 0);
  ok('move cardA→hero[0]: hero children = [cardA, heading, button]', JSON.stringify(childIds(t, hero.id)) === JSON.stringify([cardA.id, heading.id, button.id]));
  ok('move cardA→hero: grid now has only cardB', JSON.stringify(childIds(t, grid.id)) === JSON.stringify([cardB.id]));
  ok('move cardA→hero: subtree size still 8 (no loss)', flattenTree(t, new Set()).length === 8);

  // Reorder within grid: move cardB before cardA (index 0).
  const t2 = moveNode(tree, cardB.id, grid.id, 0);
  ok('reorder grid: [cardB, cardA]', JSON.stringify(childIds(t2, grid.id)) === JSON.stringify([cardB.id, cardA.id]));

  // Move a CONTAINER with its subtree: hero → grid at index 1.
  const t3 = moveNode(tree, hero.id, grid.id, 1);
  ok('move hero (with subtree) into grid: grid = [cardA, hero, cardB]', JSON.stringify(childIds(t3, grid.id)) === JSON.stringify([cardA.id, hero.id, cardB.id]));
  ok('move hero carried its children (heading still under hero)', findNode(t3, hero.id)!.children!.some((c) => c.id === heading.id));
  ok('move hero: root no longer directly holds hero', !childIds(t3, root.id).includes(hero.id));
  ok('move hero: total nodes unchanged (8)', flattenTree(t3, new Set()).length === 8);

  // Cycle guard: move grid into cardA (cardA is grid's descendant) → no-op.
  const t4 = moveNode(tree, grid.id, cardA.id, 0);
  ok('cycle guard: move grid into its own child cardA is a no-op', t4 === tree);

  // Root guard: moving root → no-op.
  const t5 = moveNode(tree, root.id, hero.id, 0);
  ok('root guard: moving root is a no-op', t5 === tree);

  // Unknown parent → no-op (and does NOT lose the dragged node).
  const t6 = moveNode(tree, cardA.id, 'does-not-exist', 0);
  ok('unknown parent → no-op', t6 === tree);
}

// ── projectDrop (smoke: resolves to a legal, children-accepting parent) ──────────
{
  const flat = flattenTree(tree, new Set([cardA.id])); // simulate dragging cardA
  // Hover over cardB with no horizontal offset → sibling of cardB under grid.
  const p = projectDrop(flat, cardA.id, cardB.id, 0, 16);
  ok('projectDrop returns a result', p !== null);
  ok('projectDrop: dropping near cardB targets grid (its parent)', p!.parentId === grid.id);

  // Hover over hero with a big right offset → nest INTO hero (a container).
  const p2 = projectDrop(flat, cardA.id, hero.id, 64, 16);
  ok('projectDrop: deep indent over hero nests INTO hero', p2!.parentId === hero.id);

  // Hover over heading (a leaf inside hero) with deep indent → can NOT nest into a
  // Heading; should fall back to hero (heading's parent), not heading.
  const p3 = projectDrop(flat, cardA.id, heading.id, 64, 16);
  ok('projectDrop: cannot nest into a leaf Heading → parent is hero, not heading', p3!.parentId === hero.id);
}

console.log(`\nLayers verify: ${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
