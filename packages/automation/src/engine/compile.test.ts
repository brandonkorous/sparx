// The branch compiler (docs/144 §9).
//
// The properties that matter are structural, and they are the ones a durable
// cursor depends on:
//
//   • DETERMINISM — the same tree always compiles to the same indices, because a
//     tick in another pod re-derives the program from stored JSON and resumes at
//     an integer another tick wrote.
//   • FORWARD-ONLY JUMPS — every target is greater than its own index, so the run
//     loop cannot spin.
//   • REACHABILITY — following the branch/jump targets from 0 lands on every
//     action exactly once per path taken, and never inside the arm not chosen.

import { describe, expect, it } from 'vitest';
import { countActions } from '@sparx/automation-schemas';
import type { Action, ConditionGroup } from '@sparx/automation-schemas';

import { compileActions, compileStoredActions, CompileError } from './compile';

const YES: ConditionGroup = {
  logic: 'AND',
  conditions: [{ field: 'customer.orderCount', operator: 'gt', value: 0 }],
};

function act(type: string, config: Record<string, unknown> = {}): Action {
  return { type, config } as Action;
}

function branch(condition: ConditionGroup, then: Action[], otherwise: Action[] = []): Action {
  return act('platform.if_else', { condition, then, otherwise });
}

/** Walk the compiled program the way the run loop does, choosing an arm per
 *  branch, and collect the ACTION types executed in order. */
function trace(steps: ReturnType<typeof compileActions>['steps'], takeThen: boolean[]): string[] {
  const executed: string[] = [];
  let branchIndex = 0;
  let i = 0;
  // Bounded so a compiler bug fails the test rather than hanging the suite.
  for (let guard = 0; guard < 1000 && i < steps.length; guard += 1) {
    const step = steps[i]!;
    if (step.kind === 'branch') {
      const taken = takeThen[branchIndex] ?? true;
      branchIndex += 1;
      i = taken ? i + 1 : step.elseIndex;
      continue;
    }
    if (step.kind === 'jump') {
      i = step.targetIndex;
      continue;
    }
    executed.push(step.action.type);
    i += 1;
  }
  return executed;
}

