// Actions — what an automation does, run in sequence (docs/81 §5.4).
//
// Every action is a typed `type` + an opaque `config` bag. Per-action config is
// validated at DISPATCH time against the executing service's contract (the action
// registry in `@wizeworks/automation`), NOT here — the downstream contract lives with
// the executor, and the engine reaches every effect through the gated dispatcher
// (§7.1). This file owns the durable storage/wire shape only.
//
// Mutating actions call EXISTING services (never re-implement domain logic); bulk
// price/financial mutations route through the established service + the
// `bulk_op_reverts` revert ledger (docs/81 §5.4).

import { z } from 'zod';

import { ConditionGroup, EMPTY_CONDITION_GROUP } from './condition';

export const ActionType = z.enum([
  // Email — always publish email.send / sequence events; never direct-send (except OTP).
  'email.send_campaign',
  'email.send_internal',
  'email.sequence_add',
  'email.sequence_remove',
  // CRM
  'crm.create_task',
  // Workflow depth (docs/144 §9) — the actions that let a rule run a process
  // rather than just announce one. `create_record` writes a row of ANY object,
  // including one the tenant invented; `set_property` writes one field;
  // `rotate_owner` hands work out fairly; `add_to_list` moves someone on or off
  // a hand-picked list.
  'crm.create_record',
  'crm.set_property',
  'crm.rotate_owner',
  'crm.add_to_list',
  // Intake routing (docs/144 §7.4) — a chat, a form or an inbound email becomes
  // a service request. One action for all three: the difference is the trigger,
  // not what happens next.
  'crm.create_ticket',
  'crm.update_deal_stage',
  'crm.add_note',
  'crm.add_tag',
  'crm.remove_tag',
  'crm.update_field',
  // Capture a site-form submitter as a CRM prospect + log their message (docs/115).
  // Reads the triggering submission; self-gates on the form's own "add to CRM" toggle.
  'crm.capture_lead',
  // Texting (docs/151 §8, docs/152 D1). Registered here as well as in the
  // executor, because an action type in one list and not the other typechecks
  // green and then rejects the slug at save time — the same footgun the
  // `inventory` and `finance` module slugs hit (docs/152 §8 #2).
  //
  // It is EXTERNAL AND BILLABLE, unlike every CRM action above it, so the
  // delivery layer enforces consent, STOP suppression, quiet hours and a
  // per-tenant ceiling before any provider call. With no provider credential
  // configured it resolves to the console provider and cannot spend.
  'sms.send',
  // Site forms (docs/115) — route a form.submitted submission. `form.notify` emails
  // the owner/recipients (reply-to the submitter); `form.autoreply` confirms to the
  // submitter. Both self-gate on the form's own toggles + are platform-transactional.
  'form.notify',
  'form.autoreply',
  // A 1:1 email from the record, through the engagement spine (docs/144 §5) —
  // threaded onto the customer's own conversation, governed by do-not-contact,
  // and visible on their timeline. Distinct from `email.send_campaign`, which is
  // marketing to an audience and answers to suppression rather than to a rep.
  'engagement.send_email',
  // A task to call someone back, plus the activity recording why it appeared.
  // Logs; never dials.
  'voice.log_call_task',
  // Commerce
  'commerce.create_invoice',
  'commerce.apply_discount',
  'commerce.update_inventory',
  'commerce.create_order',
  // Inventory — draft a reorder PO to the preferred supplier when a variant goes
  // low (the inventory.low trigger). Find-or-appends into one open draft per
  // (supplier, warehouse) so repeated low events converge, never spam.
  'inventory.draft_reorder_po',
  // B2B
  'b2b.create_quote',
  'b2b.convert_quote',
  'b2b.update_terms',
  // Per-account dunning step: mark the account's past-due invoices overdue and
  // ladder the account (credit-hold → suspend) by oldest-overdue age. The
  // thresholds live in the action config so the Locked seed's definition shows
  // them (docs/81 §3.1, docs/84 Slice F2).
  'b2b.escalate_overdue',
  // Social posting (docs/133 §9) — draft a native social post from the triggering
  // entity (a published product/article, a schedule) into the approval inbox, or
  // straight to scheduled when the automation is set to auto-approve. Calls no
  // platform API itself: it writes a SocialPost + its fan-out targets; the
  // scheduled drain + social-worker publish it, so the module-active gate suffices.
  'social.post',
  // Platform / control flow
  'platform.webhook',
  // In-app notification (docs/124 Phase 3) — write a Notification row for the
  // staff people who should see it. The in-app sibling of `email.send_internal`:
  // same "tell the team" intent, different channel. Notifications live here
  // rather than in a bespoke worker because the engine ALREADY consumes the
  // whole firehose, and because notification rules are then tenant-editable
  // (conditions, quiet hours, who gets told) instead of frozen in code.
  'platform.notify',
  'platform.wait', // durable delay — parks the run via resume_at (§7); config.delaySeconds
  'platform.stop', // end the automation early, log the reason
  // Branching (docs/144 §9) — "if they replied, do this; otherwise do that."
  // Control flow, so the run loop intercepts it before the gated dispatcher and
  // it has no executor. Its config is the ONE action config with a real shape:
  // `IfElseConfig` below.
  'platform.if_else',
]);
export type ActionType = z.infer<typeof ActionType>;

