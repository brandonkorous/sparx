// System-automation seed catalog (docs/81 §3.1, docs/84 Slice F2).
//
// The Locked / Managed behaviors that ship turned on for every tenant. Each is a
// real row in `automations` (origin='system'), installed through the service's
// idempotent `upsertSystemAutomation` (matched on origin + name). They are NOT a
// parallel runtime — the engine runs them like any tenant automation; this module
// just declares the defaults.
//
// Wiring: `seedSystemAutomations(ctx)` runs on tenant provisioning and on module
// activation, so a tenant that enables a module later still gets its defaults. It
// is safe to re-run.

import type { Automation } from '@prisma/client';
import {
  upsertSystemAutomation,
  type ServiceCtx,
  type SystemAutomationSpec,
} from '@sparx/automation';

import { B2B_OVERDUE_ESCALATION } from './b2b.js';

/** A seed plus the module whose activation installs it. `module: null` ⇒ always
 *  seeded (platform-level, no owning module). */
export interface SystemAutomationSeed {
  module: string | null;
  spec: SystemAutomationSpec;
}

/** Every platform-seeded system automation. Append here as behaviors land. */
export const SYSTEM_AUTOMATIONS: readonly SystemAutomationSeed[] = [
  { module: 'b2b', spec: B2B_OVERDUE_ESCALATION },
];

/**
 * Idempotently install system automations for one tenant. Each spec upserts by
 * (origin='system', name), so re-running updates in place — safe on every
 * provisioning + `module.activated` event.
 *
 * Pass `opts.module` (the just-activated slug) to install ONLY that module's
 * seeds — a tenant that enables B2B shouldn't get a clutter of other modules'
 * automations. Omit it (the backfill path) to install the whole catalog.
 */
export async function seedSystemAutomations(
  ctx: ServiceCtx,
  opts: { module?: string } = {}
): Promise<Automation[]> {
  const installed: Automation[] = [];
  for (const seed of SYSTEM_AUTOMATIONS) {
    if (opts.module && seed.module !== null && seed.module !== opts.module) continue;
    installed.push(await upsertSystemAutomation(ctx, seed.spec));
  }
  return installed;
}
