// COMPILE (docs/144 §9) — flatten a branching action tree into a linear program.
//
// ══════════════════════════════════════════════════════════════════════════
// WHY A COMPILER AND NOT A TREE WALK
// ══════════════════════════════════════════════════════════════════════════
//
// A run's position is `automation_runs.cursor_index`: a single integer, written
// to Postgres after every step, and the reason a crash, redeploy or scale-to-zero
// resumes exactly where it left off instead of replaying committed effects. That
// property is the whole design of the run loop, and it is worth more than
// branching is.
//
// Walking the tree at run time would need the cursor to become a PATH
// (`2.then.1.otherwise.0`) — a schema change to a hot column, a new parser, and a
// new class of bug where a path no longer resolves. Instead the tree is flattened
// to a numbered list of steps with explicit jumps, exactly as a compiler lowers
// an `if` to a conditional branch. The cursor stays an integer and every existing
// property of the run loop survives untouched.
//
// The flattening is a PURE FUNCTION of the stored actions, so re-deriving it on
// the next tick — in another pod, after a redeploy — produces byte-identical
// indices. Nothing about the program is persisted; it does not need to be.
//
// ══════════════════════════════════════════════════════════════════════════
// THE ONE HAZARD, NAMED
// ══════════════════════════════════════════════════════════════════════════
//
// Editing an automation's actions while a run is mid-flight re-indexes the
// program under that run's cursor. This is NOT new — a flat list had the same
// exposure, since deleting action 2 shifted 3 into its place — and branching does
// not deepen it, because a run holds a compiled program only for the duration of
// one step. It is called out here because the fix (pinning a run to the
// `automation_versions` snapshot it started on) belongs to versioning, not to
// this file, and a future reader should not conclude the compiler introduced it.

import {
  Action,
  isConditionGroup,
  parseIfElse,
  type ConditionGroup,
} from '@sparx/automation-schemas';

/** One instruction in the compiled program. */
export type CompiledStep =
  /** Run an action through the gated dispatcher (or the run loop's wait/stop). */
  | { kind: 'action'; action: Action; path: string }
  /**
   * Ask a question. True → fall through to `index + 1` (the first action of the
   * `then` arm); false → jump to `elseIndex`.
   */
  | { kind: 'branch'; condition: ConditionGroup; elseIndex: number; path: string; label?: string }
  /** Unconditional jump — emitted at the end of a `then` arm to skip the
   *  `otherwise` arm. Never authored; purely the compiler's own bookkeeping. */
  | { kind: 'jump'; targetIndex: number; path: string };

export interface CompiledProgram {
  steps: CompiledStep[];
  /**
   * How many steps the AUTHOR wrote — every action plus every branch, excluding
   * only the compiler's own jumps.
   *
   * A branch counts because it is a card on the canvas: somebody who drew a
   * branch with two actions in it sees three things and would call that three
   * steps. Jumps do not, because nobody wrote them. This has to agree with
   * `countActions` in @sparx/automation-schemas, which is what stamps
   * `actions_total` at enrollment — two counts of the same rule disagreeing is
   * a progress bar that never reaches the end.
   */
  actionCount: number;
}

/** Thrown when stored actions cannot be compiled. Surfaces as a loud run
 *  failure: a rule whose branch config is unreadable must stop, never guess
 *  which arm the author meant. */
export class CompileError extends Error {
  readonly code = 'AUTOMATION_COMPILE_FAILED' as const;
  constructor(
    message: string,
    readonly path: string
  ) {
    super(`${message} (at step ${path})`);
    Object.setPrototypeOf(this, CompileError.prototype);
  }
}

/**
 * Lower an authored action list to a flat program.
 *
 * Layout for `if_else` at index B:
 *
 *   B          branch (condition, elseIndex = J + 1)
 *   B+1 … T    the `then` arm
 *   J = T+1    jump → endIndex
 *   J+1 … E    the `otherwise` arm
 *   E+1        whatever follows the branch
 *
 * The jump is emitted even when `otherwise` is empty. It costs one no-op step
 * and keeps ONE layout rather than two, which is the difference between an
 * off-by-one that shows up in every branching rule and one that shows up only in
 * rules whose else-arm happens to be empty.
 */
export function compileActions(actions: Action[]): CompiledProgram {
  const steps: CompiledStep[] = [];
  let actionCount = 0;

  function emit(list: Action[], prefix: string): void {
    list.forEach((action, index) => {
      const path = prefix === '' ? String(index) : `${prefix}.${String(index)}`;

      if (action.type !== 'platform.if_else') {
        steps.push({ kind: 'action', action, path });
        actionCount += 1;
        return;
      }

      // The branch itself is a step the author wrote — a card on the canvas.
      actionCount += 1;

      let branch;
      try {
        branch = parseIfElse(action.config);
      } catch (err) {
        throw new CompileError(
          err instanceof Error ? err.message : 'unreadable branch configuration',
          path
        );
      }

      const branchIndex = steps.length;
      // Placeholder — `elseIndex` is only knowable once the `then` arm has been
      // laid out, so the real step is patched in below.
      steps.push({
        kind: 'branch',
        condition: branch.condition,
        elseIndex: -1,
        path,
        ...(branch.label === undefined ? {} : { label: branch.label }),
      });

      emit(branch.then, `${path}.then`);

      const jumpIndex = steps.length;
      steps.push({ kind: 'jump', targetIndex: -1, path: `${path}.jump` });

      emit(branch.otherwise, `${path}.otherwise`);

      const endIndex = steps.length;
      const branchStep = steps[branchIndex];
      const jumpStep = steps[jumpIndex];
      // Both are steps this function just pushed, so the narrowing is a formality
      // TypeScript needs rather than a real possibility.
      if (branchStep?.kind === 'branch') branchStep.elseIndex = jumpIndex + 1;
      if (jumpStep?.kind === 'jump') jumpStep.targetIndex = endIndex;
    });
  }

  emit(actions, '');
  return { steps, actionCount };
}

/**
 * Compile the `actions` JSON off an automation row.
 *
 * Parses with the canonical `Action` schema first: stored JSON is not trusted,
 * because rows predate schema changes and because a direct database touch is a
 * real thing that happens during an incident.
 */
export function compileStoredActions(stored: unknown): CompiledProgram {
  const parsed = Action.array().safeParse(stored);
  if (!parsed.success) {
    throw new CompileError('invalid stored actions', '0');
  }
  return compileActions(parsed.data);
}

/** True when a leaf `ConditionGroup` is present and non-empty. An empty group
 *  passes by definition, so a branch with no condition always takes `then` —
 *  which is legal, and what a half-written rule looks like. */
export function branchAlwaysTrue(condition: ConditionGroup): boolean {
  return isConditionGroup(condition) && condition.conditions.length === 0;
}
