// Module gate — session-coupled half.
//
// The session-FREE primitives (isModuleEnabled / listEnabledModules /
// invalidateModuleCache / ModuleSlug / ModuleDisabledError / moduleDisabledEnvelope)
// moved to @wizeworks/modules so lean backends can probe module flags without the
// auth/email/UI closure. They're re-exported here so every existing
// `@wizeworks/auth` importer keeps working unchanged.
//
// `requireModule` stays here because it takes a SparxSession (locked decision #6:
// one gate function across transports). It just composes `isModuleEnabled`.

import { isModuleEnabled, ModuleDisabledError, type ModuleSlug } from '@wizeworks/modules';

import type { SparxSession } from './session';

export {
  invalidateModuleCache,
  isModuleEnabled,
  listEnabledModules,
  ModuleDisabledError,
  moduleDisabledEnvelope,
  type ModuleSlug,
  // THE closed set of module slugs. Re-exported so nothing downstream keeps its
  // own copy — api-rest's hand-written one fell behind twice, and a slug missing
  // there means the module cannot be turned on at all.
  ALL_MODULES,
  // Dependency graph (BUNDLED_FREE / REQUIRES) + write-side helpers — the module
  // toggle handlers auto-enable paid requirements and block their teardown.
  BUNDLED_FREE,
  REQUIRES,
  requiredModules,
  blockingDependents,
  isModuleFlagOn,
  deriveModuleStates,
  type ModuleEnabledSource,
  // Module-preset contract + pure registry index (the reusable install seam).
  // Re-exported so api-rest / domain packages reach it via their existing
  // @wizeworks/auth dep, without taking a direct @wizeworks/modules dependency.
  ModulePresetRegistry,
  toModulePresetView,
  definePreset,
  type ModulePreset,
  type ModulePresetKind,
  type ModulePresetSummaryChip,
  type ModulePresetInstallResult,
  type ModulePresetView,
  // Industry-starter contract + pure registry index (the second provisioning
  // tier — composes presets across modules). Re-exported on the same dep edge.
  IndustryStarterRegistry,
  starterModules,
  toIndustryStarterView,
  type IndustryStarter,
  type IndustryStarterPresetRef,
  type IndustryStarterView,
} from '@wizeworks/modules';

/** Throws ModuleDisabledError if the session's tenant doesn't have the given
 *  module active. Returns void on success.
 *
 *  Use from Server Actions / Fastify preHandlers — both call this directly with
 *  the resolved session, so the gate is the same function across transports
 *  (locked decision #6). */
export async function requireModule(session: SparxSession, module: ModuleSlug): Promise<void> {
  const enabled = await isModuleEnabled(session.user.tenantId, module);
  if (!enabled) {
    throw new ModuleDisabledError(module, session.user.tenantId);
  }
}
