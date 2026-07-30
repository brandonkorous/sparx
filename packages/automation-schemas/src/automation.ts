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
  /**
   * WHICH SITE this rule acts on (docs/131 §3.1). Null/omitted = tenant-wide,
   * running on every site's events.
   *
   * A tenant running two unrelated businesses needs rules that never cross: an
   * `order.placed` follow-up written for a donut shop must not fire on a machine
   * shop's orders, with the donut shop's templates and products in its actions.
   *
   * The AUTHORING UI should default this to the site being worked in rather than
   * to null — tenant-wide is the wider blast radius, and the wider option should
   * be chosen deliberately, not received by omission. The schema keeps it
   * optional because a genuinely tenant-wide rule is a real thing and because the
   * system/seed path creates rules before any site is in context.
   */
  propertyId: z.string().uuid().nullable().optional(),
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
// `conditions` and `maxDepth` are re-declared without their create-defaults: a
// `.default()` survives `.partial()`, and the service writes every key that
// isn't undefined — so renaming an automation RESET ITS CONDITIONS to the empty
// group, which is the difference between "email customers who spent over $500"
// and "email everyone".
export const UpdateAutomationInput = CreateAutomationInput.partial().extend({
  status: AutomationStatus.optional(),
  conditions: ConditionGroup.optional(),
  maxDepth: z.number().int().min(1).max(10).optional(),
});
export type UpdateAutomationInput = z.infer<typeof UpdateAutomationInput>;

// "Duplicate to edit" — fork a (typically system/Managed) automation into a new
// user-origin, editable copy. Only the new name is caller-supplied; the engine
// copies trigger/conditions/actions and stamps `cloned_from` + origin='user'.
export const CloneAutomationInput = z.object({
  name: z.string().min(1).max(255).optional(),
});
export type CloneAutomationInput = z.infer<typeof CloneAutomationInput>;

// ─── Versioning (docs/84 Slice G-versioning) ─────────────────────────────────

/**
 * The staged, unpublished edit document held in the `automations.draft` JSONB
 * column (null = no pending draft). Stored in the same COLUMN-FORM as the live
 * row (trigger split into type + config), so publish is a straight copy and the
 * dashboard parses it back with the same trigger/condition/action parsers — no
 * drift. The JSON sub-parts stay `unknown` here exactly as they are on the wire
 * DTO; they are validated by the canonical parsers when read.
 */
export interface AutomationDraft {
  name: string;
  description: string | null;
  triggerType: string;
  triggerConfig: unknown;
  conditions: unknown;
  actions: unknown;
  maxDepth: number;
}

/** Publish the staged draft as the next live version. An optional one-line note
 *  ("what changed") is recorded on the immutable snapshot. */
export const PublishAutomationInput = z.object({
  note: z.string().max(500).optional(),
});
export type PublishAutomationInput = z.infer<typeof PublishAutomationInput>;

/** Restore a prior version — copies that snapshot back into the `draft` (the
 *  tenant reviews, then publishes, which appends a NEW version). */
export const RestoreAutomationVersionInput = z.object({
  version: z.number().int().positive(),
});
export type RestoreAutomationVersionInput = z.infer<typeof RestoreAutomationVersionInput>;
