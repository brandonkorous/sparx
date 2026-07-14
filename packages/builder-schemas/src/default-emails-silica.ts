// The silica-native bodies for the provisioned default emails (docs/120 slice 6).
//
// The same copy as the legacy `BuilderNode` trees in `default-emails.ts`, re-authored
// against silicaui's closed email schema. Both ship: provisioning writes the silica
// document AND keeps the legacy tree, and a send prefers the silica document —
// parallel-run (docs/120 D1), so a tenant provisioned before this landed keeps sending
// through `renderEmailTree` until they open the email and save it.
//
// Two things the tree carried that a silica body deliberately does NOT:
//   · the `email_wordmark` header — the send composes the brand header (an author who
//     deleted it used to get an unbranded email);
//   · the marketing `unsubscribe_link` + `physical_address` footer — the send composes
//     the legal footer on every marketing send, so CAN-SPAM compliance is structural
//     rather than something an author can delete off the bottom of the email.
//
// Merge tokens stay `{{source.field}}`, unchanged — silica interpolates them natively
// in copy and button labels, and the send covers links. No author relearns anything.
//
// The `{{customer.firstName ?? "there"}}` fallback syntax keeps working, via a happy
// interaction rather than an accident of luck: silica's native token regex only matches
// bare `[a-zA-Z0-9_.]` paths, so a token carrying a `??` fallback doesn't match, passes
// through projection verbatim, and is then interpolated by sparx's own
// `interpolateEmailTokens` pass over the projected HTML — which does understand
// fallbacks. Without it a customer with no first name would read "Hi  — thanks".

import type { SectionNode } from '@wizeworks/silicaui-builder/email';

import {
  button,
  copyBlock,
  divider,
  emailDoc,
  heading,
  itemsTable,
  para,
  when,
} from './silica-email-kit';
import type { SilicaEmailDocument } from './email-silica';

// ── Welcome / lifecycle ──────────────────────────────────────────────────────

const welcomeCustomer = (): SectionNode[] => [
  copyBlock([
    heading('Welcome to {{site.name}}'),
    para(
      'Hi {{customer.firstName ?? "there"}} — thanks for creating an account. You’re all set: browse the latest, track your orders, and check out faster every time.'
    ),
    button('Start shopping', '{{site.url}}'),
  ]),
];

const winBack = (): SectionNode[] => [
  copyBlock([
    heading('It’s been a while'),
    para(
      'We haven’t seen you at {{site.name}} in a bit, {{customer.firstName ?? "there"}}. There’s plenty new since your last visit — come take a look.'
    ),
    button('See what’s new', '{{site.url}}'),
  ]),
];

const abandonedCart = (): SectionNode[] => [
  copyBlock([
    heading('Still thinking it over?'),
    para('Your cart is saved and ready whenever you are. Here’s what you left at {{site.name}}:'),
  ]),
  ...itemsTable('cart.items'),
  copyBlock([
    para('<b>Total: {{cart.total}}</b>'),
    button('Complete your order', '{{cart.recoveryUrl}}'),
  ]),
];

const postPurchaseReview = (): SectionNode[] => [
  copyBlock([
    heading('How was your order?'),
    para(
      'Thanks for shopping with {{site.name}}, {{customer.firstName ?? "there"}}. We’d love to hear what you thought of order {{order.number}}:'
    ),
  ]),
  ...itemsTable('order.items'),
  copyBlock([button('Leave a review', '{{order.reviewUrl}}')]),
];

const chatSatisfaction = (): SectionNode[] => [
  copyBlock([
    heading('How did we do?'),
    para(
      'Thanks for chatting with {{site.name}}, {{customer.firstName ?? "there"}}. We’d love a quick word on how the conversation went.'
    ),
    button('Rate your chat', '{{site.url}}'),
  ]),
];

// ── B2B ──────────────────────────────────────────────────────────────────────

const b2bAccountApproved = (): SectionNode[] => [
  copyBlock([
    heading('You’re approved'),
    para(
      'Good news — {{b2bAccount.companyName}} has been approved for a wholesale account with {{site.name}}. You can sign in and order at your account pricing now.'
    ),
  ]),
  when('b2bAccount.creditLimit', [
    para('Your credit line is {{b2bAccount.creditLimit}} on {{b2bAccount.paymentTerms}} terms.'),
  ]),
  copyBlock([button('Go to your portal', '{{b2bAccount.portalUrl}}')]),
];

const b2bQuoteReceived = (): SectionNode[] => [
  copyBlock([
    heading('Your quote is ready'),
    para('Here are the details for quote {{quote.number}}:'),
  ]),
  ...itemsTable('quote.items'),
  copyBlock([para('<b>Total: {{quote.total}}</b>')]),
  when('quote.validUntil', [para('Valid until {{quote.validUntil}}.')]),
  copyBlock([button('Review &amp; approve', '{{quote.reviewUrl}}')]),
];

