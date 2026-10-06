// Every seed's `key` is its identity in every tenant that has it installed. The
// re-sync finds a tenant's copy by it, so a key that changes or disappears
// orphans that copy: the next pass installs a second one beside it, and both run.

import { describe, expect, it } from 'vitest';

import { SYSTEM_AUTOMATIONS } from './index.js';

/**
 * Every key that has shipped. Append a new seed's key here; never edit or remove
 * one. A seed that is retired keeps its key out of the catalog only on purpose,
 * and the tenants' copies of it then need a decision of their own.
 */
const SHIPPED_KEYS = [
  'b2b.chase-overdue-invoices',
  'b2b.invoice-due-reminder',
  'b2b.invoice-issued-email',
  'b2b.new-account-setup-task',
  'b2b.order-approved-email',
  'b2b.order-held-ask-account-approvers',
  'b2b.order-held-sign-off-task',
  'b2b.order-rejected-email',
  'b2b.quote-expiring-warning',
  'b2b.quote-received-email',
  'b2b.welcome-new-account',
  'chat.no-response-alert',
  'chat.satisfaction-survey',
  'commerce.abandoned-cart-nudge',
  'commerce.high-value-order-alert',
  'commerce.low-inventory-alert',
  'commerce.order-canceled-email',
  'commerce.order-confirmation-email',
  'commerce.order-delivered-email',
  'commerce.order-refunded-email',
  'commerce.payment-failed-email',
  'commerce.post-purchase-review',
  'commerce.refund-crm-note',
  'commerce.return-requested-alert',
  'commerce.shipping-confirmation-email',
  'crm.chat-opens-request',
  'crm.deal-won-invoice-task',
  'crm.email-opens-request',
  'crm.new-lead-follow-up-task',
  'crm.tag-vip-customers',
  'crm.welcome-new-customers',
  'crm.win-back-inactive',
  'forms.handle-submissions',
  'inventory.auto-reorder',
  'invoicing.estimate-approved-task',
  'invoicing.overdue-14-days',
  'invoicing.overdue-30-days',
  'invoicing.overdue-7-days',
  'invoicing.receipt-on-paid',
  'invoicing.reminder-3-days',
  'notifications.out-of-stock',
  'notifications.payment-failed',
  'notifications.subscription-payment-failed',
  'returns.approved-email',
  'returns.denied-email',
  'returns.received-email',
  'returns.refunded-email',
  'returns.replacement-sent-email',
  'returns.replacement-tracking-email',
  'social.announce-blog-post',
  'social.announce-product',
  'subscriptions.authentication-required-email',
  'subscriptions.canceled-email',
  'subscriptions.confirmed-email',
  'subscriptions.invoice-email',
  'subscriptions.paused-email',
  'subscriptions.payment-failed-email',
  'subscriptions.renewed-email',
  'subscriptions.resumed-email',
];

const keys = SYSTEM_AUTOMATIONS.map(({ spec }) => spec.key);

describe('system automation keys', () => {
  it('every seed has a well-formed key (it fits the 100-character column)', () => {
    for (const { spec } of SYSTEM_AUTOMATIONS) {
      expect(spec.key, spec.name).toMatch(/^[a-z0-9]+\.[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(spec.key.length, spec.name).toBeLessThanOrEqual(100);
    }
  });

  it('no two seeds share a key', () => {
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every key that has shipped is still in the catalog, unchanged', () => {
    for (const key of SHIPPED_KEYS) expect(keys, key).toContain(key);
  });

  it('a new seed is added to the shipped list', () => {
    expect([...keys].sort()).toEqual([...SHIPPED_KEYS].sort());
  });
});
