// The three ways a site can be structurally broken rather than merely imperfect.
//
// Each of these produces a page that is missing something the author put there, with
// no error anywhere: the frame renders, the page saves, the publish succeeds, and the
// content is simply absent. They are grouped here because they share that shape —
// silent subtraction — and because none of them is about what was written, only about
// how the trees fit together.

import type { Node as SilicaNode, SymbolDef } from '@wizeworks/silicaui-html';

import type { DocumentInventory } from './walk';
import { childNodes, FRAME_OWNER_NAME } from './walk';
import type { RawFinding } from './finding';
import type { LintablePage } from './types';

/**
 * A frame with no outlet.
 *
 * The outlet is the hole the page body goes through. A frame that has lost it — a
 * paste that replaced the wrong subtree, an imported layout that never had one —
 * renders a perfectly good header and footer with nothing between them, on every
 * page at once. silica pins the outlet as undeletable for exactly this reason, so
 * this is the check for trees that arrived from somewhere else.
 */
function checkOutlet(inventory: DocumentInventory): RawFinding[] {
  if (inventory.hasOutlet) return [];
  return [
    {
      origin: { scope: 'frame', ownerId: null, ownerName: FRAME_OWNER_NAME },
      nodeId: null,
      nodePath: '',
      rule: 'frame-no-outlet',
      severity: 'error',
      title: 'Your pages have nowhere to appear',
      detail:
        'The header and footer that wrap every page are missing the slot the page content goes ' +
        'into, so every page on the site shows only the header and footer with an empty space ' +
        'between them. Open the header and footer and put the page-content slot back.',
    },
  ];
}

/**
 * An instance of a saved component that no longer exists.
 *
 * A saved component placed on a page is a reference, not a copy — that is what makes
 * "edit it once and it changes everywhere" work. Delete the component and every
 * reference expands to nothing: the section vanishes from the page without the page
 * itself changing in any way the author can see in the layers list.
 */
function checkSymbols(inventory: DocumentInventory): RawFinding[] {
  return inventory.missingSymbols.map((missing) => ({
    origin: missing.origin,
    nodeId: null,
    nodePath: missing.nodePath,
    rule: 'symbol-missing' as const,
    severity: 'error' as const,
    title: 'A saved piece on this page no longer exists',
    detail:
      'This spot is set to show one of your saved pieces, but that piece has been deleted — so ' +
      'nothing appears here at all. Put a different piece in its place, or remove the empty spot.',
    evidence: missing.symbolId,
  }));
}

/* ── Duplicate node ids ─────────────────────────────────────────────────────── */

/** Every `(id, tree)` pair in one authored tree, symbol instances NOT expanded — an
 *  instance is a reference, and its master's ids belong to the master. */
function collectIds(root: SilicaNode, into: Map<string, string[]>, treeLabel: string): void {
  const visit = (node: SilicaNode): void => {
    if (node.kind === 'outlet') return;
    if (node.id) {
      const trees = into.get(node.id);
      if (trees) trees.push(treeLabel);
      else into.set(node.id, [treeLabel]);
    }
    if (node.instanceOf) return;
    for (const child of childNodes(node)) visit(child);
  };
  visit(root);
}

/**
 * Two nodes carrying the same id.
 *
 * THE FAILURE THIS EXISTS FOR, verbatim from the repo's own conventions: node ids are
 * persisted with the tree AND used as React keys and as dnd-kit sortable ids. A
 * duplicate trips React's duplicate-key guard and SILENTLY DISABLES drag-to-reorder
 * in the layers list — the author drags a section, nothing moves, and there is no
 * message anywhere explaining why. It is unreachable through normal authoring (ids
 * are minted from a random base) and entirely reachable through the paths that
 * bypass minting: an imported tree, a hand-written MCP write, a restored release from
 * before ids were globally unique.
 *
 * WHICH COLLISIONS COUNT. Only the ones that can be mounted at the same time. The
 * editor holds one page plus the frame plus every saved component, so a clash inside
 * one tree, or between a page and the frame, is live. The same id on two different
 * pages is not — those trees never meet — and reporting it would be a warning about
 * nothing.
 */
export function checkDuplicateIds(
  pages: readonly LintablePage[],
  frame: { root: SilicaNode } | null | undefined,
  symbols: Record<string, SymbolDef> | null | undefined
): RawFinding[] {
  const findings: RawFinding[] = [];

  // Trees mounted alongside EVERY page: the frame and all saved components. A
  // collision anywhere in here is live no matter which page is open.
  const shared = new Map<string, string[]>();
  if (frame?.root) collectIds(frame.root, shared, FRAME_OWNER_NAME);
  for (const symbol of Object.values(symbols ?? {})) {
    collectIds(symbol.root, shared, symbol.name);
  }

  const report = (id: string, trees: string[], origin: RawFinding['origin']): void => {
    const where =
      trees[0] === trees[1]
        ? `twice in ${trees[0] ?? 'the same place'}`
        : `in both ${trees[0] ?? '?'} and ${trees[1] ?? '?'}`;
    findings.push({
      origin,
      nodeId: id,
      nodePath: '',
      rule: 'duplicate-node-id',
      severity: 'error',
      title: 'Two blocks share the same internal id',
      detail:
        `The same block id is used ${where}. Blocks are identified by that id, so when two share ` +
        'one the editor cannot tell them apart — dragging to reorder stops working, with no ' +
        'message to say why. This cannot happen while building normally; it comes from imported ' +
        'or restored content. Delete one of the two blocks and add it again to give it a fresh id.',
      evidence: id,
    });
  };

  for (const [id, trees] of shared) {
    if (trees.length > 1) {
      report(id, trees, { scope: 'site', ownerId: null, ownerName: 'Your site' });
    }
  }

  for (const page of pages) {
    const own = new Map<string, string[]>();
    collectIds(page.root, own, page.name);
    for (const [id, trees] of own) {
      const sharedTrees = shared.get(id) ?? [];
      const all = [...trees, ...sharedTrees];
      if (all.length > 1) {
        report(id, all, { scope: 'page', ownerId: page.id, ownerName: page.name });
      }
    }
  }

  return findings;
}

/** The per-page structural findings. Duplicate ids are checked once for the whole
 *  site instead — see `checkDuplicateIds`. */
export function checkStructure(inventory: DocumentInventory): RawFinding[] {
  return [...checkOutlet(inventory), ...checkSymbols(inventory)];
}
