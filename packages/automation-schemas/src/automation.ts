// Automation CRUD input schemas (docs/81 §5, §6).
//
// The tenant-authored shape. NOTE the invariant: `origin`, `locked`, and
// `cloned_from` are NOT settable here — they are system-managed (a tenant cannot
// declare its own rule "system" or "locked"). The seed path (§3.1 Locked/Managed)
// sets those directly through an internal service function, never this input.

import { z } from 'zod';

import { Action } from './action';
import { ConditionGroup, EMPTY_CONDITION_GROUP } from './condition';
import { AutomationStatus } from './run';
import { Trigger } from './trigger';

export const CreateAutomationInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(10_000).nullable().optional(),
  trigger: Trigger,
  conditions: ConditionGroup.default(EMPTY_CONDITION_GROUP),
  actions: z.array(Action).min(1).max(50),
  /** Loop-guard ceiling: how deep a rule→event→rule cascade may go (§7). */
  maxDepth: z.number().int().min(1).max(10).default(3),
});
export type CreateAutomationInput = z.infer<typeof CreateAutomationInput>;

// Update is a partial of the create shape plus a status transition. Tenants drive
// active/paused/draft here; `error` is engine-set. Locked automations reject a
// status change at the service layer (not expressible in the schema alone).
export const UpdateAutomationInput = CreateAutomationInput.partial().extend({
  status: AutomationStatus.optional(),
});
export type UpdateAutomationInput = z.infer<typeof UpdateAutomationInput>;

// "Duplicate to edit" — fork a (typically system/Managed) automation into a new
// user-origin, editable copy. Only the new name is caller-supplied; the engine
// copies trigger/conditions/actions and stamps `cloned_from` + origin='user'.
export const CloneAutomationInput = z.object({
  name: z.string().min(1).max(255).optional(),
});
export type CloneAutomationInput = z.infer<typeof CloneAutomationInput>;
