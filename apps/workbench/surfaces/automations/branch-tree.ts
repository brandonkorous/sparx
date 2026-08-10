'use client';

// Editing a rule that has branches (docs/144 §9).
//
// ══════════════════════════════════════════════════════════════════════════
// WHY NESTED STEPS ARE ADDRESSED BY PATH
// ══════════════════════════════════════════════════════════════════════════
//
// The editor identifies every selectable node by a string id, and top-level
// actions carry a MINTED id (`act-…`) held in an array parallel to the actions —
// which is what lets a step keep its identity across a drag-reorder, so React
// keys and dnd-kit sortable ids stay stable.
//
// Nested steps cannot use that scheme. They live inside another action's config,
// they are created and destroyed by editing that config, and a second parallel
// array per branch arm would be four arrays to keep in step with one tree. So a
// nested step is addressed by WHERE IT IS: `act-7::then.0.otherwise.2`. The path
// is derived from the tree on every render, which means it cannot go stale — and
// it means a nested step's identity changes when it moves, which is correct,
// because nested steps do not drag-reorder. Only the top level does.
//
// Everything here is pure. The editor holds the state; these functions take a
// tree and return a new one.

import { IfElseConfig, type Action, type ConditionGroup } from '@sparx/automation-schemas';

/** Separates the owning top-level action's id from the path inside it. */
const PATH_SEP = '::';

export type BranchArm = 'then' | 'otherwise';

/** One hop down into a branch. */
export interface PathStep {
  arm: BranchArm;
  index: number;
}

export interface NestedRef {
  /** The top-level action id that owns this subtree. */
  rootId: string;
  /** Hops from that action down to the step. Never empty for a nested node. */
  path: PathStep[];
}

/** Build the node id for a nested step. */
export function nestedNodeId(rootId: string, path: PathStep[]): string {
  if (path.length === 0) return rootId;
  const tail = path.map((p) => `${p.arm}.${String(p.index)}`).join('.');
  return `${rootId}${PATH_SEP}${tail}`;
}

/**
 * Parse a node id back into a reference, or null when it is a plain top-level id
 * (or one of the fixed nodes — settings / trigger / conditions).
 *
 * Returns null rather than throwing on a malformed path: a stale id from a
 * previous render should deselect, not crash the editor.
 */
export function parseNestedId(nodeId: string): NestedRef | null {
  const at = nodeId.indexOf(PATH_SEP);
  if (at < 0) return null;

  const rootId = nodeId.slice(0, at);
  const parts = nodeId.slice(at + PATH_SEP.length).split('.');
  if (parts.length === 0 || parts.length % 2 !== 0) return null;

  const path: PathStep[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const arm = parts[i];
    const index = Number(parts[i + 1]);
    if ((arm !== 'then' && arm !== 'otherwise') || !Number.isInteger(index) || index < 0) {
      return null;
    }
    path.push({ arm, index });
  }
  return { rootId, path };
}

/** The two arms of a branch action, defaulted. An unparseable config yields two
 *  empty arms rather than throwing, so a rule with one bad step still renders. */
export function armsOf(action: Action): {
  condition: ConditionGroup;
  then: Action[];
  otherwise: Action[];
  label?: string;
} {
  const parsed = IfElseConfig.safeParse(action.config);
  if (!parsed.success) {
    return { condition: { logic: 'AND', conditions: [] }, then: [], otherwise: [] };
  }
  return parsed.data;
}

/** Rebuild a branch action from its parts. */
function withArms(
  action: Action,
  parts: { condition?: ConditionGroup; then?: Action[]; otherwise?: Action[]; label?: string }
): Action {
  const current = armsOf(action);
  const next: Record<string, unknown> = {
    condition: parts.condition ?? current.condition,
    then: parts.then ?? current.then,
    otherwise: parts.otherwise ?? current.otherwise,
  };
  const label = parts.label ?? current.label;
  if (label !== undefined && label !== '') next.label = label;
  return { type: action.type, config: next };
}

