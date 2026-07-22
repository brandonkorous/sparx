// Default in-app notification rules (docs/124 Phase 3).
//
// The starter matrix for "what needs me?". These are ordinary system
// automations — the notification layer has no parallel runtime, it just uses
// `platform.notify` like any other action, which is the whole reason it was
// built as an action instead of a worker.
//
// The bar for shipping one of these ON by default is deliberately high: it must
// be something a business owner would want to be INTERRUPTED about, that they
// cannot see any other way, and that they can act on. Money that failed to
// arrive and stock that hit zero clear it. "An order came in" does not — that is
// the activity feed's job, and a notification for every sale would train people
// to ignore the bell within a day.
//
// Each is `locked: false`, so a tenant can retune or switch it off. That
// editability is the point: notification policy belongs to the tenant, not to
// our code.

import type { SystemAutomationSpec } from '@sparx/automation';

/** Money that did not arrive. The clearest "needs a human" event we have. */
export const NOTIFY_PAYMENT_FAILED: SystemAutomationSpec = {
  name: 'Notify — payment failed',
  description: 'Shows a notification to owners when a customer’s payment fails.',
  trigger: { kind: 'event', eventType: 'order.payment_failed' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    {
      type: 'platform.notify',
      config: {
        kind: 'order.payment_failed',
        audience: 'owners',
        severity: 'danger',
        module: 'commerce',
        title: 'Payment failed on order {{order.number}}',
        body: 'The customer’s payment did not go through, so this order is not paid yet.',
        entityType: 'Order',
      },
    },
  ],
  locked: false,
  status: 'active',
};

/** Zero on hand — actively losing sales until someone acts. Distinct from the
 *  existing low-stock EMAIL alert, which fires earlier and to a different place. */
export const NOTIFY_STOCK_DEPLETED: SystemAutomationSpec = {
  name: 'Notify — out of stock',
  description: 'Shows a notification to owners when a product runs out of stock.',
  trigger: { kind: 'event', eventType: 'inventory.depleted' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    {
      type: 'platform.notify',
      config: {
        kind: 'inventory.depleted',
        audience: 'owners',
        severity: 'warning',
        module: 'inventory',
        title: '{{product.title}} is out of stock',
        body: 'Customers cannot buy this until it is back in stock.',
        entityType: 'ProductVariant',
      },
    },
  ],
  locked: false,
  status: 'active',
};

/** Recurring revenue quietly breaking. Easy to miss precisely because the
 *  original sale succeeded months ago. */
export const NOTIFY_SUBSCRIPTION_PAYMENT_FAILED: SystemAutomationSpec = {
  name: 'Notify — subscription payment failed',
  description: 'Shows a notification to owners when a subscription renewal payment fails.',
  trigger: { kind: 'event', eventType: 'subscription.payment_failed' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    {
      type: 'platform.notify',
      config: {
        kind: 'subscription.payment_failed',
        audience: 'owners',
        severity: 'danger',
        module: 'commerce',
        title: 'A subscription payment failed',
        // No field interpolation here on purpose: the subscription resolver's
        // field paths are not verified, and a title reading "A subscription
        // payment failed" beats one with a hole in it.
        body: 'The renewal did not go through. The customer may lose access until it is fixed.',
        entityType: 'Subscription',
      },
    },
  ],
  locked: false,
  status: 'active',
};
