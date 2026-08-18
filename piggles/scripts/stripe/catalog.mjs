// The Piggles Stripe catalog — one flat plan, plus capacity.
//
// This file is the source of truth for what exists in Stripe. sparx bills per
// active module and its catalog is therefore generated from the module roster;
// Piggles must never grow tiers (piggles/CLAUDE.md RULE #2), so there is exactly
// ONE plan here and everything else is capacity a business buys more of.
//
// Two rules this shape enforces:
//
//   • No plan picker. One product, one price, one interval. Nothing in this file
//     can be arranged into a Basic/Pro/Enterprise grid, because there is only one
//     of it. There is deliberately no annual price either — "Piggles is $49/month"
//     is the whole sentence the marketing site says.
//   • Every expansion names its meter. `metadata.meter` matches a key of `METERS`
//     in @piggles/config, so the account service can answer "what does one more
//     block of THIS cost?" without a lookup table written twice.
//
// The console never reads any of this. It renders the label the account service
// hands it and nothing else — a price in console code is billing logic that
// leaked (BILLING_RULES.md).

/** SaaS, business use. Set on every product so Stripe Tax can resolve. */
export const TAX_CODE = 'txcd_10103001';

/** 14 days, no card. Lives on the base price so a Checkout Session inherits it
 *  without every caller remembering to pass it. */
export const TRIAL_DAYS = 14;

/** What $49 includes. Stamped onto the base product's metadata so entitlement
 *  limits are readable from the subscription itself rather than from a constant
 *  in a service that may not agree with what the customer was sold. */
export const INCLUDED = {
  businesses: 1,
  locations: 1,
  sites: 1,
  seats: 3,
  contacts: 10_000,
  storage_gb: 25,
  email_sends: 5_000,
};

/** The base plan. One product, one price. */
export const BASE = {
  product: 'piggles_base',
  name: 'Piggles',
  description: 'Everything Piggles does, for one business. All apps included.',
  statementDescriptor: 'PIGGLES',
  price: { lookupKey: 'piggles_base_monthly', cents: 4900, nickname: 'Piggles — $49/month' },
};

// Capacity expansion. `meterKind` decides enforcement, not price: stocks never
// degrade what already exists, flows carry real marginal cost, units are discrete
// and self-evident (BILLING_RULES.md). Quantity on the subscription item is the
// number of blocks bought.
export const EXPANSIONS = [
  {
    product: 'piggles_seat',
    name: 'Extra team member',
    description: 'One more person on the team, beyond the 3 included.',
    unitLabel: 'team member',
    meter: 'seats',
    meterKind: 'unit',
    blockSize: 1,
    price: { lookupKey: 'piggles_seat_monthly', cents: 900, nickname: 'Extra team member — $9/month' },
  },
  {
    product: 'piggles_location',
    name: 'Extra location',
    description: 'One more place the business operates from, beyond the 1 included.',
    unitLabel: 'location',
    meter: 'locations',
    meterKind: 'unit',
    blockSize: 1,
    price: { lookupKey: 'piggles_location_monthly', cents: 1900, nickname: 'Extra location — $19/month' },
  },
  {
    product: 'piggles_site',
    name: 'Extra site',
    description: 'One more website, beyond the 1 included.',
    unitLabel: 'site',
    meter: 'sites',
    meterKind: 'unit',
    blockSize: 1,
    price: { lookupKey: 'piggles_site_monthly', cents: 1900, nickname: 'Extra site — $19/month' },
  },
  {
    product: 'piggles_storage_10gb',
    name: 'Storage, 10 GB',
    description: '10 GB more room for images, files and video, beyond the 25 GB included.',
    unitLabel: '10 GB block',
    meter: 'storage',
    meterKind: 'stock',
    blockSize: 10,
    blockUnit: 'GB',
    price: { lookupKey: 'piggles_storage_10gb_monthly', cents: 500, nickname: 'Storage, 10 GB — $5/month' },
  },
  {
    product: 'piggles_email_5k',
    name: 'Email sends, 5,000 a month',
    description:
      '5,000 more marketing emails a month, beyond the 5,000 included. Order confirmations and password resets are never counted.',
    unitLabel: '5,000 sends',
    meter: 'email',
    meterKind: 'flow',
    blockSize: 5000,
    blockUnit: 'sends',
    price: { lookupKey: 'piggles_email_5k_monthly', cents: 1000, nickname: 'Email sends, 5,000 a month — $10/month' },
  },
  {
    product: 'piggles_contacts_10k',
    name: 'Customer records, 10,000',
    description: '10,000 more customer records, beyond the 10,000 included.',
    unitLabel: '10k records',
    meter: 'contacts',
    meterKind: 'stock',
    blockSize: 10_000,
    blockUnit: 'records',
    price: { lookupKey: 'piggles_contacts_10k_monthly', cents: 1000, nickname: 'Customer records, 10,000 — $10/month' },
  },
];

// The only meter that is a FLOW — email is the one capacity with real marginal
// cost per unit and real abuse exposure, so it is the one worth accumulating in
// Stripe from day one against a future usage price ("meter from day one, even
// before you bill on it" — BILLING_RULES.md).
//
// Storage, contacts, seats, sites and locations are deliberately NOT Stripe
// meters. A Stripe meter sums or counts events over a period; a stock is a level
// at a moment, and summing it produces a number that means nothing. Those live in
// our own usage table, where "what was it on the 3rd" is answerable.
export const METER = {
  eventName: 'piggles_email_send',
  displayName: 'Piggles email sends',
};

// The events the shared billing webhook actually dispatches
// (wizeworks/services/api-rest/.../webhooks/stripe-billing.ts). Sending more than
// the handler switches on just costs delivery attempts.
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

export const WEBHOOK_PATH = '/v1/public/webhooks/stripe/billing';

// The customer portal carries payment method, invoices, billing details and
// cancellation — the Get Piggles column of BILLING_RULES.md's split table.
//
// `subscription_update` is deliberately DISABLED. With one flat plan there is no
// plan to switch to, and enabling it to expose quantity editing would put the base
// plan in the same list as the add-ons — a customer one click from a subscription
// that bills Piggles twice. Adding and removing capacity is a narrow account-
// service endpoint instead, which is what "one tap, in place, at the moment of
// friction" requires anyway.
export const PORTAL = {
  headline: 'Piggles — your billing',
  privacyUrl: 'https://meetpiggles.com/privacy',
  termsUrl: 'https://meetpiggles.com/terms',
};
