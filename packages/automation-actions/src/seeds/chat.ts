// Chat system-automation seeds (docs/90 §3b). The satisfaction-survey seed (email)
// lands with the template provisioning; this is the no-email default — a staff
// alert when a conversation goes unanswered. The `conversation` scanner already
// returns open conversations with no staff reply; the predicate adds the 10-minute
// threshold, and the interval cadence's once-per-entity dedupe fires a single alert.

import type { SystemAutomationSpec } from '@sparx/automation';

/** Alert staff when an open conversation has gone 10 minutes with no staff reply.
 *  The alert prefers the assigned agent's email (`conversation.assignedToEmail`),
 *  falling back to the tenant notify address. Platform-level internal send. */
export const CHAT_NO_RESPONSE_ALERT: SystemAutomationSpec = {
  name: 'Unresponded chat alert',
  description: 'Emails staff when an open chat goes 10 minutes without a reply.',
  trigger: {
    kind: 'schedule',
    // Sub-daily: scan every 5 minutes; the once-per-entity dedupe means each
    // conversation alerts exactly once as it crosses the 10-minute threshold.
    schedule: { cadence: 'interval', everyMinutes: 5 },
    predicate: {
      entity: 'conversation',
      where: {
        logic: 'AND',
        conditions: [
          { field: 'conversation.status', operator: 'eq', value: 'open' },
          { field: 'conversation.minutesSinceCreated', operator: 'gte', value: 10 },
        ],
      },
    },
  },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    {
      type: 'email.send_internal',
      config: {
        toField: 'conversation.assignedToEmail',
        subject: 'Unresponded chat — {{customer.fullName ?? "Anonymous"}}',
      },
    },
  ],
  locked: false,
  status: 'active',
};
