// Gated dispatcher (docs/81 §7.1) — THE only path to an effect.
//
// Action executors are never called directly; the run loop reaches them solely
// through `dispatch()`, which ALWAYS runs the gate chain first: the global chain
// (tenant-active, kill-switch, module-active) then the action's own manifest.
// Every gate decision is recorded to `gateLog` (the compliance audit trail).
//
// The richer-than-allow/deny contract is honored here:
//   • deny      → the step is `gated` (a policy skip, NOT a failure); run continues
//   • transform → the (possibly reshaped) effect flows to the next gate / executor
//   • defer     → the run parks until `resumeAt` and re-runs THIS action later
//   • allow     → proceed
//
// Control-flow actions (platform.wait / platform.stop) are intercepted by the
// run loop BEFORE dispatch — they are engine mechanics, not gated effects — so
// reaching the dispatcher with one is a programming error.

import type { ActionType, GateLogEntry } from '@sparx/automation-schemas';

import { getDescriptor } from '../actions/registry';
import type { DispatchOutcome, EffectInput, ResolvedFields, TenantCtx } from '../engine-types';
import { GLOBAL_GATES } from '../gates/builtins';

/** Thrown when an action type has no registered executor — surfaced as a loud
 *  step failure, never a silent no-op. (Module executors register via the
 *  action-registry seam when the engine is wired with their service deps.) */
export class UnregisteredActionError extends Error {
  readonly code = 'UNREGISTERED_ACTION' as const;
  constructor(public readonly actionType: string) {
    super(`no executor registered for action "${actionType}"`);
    Object.setPrototypeOf(this, UnregisteredActionError.prototype);
  }
}

export async function dispatch(
  ctx: TenantCtx,
  actionType: ActionType,
  config: Record<string, unknown>,
  fields: ResolvedFields
): Promise<DispatchOutcome> {
  const descriptor = getDescriptor(actionType);
  if (!descriptor) {
    throw new UnregisteredActionError(actionType);
  }

  let effect: EffectInput = { actionType, config, fields };
  const gateLog: GateLogEntry[] = [];

  for (const gate of [...GLOBAL_GATES, ...descriptor.gates]) {
    const result = await gate.run(ctx, effect);
    switch (result.kind) {
      case 'allow':
        gateLog.push({ gate: gate.name, decision: 'allow' });
        break;
      case 'transform':
        gateLog.push({ gate: gate.name, decision: 'transform' });
        effect = result.input;
        break;
      case 'deny':
        gateLog.push({ gate: gate.name, decision: 'deny', reason: result.reason });
        return { kind: 'gated', gate: gate.name, reason: result.reason, gateLog };
      case 'defer':
        gateLog.push({ gate: gate.name, decision: 'defer', reason: result.reason });
        return { kind: 'deferred', resumeAt: result.resumeAt, reason: result.reason, gateLog };
      default:
        return assertNever(result);
    }
  }

  const output = await descriptor.execute(ctx, effect);
  return { kind: 'completed', output, gateLog };
}

function assertNever(x: never): never {
  throw new Error(`unhandled gate result: ${JSON.stringify(x)}`);
}
