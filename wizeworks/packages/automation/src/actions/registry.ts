// Action registry (docs/81 §5.4, §7.1#2).
//
// Every action type the engine can execute is registered here as an
// `ActionDescriptor` carrying its executor AND its gate manifest. Registration
// ENFORCES the manifest declaration: an empty `gates` array is allowed but only
// with a justifying `manifestNote` — a descriptor that declares neither fails
// registration. This is the structural guarantee that no action reaches an
// effect without having passed through (and declared) the gate layer.
//
// Module-owned executors (crm.*, commerce.*, b2b.*) that need their service
// package register through this same seam where the engine is wired with those
// deps (the worker / seed path), keeping this package lean.

import type { ActionType } from '@wizeworks/automation-schemas';

import type { ActionDescriptor } from '../engine-types';

const registry = new Map<ActionType, ActionDescriptor>();

export function registerAction(descriptor: ActionDescriptor): void {
  if (!Array.isArray(descriptor.gates)) {
    throw new Error(`action "${descriptor.type}": gate manifest is required (use [] with a note)`);
  }
  if (descriptor.gates.length === 0 && descriptor.manifestNote.trim() === '') {
    throw new Error(
      `action "${descriptor.type}": an empty gate manifest must carry a justifying manifestNote (§7.1#2)`
    );
  }
  if (registry.has(descriptor.type)) {
    throw new Error(`action "${descriptor.type}" is already registered`);
  }
  registry.set(descriptor.type, descriptor);
}

export function getDescriptor(type: ActionType): ActionDescriptor | undefined {
  return registry.get(type);
}

/** The owning module slug for an action (used by the module-active global gate). */
export function moduleForAction(type: ActionType): string | null {
  return registry.get(type)?.module ?? null;
}

export function registeredActionTypes(): ActionType[] {
  return [...registry.keys()];
}

/** Test hook — drop registrations between suites so install is deterministic. */
export function _clearActionRegistry(): void {
  registry.clear();
}
