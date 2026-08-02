// The first-party integration listings — sparx's own shelf stock for the fourth
// marketplace category.
//
// WHAT AN INTEGRATION LISTING IS. Discovery, and only discovery (docs/60 §6, docs/66
// MP-Ph3). The card exists so a tenant can find that sparx talks to Stripe; its
// "Connect" CTA hands off to Settings → Integrations, where the real install happens
// against a `@sparx/provider-*` bundle resolved by `providerSlug`. Nothing here
// configures, authenticates or runs anything, which is why `configSchema` stays NULL:
// the schema is the provider's, read at connect time.
//
// WHY THIS IS AUTHORED RATHER THAN DERIVED FROM THE PROVIDER REGISTRY. It looks like
// it should be generated from `listProviders()` the way themes and components are
// generated from their catalogs, and it deliberately is not — two reasons, both real:
//
//   · `ProviderMetadataDescriptor` carries what the INSTALLER needs (config schema,
//     webhook path, scopes, currencies). It has no `tagline`, `accent` or
//     `sortWeight`, because those are marketplace COPY — how the card is written and
//     ranked — not facts about the provider.
//   · the registry is populated by SIDE EFFECT: a provider package calls
//     `registerProvider()` when imported. Nothing imports them in api-rest, so
//     `listProviders()` is empty in this process. Deriving would publish zero rows.
//
// A KNOWN DRIFT, RECORDED RATHER THAN HIDDEN: `stripe` is listed here and there is no
// `@sparx/provider-stripe` package — only avalara, easypost, paypal, shippo and taxjar
// ship bundles. The listing is honest about intent (Stripe is the default payments
// rail; `@sparx/billing` talks to Stripe directly for PLATFORM billing) but its
// "Connect" CTA has no provider to hand off to yet. Deleting the entry would hide a
// gap the marketplace is supposed to advertise; the fix is the provider package.

export interface FirstPartyIntegration {
  slug: string;
  name: string;
  /** Resolves the real `@sparx/provider-*` bundle at connect time. */
  providerSlug: string;
  /** The card's category label — human copy ("Payments"), not the `ProviderKind` enum. */
  kind: string;
  scopes: string[];
  accent: string;
  tagline: string;
  description: string;
  sortWeight: number;
}

export const FIRST_PARTY_INTEGRATIONS: readonly FirstPartyIntegration[] = [
  {
    slug: 'stripe',
    name: 'Stripe',
    providerSlug: 'stripe',
    kind: 'Payments',
    scopes: ['payments', 'refunds', 'payouts'],
    accent: '#635bff',
    tagline: 'Accept cards, wallets, and local payment methods worldwide.',
    description:
      'Connect Stripe to take card and wallet payments, issue refunds, and reconcile payouts. The default, battle-tested payments rail for sparx commerce.',
    sortWeight: 60,
  },
  {
    slug: 'paypal',
    name: 'PayPal',
    providerSlug: 'paypal',
    kind: 'Payments',
    scopes: ['payments', 'refunds'],
    accent: '#003087',
    tagline: 'Let customers check out with PayPal and Pay Later.',
    description:
      'Offer PayPal and Pay Later at checkout for buyers who prefer it — a familiar, trusted button that lifts conversion in many markets.',
    sortWeight: 48,
  },
  {
    slug: 'shippo',
    name: 'Shippo',
    providerSlug: 'shippo',
    kind: 'Shipping',
    scopes: ['rates', 'labels', 'tracking'],
    accent: '#0b7285',
    tagline: 'Real-time rates, labels, and tracking across major carriers.',
    description:
      'Pull live shipping rates at checkout, buy and print labels, and track shipments across USPS, UPS, FedEx, and more — all from one connection.',
    sortWeight: 55,
  },
  {
    slug: 'easypost',
    name: 'EasyPost',
    providerSlug: 'easypost',
    kind: 'Shipping',
    scopes: ['rates', 'labels', 'tracking'],
    accent: '#164b9b',
    tagline: 'Multi-carrier shipping — rates, labels, and tracking via one API.',
    description:
      'An alternative multi-carrier shipping connection: real-time rates, label purchase, and tracking, with broad carrier coverage and address verification.',
    sortWeight: 42,
  },
  {
    slug: 'taxjar',
    name: 'TaxJar',
    providerSlug: 'taxjar',
    kind: 'Tax',
    scopes: ['tax_calculation', 'reporting'],
    accent: '#3bb273',
    tagline: 'Automated US sales-tax calculation and reporting.',
    description:
      'Calculate accurate sales tax at checkout by jurisdiction and keep filing-ready reports — so tax stops being a spreadsheet at month-end.',
    sortWeight: 45,
  },
  {
    slug: 'avalara',
    name: 'Avalara',
    providerSlug: 'avalara',
    kind: 'Tax',
    scopes: ['tax_calculation', 'compliance'],
    accent: '#ff6a13',
    tagline: 'Enterprise tax calculation and compliance.',
    description:
      'Enterprise-grade tax determination and compliance across thousands of jurisdictions — for sellers whose tax footprint has outgrown a single state.',
    sortWeight: 38,
  },
];
