// @sparx/automation — the cross-module rule engine (docs/81, docs/84 Slice C).
//
// Public surface: the engine entry points (ingest + the two ticks), the service
// layer (CRUD + clone + system seed), and the registration seams (resolvers,
// scanners, actions) module owners use to teach the engine new triggers/effects.
// The gated dispatcher is the only path to an effect — there is no exported
// "call an executor directly".

// ── engine-internal contracts ──
export type {
  ActionDescriptor,
  ActionOutput,
  DispatchOutcome,
  EffectInput,
  EngineDeps,
  EngineLogger,
  Gate,
  GateResult,
  NamedGate,
  ResolvedFields,
  TenantCtx,
  TriggerEnvelope,
} from './engine-types';

// ── conditions ──
export { evaluateConditions } from './conditions/evaluate';

// ── resolver / scanner registry ──
export {
  getScanner,
  registerResolver,
  registerScanner,
  registeredResolverEvents,
  registeredScannerEntities,
  resolveFields,
  type ScannedRow,
  type ScheduleScanner,
  type TriggerResolver,
} from './resolvers/registry';
export { installBuiltinResolvers } from './resolvers/builtins';

// ── gates ──
export { GLOBAL_GATES, webhookEgressGate } from './gates/builtins';
export { _resetTenantStateCache } from './gates/tenant-state';

// ── action registry + dispatcher ──
export {
  _clearActionRegistry,
  getDescriptor,
  moduleForAction,
  registerAction,
  registeredActionTypes,
} from './actions/registry';
export { installBuiltinActions } from './actions/builtins';
export { dispatch, UnregisteredActionError } from './dispatch/dispatcher';

// ── engine entry points ──
export { dedupeOf } from './engine/idempotency';
export { installBuiltins } from './engine/install';
export { handleTrigger } from './engine/handle-trigger';
export { runAutomationTick, type TickResult } from './engine/run-tick';
export { runScheduleTick, type ScheduleTickResult } from './engine/schedule-tick';

// ── service layer ──
export {
  AutomationNotFoundError,
  cloneAutomation,
  createAutomation,
  deleteAutomation,
  getAutomation,
  listAutomations,
  LockedAutomationError,
  setAutomationStatus,
  updateAutomation,
  upsertSystemAutomation,
  type ListAutomationsFilter,
  type ServiceCtx,
  type SystemAutomationSpec,
} from './service/automation-service';
