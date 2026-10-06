import type { TriggerEventDef } from './types';

export const SELLING_TRIGGER_EVENTS: readonly TriggerEventDef[] = [
  // ── Selling — orders ──
  { eventType: 'order.placed', label: 'An order is placed', module: 'commerce' },
  { eventType: 'order.paid', label: 'An order is paid', module: 'commerce' },
  { eventType: 'order.fulfilled', label: 'An order is fulfilled', module: 'commerce' },
  { eventType: 'order.delivered', label: 'An order is delivered', module: 'commerce' },
  { eventType: 'order.cancelled', label: 'An order is canceled', module: 'commerce' },
  { eventType: 'order.refunded', label: 'An order is refunded', module: 'commerce' },
  { eventType: 'order.payment_failed', label: 'An order payment fails', module: 'commerce' },
  // ── Selling — subscriptions ──
  { eventType: 'subscription.created', label: 'A subscription starts', module: 'commerce' },
  { eventType: 'subscription.renewed', label: 'A subscription renews', module: 'commerce' },
  {
    eventType: 'subscription.payment_failed',
    label: 'A subscription payment fails',
    module: 'commerce',
  },
  { eventType: 'subscription.paused', label: 'A subscription is paused', module: 'commerce' },
  { eventType: 'subscription.resumed', label: 'A subscription resumes', module: 'commerce' },
  { eventType: 'subscription.cancelled', label: 'A subscription is canceled', module: 'commerce' },
  // ── Selling — returns ──
  // All six: a return has three ENDINGS, and a shop cannot write to a shopper about an
  // ending it cannot pick here (persona issue 448).
  {
    eventType: 'return.requested',
    label: 'Someone asks to send something back',
    module: 'commerce',
  },
  { eventType: 'return.approved', label: 'A return is approved', module: 'commerce' },
  { eventType: 'return.received', label: 'A return is received', module: 'commerce' },
  { eventType: 'return.refunded', label: 'A return is refunded', module: 'commerce' },
  { eventType: 'return.exchanged', label: 'A replacement is sent', module: 'commerce' },
  {
    eventType: 'return.replacement_shipped',
    label: 'A replacement is posted',
    module: 'commerce',
  },
  { eventType: 'return.denied', label: 'A return is turned down', module: 'commerce' },
  // ── Selling — inventory ──
  { eventType: 'inventory.low', label: 'A product runs low on stock', module: 'commerce' },
  { eventType: 'inventory.depleted', label: 'A product sells out', module: 'commerce' },
  // ── Content ──
  { eventType: 'product.published', label: 'A product goes live', module: 'cms' },
  {
    eventType: 'content.entry.published',
    label: 'An article or page is published',
    module: 'cms',
  },
  { eventType: 'form.submitted', label: 'A form on your site is submitted', module: 'cms' },
];
