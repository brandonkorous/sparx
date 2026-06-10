// Status vocabularies + the persisted gate-decision shape (docs/81 §6, §7, §7.1).
//
// The runtime gate CONTRACT (GateResult allow/deny/transform/defer + the Gate
// function type) lives in the engine (`@sparx/automation`) because it references
// engine-side EffectInput/TenantCtx. Here we own only what is persisted + shared:
// the enums and the `gate_log` entry shape.

import { z } from 'zod';

/** `automations.origin` — who authored the rule (§3.1). */
export const AutomationOrigin = z.enum(['user', 'system']);
export type AutomationOrigin = z.infer<typeof AutomationOrigin>;

/** `automations.status`. */
export const AutomationStatus = z.enum(['draft', 'active', 'paused', 'error']);
export type AutomationStatus = z.infer<typeof AutomationStatus>;

/** `automation_runs.status` — `waiting` = parked on a durable delay (§7). */
export const RunStatus = z.enum(['running', 'waiting', 'completed', 'failed', 'skipped']);
export type RunStatus = z.infer<typeof RunStatus>;

/** `automation_run_steps.status` — `gated` = blocked by a policy gate, NOT a failure (§7.1). */
export const StepStatus = z.enum(['pending', 'running', 'completed', 'failed', 'skipped', 'gated']);
export type StepStatus = z.infer<typeof StepStatus>;

/** A single gate decision recorded on a step (the compliance audit trail, §7.1). */
export const GateDecisionKind = z.enum(['allow', 'deny', 'transform', 'defer']);
export type GateDecisionKind = z.infer<typeof GateDecisionKind>;

export const GateLogEntry = z.object({
  gate: z.string(),
  decision: GateDecisionKind,
  reason: z.string().optional(),
});
export type GateLogEntry = z.infer<typeof GateLogEntry>;
