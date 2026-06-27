// The gateway catalog (docs/111 §1 D1) — the data-driven list of every payment
// gateway sparx can run. ONE source of truth: the dashboard renders cards + credential
// forms from it (via an API mirror), api-rest validates captured credentials against
// it, and each entry pairs with a `PaymentGateway` adapter resolved by `id`. Adding a
// gateway is a descriptor here + an adapter in ./gateways — no new UI branches, no new
// routes.
//
// Pure data, no SDK imports — safe to surface over the catalog endpoint. Secrets are
// NEVER in here; `credentialFields[].secret` marks which captured fields are write-only
// and encrypted at rest (docs/111 §2).

/** How a tenant turns the gateway on. */
export type GatewayOnboarding =
  // Stripe Connect Express — sparx hosts onboarding, nothing to capture (sparx Pay).
  | 'sparx_hosted'
  // The merchant pastes API keys from their processor dashboard (captured + encrypted).
  | 'api_keys'
  // No online processing — record payments by hand (manual).
  | 'manual';

/** How the shopper pays at checkout. */
export type GatewayCheckout =
  // sparx-rendered card form (Stripe Elements) — Stripe-family only.
  | 'inline'
  // Redirect to the vendor's hosted payment page, resume on return (everyone else).
  | 'redirect'
  // No online checkout (manual).
  | 'none';

/** One captured credential field. `secret: true` ⇒ write-only + encrypted at rest;
 *  `secret: false` ⇒ a non-sensitive value kept in the clear for display/the client
 *  SDK (a public client key, a location id, a hosted URL). */
export interface CredentialField {
  key: string;
  label: string;
  placeholder?: string;
  secret: boolean;
  help?: string;
  optional?: boolean;
}

export interface GatewayCapabilities {
  refunds: boolean;
  /** Auth-then-capture (manual capture) supported server-side. */
  capture: boolean;
  /** Hosted payment links for invoices. */
  paymentLinks: boolean;
  webhooks: boolean;
}

export interface GatewayDescriptor {
  id: string;
  name: string;
  tagline?: string;
  blurb: string;
  /** sparx Pay leads the picker (docs/111 D7). */
  recommended?: boolean;
  onboarding: GatewayOnboarding;
  checkout: GatewayCheckout;
  capabilities: GatewayCapabilities;
  /** Captured for `api_keys` onboarding; empty for hosted/manual. */
  credentialFields: CredentialField[];
  /** Whether the gateway has a sandbox/production toggle. */
  environments: boolean;
  /** Whether sparx takes a per-transaction fee on this gateway. */
  sparxFee: boolean;
  feeNote: string;
  /** ISO country codes the gateway broadly supports (display only). */
  regions: string[];
  docsUrl?: string;
}

const CARD_CAPS: GatewayCapabilities = {
  refunds: true,
  capture: true,
  paymentLinks: true,
  webhooks: true,
};