export const Action = z.object({
  type: ActionType,
  /**
   * Per-action parameters. Shape is action-specific and validated by the action
   * registry at dispatch time. For `platform.wait`, `config.delaySeconds` is the
   * durable delay; for `platform.stop`, `config.reason`.
   */
  config: z.record(z.string(), z.unknown()).default({}),
});
export type Action = z.infer<typeof Action>;

/** Action types that produce an external/side effect (vs. pure control flow). */
export const CONTROL_FLOW_ACTIONS: ReadonlySet<ActionType> = new Set([
  'platform.wait',
  'platform.stop',
  'platform.if_else',
]);

// ─── Branching (docs/144 §9) ─────────────────────────────────────────────────
//
// WHY THE NESTED LISTS LIVE IN AN OPAQUE `config` RATHER THAN IN `Action` ITSELF.
//
// The obvious move is to make `Action` a union whose branch arm carries
// `Action[]` — three explicit finite levels, exactly the technique `ConditionGroup`
// uses. It was rejected for the same reason that technique exists: the schema is
// converted to JSON Schema for REST validation AND for MCP tool registration, and
// a three-level union of objects each holding two arrays of the level below
// produces a tool schema several times the size of the entire rest of the
// automation contract — for a field most rules never use. Keeping `config` a flat
// record leaves the wire shape, the stored shape and every generated schema
// EXACTLY as they were before branching existed.
//
// The cost is that the branch payload is not validated by `Action.parse`. That is
// paid explicitly: `IfElseConfig` below is the parser, `validateActionTree` runs
// it over the whole authored list at the create/update boundary, and the compiler
// parses it AGAIN at run time — because a row written before a schema change, or
// by a direct DB touch, must fail loudly rather than branch arbitrarily.

/** How deep branches may nest: the root list plus two levels of `if_else`.
 *  Matches MAX_CONDITION_DEPTH, and for the same reason — deeper than this
 *  cannot be read on a canvas, by the author or by anyone after them. */
export const MAX_ACTION_DEPTH = 3;

/** Ceiling on the actions inside ONE branch arm. The root list allows 50; a
 *  single arm is capped lower so a branching rule cannot smuggle 100 actions
 *  past the root limit. */
export const MAX_BRANCH_ACTIONS = 25;

/**
 * The shape of a `platform.if_else` action's config.
 *
 * `otherwise` is a real, first-class list rather than an optional afterthought:
 * "and if not, do nothing" is a legitimate rule, and an empty array says it in
 * the same vocabulary as any other branch.
 */
export const IfElseConfig = z.object({
  /** The question being asked, in the same vocabulary as a rule's own
   *  conditions — one filter language for the whole engine. */
  condition: ConditionGroup.default(EMPTY_CONDITION_GROUP),
  /** What to do when the answer is yes. */
  then: z.array(Action).max(MAX_BRANCH_ACTIONS).default([]),
  /** What to do when it is no. Empty = nothing; the rule continues after. */
  otherwise: z.array(Action).max(MAX_BRANCH_ACTIONS).default([]),
  /** Optional author's note ("did they book a call?") shown on the canvas
   *  instead of a rendering of the condition tree. */
  label: z.string().trim().max(120).optional(),
});
export type IfElseConfig = z.infer<typeof IfElseConfig>;

/** Parse a branch action's config, or throw. Used by the compiler, where an
 *  unparseable branch must fail the run rather than pick an arm. */
export function parseIfElse(config: unknown): IfElseConfig {
  return IfElseConfig.parse(config ?? {});
}

export interface ActionTreeIssue {
  /** Dotted position in the authored tree, e.g. `2.then.0`. */
  path: string;
  message: string;
}

/**
 * Validate an authored action list: branch configs parse, and nesting stays
 * within `MAX_ACTION_DEPTH`.
 *
 * Returns issues rather than throwing so the create/update schemas can attach
 * them to the right field and the editor can point at the offending step.
 */
export function validateActionTree(actions: unknown, depth = 1, prefix = ''): ActionTreeIssue[] {
  if (!Array.isArray(actions)) return [{ path: prefix || 'actions', message: 'expected a list' }];

  const issues: ActionTreeIssue[] = [];
  actions.forEach((raw, index) => {
    const at = prefix === '' ? String(index) : `${prefix}.${String(index)}`;
    const node = raw as { type?: unknown; config?: unknown };
    if (node.type !== 'platform.if_else') return;

    if (depth >= MAX_ACTION_DEPTH) {
      issues.push({
        path: at,
        message: `branches can only nest ${String(MAX_ACTION_DEPTH - 1)} deep — move this into its own rule`,
      });
      return;
    }

    const parsed = IfElseConfig.safeParse(node.config ?? {});
    if (!parsed.success) {
      issues.push({ path: at, message: parsed.error.issues[0]?.message ?? 'invalid branch' });
      return;
    }
    issues.push(...validateActionTree(parsed.data.then, depth + 1, `${at}.then`));
    issues.push(...validateActionTree(parsed.data.otherwise, depth + 1, `${at}.otherwise`));
  });
  return issues;
}

/** Total number of actions in a tree, branches included — what the authoring UI
 *  shows as "12 steps" and what a step budget would count. */
export function countActions(actions: Action[]): number {
  return actions.reduce((total, action) => {
    if (action.type !== 'platform.if_else') return total + 1;
    const branch = IfElseConfig.safeParse(action.config);
    if (!branch.success) return total + 1;
    return total + 1 + countActions(branch.data.then) + countActions(branch.data.otherwise);
  }, 0);
}
