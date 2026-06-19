// Provider-agnostic domain-registrar contract.
//
// This package is the seam that lets sparx swap the underlying registrar
// (GoDaddy today; name.com next) without touching the purchase/DNS/lifecycle
// flows in api-rest and api-mcp. It contains ONLY:
//
//   - the `RegistrarClient` interface every provider implements,
//   - the shared wire types those methods exchange,
//   - `RegistrarError` (the neutral error every provider throws), and
//   - the registrar-NEUTRAL DNS/DKIM helpers (the sparx record set + keypair).
//
// It depends on no provider. Providers (`@sparx/godaddy`, future `@sparx/namecom`)
// depend on THIS — never the other way round — so the workspace graph stays
// acyclic. Selection happens in each service's composition root, not here.

import { generateKeyPairSync } from 'node:crypto';

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
 * operations only — building the sparx DNS record set and the DKIM keypair are
 * caller concerns (see the neutral helpers below), not provider behavior, so a
 * new provider only has to translate these calls to its own API.
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
// These build sparx's DESIRED state (the record set we want, a DKIM keypair).
// They are identical no matter which registrar applies them, so they live with
// the contract rather than inside any one provider.

/** The canonical sparx DNS record set for a purchased domain (docs/24 §3). */
export function buildSparxDnsRecords(dkimPublicKey: string): DnsRecord[] {
  return [
    { type: 'CNAME', name: '@', data: 'customers.sparx.zone', ttl: 600 },
    { type: 'CNAME', name: 'www', data: 'customers.sparx.zone', ttl: 600 },
    { type: 'TXT', name: '@', data: 'v=spf1 include:_spf.sparx.email ~all', ttl: 3600 },
    {
      type: 'TXT',
      name: 'sparx._domainkey',
      data: `v=DKIM1; k=rsa; p=${dkimPublicKey}`,
      ttl: 3600,
    },
    {
      type: 'TXT',
      name: '_dmarc',
      data: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@sparx.email',
      ttl: 3600,
    },
    { type: 'MX', name: '@', data: 'mail.sparx.email', ttl: 3600, priority: 10 },
  ];
}

/**
 * Generate an RSA-2048 DKIM keypair. Returns:
 *   - publicKey: stripped PEM ready for the DKIM TXT `p=` value
 *   - privateKey: PKCS8 PEM for signing outbound mail
 */
export function generateDkimKeypair(): { publicKey: string; privateKey: string } {
  const { publicKey: pubPem, privateKey: privPem } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const dkimPublicKey = pubPem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');

  return { publicKey: dkimPublicKey, privateKey: privPem };
}
