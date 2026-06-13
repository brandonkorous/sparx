// Invoicing system-automation seeds (docs/90 §3b). The Managed defaults that ship
// on Invoicing activation. The email-sending dunning seeds (reminder + the three
// overdue notices) land with the template provisioning; this is the no-email
// default — a task when a user-authored document is approved. Partitioned to
// USER workflows (`workflowSlug != 'net-terms-ar'`, the B2B AR substrate) so it
// doesn't double up with the B2B dunning ladder.

import type { SystemAutomationSpec } from '@sparx/automation';

/** When a billing document reaches a committed (customer-approved) stage, open a
 *  task to advance it. Scoped to user-authored workflows, not the B2B AR ledger. */
export const INVOICING_ESTIMATE_APPROVED_TASK: SystemAutomationSpec = {
  name: 'Estimate approved — advance task',
  description:
    'Opens a task to advance the document when a user-authored billing document is approved (reaches a committed stage).',
  trigger: { kind: 'event', eventType: 'crm.billing_document.stage_changed' },
  conditions: {
    logic: 'AND',
    conditions: [
      { field: 'invoice.stageType', operator: 'eq', value: 'committed' },
      { field: 'invoice.workflowSlug', operator: 'neq', value: 'net-terms-ar' },
    ],
  },
  actions: [
    {
      type: 'crm.create_task',
      config: {
        title: 'Advance to next stage — {{invoice.number}}',
        assigneeField: 'invoice.assignedUserId',
        dueInDays: 0,
      },
    },
  ],
  locked: false,
  status: 'active',
};
