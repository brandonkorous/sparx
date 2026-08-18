// Provider-agnostic domain-registrar contract.
//
// This package is the seam that lets sparx swap the underlying registrar
// (GoDaddy today; name.com next) without touching the purchase/DNS/lifecycle
// flows in api-rest and api-mcp. It contains ONLY:
//
//   - the `RegistrarClient` interface every provider implements,
//   - the shared wire types those methods exchange,
//   - `RegistrarError` (the neutral error every provider throws), and
//   - the registrar-NEUTRAL DNS helper (the sparx record set).
//
// It depends on no provider. Providers (`@wizeworks/godaddy`, future `@sparx/namecom`)
// depend on THIS — never the other way round — so the workspace graph stays
// acyclic. Selection happens in each service's composition root, not here.

// ─── Error ─────────────────────────────────────────────────────────────────

/**
 * The single error type callers catch regardless of which registrar is active.
 * `status` is the upstream HTTP status (0 when the failure was local, e.g. a
 * missing credential), so route handlers can branch on it without knowing the
 * provider.
 */
export class RegistrarError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'RegistrarError';
  }
}

// ─── Wire types ──────────────────────────────────────────────────────────────

export interface DomainAvailability {
  available: boolean;
  /** First-year registration price, in cents. */
  price: number;
  /** Renewal price, in cents (differs sharply from `price` for promo TLDs, e.g. .shop). */
  renewalPrice: number;
  currency: string;
  tld: string;
}

export interface DomainSuggestion {
  domain: string;
  available: boolean;
  /** First-year registration price, in cents. */
  price: number;
  /** Renewal price, in cents. */
  renewalPrice: number;
  currency: string;
  tld: string;
}

/** Full registrant contact — required for every domain registration (ICANN). */
export interface RegistrantContact {
  firstName: string;
  lastName: string;
  email: string;
  /** E.164 format: +1.4805551234 */
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  /** 2-letter state/province code. */
  state: string;
  postalCode: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
}

export interface DnsRecord {
  type: 'A' | 'AAAA' | 'CAA' | 'CNAME' | 'MX' | 'NS' | 'SRV' | 'TXT';
  name: string;
  data: string;
  ttl: number;
  priority?: number;
}

// ─── The contract ─────────────────────────────────────────────────────────────

/**
 * Every registrar provider implements this. Methods cover the registrar's API
 * operations only — building the sparx DNS record set is a caller concern (see
 * the neutral helper below), not provider behavior, so a new provider only has
 * to translate these calls to its own API.
 *
 * Providers MUST throw `RegistrarError` (not a provider-specific error) so
 * callers stay provider-agnostic.
 */
export interface RegistrarClient {
  /** Availability + pricing for a single exact domain. */
  checkAvailability(domain: string): Promise<DomainAvailability>;
  /** Name suggestions (with availability + pricing) for a keyword/business name. */
  getDomainSuggestions(query: string, tlds?: string[]): Promise<DomainSuggestion[]>;
  /** Register a domain. Returns the registrar's order id. */
  purchaseDomain(
    domain: string,
    years: number,
    registrant: RegistrantContact,
    privacy: boolean
  ): Promise<{ orderId: string }>;
  /** Replace ALL DNS records for a domain with the supplied set. */
  configureDNS(domain: string, records: DnsRecord[]): Promise<void>;
  /** Renew a registered domain. `orderId` is null when the registrar renews without one. */
  renewDomain(domain: string, years: number): Promise<{ orderId: string | null }>;
  /** Unlock the domain and return the transfer auth code so the owner can leave. */
  initiateTransferOut(domain: string): Promise<{ authCode: string }>;
  /** Toggle WHOIS privacy. */
  setPrivacy(domain: string, enabled: boolean): Promise<void>;
  /** Toggle registrar auto-renew. */
  setAutoRenew(domain: string, enabled: boolean): Promise<void>;
}

/** The active registrar, by env key. Extend as providers are added. */
export type RegistrarName = 'godaddy' | 'namecom';

// ─── TLD menu ──────────────────────────────────────────────────────────────
//
// The curated TLD menu for domain SEARCH (registrar-neutral product decision, so
// it lives with the contract — every provider's suggestion call defaults to it).
// The list IS the menu the tenant sees: classics, tech/startup, commerce, and
// business/content/lifestyle TLDs, all in the affordable tier. Premium-priced
// TLDs (.ai ~$420/yr, .inc, .llc, …) are intentionally excluded so a ~$12 search
// never sits beside a $400+ outlier — they remain reachable by EXACT domain via
// checkAvailability(). Callers can override with a narrower/wider set.

export const DEFAULT_TLDS = [
  // classics + generic
  'com',
  'co',
  'net',
  'org',
  'info',
  'biz',
  // tech / startup
  'io',
  'app',
  'dev',
  'tech',
  'xyz',
  'digital',
  'space',
  // commerce
  'shop',
  'store',
  'online',
  'site',
  // business / services / brand
  'works',
  'agency',
  'group',
  'pro',
  'studio',
  'design',
  'media',
  // content / audience / lifestyle
  'blog',
  'me',
  'world',
  'life',
  'live',
  'club',
];

// ─── Registrar-neutral helpers ─────────────────────────────────────────────────
//
// This builds sparx's DESIRED state for a purchased domain: the WEB records
// that point the domain at sparx hosting. It is identical no matter which
// registrar applies it, so it lives with the contract rather than inside any
// one provider.
//
// Email-authentication records (SPF, DKIM, DMARC) are intentionally NOT here.
// They are owned entirely by the Mailgun sending-domain flow
// (@wizeworks/email-platform domain-service + @wizeworks/email admin/mailgun-domains),
// which provisions the correct per-domain records — `v=spf1 include:mailgun.org`,
// a `mx._domainkey` DKIM key, and DMARC — when the tenant verifies their sending
// domain. Seeding our own SPF here would put a SECOND `v=spf1` record on the
// domain the moment they verify, and a domain may have exactly one — two is an
// SPF permerror that fails authentication outright. The old SPF/DKIM/DMARC/MX
// set here pointed at decommissioned Postal infra.

/**
 * The canonical WEB DNS record set for a purchased domain (docs/24 §3).
 *
 * `zoneDomain` is the TENANT's zone — this is what a customer is told to point
 * their own domain at, and it must wear their brand's name, not another
 * company's. Both records were the literal `customers.sparx.zone`, so a Piggles
 * customer buying a domain had it pointed at sparx's ingress. Same address
 * either way, which is exactly why nothing broke and nobody noticed.
 *
 * Absent → the deployment's default zone, which is right for the brand that
 * deployment was set up for and is all there was before there were two.
 */
export function buildSparxDnsRecords(zoneDomain?: string | null): DnsRecord[] {
  const target = `customers.${zoneDomain?.trim() || DEFAULT_ZONE_DOMAIN}`;
  return [
    { type: 'CNAME', name: '@', data: target, ttl: 600 },
    { type: 'CNAME', name: 'www', data: target, ttl: 600 },
  ];
}

/** The zone this deployment mints subdomains in when no brand says otherwise.
 *  The FIRST entry of `SPARX_ZONE_DOMAINS`, matching wizeworks/services/api-rest's own
 *  reading of it, so the two cannot drift. */
const DEFAULT_ZONE_DOMAIN =
  (process.env.SPARX_ZONE_DOMAINS ?? process.env.SPARX_ZONE_DOMAIN ?? 'sparx.zone')
    .split(',')[0]
    ?.trim() || 'sparx.zone';
