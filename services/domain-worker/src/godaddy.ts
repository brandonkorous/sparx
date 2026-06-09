// Minimal GoDaddy API subset for the domain-worker: DNS configuration retry
// and the Sparx DNS record set builder. Only configureDNS and buildSparxDnsRecords
// are needed here — the full client lives in services/api-rest/src/lib/godaddy.ts.

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
    public readonly status: number,
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

export async function configureDNS(domain: string, records: DnsRecord[]): Promise<void> {
  await gd('PUT', `/v1/domains/${encodeURIComponent(domain)}/records`, records);
}

export function buildSparxDnsRecords(dkimPublicKey: string): DnsRecord[] {
  const cnameTarget = env.SPARX_CNAME_TARGET;
  return [
    { type: 'CNAME', name: '@', data: cnameTarget, ttl: 3600 },
    { type: 'CNAME', name: 'www', data: cnameTarget, ttl: 3600 },
    { type: 'TXT', name: '@', data: 'v=spf1 include:mailgun.org ~all', ttl: 3600 },
    {
      type: 'TXT',
      name: 'sparx._domainkey',
      data: `v=DKIM1; k=rsa; p=${dkimPublicKey}`,
      ttl: 3600,
    },
    {
      type: 'TXT',
      name: '_dmarc',
      data: 'v=DMARC1; p=none; rua=mailto:postmaster@sparx.email',
      ttl: 3600,
    },
    { type: 'MX', name: '@', data: 'mail.sparx.email', ttl: 3600, priority: 10 },
  ];
}
