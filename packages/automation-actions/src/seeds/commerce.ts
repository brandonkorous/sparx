// Commerce system-automation seeds (docs/90 §3b). The Managed defaults that ship on
// Commerce activation. The email-sending Commerce seeds (abandoned-cart, post-
// purchase-review) land with the template provisioning; these three are the
// no-email defaults — two internal staff alerts + a CRM note. The internal alerts
// use `email.send_internal`, a PLATFORM-level transactional send (no email-module
// gate), so a commerce-only tenant still gets them.

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
