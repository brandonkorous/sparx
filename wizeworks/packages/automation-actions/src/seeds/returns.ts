// Returns / RMA email seeds (docs/impl transactional-email §4 P3).
//
// Each fires on a `return.*` event — the built-in resolver hydrates the return + its
// order + customer, so `customer.email` (recipient + `is_set` guard) and the order
// refs resolve — and sends the matching provisioned Builder email by key. All
// transactional, owned by the `commerce` module (returns ship with it), held by the
// `email.send_campaign` action's `module:'email'` gate until email is active.

import type { SystemAutomationSpec } from '@wizeworks/automation';

export const RETURN_APPROVED_EMAIL: SystemAutomationSpec = {
  name: 'Return approved — email',
  description: 'Emails the customer when their return is approved, with next steps.',
  trigger: { kind: 'event', eventType: 'return.approved' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'return-approved', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

export const RETURN_RECEIVED_EMAIL: SystemAutomationSpec = {
  name: 'Return received — email',
  description: 'Emails the customer when their returned items arrive back.',
  trigger: { kind: 'event', eventType: 'return.received' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'return-received', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

export const RETURN_REFUNDED_EMAIL: SystemAutomationSpec = {
  name: 'Return refunded — email',
  description: 'Emails the customer when a refund is issued for their return.',
  trigger: { kind: 'event', eventType: 'return.refunded' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'return-refunded', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};