const b2bQuoteExpiring = (): SectionNode[] => [
  copyBlock([
    heading('Your quote expires soon'),
    para(
      'Heads-up — quote {{quote.number}} expires on {{quote.validUntil}}. Approve it before then to lock in your pricing.'
    ),
    para('<b>Total: {{quote.total}}</b> · Expires {{quote.validUntil}}'),
    button('Approve now', '{{quote.reviewUrl}}'),
  ]),
];

const b2bInvoiceDue = (): SectionNode[] => [
  copyBlock([
    heading('Invoice {{invoice.number}}'),
    para('A reminder that invoice {{invoice.number}} is due in {{invoice.daysUntilDue}} days.'),
    para('<b>Amount due: {{invoice.balance}}</b> · Due {{invoice.dueDate}}'),
    button('Pay now', '{{invoice.payUrl}}'),
  ]),
];

// ── Invoicing + dunning ──────────────────────────────────────────────────────

const invoicingReminder = (): SectionNode[] => [
  copyBlock([
    heading('A quick reminder'),
    para(
      'Just a friendly reminder that invoice {{invoice.number}} is due on {{invoice.dueDate}}. Here’s a summary:'
    ),
  ]),
  ...itemsTable('invoice.items'),
  copyBlock([
    para('<b>Balance due: {{invoice.balance}}</b> · Due {{invoice.dueDate}}'),
    button('Pay invoice', '{{invoice.payUrl}}'),
  ]),
];

/** The three dunning notices differ only in tone + the escalation line, so they share
 *  a shape: the same heading/copy/amount/CTA spine, authored per notice. */
const dunning = (title: string, body: string, tail?: SectionNode[]): SectionNode[] => [
  copyBlock([
    heading(title),
    para(body),
    para('<b>Amount due: {{invoice.balance}}</b> · {{invoice.overdueDays}} days overdue'),
  ]),
  ...(tail ?? []),
  copyBlock([button('Pay now', '{{invoice.payUrl}}')]),
];

const invoicingOverdue = (): SectionNode[] =>
  dunning(
    'Your invoice is past due',
    'Invoice {{invoice.number}} was due on {{invoice.dueDate}} and is now {{invoice.overdueDays}} days overdue. Please submit payment at your earliest convenience.'
  );

const invoicingOverdue2 = (): SectionNode[] =>
  dunning(
    'Second notice',
    'Our records show invoice {{invoice.number}} remains unpaid and is now {{invoice.overdueDays}} days overdue. Please arrange payment to keep your account in good standing.'
  );

const invoicingOverdueFinal = (): SectionNode[] =>
  dunning(
    'Final notice',
    'Invoice {{invoice.number}} is now {{invoice.overdueDays}} days overdue and requires immediate attention. This is the final reminder before your account is escalated.',
    [
      when('invoice.overdueDays', [
        para(
          'If payment isn’t received, your account may be placed on credit hold and outstanding orders paused.'
        ),
      ]),
    ]
  );

const invoicingReceipt = (): SectionNode[] => [
  copyBlock([
    heading('Payment received — thank you!'),
    para(
      'We’ve received your payment in full for invoice {{invoice.number}}. Here’s a summary for your records:'
    ),
  ]),
  ...itemsTable('invoice.items'),
  copyBlock([para('<b>Total paid: {{invoice.total}}</b>')]),
];

// ── Commerce ─────────────────────────────────────────────────────────────────

const orderConfirmation = (): SectionNode[] => [
  copyBlock([
    heading('Your order is confirmed'),
    para(
      'Thanks for your order, {{customer.firstName ?? "there"}} — we’re getting it ready. Here’s a summary of order {{order.number}}:'
    ),
  ]),
  ...itemsTable('order.items'),
  copyBlock([para('<b>Total: {{order.total}}</b>')]),
  // The legacy tree bound `order.shippingAddress.oneLine`, but the resolver supplies
  // `order.shippingAddress` as an already-formatted one-line string — the old binding
  // could never have resolved. Bound to the real path here.
  when('order.shippingAddress', [para('Shipping to: {{order.shippingAddress}}')]),
  copyBlock([button('View your order', '{{order.statusUrl}}')]),
];

const shippingConfirmation = (): SectionNode[] => [
  copyBlock([
    heading('Your order is on its way'),
    para('Good news, {{customer.firstName ?? "there"}} — order {{order.number}} has shipped.'),
    para('Carrier: {{shipping.carrier}} · Tracking: {{shipping.trackingNumber}}'),
  ]),
  when('shipping.trackingNumber', [button('Track your package', '{{shipping.trackingUrl}}')]),
  copyBlock([divider()]),
  ...itemsTable('order.items'),
];