/** Read the action at a path inside `root`, or null. */
export function actionAt(root: Action, path: PathStep[]): Action | null {
  let current: Action | undefined = root;
  for (const hop of path) {
    if (current?.type !== 'platform.if_else') return null;
    current = armsOf(current)[hop.arm][hop.index];
  }
  return current ?? null;
}

/**
 * Return a copy of `root` with the action at `path` replaced by `next`, or —
 * when `next` is null — removed.
 *
 * Recursive rather than iterative because the whole point is to rebuild the
 * chain of parents above the change: every ancestor is a new object, so React
 * sees a changed reference at each level it needs to.
 */
export function setActionAt(root: Action, path: PathStep[], next: Action | null): Action {
  const [hop, ...rest] = path;
  if (!hop) {
    // An empty path means "replace the root itself" — the caller handles that
    // case before recursing, so reaching here with a null `next` would mean
    // deleting a node by asking its own subtree to remove it.
    return next ?? root;
  }

  const arms = armsOf(root);
  const list = [...arms[hop.arm]];
  const child = list[hop.index];
  if (!child) return root;

  if (rest.length === 0) {
    if (next === null) list.splice(hop.index, 1);
    else list[hop.index] = next;
  } else {
    list[hop.index] = setActionAt(child, rest, next);
  }

  return withArms(root, { [hop.arm]: list });
}

/**
 * Insert `action` into a branch arm.
 *
 * `path` addresses the BRANCH (empty = `root` itself is the branch); `arm` and
 * `atIndex` say where in it.
 */
export function insertIntoBranch(
  root: Action,
  path: PathStep[],
  arm: BranchArm,
  atIndex: number,
  action: Action
): Action {
  if (path.length === 0) {
    const arms = armsOf(root);
    const list = [...arms[arm]];
    list.splice(Math.min(Math.max(atIndex, 0), list.length), 0, action);
    return withArms(root, { [arm]: list });
  }

  const [hop, ...rest] = path;
  if (!hop) return root;
  const arms = armsOf(root);
  const list = [...arms[hop.arm]];
  const child = list[hop.index];
  if (!child) return root;
  list[hop.index] = insertIntoBranch(child, rest, arm, atIndex, action);
  return withArms(root, { [hop.arm]: list });
}

/** Replace the question a branch asks. `path` addresses the branch. */
export function setBranchCondition(
  root: Action,
  path: PathStep[],
  condition: ConditionGroup,
  label?: string
): Action {
  if (path.length === 0) return withArms(root, { condition, label });
  const [hop, ...rest] = path;
  if (!hop) return root;
  const arms = armsOf(root);
  const list = [...arms[hop.arm]];
  const child = list[hop.index];
  if (!child) return root;
  list[hop.index] = setBranchCondition(child, rest, condition, label);
  return withArms(root, { [hop.arm]: list });
}

/**
 * How deep a branch sits, counting the root list as depth 1.
 *
 * The editor uses this to stop offering "add a branch" where the schema would
 * reject it — being unable to find the option is a better experience than being
 * told off after writing one.
 */
export function depthOf(path: PathStep[]): number {
  return path.length + 1;
}

export interface FlatStep {
  action: Action;
  /** Path from its top-level ancestor. Empty for a top-level action itself. */
  path: PathStep[];
  /** Which top-level action's subtree it belongs to. */
  rootIndex: number;
}

/** Every action in a tree, flattened depth-first with its path — what the step
 *  counter and the "12 steps" summary read. */
export function flatten(actions: Action[]): FlatStep[] {
  const out: FlatStep[] = [];

  function visit(action: Action, rootIndex: number, path: PathStep[]): void {
    out.push({ action, path, rootIndex });
    if (action.type !== 'platform.if_else') return;
    const arms = armsOf(action);
    for (const arm of ['then', 'otherwise'] as const) {
      arms[arm].forEach((child, i) => {
        visit(child, rootIndex, [...path, { arm, index: i }]);
      });
    }
  }

  actions.forEach((action, rootIndex) => {
    visit(action, rootIndex, []);
  });
  return out;
}

/** Total steps including everything inside branches — the number the editor
 *  shows, and the one an author counts when they look at the canvas. */
export function countSteps(actions: Action[]): number {
  return flatten(actions).length;
}
