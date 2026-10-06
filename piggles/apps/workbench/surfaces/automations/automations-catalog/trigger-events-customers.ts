import type { TriggerEventDef } from './types';

export const CUSTOMER_TRIGGER_EVENTS: readonly TriggerEventDef[] = [
  // ── Customers (CRM) ──
  // Two kinds of new person: a welcome suits somebody who made an account, not a stranger
  // asking through a contact form (sparx persona issue 086).
  {
    eventType: 'crm.customer.created',
    label: 'A new customer is added by your team or makes an account on your site',
    module: 'crm',
  },
  {
    eventType: 'crm.customer.captured',
    label: 'Someone new reaches you through a form, a booking or a checkout',
    module: 'crm',
  },
  { eventType: 'crm.customer.updated', label: 'A customer’s details change', module: 'crm' },
  { eventType: 'crm.customer.subscribed', label: 'A customer opts in to marketing', module: 'crm' },
  { eventType: 'crm.deal.created', label: 'A sales deal is created', module: 'crm' },
  {
    eventType: 'crm.deal.stage_changed',
    label: 'A sales deal changes stage (e.g. won or lost)',
    module: 'crm',
  },
  { eventType: 'crm.task.created', label: 'A task is created', module: 'crm' },
  // ── Workflow depth (docs/144 §9) ──
  // The generic one: a business can act on a custom property (e.g. "renewal date") without
  // anyone at sparx knowing the field exists.
  {
    eventType: 'crm.property.changed',
    label: 'A detail you track changes on a record',
    module: 'crm',
  },
  {
    eventType: 'crm.association.added',
    label: 'Two records are linked to each other',
    module: 'crm',
  },
  { eventType: 'booking.created', label: 'Somebody books an appointment', module: 'crm' },
  { eventType: 'booking.cancelled', label: 'An appointment is canceled', module: 'crm' },
  { eventType: 'booking.completed', label: 'An appointment is completed', module: 'crm' },
  { eventType: 'booking.no_show', label: 'Somebody misses their appointment', module: 'crm' },
  // ── Support requests (docs/144 §7) ──
  // The inbound one is FIRST: "somebody wrote to us" is where a support process begins.
  {
    eventType: 'crm.engagement.received',
    label: 'A customer replies or writes in',
    module: 'crm',
  },
  { eventType: 'crm.ticket.created', label: 'A support request is opened', module: 'crm' },
  {
    eventType: 'crm.ticket.stage_changed',
    label: 'A support request moves along (e.g. resolved)',
    module: 'crm',
  },
  {
    eventType: 'crm.ticket.sla.warning',
    label: 'A support request is running out of time',
    module: 'crm',
  },
  {
    eventType: 'crm.ticket.sla.breached',
    label: 'A support request missed its response time',
    module: 'crm',
  },
  // ── Invoicing ──
  {
    eventType: 'crm.billing_document.created',
    label: 'A quote, estimate or invoice is created',
    module: 'invoicing',
  },
  {
    eventType: 'crm.billing_document.finalized',
    label: 'An invoice is finalized',
    module: 'invoicing',
  },
  {
    eventType: 'crm.billing_document.paid',
    label: 'An invoice is paid in full',
    module: 'invoicing',
  },
  {
    eventType: 'crm.billing_document.converted',
    label: 'A quote is converted to an order',
    module: 'invoicing',
  },
  {
    eventType: 'crm.billing_document.stage_changed',
    label: 'A quote or invoice changes stage',
    module: 'invoicing',
  },
  // ── Wholesale (B2B) ──
  { eventType: 'crm.b2b_account.created', label: 'A wholesale account is created', module: 'b2b' },
  // Held for sign-off: over a spending limit, or past the account's credit limit
  // (sparx persona issue 085).
  {
    eventType: 'b2b.order.pending_approval',
    label: 'A wholesale order is waiting for sign-off',
    module: 'b2b',
  },
  { eventType: 'b2b.order.approved', label: 'A wholesale order is approved', module: 'b2b' },
  { eventType: 'b2b.order.rejected', label: 'A wholesale order is rejected', module: 'b2b' },
  // Issued on the account's terms: at checkout, from an accepted quote, or when a
  // held order is signed off (sparx persona issue 085).
  { eventType: 'b2b.invoice.created', label: 'A wholesale invoice is issued', module: 'b2b' },
  { eventType: 'b2b.invoice.overdue', label: 'A wholesale invoice is overdue', module: 'b2b' },
  {
    eventType: 'b2b.account.credit_hold',
    label: 'A wholesale account goes on credit hold',
    module: 'b2b',
  },
];
