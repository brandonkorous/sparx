// Minimal GoDaddy API subset for the domain-worker: DNS configuration retry
// and the sparx DNS record set builder. Only configureDNS and buildSparxDnsRecords
// are needed here — the full client lives in the @sparx/godaddy package.
//
// NOTE: this is a standalone copy that has NOT yet been migrated to the
// @sparx/registrar `RegistrarClient` contract (unlike api-rest / api-mcp).
// Before name.com goes live this worker must move onto the contract too —
// otherwise a DNS-config retry for a name.com-registered domain would still
// call GoDaddy. At that point this copy of buildSparxDnsRecords should be
// deleted in favour of the contract's.

import { platformBrandIdentity } from '@wizeworks/brand-core';
import { env } from './env.js';

const IS_PROD = env.NODE_ENV === 'production';
const BASE_URL = IS_PROD ? 'https://api.godaddy.com' : 'https://api.ote-godaddy.com';

function authHeader(): string {
  const key = IS_PROD ? env.GODADDY_API_KEY_PROD : env.GODADDY_API_KEY_OTE;
  const secret = IS_PROD ? env.GODADDY_API_SECRET_PROD : env.GODADDY_API_SECRET_OTE;
  return `sso-key ${key ?? ''}:${secret ?? ''}`;
}

export interface DnsRecord {
  type: 'A' | 'AAAA' | 'CAA' | 'CNAME' | 'MX' | 'NS' | 'SRV' | 'TXT';
  name: string;
  data: string;
  ttl: number;
  priority?: number;
}

export class GoDaddyError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'GoDaddyError';
  }
}

async function gd(method: string, path: string, body?: unknown): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    let message = `GoDaddy API ${method} ${path} → ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string };
      if (j.message) message = j.message;
    } catch {
      // ignore JSON parse failure — use the default message
    }
    throw new GoDaddyError(message, res.status);
  }
}

/** The shared ingress, under the brand's OWN name — `customers.piggles.site`
 *  for a Piggles tenant, `customers.sparx.zone` for a sparx one. Same address. */
export function cnameTargetFor(brand?: string | null): string {
  const zone = platformBrandIdentity(brand).zoneDomain;
  return zone ? `customers.${zone}` : env.SPARX_CNAME_TARGET;
}

export async function configureDNS(domain: string, records: DnsRecord[]): Promise<void> {
  await gd('PUT', `/v1/domains/${encodeURIComponent(domain)}/records`, records);
}

// WEB records only. Email-authentication records (SPF, DKIM, DMARC) are owned
// by the Mailgun sending-domain flow, which sets the correct per-domain SPF
// (`include:mailgun.org`), `mx._domainkey` DKIM, and DMARC at domain
// verification. Seeding SPF here too would put a second `v=spf1` record on the
// domain — an SPF permerror. The old SPF/DKIM/DMARC/MX set was Postal-era.
// `brand` is the TENANT's, not the deployment's: one worker drains the queue for
// every brand, and a customer must never be told to point their own domain at
// another company's hostname. Absent → the deployment default, which is right for
// the brand that deployment was set up for and is all there ever was before.
export function buildSparxDnsRecords(brand?: string | null): DnsRecord[] {
  const cnameTarget = cnameTargetFor(brand);
  return [
    { type: 'CNAME', name: '@', data: cnameTarget, ttl: 3600 },
    { type: 'CNAME', name: 'www', data: cnameTarget, ttl: 3600 },
  ];
}
