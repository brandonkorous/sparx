// Chat system-automation seeds (docs/90 §3b). Two defaults over the shared
// `conversation` scanner, partitioned by `conversation.status`: a no-email staff
// alert when an OPEN conversation goes unanswered, and a customer satisfaction
// survey after a conversation is RESOLVED. Both use the interval cadence so each
// conversation triggers exactly once (once-per-entity dedupe).

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

/** Ask for feedback after a conversation is resolved. The `conversation` scanner
 *  returns recently-resolved conversations; the predicate keeps only those with an
 *  emailable contact (an anonymous visitor with no captured email is skipped), and
 *  the 10-minute send delay lets the conversation settle first (docs/90 —
 *  `wait(10m)`). Transactional — a post-support survey, not marketing. */
export const CHAT_SATISFACTION_SURVEY: SystemAutomationSpec = {
  name: 'Chat satisfaction survey',
  description: 'Emails the customer a short survey ten minutes after a chat is resolved.',
  trigger: {
    kind: 'schedule',
    schedule: { cadence: 'interval', everyMinutes: 5 },
    predicate: {
      entity: 'conversation',
      where: {
        logic: 'AND',
        conditions: [
          { field: 'conversation.status', operator: 'eq', value: 'resolved' },
          { field: 'customer.email', operator: 'is_set' },
        ],
      },
    },
  },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    {
      type: 'email.send_campaign',
      config: {
        builderEmailKey: 'chat-satisfaction',
        emailType: 'transactional',
        delaySeconds: 600,
      },
    },
  ],
  locked: false,
  status: 'active',
};