describe('compileActions', () => {
  it('leaves a flat list untouched — every existing automation compiles 1:1', () => {
    const actions = [act('crm.add_tag'), act('platform.wait'), act('email.send_campaign')];
    const program = compileActions(actions);

    expect(program.steps).toHaveLength(3);
    expect(program.actionCount).toBe(3);
    expect(program.steps.every((s) => s.kind === 'action')).toBe(true);
    expect(program.steps.map((s) => s.path)).toEqual(['0', '1', '2']);
  });

  it('lays a branch out as branch → then → jump → otherwise', () => {
    const program = compileActions([
      branch(YES, [act('crm.add_tag')], [act('crm.add_note')]),
      act('platform.stop'),
    ]);

    expect(program.steps.map((s) => s.kind)).toEqual([
      'branch',
      'action',
      'jump',
      'action',
      'action',
    ]);
    // The else-arm starts right after the jump; the jump lands on what follows
    // the whole branch.
    const head = program.steps[0]!;
    const jump = program.steps[2]!;
    expect(head.kind === 'branch' && head.elseIndex).toBe(3);
    expect(jump.kind === 'jump' && jump.targetIndex).toBe(4);
  });

  it('counts only real actions — the compiler’s jumps are not steps a person wrote', () => {
    const program = compileActions([
      branch(YES, [act('crm.add_tag'), act('crm.add_note')], [act('platform.stop')]),
    ]);
    // 1 branch + 2 then + 1 otherwise = 4 authored; the jump is not one.
    expect(program.actionCount).toBe(4);
    expect(program.steps).toHaveLength(5);
  });

  it('runs the then-arm and skips the otherwise-arm', () => {
    const program = compileActions([
      branch(YES, [act('crm.add_tag'), act('crm.add_note')], [act('crm.remove_tag')]),
      act('platform.notify'),
    ]);
    expect(trace(program.steps, [true])).toEqual([
      'crm.add_tag',
      'crm.add_note',
      'platform.notify',
    ]);
  });

  it('runs the otherwise-arm and skips the then-arm', () => {
    const program = compileActions([
      branch(YES, [act('crm.add_tag'), act('crm.add_note')], [act('crm.remove_tag')]),
      act('platform.notify'),
    ]);
    expect(trace(program.steps, [false])).toEqual(['crm.remove_tag', 'platform.notify']);
  });

  it('carries on past a branch whose else-arm is empty', () => {
    // The layout emits a jump even with nothing to skip. This is the case that
    // an "optimised" compiler would get wrong by one.
    const program = compileActions([branch(YES, [act('crm.add_tag')]), act('platform.notify')]);
    expect(trace(program.steps, [false])).toEqual(['platform.notify']);
    expect(trace(program.steps, [true])).toEqual(['crm.add_tag', 'platform.notify']);
  });

  it('handles a branch as the LAST step, with nothing after it', () => {
    const program = compileActions([branch(YES, [act('crm.add_tag')], [act('crm.add_note')])]);
    expect(trace(program.steps, [true])).toEqual(['crm.add_tag']);
    expect(trace(program.steps, [false])).toEqual(['crm.add_note']);
  });

  it('nests a branch inside a branch', () => {
    const program = compileActions([
      branch(
        YES,
        [branch(YES, [act('crm.add_tag')], [act('crm.remove_tag')]), act('crm.add_note')],
        [act('crm.update_field')]
      ),
      act('platform.stop'),
    ]);

    // Outer yes → inner yes
    expect(trace(program.steps, [true, true])).toEqual([
      'crm.add_tag',
      'crm.add_note',
      'platform.stop',
    ]);
    // Outer yes → inner no
    expect(trace(program.steps, [true, false])).toEqual([
      'crm.remove_tag',
      'crm.add_note',
      'platform.stop',
    ]);
    // Outer no — the inner branch is never reached, so its arm choice is moot
    expect(trace(program.steps, [false])).toEqual(['crm.update_field', 'platform.stop']);
  });

  it('nests a branch inside the OTHERWISE arm', () => {
    const program = compileActions([
      branch(
        YES,
        [act('crm.add_tag')],
        [branch(YES, [act('crm.add_note')], [act('crm.remove_tag')])]
      ),
      act('platform.stop'),
    ]);
    expect(trace(program.steps, [true])).toEqual(['crm.add_tag', 'platform.stop']);
    expect(trace(program.steps, [false, true])).toEqual(['crm.add_note', 'platform.stop']);
    expect(trace(program.steps, [false, false])).toEqual(['crm.remove_tag', 'platform.stop']);
  });

  it('only ever jumps FORWARD — a backward target would let a run spin', () => {
    const program = compileActions([
      branch(
        YES,
        [branch(YES, [act('crm.add_tag')], [act('crm.add_note')])],
        [act('crm.remove_tag')]
      ),
      act('crm.update_field'),
    ]);
    program.steps.forEach((step, index) => {
      if (step.kind === 'branch') expect(step.elseIndex).toBeGreaterThan(index);
      if (step.kind === 'jump') expect(step.targetIndex).toBeGreaterThan(index);
    });
  });

  it('is deterministic — the same tree compiles identically every time', () => {
    // The property the durable cursor rests on: another pod, another process,
    // same indices.
    const tree = [
      branch(
        YES,
        [act('crm.add_tag'), branch(YES, [act('crm.add_note')], [act('crm.remove_tag')])],
        [act('crm.update_field')]
      ),
      act('platform.stop'),
    ];
    const first = compileActions(tree);
    const second = compileActions(tree);
    expect(JSON.stringify(second.steps)).toBe(JSON.stringify(first.steps));
  });

  it('agrees with countActions on how many steps a rule has', () => {
    // These two counts describe the same rule from opposite ends: `countActions`
    // stamps `actions_total` at enrollment, `actionCount` comes out of the
    // compiler. They disagreed once — the compiler was not counting the branch
    // card itself — which is a progress bar that never reaches its own end.
    const trees: Action[][] = [
      [act('crm.add_tag')],
      [branch(YES, [act('crm.add_tag')], [act('crm.add_note')])],
      [branch(YES, [act('crm.add_tag')]), act('platform.stop')],
      [
        branch(
          YES,
          [act('crm.add_tag'), branch(YES, [act('crm.add_note')], [act('crm.remove_tag')])],
          [act('crm.update_field')]
        ),
        act('platform.stop'),
      ],
    ];
    for (const tree of trees) {
      expect(compileActions(tree).actionCount).toBe(countActions(tree));
    }
  });

  it('paths name where a step sits in the AUTHORED tree, not in the program', () => {
    const program = compileActions([
      act('crm.add_tag'),
      branch(YES, [act('crm.add_note')], [act('crm.remove_tag')]),
    ]);
    const paths = program.steps.filter((s) => s.kind === 'action').map((s) => s.path);
    expect(paths).toEqual(['0', '1.then.0', '1.otherwise.0']);
  });

  it('an empty condition takes the then-arm — a half-written branch is legal', () => {
    const program = compileActions([
      branch({ logic: 'AND', conditions: [] }, [act('crm.add_tag')], [act('crm.add_note')]),
    ]);
    const head = program.steps[0]!;
    expect(head.kind === 'branch' && head.condition.conditions).toHaveLength(0);
  });

  it('a branch label rides along for the canvas to show', () => {
    const program = compileActions([
      act('platform.if_else', { condition: YES, then: [], otherwise: [], label: 'Did they book?' }),
    ]);
    const head = program.steps[0]!;
    expect(head.kind === 'branch' && head.label).toBe('Did they book?');
  });
});

describe('compileStoredActions', () => {
  it('compiles a stored JSON action list', () => {
    const program = compileStoredActions([
      { type: 'crm.add_tag', config: { tags: ['vip'] } },
      { type: 'platform.stop', config: {} },
    ]);
    expect(program.actionCount).toBe(2);
  });

  it('refuses a stored value that is not an action list', () => {
    // Stored JSON is not trusted: rows predate schema changes, and a direct
    // database touch during an incident is a real thing that happens.
    expect(() => compileStoredActions({ nope: true })).toThrow(CompileError);
    expect(() => compileStoredActions(null)).toThrow(CompileError);
  });

  it('refuses a branch whose config cannot be read, naming the step', () => {
    // Failing loudly is the point: a rule that cannot say which arm the author
    // meant must stop rather than pick one.
    try {
      compileStoredActions([
        { type: 'crm.add_tag', config: {} },
        { type: 'platform.if_else', config: { then: 'not-a-list' } },
      ]);
      expect.unreachable('expected a CompileError');
    } catch (err) {
      expect(err).toBeInstanceOf(CompileError);
      expect((err as CompileError).path).toBe('1');
    }
  });
});
