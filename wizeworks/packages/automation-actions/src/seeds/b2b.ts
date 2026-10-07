// B2B system-automation seeds (docs/81 §3.1, docs/84 Slice F2).
//
// The dunning ladder as a LOCKED system automation. Locked = system-origin and
// non-disable-able: the tenant sees the full definition and its run history but
// can't switch credit-hold/suspension off (docs/81 §3.1 — "credit-hold
// escalation" is the canonical Locked example). It is the one source of truth for
// the behavior, replacing the b2b-overdue-worker cron (retired in Slice F3).

import type { SystemAutomationSpec } from '@wizeworks/automation';
import { ACCOUNT_SET_UP_TO_DO } from '@wizeworks/crm';

export const B2B_OVERDUE_ESCALATION: SystemAutomationSpec = {
  key: 'b2b.chase-overdue-invoices',
  name: 'Chase overdue wholesale invoices',
  previousNames: ['B2B overdue escalation'],
  description:
    'Daily dunning ladder: marks past-due invoices overdue, places an account on credit hold once an invoice is 14 days overdue, and suspends it at 30 days. Locked, the platform owns this credit invariant.',
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

/** Tell the business when the late-payment ladder above stops a customer
 *  ordering: a notice in the owners' bell that opens the account.
 *
 *  The ladder suspended O'Malley Ranch the morning a 40-day-old bill was moved
 *  in, and nothing said so: no task, nothing in the bell, and the account page
 *  read "Suspended" over help text about credit holds. The ladder published
 *  `b2b.account.suspended` and nothing listened (sparx persona issue 101).
 *  Suspension is lifted by hand once they have paid (docs/10 §9), so the notice
 *  says how. A credit hold gets the same, in its own words. A notice and not a
 *  task: it reports what happened, and a task would stay open after the account
 *  is opened again. Managed. */
export const B2B_ACCOUNT_SUSPENDED_NOTICE: SystemAutomationSpec = {
  key: 'b2b.account-suspended-notice',
  name: 'Wholesale customer suspended: tell me',
  description:
    'Tells you when a wholesale customer is suspended for paying late, so you know they cannot order and can open them again once they have paid.',
  trigger: { kind: 'event', eventType: 'b2b.account.suspended' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    {
      type: 'platform.notify',
      config: {
        kind: 'b2b.account.suspended',
        audience: 'owners',
        severity: 'danger',
        module: 'b2b',
        title:
          '{{b2bAccount.companyName}} can no longer order: a bill is {{b2bAccount.overdueDays}} days late',
        body: 'Once they have paid, open their account and set Standing back to Open for orders.',
        entityType: 'b2b_account',
        entityId: '{{b2bAccount.id}}',
      },
    },
  ],
  locked: false,
  status: 'active',
};

export const B2B_ACCOUNT_CREDIT_HOLD_NOTICE: SystemAutomationSpec = {
  key: 'b2b.account-credit-hold-notice',
  name: 'Wholesale customer on credit hold: tell me',
  description:
    'Tells you when a wholesale customer is put on credit hold for paying late, so you know new orders on account are stopped.',
  trigger: { kind: 'event', eventType: 'b2b.account.credit_hold' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    {
      type: 'platform.notify',
      config: {
        kind: 'b2b.account.credit_hold',
        audience: 'owners',
        severity: 'warning',
        module: 'b2b',
        title:
          '{{b2bAccount.companyName}} is on credit hold: a bill is {{b2bAccount.overdueDays}} days late',
        body: 'New orders on account are stopped. Chase the bill, or open their account and set Standing back to Open for orders.',
        entityType: 'b2b_account',
        entityId: '{{b2bAccount.id}}',
      },
    },
  ],
  locked: false,
  status: 'active',
};

/** Open a set-up task when a new wholesale customer is added. Assigned to their
 *  rep, falling back to the tenant owner. Managed (no email).
 *
 *  The task names the WORK, not the record: a customer created this way has no
 *  credit limit, and `credit_limit` is `NOT NULL DEFAULT 0`, so until somebody
 *  sets one they are refused at checkout on every order placed on terms
 *  (issue 807). "Set up prices and terms" is that job. */
export const B2B_NEW_ACCOUNT_TASK: SystemAutomationSpec = {
  key: 'b2b.new-account-setup-task',
  name: 'New wholesale customer: set-up task',
  previousNames: ['New B2B account onboarding task'],
  description:
    'Opens a task to set up prices and terms, due tomorrow, when a wholesale customer is added without them. The task closes itself once they are set.',
  trigger: { kind: 'event', eventType: 'crm.b2b_account.created' },
  // Only when the job is still to do: no terms chosen, or terms with no credit
  // limit to order against. Gillett added five accounts with their tier, terms
  // and limit already set, and got five open tasks to "set up prices and terms"
  // (sparx persona issue 080). "Pay before dispatch" needs no limit.
  //
  // The rule lives in @wizeworks/crm-schemas, not here, because the task closes
  // itself by the SAME rule once the business sets the account up: Wasatch
  // Front's stayed open after it was put on Net 30 with a $25,000 limit.
  conditions: ACCOUNT_SET_UP_TO_DO,
  actions: [
    {
      type: 'crm.create_task',
      config: {
        title: 'Set up prices and terms for {{b2bAccount.companyName}}',
        assigneeField: 'b2bAccount.assignedRepId',
        dueInDays: 1,
        // Linked to the account, and closed, done, by whatever saves its terms
        // and limit once the rule above is no longer true, with a line saying
        // what was set and by whom.
        closeWhenAccountSetUp: true,
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
  key: 'b2b.welcome-new-account',
  name: 'Welcome a new wholesale customer',
  previousNames: ['B2B account approved'],
  description: 'Emails their main contact when a wholesale customer is approved to start ordering.',
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
  key: 'b2b.quote-received-email',
  name: 'Quote received: email the customer',
  previousNames: ['B2B quote received'],
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

/** Email an invoice issued on an account's terms to the buyer, the moment it is
 *  issued: at checkout, from an accepted quote, or when a held order is signed
 *  off. The /b2b page promises "orders on terms invoice automatically with the
 *  buyer's PO number", and the invoice was written and then sat there: only the
 *  business's Send button ever sent one (sparx persona issue 085). Sends the SAME
 *  email that button does. Skips a document already sent by hand. Transactional.
 *
 *  (This slot held "Quote accepted: turn it into an order", a task that asked the
 *  business to do by hand what accepting now does by itself. It never shipped.) */
export const B2B_INVOICE_ISSUED_EMAIL: SystemAutomationSpec = {
  key: 'b2b.invoice-issued-email',
  name: 'Invoice on terms: email it to the buyer',
  description:
    'Emails a wholesale invoice to the buyer as soon as it is issued, with their PO number and a link to print or save it.',
  trigger: { kind: 'event', eventType: 'b2b.invoice.created' },
  conditions: {
    logic: 'AND',
    conditions: [{ field: 'invoice.sentAt', operator: 'is_not_set' }],
  },
  actions: [{ type: 'b2b.send_invoice', config: {} }],
  locked: false,
  status: 'active',
};

/** A wholesale order is waiting for somebody to sign it off: over a spending
 *  limit, or past the account's credit limit. Checkout and an accepted quote
 *  both hold one, and announced it to nobody: it sat in Approvals until somebody
 *  happened to look (sparx persona issue 085). */
export const B2B_ORDER_HELD_TASK: SystemAutomationSpec = {
  key: 'b2b.order-held-sign-off-task',
  name: 'Wholesale order waiting: sign it off',
  description:
    'Opens a task when a wholesale order is held for sign-off, so it is approved or rejected rather than left waiting.',
  trigger: { kind: 'event', eventType: 'b2b.order.pending_approval' },
  // Only when the business is asked. A spending limit the account signs off is
  // the buyer's own approver's to answer on the site, and a task telling the
  // business to sign an order its Approve button refuses is a chore nobody can
  // do (sparx persona issue 087). An old event with no `asks` resolves as asking
  // the business, so nothing that used to open a task stops.
  conditions: {
    logic: 'AND',
    conditions: [{ field: 'approval.asksBusiness', operator: 'eq', value: true }],
  },
  actions: [
    {
      type: 'crm.create_task',
      config: {
        title:
          'Order {{order.number}} from {{customer.fullName}} is waiting for your sign-off: approve or reject it under Approvals',
        dueInDays: 0,
        // The task is true only while the order waits. The account's approver
        // approved O-000014 on the site, the order was placed, and this task
        // stayed open telling the business to sign it. Now whatever answers
        // the order (approved or turned down on either side, or canceled)
        // closes the task and says who did it.
        closeWhenOrderLeaves: 'pending_approval',
      },
    },
  ],
  locked: false,
  status: 'active',
};

/** A wholesale order is waiting for the account's own approver: the spending
 *  limit it went over is one the account signs off. Emails every approver at
 *  the account who did not place it, with the order and one button to it on the
 *  site, where they approve it or turn it down.
 *
 *  Gillett put Teodora on the Wasatch account as "Can approve orders", Renée's
 *  order went over the limit, and Teodora was never told: the role did nothing
 *  (sparx persona issue 087). Transactional. */
export const B2B_ORDER_ASK_ACCOUNT_APPROVERS: SystemAutomationSpec = {
  key: 'b2b.order-held-ask-account-approvers',
  name: 'Wholesale order waiting: ask their approvers',
  description:
    'Emails the people who can approve orders at a wholesale customer when one of their orders goes over a spending limit they sign off.',
  trigger: { kind: 'event', eventType: 'b2b.order.pending_approval' },
  conditions: {
    logic: 'AND',
    conditions: [{ field: 'approval.asksAccount', operator: 'eq', value: true }],
  },
  actions: [{ type: 'b2b.ask_account_approvers', config: {} }],
  locked: false,
  status: 'active',
};

/** Remind a B2B account three days before a net-terms AR invoice is due. A daily
 *  scan; the exact-day window (`daysUntilDue == 3`) fires it once. Partitioned to
 *  the B2B AR substrate (`net-terms-ar`) so it doesn't overlap the standalone
 *  invoicing reminder. Transactional. */
export const B2B_INVOICE_DUE_NUDGE: SystemAutomationSpec = {
  key: 'b2b.invoice-due-reminder',
  name: 'Remind before a wholesale invoice is due',
  previousNames: ['B2B invoice due reminder'],
  description: 'Emails a wholesale customer three days before an invoice on terms falls due.',
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
  key: 'b2b.quote-expiring-warning',
  name: 'Warn before a quote runs out',
  previousNames: ['B2B quote expiring'],
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
  key: 'b2b.order-approved-email',
  name: 'Wholesale order approved: email the buyer',
  previousNames: ['B2B order approved: email', 'B2B order approved — email'],
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
  key: 'b2b.order-rejected-email',
  name: 'Wholesale order turned down: email the buyer',
  previousNames: ['B2B order rejected: email', 'B2B order rejected — email'],
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
