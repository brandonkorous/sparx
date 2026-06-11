// B2B system-automation seeds (docs/81 §3.1, docs/84 Slice F2).
//
// The dunning ladder as a LOCKED system automation. Locked = system-origin and
// non-disable-able: the tenant sees the full definition and its run history but
// can't switch credit-hold/suspension off (docs/81 §3.1 — "credit-hold
// escalation" is the canonical Locked example). It is the one source of truth for
// the behavior, replacing the b2b-overdue-worker cron (retired in Slice F3).

import type { SystemAutomationSpec } from '@sparx/automation';

export const B2B_OVERDUE_ESCALATION: SystemAutomationSpec = {
  name: 'B2B overdue escalation',
  description:
    'Daily dunning ladder: marks past-due invoices overdue, places an account on credit hold once an invoice is 14 days overdue, and suspends it at 30 days. Locked — the platform owns this credit invariant.',
  trigger: {
    kind: 'schedule',
    // Daily, just after 00:00 UTC. The tick is idempotent within the day
    // (window-scoped dedupe), so the exact minute only sets the earliest fire.
    schedule: { cadence: 'daily', atMinuteUtc: 0 },
    predicate: {
      entity: 'b2b_account',
      // The scan resolves `hasOverdueInvoices` per account; only accounts with an
      // actionable (unpaid-past-due or overdue) invoice enqueue a run.
      where: {
        logic: 'AND',
        conditions: [{ field: 'b2bAccount.hasOverdueInvoices', operator: 'eq', value: true }],
      },
    },
  },
  conditions: { logic: 'AND', conditions: [] },
  // Thresholds left to the executor defaults (14 / 30). A tenant that needs a
  // different cadence clones this into a Managed copy and overrides the config.
  actions: [{ type: 'b2b.escalate_overdue', config: {} }],
  locked: true,
  status: 'active',
};
