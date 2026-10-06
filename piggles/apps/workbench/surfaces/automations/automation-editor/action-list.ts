import { arrayMove } from '@dnd-kit/sortable';
import type { Action, ConditionGroup } from '@wizeworks/automation-schemas';
import { TRIGGER_NODE } from '../automations-presentation';
import { availableActions } from '../automations-catalog';
import {
  actionAt,
  insertIntoBranch,
  nestedNodeId,
  parseNestedId,
  setActionAt,
  setBranchCondition,
  type BranchArm,
} from '../branch-tree';
import { newActionId } from './doc-fields';
import type { EditorState } from './use-editor-state';

// ── Action list operations (the canvas drives these callbacks) ──
export function insertAction(ed: EditorState, atIndex: number) {
  const { enabledModules, actions, setActions, setActionIds, selectNode } = ed;
  const first = availableActions(enabledModules)[0];
  const action: Action = {
    type: first?.type ?? 'platform.stop',
    config: first?.jsonTemplate ?? {},
  };
  const id = newActionId();
  const clamped = Math.min(Math.max(atIndex, 0), actions.length);
  setActions((prev) => {
    const next = [...prev];
    next.splice(clamped, 0, action);
    return next;
  });
  setActionIds((prev) => {
    const next = [...prev];
    next.splice(clamped, 0, id);
    return next;
  });
  selectNode(id);
}

export function moveAction(ed: EditorState, from: number, to: number) {
  const { setActions, setActionIds } = ed;
  setActions((prev) => arrayMove(prev, from, to));
  setActionIds((prev) => arrayMove(prev, from, to));
}

// ── editing a step, wherever it sits ──
// A node id is a top-level action id (`act-…`) or a PATH into a branch (`act-…::then.0`); both
// arrive through the same two functions, so branch support never leaks into the editor forms.

export function updateAction(ed: EditorState, id: string, next: Action) {
  const { actionIds, setActions } = ed;
  const nested = parseNestedId(id);
  if (nested) {
    const rootIndex = actionIds.indexOf(nested.rootId);
    if (rootIndex < 0) return;
    setActions((prev) =>
      prev.map((a, idx) => (idx === rootIndex ? setActionAt(a, nested.path, next) : a))
    );
    return;
  }
  const i = actionIds.indexOf(id);
  if (i < 0) return;
  setActions((prev) => prev.map((a, idx) => (idx === i ? next : a)));
}

export function removeAction(ed: EditorState, id: string) {
  const { actionIds, setActions, setActionIds, selectedId, setSelectedId } = ed;
  const nested = parseNestedId(id);
  if (nested) {
    const rootIndex = actionIds.indexOf(nested.rootId);
    if (rootIndex < 0) return;
    setActions((prev) =>
      prev.map((a, idx) => (idx === rootIndex ? setActionAt(a, nested.path, null) : a))
    );
    // Select the branch that held it. Selecting a sibling would need the path
    // arithmetic for "the step before this one in this arm", and a deleted
    // step's neighbour is not obviously what somebody wants to look at next.
    if (selectedId === id) setSelectedId(nested.rootId);
    return;
  }
  const i = actionIds.indexOf(id);
  if (i < 0) return;
  setActions((prev) => prev.filter((_, idx) => idx !== i));
  setActionIds((prev) => prev.filter((_, idx) => idx !== i));
  if (selectedId === id) setSelectedId(actionIds[i - 1] ?? actionIds[i + 1] ?? TRIGGER_NODE);
}

/** Add a step inside one arm of a branch. `branchNodeId` is the branch's own
 *  node id — top-level or itself nested. */
export function insertIntoArm(
  ed: EditorState,
  branchNodeId: string,
  arm: BranchArm,
  atIndex: number
) {
  const { enabledModules, actionIds, setActions, selectNode } = ed;
  const first = availableActions(enabledModules)[0];
  const action: Action = {
    type: first?.type ?? 'platform.stop',
    config: first?.jsonTemplate ?? {},
  };

  const nested = parseNestedId(branchNodeId);
  const rootId = nested?.rootId ?? branchNodeId;
  const branchPath = nested?.path ?? [];
  const rootIndex = actionIds.indexOf(rootId);
  if (rootIndex < 0) return;

  setActions((prev) =>
    prev.map((a, idx) =>
      idx === rootIndex ? insertIntoBranch(a, branchPath, arm, atIndex, action) : a
    )
  );
  selectNode(nestedNodeId(rootId, [...branchPath, { arm, index: atIndex }]));
}

/** Change the question a branch asks (and the note shown on its card). */
export function setBranchQuestion(
  ed: EditorState,
  branchNodeId: string,
  condition: ConditionGroup,
  label?: string
) {
  const { actionIds, setActions } = ed;
  const nested = parseNestedId(branchNodeId);
  const rootId = nested?.rootId ?? branchNodeId;
  const branchPath = nested?.path ?? [];
  const rootIndex = actionIds.indexOf(rootId);
  if (rootIndex < 0) return;
  setActions((prev) =>
    prev.map((a, idx) =>
      idx === rootIndex ? setBranchCondition(a, branchPath, condition, label) : a
    )
  );
}

/** The action a node id points at, top-level or nested. */
export function actionForNode(ed: EditorState, id: string): Action | null {
  const { actionIds, actions } = ed;
  const nested = parseNestedId(id);
  if (!nested) {
    const i = actionIds.indexOf(id);
    return i >= 0 ? (actions[i] ?? null) : null;
  }
  const rootIndex = actionIds.indexOf(nested.rootId);
  if (rootIndex < 0) return null;
  const root = actions[rootIndex];
  return root ? actionAt(root, nested.path) : null;
}

/** The canvas and inspector callbacks, bound to this render's state. */
export function actionHandlers(ed: EditorState) {
  return {
    insertAction: (atIndex: number) => {
      insertAction(ed, atIndex);
    },
    moveAction: (from: number, to: number) => {
      moveAction(ed, from, to);
    },
    updateAction: (id: string, next: Action) => {
      updateAction(ed, id, next);
    },
    removeAction: (id: string) => {
      removeAction(ed, id);
    },
    insertIntoArm: (branchNodeId: string, arm: BranchArm, atIndex: number) => {
      insertIntoArm(ed, branchNodeId, arm, atIndex);
    },
    setBranchQuestion: (branchNodeId: string, condition: ConditionGroup, label?: string) => {
      setBranchQuestion(ed, branchNodeId, condition, label);
    },
    actionForNode: (id: string) => actionForNode(ed, id),
  };
}
