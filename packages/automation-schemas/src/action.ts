// Actions — what an automation does, run in sequence (docs/81 §5.4).
//
// Every action is a typed `type` + an opaque `config` bag. Per-action config is
// validated at DISPATCH time against the executing service's contract (the action
// registry in `@sparx/automation`), NOT here — the downstream contract lives with
// the executor, and the engine reaches every effect through the gated dispatcher
// (§7.1). This file owns the durable storage/wire shape only.
//
// Mutating actions call EXISTING services (never re-implement domain logic); bulk
// price/financial mutations route through the established service + the
// `bulk_op_reverts` revert ledger (docs/81 §5.4).

import { z } from 'zod';

export const ActionType = z.enum([
  // Email — always publish email.send / sequence events; never direct-send (except OTP).
  'email.send_campaign',
  'email.send_internal',
  'email.sequence_add',
  'email.sequence_remove',
  // CRM
  'crm.create_task',
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
  // Site forms (docs/115) — route a form.submitted submission. `form.notify` emails
  // the owner/recipients (reply-to the submitter); `form.autoreply` confirms to the
  // submitter. Both self-gate on the form's own toggles + are platform-transactional.
  'form.notify',
  'form.autoreply',
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
]);
