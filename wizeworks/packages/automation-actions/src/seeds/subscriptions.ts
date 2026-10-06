// Commerce subscription lifecycle email seeds (docs/impl transactional-email §4 P2).
//
// Auto-ship recurring commerce. Each fires on a `subscription.*` event — the
// built-in resolver (wizeworks/packages/automation/src/resolvers/builtins.ts) hydrates the
// subscription + its customer, so `customer.email` (the recipient + the `is_set`
// guard) and the `subscription.id` ref resolve — and sends the matching provisioned
// Builder email by key. All transactional (a marketing unsubscribe never withholds a
// "your payment failed"), owned by the `commerce` module (subscriptions ship with it),
// and held by the `email.send_campaign` action's own `module:'email'` gate until email
// is active.

import type { SystemAutomationSpec } from '@wizeworks/automation';

// Every subscription email only sends to a customer with an address on file
// (`customer.email is_set`), inlined per seed to match the other seed files.

export const SUBSCRIPTION_CONFIRMED_EMAIL: SystemAutomationSpec = {
  key: 'subscriptions.confirmed-email',
  name: 'Subscription confirmed: email',
  previousNames: ['Subscription confirmed — email'],
  description: 'Emails the customer when a new subscription starts.',
  trigger: { kind: 'event', eventType: 'subscription.created' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'subscription-confirmed', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

export const SUBSCRIPTION_RENEWED_EMAIL: SystemAutomationSpec = {
  key: 'subscriptions.renewed-email',
  name: 'Subscription renewed: email',
  previousNames: ['Subscription renewed — email'],
  description: 'Emails the customer when their subscription renews and reorders.',
  trigger: { kind: 'event', eventType: 'subscription.renewed' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'subscription-renewed', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

export const SUBSCRIPTION_PAYMENT_FAILED_EMAIL: SystemAutomationSpec = {
  key: 'subscriptions.payment-failed-email',
  name: 'Subscription payment failed: email',
  previousNames: ['Subscription payment failed — email'],
  description: 'Emails the customer when a subscription renewal payment fails, so they can fix it.',
  trigger: { kind: 'event', eventType: 'subscription.payment_failed' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'subscription-payment-failed', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

export const SUBSCRIPTION_AUTHENTICATION_REQUIRED_EMAIL: SystemAutomationSpec = {
  key: 'subscriptions.authentication-required-email',
  name: 'Subscription payment needs confirming: email',
  previousNames: ['Subscription payment needs confirming — email'],
  description:
    'Emails the customer when their bank asks them to confirm a renewal payment, so a good card is not mistaken for a failed one.',
  trigger: { kind: 'event', eventType: 'subscription.authentication_required' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: {
        builderEmailKey: 'subscription-authentication-required',
        emailType: 'transactional',
      },
    },
  ],
  locked: false,
  status: 'active',
};

export const SUBSCRIPTION_INVOICE_EMAIL: SystemAutomationSpec = {
  key: 'subscriptions.invoice-email',
  name: 'Subscription invoice: email',
  previousNames: ['Subscription invoice — email'],
  description:
    'Emails the customer the bill for a repeat order that is invoiced rather than charged to a saved card.',
  trigger: { kind: 'event', eventType: 'subscription.invoiced' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'subscription-invoice', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

export const SUBSCRIPTION_PAUSED_EMAIL: SystemAutomationSpec = {
  key: 'subscriptions.paused-email',
  name: 'Subscription paused: email',
  previousNames: ['Subscription paused — email'],
  description: 'Emails the customer when their subscription is paused.',
  trigger: { kind: 'event', eventType: 'subscription.paused' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'subscription-paused', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

export const SUBSCRIPTION_RESUMED_EMAIL: SystemAutomationSpec = {
  key: 'subscriptions.resumed-email',
  name: 'Subscription resumed: email',
  previousNames: ['Subscription resumed — email'],
  description: 'Emails the customer when their subscription resumes.',
  trigger: { kind: 'event', eventType: 'subscription.resumed' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'subscription-resumed', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};

export const SUBSCRIPTION_CANCELLED_EMAIL: SystemAutomationSpec = {
  key: 'subscriptions.canceled-email',
  name: 'Subscription canceled: email',
  previousNames: ['Subscription cancelled: email', 'Subscription cancelled — email'],
  description: 'Emails the customer when their subscription is canceled.',
  trigger: { kind: 'event', eventType: 'subscription.cancelled' },
  conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
  actions: [
    {
      type: 'email.send_campaign',
      config: { builderEmailKey: 'subscription-cancelled', emailType: 'transactional' },
    },
  ],
  locked: false,
  status: 'active',
};