// ── Scheduling: the industry-agnostic `booking` source (docs/79 §10) ─────────
// The legacy B2B-fleet `appointment` source (service_appointments) was retired
// 2026-07-14 (docs/79 §15.7) — B2B fleet bookings are Bookings too.

/** location / staff / add-to-calendar are the cross-type optionals every booking kind
 *  (appointment · class · reservation · rental) may or may not carry. */
const bookingBody = (title: string, lead: string, cta: string): SectionNode[] => [
  copyBlock([heading(title), para(lead)]),
  when('booking.location', [para('Location: {{booking.location}}')]),
  when('booking.staff', [para('With: {{booking.staff}}')]),
  copyBlock([button(cta, '{{booking.manageUrl}}')]),
  when('booking.addToCalendarUrl', [button('Add to calendar', '{{booking.addToCalendarUrl}}')]),
];

const bookingConfirmation = (): SectionNode[] =>
  bookingBody(
    'Your booking is confirmed',
    'Hi {{customer.firstName ?? "there"}} — your {{booking.service}} is booked for {{booking.when}}.',
    'Manage booking'
  );

const bookingReminder = (): SectionNode[] =>
  bookingBody(
    'A reminder about your upcoming booking',
    'Hi {{customer.firstName ?? "there"}} — a reminder that your {{booking.service}} is coming up on {{booking.when}}.',
    'Manage booking'
  );

const bookingRescheduled = (): SectionNode[] =>
  bookingBody(
    'Your booking has been rescheduled',
    'Hi {{customer.firstName ?? "there"}} — your {{booking.service}} has been moved to {{booking.when}}.',
    'Manage booking'
  );

const bookingCancelled = (): SectionNode[] => [
  copyBlock([
    heading('Your booking was cancelled'),
    para(
      'Hi {{customer.firstName ?? "there"}} — your {{booking.service}} scheduled for {{booking.when}} has been cancelled.'
    ),
  ]),
  when('booking.cancellationReason', [para('Reason: {{booking.cancellationReason}}')]),
  copyBlock([button('Book another time', '{{booking.bookUrl}}')]),
];

const waitlistOffer = (): SectionNode[] => [
  copyBlock([
    heading('A spot just opened up'),
    para(
      'Hi {{customer.firstName ?? "there"}} — good news: a spot opened for {{waitlist.service}} in your requested window ({{waitlist.window}}). Book now to claim it.'
    ),
  ]),
  when('waitlist.offerExpires', [para('This offer is held until {{waitlist.offerExpires}}.')]),
  copyBlock([button('Book your spot', '{{waitlist.bookUrl}}')]),
];

// ── The registry ─────────────────────────────────────────────────────────────

/** Every default's silica body, by template key. Built once at module load (like the
 *  legacy trees) so the authored node id sequence is stable across reads. */
const SILICA_EMAIL_BODIES: Record<string, SectionNode[]> = {
  'welcome-customer': welcomeCustomer(),
  'win-back': winBack(),
  'abandoned-cart': abandonedCart(),
  'post-purchase-review': postPurchaseReview(),
  'chat-satisfaction': chatSatisfaction(),
  'b2b-account-approved': b2bAccountApproved(),
  'b2b-quote-received': b2bQuoteReceived(),
  'b2b-quote-expiring': b2bQuoteExpiring(),
  'b2b-invoice-due': b2bInvoiceDue(),
  'invoicing-reminder': invoicingReminder(),
  'invoicing-overdue': invoicingOverdue(),
  'invoicing-overdue-2': invoicingOverdue2(),
  'invoicing-overdue-final': invoicingOverdueFinal(),
  'invoicing-receipt': invoicingReceipt(),
  'order-confirmation': orderConfirmation(),
  'shipping-confirmation': shippingConfirmation(),
  'booking-confirmation': bookingConfirmation(),
  'booking-reminder': bookingReminder(),
  'booking-rescheduled': bookingRescheduled(),
  'booking-cancelled': bookingCancelled(),
  'waitlist-offer': waitlistOffer(),
};

/** The silica document for a default template. Subject + preheader live INSIDE the
 *  document now (silica owns those fields, docs/120 D3), so they're passed in from the
 *  registry entry rather than duplicated here.
 *
 *  THROWS on an unknown key — deliberately. A new default added to
 *  `DEFAULT_EMAIL_TEMPLATES` with no silica body would otherwise provision silently as
 *  a legacy-only email and quietly keep the old engine alive; this fails at module
 *  load, in every test and every boot, instead. */
export function silicaDefaultEmail(
  key: string,
  subject: string,
  preheader: string
): SilicaEmailDocument {
  const body = SILICA_EMAIL_BODIES[key];
  if (!body) {
    throw new Error(
      `default-emails-silica: no silica body authored for template "${key}" — add one to SILICA_EMAIL_BODIES.`
    );
  }
  return emailDoc(subject, preheader, body);
}

export { SILICA_EMAIL_BODIES };
