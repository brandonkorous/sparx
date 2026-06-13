// Commerce system-automation seeds (docs/90 §3b). The Managed defaults that ship on
// Commerce activation. Three no-email defaults — two internal staff alerts (the
// PLATFORM-level `email.send_internal`, no email-module gate, so a commerce-only
// tenant still gets them) + a CRM note — plus two email-sending defaults
// (abandoned-cart, post-purchase-review) that reference a provisioned Builder-email
// by `key`; the `module: 'email'` gate holds those sends until email is active.

import type { SystemAutomationSpec } from '@sparx/automation';

/** Alert staff when a high-value order is paid. The $500 default is the ADR's
 *  `highValueThreshold ?? 500`; the alert goes to the tenant's notify address (the
 *  owner) by default. Edit the threshold or add a `to`/`toField` on the action. */
export const COMMERCE_HIGH_VALUE_ORDER_ALERT: SystemAutomationSpec = {
  name: 'High-value order alert',
  description: 'Emails staff when an order of $500 or more is paid.',
  trigger: { kind: 'event', eventType: 'order.paid' },
  conditions: {
    logic: 'AND',
    conditions: [{ field: 'order.total', operator: 'gte', value: 500 }],
  },
  actions: [
    {
      type: 'email.send_internal',
      config: { subject: 'High-value order — {{order.number}} · ${{order.total}}' },
    },
  ],
  locked: false,
  status: 'active',
};

/** Alert staff when a variant drops to/under its low-stock threshold (the
 *  `inventory.low` event already carries the on-hand level). */
export const COMMERCE_LOW_INVENTORY_ALERT: SystemAutomationSpec = {
  name: 'Low inventory alert',
  description: 'Emails staff when a product variant runs low on stock.',
  trigger: { kind: 'event', eventType: 'inventory.low' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    {
      type: 'email.send_internal',
      config: { subject: 'Low inventory — {{product.title}} · {{inventory.quantity}} remaining' },
    },
  ],
  locked: false,
  status: 'active',
};

/** Log a CRM note on the customer when a refund is issued, so the account timeline
 *  reflects it without a human re-entering it. */
export const COMMERCE_REFUND_CRM_NOTE: SystemAutomationSpec = {
  name: 'Refund issued — CRM note',
  description: 'Adds a note to the customer’s CRM timeline when an order is refunded.',
  trigger: { kind: 'event', eventType: 'order.refunded' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    {
      type: 'crm.add_note',
      config: { note: 'Refund issued — {{order.number}} · ${{order.refundTotal}}' },
    },
  ],
  locked: false,
  status: 'active',
};

/** Nudge a shopper who left items in their cart. An INTERVAL scan over the `cart`
 *  scanner (which already returns carts cold >30 min, still holding items, with an
 *  emailable customer, and never recovered) — once-per-entity dedupe means one
 *  nudge per cart. The 2-hour delay lets a distracted shopper return on their own
 *  first (docs/90 — `wait(2h)`). Marketing. */
export const COMMERCE_ABANDONED_CART_NUDGE: SystemAutomationSpec = {
  name: 'Abandoned cart nudge',
  description:
    'Emails a shopper a couple of hours after they leave items in their cart without checking out.',
  trigger: {
    kind: 'schedule',
    schedule: { cadence: 'interval', everyMinutes: 15 },
    predicate: {
      entity: 'cart',
      where: {
        logic: 'AND',
        conditions: [{ field: 'customer.email', operator: 'is_set' }],
      },
    },
  },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    {
      type: 'email.send_campaign',
      // ~2h after the cart goes cold (the scanner's 30-min threshold + this delay).
      config: { builderEmailKey: 'abandoned-cart', emailType: 'marketing', delaySeconds: 7200 },
    },
  ],
  locked: false,
  status: 'active',
};

/** Ask for a review a few days after an order is fulfilled. Event-driven off
 *  `order.fulfilled`; the 3-day delay gives the order time to arrive before the
 *  ask (docs/90 — `wait(3d)`). Marketing. */
export const COMMERCE_POST_PURCHASE_REVIEW: SystemAutomationSpec = {
  name: 'Post-purchase review request',
  description: 'Emails the customer three days after their order ships, asking for a review.',
  trigger: { kind: 'event', eventType: 'order.fulfilled' },
  conditions: {
    logic: 'AND',
    conditions: [{ field: 'customer.email', operator: 'is_set' }],
  },
  actions: [
    {
      type: 'email.send_campaign',
      config: {
        builderEmailKey: 'post-purchase-review',
        emailType: 'marketing',
        delaySeconds: 259_200, // 3 days
      },
    },
  ],
  locked: false,
  status: 'active',
};
