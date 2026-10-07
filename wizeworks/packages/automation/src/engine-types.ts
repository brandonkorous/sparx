// Engine-internal contracts (docs/81 §5.3, §7, §7.1).
//
// These reference DB + bus primitives, so they live in the engine rather than
// `@wizeworks/automation-schemas` (which is the pure persisted/wire shape). The
// gate contract (`GateResult` / `Gate`) and the dispatch outcome are the
// keystones of the mandatory policy layer.

import type { ActionType, GateLogEntry, ResolvedFields } from '@wizeworks/automation-schemas';
import type { TxClient } from '@wizeworks/db';
import type { Publisher } from '@wizeworks/events';

/**
 * The envelope the engine ingests. Structurally a `SparxEvent` but with
 * `type: string` rather than the closed `EventType` union — the engine handles
 * trigger types not yet in the canonical registry (every `schedule.*` cadence,
 * and the `[ADD]` events docs/81 §5.2 flags). A real `SparxEvent` is assignable
 * to this (its `EventType` ⊂ `string`); Slice E reconciles the registry.
 */
export interface TriggerEnvelope {
  type: string;
  tenantId: string;
  actorId: string | null;
  /** ISO timestamp. */
  occurredAt: string;
  data: unknown;
}

/** Structural logger — satisfied by Fastify's logger and the events PublisherLogger. */
export interface EngineLogger {
  debug(obj: object, msg?: string): void;
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

/** Ambient dependencies the engine needs to produce effects. */
export interface EngineDeps {
  publisher: Publisher;
  logger: EngineLogger;
  /**
   * Only these tenants' rules and runs. The worker leaves it unset and serves
   * every tenant. A test sets it to the tenants it made, because the database it
   * runs against holds real businesses too: a test's schedule tick with a clock
   * a day ahead ran Gillett's overdue ladder for tomorrow, and a test's run tick
   * would carry out another business's waiting run with the test's fake email
   * sender (sparx persona issue 142). A live set, so a test can add a tenant
   * after building its deps.
   */
  onlyTenants?: ReadonlySet<string>;
}

/**
 * Flat, resolver-exposed field map keyed by dotted path (e.g. `customer.type`,
 * `order.total`). Conditions reference these resolved fields, never raw
 * trigger-payload keys (docs/81 §5.3).
 *
 * Defined alongside the evaluator in `@wizeworks/automation-schemas` and re-exported
 * here: the map's shape is half of the evaluator's contract, and a second local
 * definition is how the two would drift.
 */
export type { ResolvedFields } from '@wizeworks/automation-schemas';

/**
 * Per-dispatch context threaded through resolve → gate → execute. `tx` is the
 * tenant-scoped transaction client (RLS GUC already set by `withTenant`);
 * `causeDepth` is the cascade depth of the owning run, stamped onto any event
 * an action emits so the loop-guard can refuse runaway rule→event→rule chains.
 */
export interface TenantCtx {
  tenantId: string;
  tx: TxClient;
  deps: EngineDeps;
  causeDepth: number;
}

/** The effect a gate inspects / shapes / vetoes — one action about to run. */
export interface EffectInput {
  actionType: ActionType;
  config: Record<string, unknown>;
  /** Resolved entity fields for the triggering record (read-only policy context). */
  fields: ResolvedFields;
}

/**
 * A gate's verdict (docs/81 §7.1). Richer than allow/deny: a gate may *shape*
 * an effect (`transform` — suppression filters a list, tax annotates an amount)
 * or *park* the run until later (`defer` — quiet hours → `resume_at`). `deny`
 * is a policy skip, recorded as `gated`, NOT a failure.
 */
export type GateResult =
  | { kind: 'allow' }
  | { kind: 'deny'; reason: string }
  | { kind: 'transform'; input: EffectInput }
  | { kind: 'defer'; resumeAt: Date; reason: string };

export type Gate = (ctx: TenantCtx, effect: EffectInput) => Promise<GateResult>;

/** A gate plus the name that lands in `gate_log` for the compliance audit trail. */
export interface NamedGate {
  name: string;
  run: Gate;
}

/** An executor's return value, persisted to `automation_run_steps.output`. */
export type ActionOutput = Record<string, unknown> | null;

/**
 * The result of dispatching one action through the gate chain. Drives both the
 * per-step log and the run state machine: a `defer` parks the run, a `gated`
 * records a policy block without failing the run, a `completed` advances it.
 * (Control-flow actions — platform.wait / platform.stop — are handled by the run
 * loop before dispatch, so they are not dispatch outcomes.)
 */
export type DispatchOutcome =
  | { kind: 'completed'; output: ActionOutput; gateLog: GateLogEntry[] }
  | { kind: 'gated'; gate: string; reason: string; gateLog: GateLogEntry[] }
  | { kind: 'deferred'; resumeAt: Date; reason: string; gateLog: GateLogEntry[] };

/**
 * The registration record for one action type (docs/81 §7.1#2). `gates` MAY be
 * empty, but `manifestNote` must then justify why (e.g. "pure internal write,
 * no external effect" or "suppression enforced at the email capability
 * boundary"). A descriptor with an empty manifest and an empty note fails
 * registration — the *declaration* is mandatory, the contents may be empty.
 */
export interface ActionDescriptor {
  type: ActionType;
  /** Owning module slug, for the module-active global gate; null = platform-level. */
  module: string | null;
  /**
   * The module ONE step needs, where that depends on what the step does rather
   * than on the kind of action. Absent ⇒ `module`, for every step. An email step
   * that tells a customer about something they did (an order confirmation, a
   * receipt) needs no email module; the same action sending a campaign does
   * (sparx persona issue 087). The module-active gate reads this, so the rule
   * lives in one place per action and every automation using it follows.
   */
  moduleFor?: (effect: EffectInput) => string | null;
  /** Per-action gate manifest (§7.1#2). */
  gates: NamedGate[];
  /** Justification for the manifest — required, especially when `gates` is empty. */
  manifestNote: string;
  execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput>;
}
