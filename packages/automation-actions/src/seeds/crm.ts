// CRM system-automation seeds (docs/90 §3b). The Managed defaults that ship on CRM
// activation. All editable by the tenant (origin=system, locked=false) — they own
// them the moment they're seeded. Three no-email defaults (tag + tasks) plus the
// two email-sending CRM defaults (welcome, win-back) that reference a provisioned
// Builder-email template by `key`; the `email.send_campaign` action's `module:
// 'email'` gate holds those sends until the email module is active (docs/90 §4).

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

/** Send the welcome email the moment a customer record is created (a signup, a
 *  first order, a newsletter subscribe). Transactional — it isn't withheld by a
 *  marketing opt-out, and reaches every new customer with an address. */
export const CRM_WELCOME_NEW_CUSTOMER: SystemAutomationSpec = {
  name: 'Welcome new customers',
  description: 'Sends the welcome email when a new customer is created.',
  trigger: { kind: 'event', eventType: 'crm.customer.created' },
  conditions: {
    logic: 'AND',
    conditions: [{ field: 'customer.email', operator: 'is_set' }],
  },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'welcome-customer', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

/** Win back a customer who has ordered before but has gone quiet for 90+ days. A
 *  daily-grain INTERVAL scan (once-per-entity dedupe) so a lapsed customer gets a
 *  SINGLE nudge as they cross the threshold, not one every day they stay inactive.
 *  Marketing — it respects the unsubscribe/do-not-contact gates. */
export const CRM_WIN_BACK_INACTIVE: SystemAutomationSpec = {
  name: 'Win back inactive customers',
  description:
    'Emails a customer who has ordered before but hasn’t in 90 days. Edit the window or the message on this automation.',
  trigger: {
    kind: 'schedule',
    // Daily-grain interval: fires at 00:00 UTC, deduped once per customer so a
    // long-inactive customer is nudged exactly once (not every day they qualify).
    schedule: { cadence: 'interval', everyMinutes: 1440 },
    predicate: {
      entity: 'customer',
      where: {
        logic: 'AND',
        conditions: [
          { field: 'customer.daysSinceLastOrder', operator: 'gte', value: 90 },
          { field: 'customer.orderCount', operator: 'gt', value: 0 },
          { field: 'customer.email', operator: 'is_set' },
        ],
      },
    },
  },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'win-back', emailType: 'marketing' },
    },
  ],
  locked: false,
  status: 'active',
};

/* ── Intake: turning what arrives into a request (docs/144 §7) ──────────────
 *
 * The Requests queue tells every tenant that requests land there when a customer
 * emails, fills in a form or starts a chat. Two of those three are these seeds;
 * the form path is the always-on `Handle form submissions` automation, which
 * self-gates on each form's own "open a request" toggle.
 *
 * Without these the `crm.create_ticket` action existed and nothing ever called
 * it — the mechanism shipped, the capability did not, and the empty state was
 * making a promise the product did not keep.
 */

/** Inbound email on a connected mailbox opens a request.
 *
 *  Active by default: a customer emailing your support address IS a request, and
 *  a business that connected a mailbox has already said it wants that mail here.
 *
 *  Safe to fire on every inbound message, twice over. The condition drops any
 *  thread that already has a request attached, and beneath it
 *  `ticketService.create` treats (source='email', threadId) as a unique intake
 *  key — so three emails about one problem before anyone replies produce one
 *  request, and an automation retry produces none. The action also links the
 *  thread to the request, so the customer's actual words land ON it rather than
 *  in a mailbox beside it. */
export const CRM_EMAIL_OPENS_REQUEST: SystemAutomationSpec = {
  name: 'Email opens a support request',
  description:
    'When a customer emails a mailbox you have connected, opens a support request with a reply deadline and attaches the conversation to it. One request per email thread, however many messages arrive. Turn this off if you would rather triage your inbox yourself.',
  trigger: { kind: 'event', eventType: 'crm.engagement.received' },
  conditions: {
    logic: 'AND',
    // Already has a request — this is a reply on an open conversation, not a new
    // thing being asked.
    conditions: [{ field: 'engagement.ticketId', operator: 'is_not_set' }],
  },
  actions: [{ type: 'crm.create_ticket', config: { priority: 'medium' } }],
  locked: false,
  status: 'active',
};

/** A live-chat conversation opens a request — SEEDED PAUSED, deliberately.
 *
 *  Unlike email, a chat message is not self-evidently a request: most are
 *  answered in the widget in under a minute and never needed a queue row or a
 *  deadline. On a busy site, on by default would fill the queue with resolved
 *  small talk from the moment CRM was switched on, and the first thing the
 *  feature would teach a business is that the queue is noise.
 *
 *  So it ships built, named and explained, one switch away — the tenant decides,
 *  which is the only party that knows how their chat is actually used. The
 *  dedupe key is the conversation, so turning it on gives one request per
 *  conversation, not per message. */
export const CRM_CHAT_OPENS_REQUEST: SystemAutomationSpec = {
  name: 'Live chat opens a support request',
  description:
    'When someone starts a live chat, opens a support request with a reply deadline and hands it to whoever is already on the conversation. One request per conversation, however many messages are sent. Off until you turn it on — most chats are answered on the spot and do not need to become requests.',
  trigger: { kind: 'event', eventType: 'chat.message.received' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    {
      type: 'crm.create_ticket',
      // Whoever already picked the chat up keeps it; an unresolved assignee
      // leaves it in the unassigned queue, which is where new work belongs.
      config: { priority: 'medium', assigneeField: 'conversation.assignedToId' },
    },
  ],
  locked: false,
  status: 'paused',
};
