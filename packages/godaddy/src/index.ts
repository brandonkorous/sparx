// GoDaddy Reseller API client (docs/24 §3, docs/24 §5) — one implementation of
// the provider-agnostic `RegistrarClient` contract in @sparx/registrar.
//
// Reads OTE vs production credentials from process.env. All domain purchase,
// DNS configuration, and lifecycle operations go through this module.
//
// Auth: `sso-key {KEY}:{SECRET}` header per the GoDaddy Reseller API spec.
// OTE base: https://api.ote-godaddy.com
// Prod base: https://api.godaddy.com
//
// Consumers should depend on the `RegistrarClient` interface and obtain an
// instance via `createGoDaddyRegistrar()` (or their service's registrar
// resolver), not on the free functions below — that is what keeps name.com a
// drop-in swap. The free functions remain exported as the implementation.

import {
  DEFAULT_TLDS,
  RegistrarError,
  buildSparxDnsRecords,
  generateDkimKeypair,
  type DnsRecord,
  type DomainAvailability,
  type DomainSuggestion,
  type RegistrantContact,
  type RegistrarClient,
} from '@sparx/registrar';

// Re-export the contract surface so existing `@sparx/godaddy` importers keep
// working: the shared types, the TLD menu, the neutral DNS/DKIM helpers, and
// the error.
export {
  DEFAULT_TLDS,
  RegistrarError,
  buildSparxDnsRecords,
  generateDkimKeypair,
  type DnsRecord,
  type DomainAvailability,
  type DomainSuggestion,
  type RegistrantContact,
  type RegistrarClient,
};

const OTE_BASE = 'https://api.ote-godaddy.com';
const PROD_BASE = 'https://api.godaddy.com';

/**
 * Which GoDaddy environment to talk to.
 *
 * Defaults to following NODE_ENV (`production` → prod, else OTE), but an explicit
 * `GODADDY_ENV` (`prod`|`production` / `ote`|`test`) overrides it. This decouples
 * the registrar environment from NODE_ENV so local dev / staging can point at the
 * production READ endpoints — `available` and `suggest` cost nothing; only
 * `purchase` charges — which is necessary because GoDaddy's OTE sandbox is
 * chronically degraded (it returns blanket 500 ERROR_INTERNAL across all
 * endpoints). Production is unaffected: NODE_ENV=production still resolves to prod
 * with no GODADDY_ENV set.
 */
function resolveEnv(): 'prod' | 'ote' {
  const explicit = process.env.GODADDY_ENV?.trim().toLowerCase();
  if (explicit === 'prod' || explicit === 'production') return 'prod';
  if (explicit === 'ote' || explicit === 'test') return 'ote';
  return process.env.NODE_ENV === 'production' ? 'prod' : 'ote';
}

function baseUrl(): string {
  return resolveEnv() === 'prod' ? PROD_BASE : OTE_BASE;
}

