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

/** Open an onboarding task when a new B2B account is created. Assigned to the
 *  account's rep, falling back to the tenant owner. Managed (no email). */
export const B2B_NEW_ACCOUNT_TASK: SystemAutomationSpec = {
  name: 'New B2B account onboarding task',
  description: 'Opens an onboarding task, due tomorrow, when a B2B account is created.',
  trigger: { kind: 'event', eventType: 'crm.b2b_account.created' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    {
      type: 'crm.create_task',
      config: {
        title: 'Onboard new B2B account — {{b2bAccount.companyName}}',
        assigneeField: 'b2bAccount.assignedRepId',
        dueInDays: 1,
      },
    },
  ],
  locked: false,
  status: 'active',
};

/** Welcome a B2B account the moment it's created — in the self-serve model account
 *  creation IS the "approved" moment (docs/90; the resolver triggers this off
 *  `crm.b2b_account.created`). Addressed to the account's primary contact.
 *  Transactional. */
export const B2B_ACCOUNT_APPROVED: SystemAutomationSpec = {
  name: 'B2B account approved',
  description: 'Emails the account’s primary contact when a B2B account is approved.',
  trigger: { kind: 'event', eventType: 'crm.b2b_account.created' },
  conditions: {
    logic: 'AND',
    conditions: [{ field: 'customer.email', operator: 'is_set' }],
  },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'b2b-account-approved', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

/** Send the quote to the customer when it's submitted for their decision. A
 *  quote is a BillingDocument on the system `b2b-quotes` workflow (the retired
 *  Quote model's consolidation); `quote.stageName` is the finer-grained signal
 *  `stage_changed` needs since several stages share `stageType: 'draft'`.
 *  Transactional. */
export const B2B_QUOTE_RECEIVED: SystemAutomationSpec = {
  name: 'B2B quote received',
  description: 'Emails the customer their quote details when a quote is submitted.',
  trigger: { kind: 'event', eventType: 'crm.billing_document.stage_changed' },
  conditions: {
    logic: 'AND',
    conditions: [
      { field: 'invoice.workflowSlug', operator: 'eq', value: 'b2b-quotes' },
      { field: 'quote.stageName', operator: 'eq', value: 'Submitted' },
      { field: 'customer.email', operator: 'is_set' },
    ],
  },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'b2b-quote-received', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

/** Remind a B2B account three days before a net-terms AR invoice is due. A daily
 *  scan; the exact-day window (`daysUntilDue == 3`) fires it once. Partitioned to
 *  the B2B AR substrate (`net-terms-ar`) so it doesn't overlap the standalone
 *  invoicing reminder. Transactional. */
export const B2B_INVOICE_DUE_NUDGE: SystemAutomationSpec = {
  name: 'B2B invoice due reminder',
  description: 'Emails the account three days before a net-terms invoice is due.',
  trigger: {
    kind: 'schedule',
    schedule: { cadence: 'daily', atMinuteUtc: 0 },
    predicate: {
      entity: 'billing_document',
      where: {
        logic: 'AND',
        conditions: [
          { field: 'invoice.daysUntilDue', operator: 'eq', value: 3 },
          { field: 'invoice.status', operator: 'eq', value: 'unpaid' },
          { field: 'invoice.workflowSlug', operator: 'eq', value: 'net-terms-ar' },
          { field: 'customer.email', operator: 'is_set' },
        ],
      },
    },
  },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'b2b-invoice-due', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

/** Nudge the customer when a submitted-or-quoted quote is within 48h of
 *  expiring. A daily-grain INTERVAL scan over the `quote` scanner (which
 *  already returns b2b-quotes-workflow documents inside the 48h window) —
 *  once-per-entity dedupe sends a single reminder. Excludes a raw, unsent
 *  Draft (never shown to the customer, so never worth an expiry nudge).
 *  Transactional. */
export const B2B_QUOTE_EXPIRING: SystemAutomationSpec = {
  name: 'B2B quote expiring',
  description: 'Emails the customer when a submitted quote is within 48 hours of expiring.',
  trigger: {
    kind: 'schedule',
    schedule: { cadence: 'interval', everyMinutes: 1440 },
    predicate: {
      entity: 'quote',
      where: {
        logic: 'AND',
        conditions: [
          {
            field: 'quote.stageName',
            operator: 'in',
            value: ['Submitted', 'Under Review', 'Quoted'],
          },
          { field: 'customer.email', operator: 'is_set' },
        ],
      },
    },
  },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'b2b-quote-expiring', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

/** Tell the buyer when their pending-approval order is approved (→ placed) by an
 *  approver at their organization (docs/impl transactional-email §4 P3). The event
 *  carries the order, so it resolves through the order source. Transactional. */
export const B2B_ORDER_APPROVED_EMAIL: SystemAutomationSpec = {
  name: 'B2B order approved — email',
  description: 'Emails the buyer when their pending order is approved.',
  trigger: { kind: 'event', eventType: 'b2b.order.approved' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'b2b-order-approved', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

/** Tell the buyer when their pending-approval order is rejected (→ cancelled).
 *  Transactional. */
export const B2B_ORDER_REJECTED_EMAIL: SystemAutomationSpec = {
  name: 'B2B order rejected — email',
  description: 'Emails the buyer when their pending order is not approved.',
  trigger: { kind: 'event', eventType: 'b2b.order.rejected' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'b2b-order-rejected', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};
