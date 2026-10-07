// What Stripe shows a Piggles customer: product copy, the portal's framing, the
// meter and the webhook. Nothing at runtime renders this; it lives on invoices.

/** SaaS, business use, so Stripe Tax can resolve a rate. */
export const TAX_CODE = 'txcd_10103001';
export const TRIAL_DAYS = 14;

export const COPY = {
  piggles_base: {
    name: 'Piggles',
    description: 'Everything Piggles does, for one business. All apps included.',
    statementDescriptor: 'PIGGLES',
  },
  piggles_seat: {
    name: 'Extra team member',
    description: 'One more person on the team, beyond the 3 included.',
    unitLabel: 'team member',
  },
  piggles_location: {
    name: 'Extra location',
    description: 'One more place the business operates from, beyond the 1 included.',
    unitLabel: 'location',
  },
  piggles_site: {
    name: 'Extra site',
    description: 'One more website, beyond the 1 included.',
    unitLabel: 'site',
  },
  piggles_storage_10gb: {
    name: 'Storage, 10 GB',
    description: '10 GB more room for images, files and video, beyond the 25 GB included.',
    unitLabel: '10 GB block',
  },
  piggles_email_5k: {
    name: 'Email sends, 5,000 a month',
    description:
      '5,000 more marketing emails a month, beyond the 5,000 included. Order confirmations and password resets are never counted.',
    unitLabel: '5,000 sends',
  },
  piggles_contacts_10k: {
    name: 'Customer records, 10,000',
    description: '10,000 more customer records, beyond the 10,000 included.',
    unitLabel: '10k records',
  },
};

// Email is the one FLOW meter (real cost per send), so Stripe sums it from day one.
// Storage, contacts and seats are levels, which a Stripe meter cannot sum.
export const METER = { eventName: 'piggles_email_send', displayName: 'Piggles email sends' };

export const WEBHOOK_PATH = '/v1/public/webhooks/stripe/billing';
// Exactly what api-rest's billing webhook dispatches (webhooks/stripe-billing.ts).
export const WEBHOOK_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'customer.subscription.trial_will_end',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
];

export const PORTAL = {
  headline: 'Piggles: your billing',
  privacyUrl: 'https://meetpiggles.com/privacy',
  termsUrl: 'https://meetpiggles.com/terms',
};

/** The name an offer's discount carries on checkout and on every invoice. */
const COUPON_NAMES = { FOUNDER: 'Founding member price' };

export function couponNameFor(id) {
  const name = COUPON_NAMES[id];
  if (!name) throw new Error(`No coupon name for "${id}". Add it to COUPON_NAMES.`);
  return name;
}

export function copyFor(id) {
  const copy = COPY[id];
  if (!copy) throw new Error(`No product copy for "${id}". Add it to COPY.`);
  return copy;
}