export const GATEWAY_CATALOG: readonly GatewayDescriptor[] = [
  {
    id: 'sparx_pay',
    name: 'sparx Pay',
    tagline: 'Recommended',
    blurb:
      'Accept cards in minutes. sparx handles disputes, settlement, and PCI, and pays out to your bank automatically. Flat 0.5% per transaction — no monthly fee, and better blended rates as you grow.',
    recommended: true,
    onboarding: 'sparx_hosted',
    checkout: 'inline',
    capabilities: CARD_CAPS,
    credentialFields: [],
    environments: false,
    sparxFee: true,
    feeNote: 'Flat 0.5% per transaction. No monthly fee.',
    regions: ['US'],
  },
  {
    id: 'stripe_direct',
    name: 'Your own Stripe',
    blurb:
      'Route checkout to your own Stripe account. No sparx fee — you own disputes, PCI, and payouts. Paste your secret key and webhook signing secret from the Stripe dashboard.',
    onboarding: 'api_keys',
    checkout: 'inline',
    capabilities: CARD_CAPS,
    credentialFields: [
      {
        key: 'secret_key',
        label: 'Secret key',
        placeholder: 'sk_live_…',
        secret: true,
        help: 'Stripe → Developers → API keys → Secret key.',
      },
      {
        key: 'publishable_key',
        label: 'Publishable key',
        placeholder: 'pk_live_…',
        secret: false,
        help: 'Used by the storefront to mount the card form.',
      },
      {
        key: 'webhook_secret',
        label: 'Webhook signing secret',
        placeholder: 'whsec_…',
        secret: true,
        optional: true,
        help: 'From the webhook endpoint you point at sparx. Optional but recommended.',
      },
    ],
    environments: false,
    sparxFee: false,
    feeNote: 'No sparx fee — you pay Stripe’s rates directly.',
    regions: ['US', 'CA', 'GB', 'EU', 'AU'],
    docsUrl: 'https://dashboard.stripe.com/apikeys',
  },
  {
    id: 'square',
    name: 'Square',
    blurb:
      'Use your existing Square account. Great if you also sell in person — your online and POS sales land in one Square balance. Shoppers pay on a Square-hosted page; no sparx fee.',
    onboarding: 'api_keys',
    checkout: 'redirect',
    capabilities: { refunds: true, capture: true, paymentLinks: true, webhooks: true },
    credentialFields: [
      {
        key: 'access_token',
        label: 'Access token',
        placeholder: 'EAAA…',
        secret: true,
        help: 'Square → Developer → your app → Production access token.',
      },
      {
        key: 'application_id',
        label: 'Application ID',
        placeholder: 'sq0idp-…',
        secret: false,
        help: 'Your Square application id (safe to expose).',
      },
      {
        key: 'location_id',
        label: 'Location ID',
        placeholder: 'L…',
        secret: false,
        help: 'The Square location to attribute sales to.',
      },
      {
        key: 'webhook_signature_key',
        label: 'Webhook signature key',
        secret: true,
        optional: true,
        help: 'From your Square webhook subscription. Optional but recommended.',
      },
    ],
    environments: true,
    sparxFee: false,
    feeNote: 'No sparx fee — you pay Square’s rates directly.',
    regions: ['US', 'CA', 'GB', 'AU', 'JP'],
    docsUrl: 'https://developer.squareup.com/apps',
  },
  {
    id: 'authorize_net',
    name: 'Authorize.net',
    blurb:
      'The classic for established US merchants. Keep your Authorize.net account and gateway rates — sparx routes checkout to an Authorize.net hosted payment page. No sparx fee.',
    onboarding: 'api_keys',
    checkout: 'redirect',
    capabilities: { refunds: true, capture: true, paymentLinks: true, webhooks: true },
    credentialFields: [
      {
        key: 'api_login_id',
        label: 'API Login ID',
        secret: false,
        help: 'Authorize.net → Account → Settings → API Credentials & Keys.',
      },
      {
        key: 'transaction_key',
        label: 'Transaction Key',
        secret: true,
        help: 'Generated alongside your API Login ID.',
      },
      {
        key: 'signature_key',
        label: 'Signature Key',
        secret: true,
        optional: true,
        help: 'For webhook verification. Optional but recommended.',
      },
    ],
    environments: true,
    sparxFee: false,
    feeNote: 'No sparx fee — you pay your Authorize.net rates directly.',
    regions: ['US', 'CA', 'GB', 'AU'],
    docsUrl: 'https://account.authorize.net/',
  },
  {
    id: 'first_pay',
    name: '1stPayGateway',
    blurb:
      'Common with ISO/agent-sold merchant accounts. Keep your 1stPayGateway processing — sparx routes checkout to a 1stPay hosted page. No sparx fee.',
    onboarding: 'api_keys',
    checkout: 'redirect',
    capabilities: { refunds: true, capture: false, paymentLinks: true, webhooks: true },
    credentialFields: [
      {
        key: 'gateway_id',
        label: 'Transaction Center ID',
        secret: false,
        help: 'Your 1stPayGateway Transaction Center / merchant id.',
      },
      {
        key: 'api_key',
        label: 'API key',
        secret: true,
        help: 'Your 1stPayGateway API key.',
      },
    ],
    environments: true,
    sparxFee: false,
    feeNote: 'No sparx fee — you pay your 1stPayGateway rates directly.',
    regions: ['US'],
    docsUrl: 'https://secure.1stpaygateway.net/',
  },
  {
    id: 'custom',
    name: 'Custom gateway',
    blurb:
      'Use any other processor. Point sparx at your gateway’s hosted checkout URL and credentials; sparx redirects shoppers there and reconciles on return. For full control, a developer can drop in a code adapter — see the plugin contract.',
    onboarding: 'api_keys',
    checkout: 'redirect',
    capabilities: { refunds: false, capture: false, paymentLinks: true, webhooks: true },
    credentialFields: [
      {
        key: 'hosted_url',
        label: 'Hosted checkout URL',
        placeholder: 'https://pay.yourgateway.com/checkout',
        secret: false,
        help: 'Where sparx sends shoppers to pay. sparx appends amount, reference, and return URL.',
      },
      {
        key: 'api_key',
        label: 'API key',
        secret: true,
        optional: true,
        help: 'Sent as a bearer token when sparx confirms/queries the payment, if your gateway needs one.',
      },
      {
        key: 'webhook_secret',
        label: 'Webhook secret',
        secret: true,
        optional: true,
        help: 'Shared secret sparx verifies inbound webhooks against, if your gateway signs them.',
      },
    ],
    environments: true,
    sparxFee: false,
    feeNote: 'No sparx fee — your processor’s rates apply.',
    regions: [],
  },
  {
    id: 'manual',
    name: 'Manual payments',
    blurb:
      'Record check, cash, wire, or ACH by hand. No online card payments and no fee — you mark orders and invoices paid yourself.',
    onboarding: 'manual',
    checkout: 'none',
    capabilities: { refunds: false, capture: false, paymentLinks: false, webhooks: false },
    credentialFields: [],
    environments: false,
    sparxFee: false,
    feeNote: 'No fee. No online card processing.',
    regions: [],
  },
] as const;

export function getGatewayDescriptor(id: string): GatewayDescriptor | undefined {
  return GATEWAY_CATALOG.find((g) => g.id === id);
}

/** Every gateway id the catalog knows. */
export const CATALOG_GATEWAY_IDS: readonly string[] = GATEWAY_CATALOG.map((g) => g.id);

/** The subset whose credentials a tenant captures + we encrypt (api_keys onboarding). */
export function isApiKeyGateway(id: string): boolean {
  return getGatewayDescriptor(id)?.onboarding === 'api_keys';
}