function authHeader(): string {
  const isProd = resolveEnv() === 'prod';
  const key = isProd ? process.env.GODADDY_API_KEY_PROD : process.env.GODADDY_API_KEY_OTE;
  const secret = isProd ? process.env.GODADDY_API_SECRET_PROD : process.env.GODADDY_API_SECRET_OTE;
  if (!key || !secret) {
    const suffix = isProd ? 'PROD' : 'OTE';
    throw new RegistrarError(
      `GoDaddy ${isProd ? 'production' : 'OTE'} API credentials not configured ` +
        `(set GODADDY_API_KEY_${suffix} / GODADDY_API_SECRET_${suffix})`,
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
    throw new RegistrarError(message, res.status);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** GoDaddy returns prices in micro-units (USD * 1,000,000). Convert to integer
 *  cents — the unit the rest of sparx (markup, Stripe, UI) speaks. */
function microToCents(micro: number | undefined | null): number {
  return micro != null ? Math.round(micro / 10000) : 0;
}

// GoDaddy response shapes (internal)
interface GdAvailableResponse {
  available: boolean;
  price?: number;
  renewalPrice?: number;
  currency?: string;
  period?: number;
  tld?: string;
}

interface GdBulkAvailableResponse {
  domains?: {
    domain: string;
    available?: boolean;
    price?: number;
    renewalPrice?: number;
    currency?: string;
  }[];
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
  // checkType=FULL: live registry query — accurate but slower. This is the
  // AUTHORITATIVE single-domain check (drives /check, the exact-host result, and
  // the purchase pre-flight), so correctness wins over latency: FAST is served
  // from a cache GoDaddy itself flags as "less accurate" and was returning wrong
  // availability for recently registered/dropped names. The bulk suggestion-list
  // enrichment below stays on FAST (a type-ahead list of look-alikes where speed
  // matters more than precision).
  const res = await gd<GdAvailableResponse>(
    'GET',
    `/v1/domains/available?domain=${encodeURIComponent(domain)}&checkType=FULL`
  );
  return {
    available: res.available,
    price: microToCents(res.price),
    renewalPrice: microToCents(res.renewalPrice ?? res.price),
    currency: res.currency ?? 'USD',
    tld: res.tld ?? domain.split('.').slice(1).join('.'),
  };
}

/** Bulk availability + pricing for many domains in one call. `suggest` returns
 *  names only (no price), so a suggestion batch is enriched through this. Returns
 *  a map keyed by domain; taken/missing domains simply aren't present. */
async function checkAvailabilityBulk(
  domains: string[]
): Promise<
  Map<string, { available: boolean; price: number; renewalPrice: number; currency: string }>
> {
  const map = new Map<
    string,
    { available: boolean; price: number; renewalPrice: number; currency: string }
  >();
  if (domains.length === 0) return map;
  // Intentionally FAST here (unlike the authoritative single check, which is
  // FULL): this enriches the suggestion type-ahead list, where a quick response
  // across many names matters more than per-name precision — and the exact host
  // the tenant actually cares about is re-checked with FULL via checkAvailability.
  const res = await gd<GdBulkAvailableResponse>(
    'POST',
    '/v1/domains/available?checkType=FAST',
    domains
  );
  for (const d of res.domains ?? []) {
    map.set(d.domain, {
      available: d.available ?? false,
      price: microToCents(d.price),
      renewalPrice: microToCents(d.renewalPrice ?? d.price),
      currency: d.currency ?? 'USD',
    });
  }
  return map;
}

// The curated TLD menu (`DEFAULT_TLDS`) is registrar-neutral and lives in
// @sparx/registrar — the suggest endpoint surfaces exactly these. Callers can
// override `tlds` for a narrower/wider set.
export async function getDomainSuggestions(
  query: string,
  tlds: string[] = DEFAULT_TLDS
): Promise<DomainSuggestion[]> {
  const tldParam = tlds.join(',');
  const items = await gd<GdSuggestion[]>(
    'GET',
    `/v1/domains/suggest?query=${encodeURIComponent(query)}&tlds=${tldParam}&limit=20`
  );

  // `suggest` returns names only — enrich with real availability + pricing in a
  // single bulk call. Best-effort: if pricing fails, fall back to unpriced names
  // rather than erroring the whole search.
  let priced: Awaited<ReturnType<typeof checkAvailabilityBulk>> = new Map();
  try {
    priced = await checkAvailabilityBulk(items.map((s) => s.domain));
  } catch {
    // leave `priced` empty
  }

  return items.map((s) => {
    const p = priced.get(s.domain);
    return {
      domain: s.domain,
      available: p?.available ?? s.available ?? true,
      price: p?.price ?? 0,
      renewalPrice: p?.renewalPrice ?? p?.price ?? 0,
      currency: p?.currency ?? s.currency ?? 'USD',
      tld: s.tld ?? s.domain.split('.').slice(1).join('.'),
    };
  });
}

// ─── Legal agreements (GoDaddy-specific) ───────────────────────────────────────

export interface DomainAgreement {
  agreementKey: string;
  title: string;
  url: string;
}

interface GdAgreement {
  agreementKey: string;
  title?: string;
  url?: string;
}

/**
 * The registration agreements GoDaddy requires for a TLD. The purchase consent
 * must echo back exactly these `agreementKey`s — they vary by TLD and by whether
 * WHOIS privacy is added, so they MUST be fetched per purchase, not hardcoded.
 * Hardcoding 'DNRA' only covers gTLDs like .com/.net/.org; other TLDs reject the
 * purchase with HTTP 400 when the consented keys don't match.
 */
export async function getDomainAgreements(
  tld: string,
  privacy: boolean,
  forTransfer = false
): Promise<DomainAgreement[]> {
  const items = await gd<GdAgreement[]>(
    'GET',
    `/v1/domains/agreements?tlds=${encodeURIComponent(tld)}&privacy=${privacy}&forTransfer=${forTransfer}`
  );
  return items.map((a) => ({
    agreementKey: a.agreementKey,
    title: a.title ?? '',
    url: a.url ?? '',
  }));
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

export async function purchaseDomain(
  domain: string,
  years: number,
  registrant: RegistrantContact,
  privacy: boolean
): Promise<{ orderId: string }> {
  // Fetch and consent to exactly the agreements GoDaddy requires for THIS TLD
  // (plus the privacy add-on) — they vary by TLD, so never hardcode the keys.
  const tld = domain.split('.').slice(1).join('.');
  const agreementKeys = (await getDomainAgreements(tld, privacy)).map((a) => a.agreementKey);
  if (agreementKeys.length === 0) {
    throw new RegistrarError(
      `GoDaddy returned no registration agreements for .${tld}; cannot purchase.`,
      0
    );
  }

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
      agreementKeys,
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

// ─── RegistrarClient factory ────────────────────────────────────────────────

/**
 * A `RegistrarClient` backed by GoDaddy. The methods bind to the module
 * functions above; GoDaddy's per-TLD agreement fetch is handled inside
 * `purchaseDomain`, so it never surfaces on the neutral contract.
 */
export function createGoDaddyRegistrar(): RegistrarClient {
  return {
    checkAvailability,
    getDomainSuggestions,
    purchaseDomain,
    configureDNS,
    renewDomain,
    initiateTransferOut,
    setPrivacy,
    setAutoRenew,
  };
}
