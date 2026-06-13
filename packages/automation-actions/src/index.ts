// @sparx/automation-actions — the module-effect composition root (docs/84 Slice F).
//
// The engine (`@sparx/automation`) stays lean: it knows the gated dispatcher and
// the `registerAction` seam but depends on NO module service. This package is
// where the seam is filled — it imports the module services and registers an
// executor per action type. The automation-worker calls `installModuleActions()`
// at boot, alongside the engine's `installBuiltins()`.
//
// As email / commerce / b2b executors land, add their `installXActions()` here.

export { installCrmActions } from './crm.js';
export { installB2bActions } from './b2b.js';
export { installEmailActions } from './email.js';
export { installEntityResolvers } from './resolvers.js';
export { seedSystemAutomations, SYSTEM_AUTOMATIONS } from './seeds/index.js';
export {
  reconcileSystemSeeds,
  type ReconcileSummary,
  type ReconcileModuleResult,
} from './seeds/reconcile.js';

import { installB2bActions } from './b2b.js';
import { installCrmActions } from './crm.js';
import { installEmailActions } from './email.js';
import { installEntityResolvers } from './resolvers.js';

/** Register every module action executor + entity resolver/scanner (idempotent). */
export function installModuleActions(): void {
  installCrmActions();
  installB2bActions();
  installEmailActions();
  installEntityResolvers();
  // installCommerceActions(); — Slice F (commerce.*)
}
