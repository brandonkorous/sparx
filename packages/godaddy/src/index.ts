// GoDaddy Reseller API client (docs/24 §3, docs/24 §5).
//
// Reads OTE vs production credentials from process.env. All domain purchase,
// DNS configuration, and lifecycle operations go through this module.
//
// Auth: `sso-key {KEY}:{SECRET}` header per the GoDaddy Reseller API spec.
// OTE base: https://api.ote-godaddy.com
// Prod base: https://api.godaddy.com

import { generateKeyPairSync } from 'node:crypto';

const OTE_BASE = 'https://api.ote-godaddy.com';
const PROD_BASE = 'https://api.godaddy.com';

function baseUrl(): string {
  return process.env['NODE_ENV'] === 'production' ? PROD_BASE : OTE_BASE;
}

function authHeader(): string {
  const isProd = process.env['NODE_ENV'] === 'production';
  const key = isProd ? process.env['GODADDY_API_KEY_PROD'] : process.env['GODADDY_API_KEY_OTE'];
  const secret = isProd
    ? process.env['GODADDY_API_SECRET_PROD']
    : process.env['GODADDY_API_SECRET_OTE'];
  if (!key || !secret) {
    throw new GoDaddyError(
      `GoDaddy ${isProd ? 'production' : 'OTE'} API credentials not configured`,
      0
    );
  }
  return `sso-key ${key}:${secret}`;
}

async function gd<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    let message = `GoDaddy ${method} ${path} → HTTP ${res.status}`;
    try {
      const err = (await res.json()) as { message?: string; code?: string };
      if (err.message) message += `: ${err.message}`;
      if (err.code) message += ` (${err.code})`;
    } catch {
      // JSON parse failure — use the status-only message
    }
    throw new GoDaddyError(message, res.status);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ─── Error class ─────────────────────────────────────────────────────────────

export class GoDaddyError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'GoDaddyError';
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DomainAvailability {
  available: boolean;
  /** Wholesale price in cents. */
  price: number;
  currency: string;
  tld: string;
}

export interface DomainSuggestion {
  domain: string;
  available: boolean;
  /** Wholesale price in cents. */
  price: number;
  currency: string;
  tld: string;
}

/** Full registrant contact — required for every GoDaddy domain registration. */
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

// GoDaddy response shapes (internal)
interface GdAvailableResponse {
  available: boolean;
  price?: number;
  currency?: string;
  period?: number;
  tld?: string;
}

interface GdSuggestion {
  domain: string;
  available?: boolean;
  price?: number;
  currency?: string;
  tld?: string;
}

interface GdPurchaseResponse {
  orderId: number | string;
}

interface GdRenewResponse {
  orderId?: number | string;
}

interface GdTransferOutResponse {
  authCode: string;
}

// ─── Availability + suggestions ──────────────────────────────────────────────

export async function checkAvailability(domain: string): Promise<DomainAvailability> {
  const res = await gd<GdAvailableResponse>(
    'GET',
    `/v1/domains/available?domain=${encodeURIComponent(domain)}&checkType=FAST`
  );
  return {
    available: res.available,
    price: res.price ?? 0,
    currency: res.currency ?? 'USD',
    tld: res.tld ?? domain.split('.').slice(1).join('.'),
  };
}

const DEFAULT_TLDS = ['com', 'net', 'org', 'co', 'io', 'shop', 'store', 'app'];

export async function getDomainSuggestions(
  query: string,
  tlds: string[] = DEFAULT_TLDS
): Promise<DomainSuggestion[]> {
  const tldParam = tlds.join(',');
  const items = await gd<GdSuggestion[]>(
    'GET',
    `/v1/domains/suggest?query=${encodeURIComponent(query)}&tlds=${tldParam}&limit=10`
  );
  return items.map((s) => ({
    domain: s.domain,
    available: s.available ?? true,
    price: s.price ?? 0,
    currency: s.currency ?? 'USD',
    tld: s.tld ?? s.domain.split('.').slice(1).join('.'),
  }));
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

export async function purchaseDomain(
  domain: string,
  years: number,
  registrant: RegistrantContact,
  privacy: boolean
): Promise<{ orderId: string }> {
  const contact = {
    firstName: registrant.firstName,
    lastName: registrant.lastName,
    email: registrant.email,
    phone: registrant.phone,
    addressMailing: {
      address1: registrant.address1,
      ...(registrant.address2 ? { address2: registrant.address2 } : {}),
      city: registrant.city,
      state: registrant.state,
      postalCode: registrant.postalCode,
      country: registrant.country,
    },
  };

  const res = await gd<GdPurchaseResponse>('POST', '/v1/domains/purchase', {
    domain,
    period: years,
    renewAuto: true,
    privacy,
    consent: {
      agreedAt: new Date().toISOString(),
      agreedBy: registrant.email,
      agreementKeys: ['DNRA'],
    },
    contactAdmin: contact,
    contactBilling: contact,
    contactRegistrant: contact,
    contactTech: contact,
  });

  return { orderId: String(res.orderId) };
}

// ─── DNS configuration ────────────────────────────────────────────────────────

/** Replace ALL DNS records for a domain with the supplied records. */
export async function configureDNS(domain: string, records: DnsRecord[]): Promise<void> {
  await gd<void>('PUT', `/v1/domains/${encodeURIComponent(domain)}/records`, records);
}

/** The canonical Sparx DNS record set for a purchased domain (docs/24 §3). */
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

// ─── DKIM keypair ─────────────────────────────────────────────────────────────

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

// ─── Renewal ──────────────────────────────────────────────────────────────────

export async function renewDomain(
  domain: string,
  years: number
): Promise<{ orderId: string | null }> {
  const res = await gd<GdRenewResponse>('POST', `/v1/domains/${encodeURIComponent(domain)}/renew`, {
    period: years,
  });
  return { orderId: res.orderId != null ? String(res.orderId) : null };
}

// ─── Transfer out ─────────────────────────────────────────────────────────────

export async function initiateTransferOut(domain: string): Promise<{ authCode: string }> {
  await gd<void>('PATCH', `/v1/domains/${encodeURIComponent(domain)}`, { locked: false });
  const res = await gd<GdTransferOutResponse>(
    'GET',
    `/v1/domains/${encodeURIComponent(domain)}/transferOut`
  );
  return { authCode: res.authCode };
}

// ─── Settings toggles ─────────────────────────────────────────────────────────

export async function setPrivacy(domain: string, enabled: boolean): Promise<void> {
  await gd<void>('PATCH', `/v1/domains/${encodeURIComponent(domain)}`, { privacy: enabled });
}

export async function setAutoRenew(domain: string, enabled: boolean): Promise<void> {
  await gd<void>('PATCH', `/v1/domains/${encodeURIComponent(domain)}`, { renewAuto: enabled });
}
