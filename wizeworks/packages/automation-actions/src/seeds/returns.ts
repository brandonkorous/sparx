// Returns / RMA email seeds (docs/impl transactional-email §4 P3).
//
// Each fires on a `return.*` event — the built-in resolver hydrates the return + its
// order + customer, so `customer.email` (recipient + `is_set` guard) and the order
// refs resolve — and sends the matching provisioned Builder email by key. All
// transactional, owned by the `commerce` module (returns ship with it), held by the
// `email.send_campaign` action's `module:'email'` gate until email is active.

import type { SystemAutomationSpec } from '@wizeworks/automation';

export const RETURN_APPROVED_EMAIL: SystemAutomationSpec = {
  key: 'returns.approved-email',
  name: 'Return approved: email',
  previousNames: ['Return approved — email'],
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
  key: 'returns.received-email',
  name: 'Return received: email',
  previousNames: ['Return received — email'],
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
  key: 'returns.refunded-email',
  name: 'Return refunded: email',
  previousNames: ['Return refunded — email'],
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

// The two ENDINGS that used to reach nobody.
//
// A return finishes in one of three ways — the money goes back, a replacement
// goes out, or the answer is no — and only the first sent anything. So the
// "we've received your return" email above, which ends by promising *"we'll
// email you again the moment your exchange is on its way"*, kept that promise
// for a refund and broke it for every swap; and the console's "Turn down this
// return" box said *"they are told the reason you give here"* while nothing told
// them anything (persona issue 448).

export const RETURN_EXCHANGED_EMAIL: SystemAutomationSpec = {
  key: 'returns.replacement-sent-email',
  name: 'Replacement sent: email',
  previousNames: ['Replacement sent — email'],
  description: 'Emails the customer when the replacement for their swap goes out.',
  trigger: { kind: 'event', eventType: 'return.exchanged' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'return-exchanged', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

// The tracking number, sent the moment it exists.
//
// Only fires when the parcel was posted AFTER the swap was settled, which is the
// ordinary way round. A swap settled with the number already in hand carries it
// in the email above and never reaches here, so a customer gets one email about
// their replacement, never two.
export const RETURN_REPLACEMENT_SHIPPED_EMAIL: SystemAutomationSpec = {
  key: 'returns.replacement-tracking-email',
  name: 'Replacement tracking: email',
  previousNames: ['Replacement tracking — email'],
  description: 'Emails the customer the tracking number when the replacement is posted.',
  trigger: { kind: 'event', eventType: 'return.replacement_shipped' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'return-replacement-shipped', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

export const RETURN_DENIED_EMAIL: SystemAutomationSpec = {
  key: 'returns.denied-email',
  name: 'Return turned down: email',
  previousNames: ['Return turned down — email'],
  description: 'Emails the customer the reason when a return is not accepted.',
  trigger: { kind: 'event', eventType: 'return.denied' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'return-denied', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};
