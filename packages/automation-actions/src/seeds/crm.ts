// CRM system-automation seeds (docs/90 §3b). The Managed defaults that ship on CRM
// activation. All editable by the tenant (origin=system, locked=false) — they own
// them the moment they're seeded. The email-sending CRM seeds (welcome, win-back)
// land once the default Builder-email templates are provisioned + the send-by-key
// join exists; these three are the no-email CRM defaults (tag + tasks).

import type { SystemAutomationSpec } from '@sparx/automation';

/** Tag a customer `vip` once their lifetime spend crosses the default threshold.
 *  A daily scan (not an event) so it's reliable regardless of which write moved the
 *  total; the `tags not_contains 'vip'` predicate drops a customer out of the scan
 *  the moment they're tagged, so each fires exactly once. The 1000 default is the
 *  ADR's `vipThreshold ?? 1000` — a tenant edits this Managed copy to change it. */
export const CRM_AUTO_TAG_VIP: SystemAutomationSpec = {
  name: 'Tag VIP customers',
  description:
    'Tags a customer “vip” once their lifetime spend reaches $1,000. Edit the threshold or the tag on this automation.',
  trigger: {
    kind: 'schedule',
    schedule: { cadence: 'daily', atMinuteUtc: 0 },
    predicate: {
      entity: 'customer',
      where: {
        logic: 'AND',
        conditions: [
          { field: 'customer.totalSpent', operator: 'gte', value: 1000 },
          { field: 'customer.tags', operator: 'not_contains', value: 'vip' },
        ],
      },
    },
  },
  conditions: { logic: 'AND', conditions: [] },
  actions: [{ type: 'crm.add_tag', config: { tags: ['vip'] } }],
  locked: false,
  status: 'active',
};

/** Open a follow-up task when a new deal is created in an open stage. The task is
 *  assigned to the deal's rep (falling back to the tenant owner when unassigned). */
export const CRM_NEW_LEAD_FOLLOW_UP_TASK: SystemAutomationSpec = {
  name: 'New lead follow-up task',
  description: 'Creates a follow-up task, due tomorrow, when a deal is created in an open stage.',
  trigger: { kind: 'event', eventType: 'crm.deal.created' },
  conditions: {
    logic: 'AND',
    conditions: [{ field: 'deal.stageType', operator: 'eq', value: 'open' }],
  },
  actions: [
    {
      type: 'crm.create_task',
      config: {
        title: 'Follow up — {{deal.name}}',
        assigneeField: 'deal.assignedRepId',
        dueInDays: 1,
      },
    },
  ],
  locked: false,
  status: 'active',
};

/** When a deal moves to a won stage, open a task to create the invoice (the
 *  cross-module bridge to invoicing). Assigned to the deal's rep. */
export const CRM_DEAL_WON_INVOICE_TASK: SystemAutomationSpec = {
  name: 'Deal won — create invoice task',
  description: 'Opens a task to create the invoice when a deal is marked won.',
  trigger: { kind: 'event', eventType: 'crm.deal.stage_changed' },
  conditions: {
    logic: 'AND',
    conditions: [{ field: 'deal.stageType', operator: 'eq', value: 'won' }],
  },
  actions: [
    {
      type: 'crm.create_task',
      config: {
        title: 'Create invoice — {{deal.name}}',
        assigneeField: 'deal.assignedRepId',
        dueInDays: 1,
      },
    },
  ],
  locked: false,
  status: 'active',
};
