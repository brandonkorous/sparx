/**
 * Asking the internet two questions: what does this domain publish, and is this
 * name taken.
 *
 * These are the only two tools of the seventeen that send anything anywhere, and
 * the assurance strip on both pages says so in as many words. Both use public
 * services designed to be queried from a browser, and neither sends anything but
 * the domain name itself.
 *
 * ── WHY DNS-OVER-HTTPS ──────────────────────────────────────────────────────
 *
 * A browser cannot make an ordinary DNS query — there is no API for it, and
 * there never will be, because DNS runs over UDP on a port scripts cannot reach.
 * DNS-over-HTTPS exists partly for this and answers over ordinary HTTPS in JSON.
 * Cloudflare's resolver is used because it supports the JSON form, allows
 * cross-origin requests, and does not require a key.
 */

const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';

export type DnsRecordType = 'TXT' | 'MX' | 'A' | 'CNAME' | 'NS';

export interface DnsAnswer {
  name: string;
  type: number;
  data: string;
}

export class LookupError extends Error {}

async function query(name: string, type: DnsRecordType): Promise<DnsAnswer[]> {
  const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(name)}&type=${type}`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { accept: 'application/dns-json' } });
  } catch {
    throw new LookupError(
      'Could not reach the lookup service. Check your connection — this is the one part of this tool that needs one.'
    );
  }

  if (!response.ok) {
    throw new LookupError(`The lookup service answered with an error (${response.status}).`);
  }

  const body = (await response.json()) as { Status?: number; Answer?: DnsAnswer[] };

  // Status 3 is NXDOMAIN — the name does not exist at all, which is a real
  // answer rather than a failure and is worth saying differently from "no
  // records of that type".
  if (body.Status === 3) throw new LookupError(`There is no domain called ${name}.`);
  if (body.Status !== 0 && body.Status !== undefined) {
    throw new LookupError(`The lookup did not succeed (code ${body.Status}).`);
  }

  return (body.Answer ?? []).map((a) => ({
    ...a,
    // TXT records come back wrapped in quotes, and long ones arrive as several
    // quoted chunks that have to be joined — a DKIM key is routinely split this
    // way, and treating the chunks as separate records is why so many checkers
    // report a valid key as malformed.
    data: a.data.replace(/^"|"$/g, '').replace(/"\s+"/g, ''),
  }));
}

export interface EmailAuthFinding {
  kind: 'spf' | 'dkim' | 'dmarc';
  /** `good` — present and sensible. `warn` — present but worth looking at.
   *  `bad` — missing, or actively broken. `unknown` — we could not tell, which
   *  is deliberately NOT folded into `bad`. */
  status: 'good' | 'warn' | 'bad' | 'unknown';
  /** The heading, in plain words. */
  title: string;
  /** What it means and what to do, for somebody who has never seen a DNS
   *  record. */
  detail: string;
  /** The record as published, when there is one. */
  record?: string;
}

export async function checkSpf(domain: string): Promise<EmailAuthFinding> {
  const answers = await query(domain, 'TXT');
  const spf = answers.filter((a) => /^v=spf1/i.test(a.data));

  if (spf.length === 0) {
    return {
      kind: 'spf',
      status: 'bad',
      title: 'No SPF record',
      detail:
        'Nothing on this domain says which services are allowed to send email as you. Receiving mail servers have no way to tell your invoices from somebody pretending to be you, and many will treat both with suspicion.',
    };
  }

  if (spf.length > 1) {
    return {
      kind: 'spf',
      status: 'bad',
      title: `${spf.length} SPF records — one too many`,
      detail:
        'A domain may only publish one SPF record. Most mail servers treat two as an error and ignore both, which fails every message at once. This usually happens after signing up for a new email service and pasting in its record alongside the existing one — the fix is to merge them into a single line.',
      record: spf.map((s) => s.data).join('\n'),
    };
  }

  const record = spf[0]!.data;
  const lookups = (record.match(/\b(include|a|mx|ptr|exists|redirect):?/gi) ?? []).length;

  if (/[?~-]all/.test(record) === false) {
    return {
      kind: 'spf',
      status: 'warn',
      title: 'SPF record has no ending',
      detail:
        'The record does not say what to do about senders it has not listed. Ending it with ~all tells receiving servers to treat anything else as suspicious, which is the setting to start with.',
      record,
    };
  }

  if (record.includes('+all')) {
    return {
      kind: 'spf',
      status: 'bad',
      title: 'SPF record allows anybody',
      detail:
        'This record ends in +all, which tells the world that any server at all may send email as your domain. That is the same as having no record, except it looks deliberate. It should almost always be ~all.',
      record,
    };
  }

  if (lookups > 10) {
    return {
      kind: 'spf',
      status: 'warn',
      title: 'SPF record does too much looking up',
      detail: `This record needs about ${lookups} lookups to evaluate, and the limit is ten — past that, servers give up and the check fails. It usually means several services have been added over the years. Removing ones you no longer use is the usual fix.`,
      record,
    };
  }

  return {
    kind: 'spf',
    status: 'good',
    title: 'SPF record looks right',
    detail:
      'One record, a sensible ending, and within the lookup limit. This tells receiving servers which services may send email as you.',
    record,
  };
}

export async function checkDmarc(domain: string): Promise<EmailAuthFinding> {
  const answers = await query(`_dmarc.${domain}`, 'TXT').catch(() => [] as DnsAnswer[]);
  const dmarc = answers.find((a) => /^v=DMARC1/i.test(a.data));

  if (!dmarc) {
    return {
      kind: 'dmarc',
      status: 'bad',
      title: 'No DMARC record',
      detail:
        'Nothing tells receiving servers what to do when a message fails the other checks, and nothing reports back to you about who is sending email as your domain. The large mail providers now expect this from anybody sending in volume.',
    };
  }

  const policy = /p=(\w+)/i.exec(dmarc.data)?.[1]?.toLowerCase();
  const reports = /rua=/i.test(dmarc.data);

  if (policy === 'none') {
    return {
      kind: 'dmarc',
      status: reports ? 'good' : 'warn',
      title: reports ? 'DMARC is in monitoring mode' : 'DMARC is monitoring, but reporting nowhere',
      detail: reports
        ? 'This is the right place to start: nothing is being rejected, and reports are coming to you about everything sending as your domain. Once those reports look clean, tighten the policy to quarantine.'
        : 'The policy is set to monitor, but no reporting address is given — so nothing is being enforced AND nobody is being told anything. Add an rua address so the monitoring produces something you can read.',
      record: dmarc.data,
    };
  }

  return {
    kind: 'dmarc',
    status: 'good',
    title: `DMARC is set to ${policy ?? 'a policy'}`,
    detail:
      policy === 'reject'
        ? 'The strictest setting: mail that fails the checks is refused outright. Right for an established sender, and worth confirming your own services all pass before leaving it here.'
        : 'Mail that fails the checks goes to the spam folder rather than the inbox. A sensible middle setting.',
    record: dmarc.data,
  };
}

/** DKIM cannot be found without knowing the selector — the name your mail
 *  provider publishes it under — so the common ones are tried. A miss is
 *  reported as "could not find", never as "missing": those are different facts
 *  and only one of them is a problem. */
export async function checkDkim(domain: string, selectors: string[]): Promise<EmailAuthFinding> {
  for (const selector of selectors) {
    const answers = await query(`${selector}._domainkey.${domain}`, 'TXT').catch(
      () => [] as DnsAnswer[]
    );
    const found = answers.find((a) => /(v=DKIM1|k=rsa|p=)/i.test(a.data));
    if (found) {
      const key = /p=([A-Za-z0-9+/=]+)/.exec(found.data)?.[1] ?? '';
      // A published record with an empty key is how a provider marks a key as
      // revoked. It looks like a valid record and stops all signing.
      if (key.length === 0) {
        return {
          kind: 'dkim',
          status: 'bad',
          title: `DKIM key at “${selector}” is empty`,
          detail:
            'There is a record here but it carries no key, which is how a revoked key is published. Signing will not work until your mail provider issues a new one.',
          record: found.data,
        };
      }
      return {
        kind: 'dkim',
        status: 'good',
        title: `DKIM key found at “${selector}”`,
        detail:
          'Your mail is being signed, so receiving servers can confirm messages really came from you and were not altered on the way.',
        record: found.data,
      };
    }
  }

  return {
    kind: 'dkim',
    status: 'unknown',
    title: 'Could not find a DKIM key',
    detail: `DKIM keys are published under a name your mail provider chooses, and there is no way to list them — they can only be guessed at. The usual ones were tried (${selectors.join(', ')}) without a match. That does not mean you have no DKIM: check your mail provider's settings for the exact name, and try it above.`,
  };
}

/** The selectors used by the common providers, tried in turn. */
export const COMMON_DKIM_SELECTORS = [
  'google',
  'selector1',
  'selector2',
  'k1',
  'k2',
  's1',
  's2',
  'mail',
  'dkim',
  'default',
  'mandrill',
  'zmail',
  'pm',
  'mailjet',
  'sig1',
];

// ── GENERATING THE RECORDS ──────────────────────────────────────────────────

export interface SpfInput {
  /** Which services send on your behalf. */
  includes: string[];
  /** Also allow whatever your website's own server is. */
  allowA: boolean;
  /** Also allow your incoming mail servers. */
  allowMx: boolean;
  policy: '~all' | '-all' | '?all';
}

export function buildSpf(input: SpfInput): string {
  const parts = ['v=spf1'];
  if (input.allowA) parts.push('a');
  if (input.allowMx) parts.push('mx');
  for (const include of input.includes) if (include.trim()) parts.push(`include:${include.trim()}`);
  parts.push(input.policy);
  return parts.join(' ');
}

export function buildDmarc(input: {
  policy: 'none' | 'quarantine' | 'reject';
  reportTo: string;
  percentage: number;
}): string {
  const parts = [`v=DMARC1`, `p=${input.policy}`];
  if (input.reportTo.trim()) parts.push(`rua=mailto:${input.reportTo.trim()}`);
  if (input.percentage < 100) parts.push(`pct=${input.percentage}`);
  parts.push('adkim=r', 'aspf=r');
  return parts.join('; ');
}

/** The senders people most often need to allow, with the value to use. */
export const SPF_PRESETS: { label: string; value: string }[] = [
  { label: 'Google Workspace', value: '_spf.google.com' },
  { label: 'Microsoft 365', value: 'spf.protection.outlook.com' },
  { label: 'Zoho Mail', value: 'zoho.com' },
  { label: 'Mailchimp', value: 'servers.mcsv.net' },
  { label: 'SendGrid', value: 'sendgrid.net' },
  { label: 'Mailgun', value: 'mailgun.org' },
  { label: 'Brevo (Sendinblue)', value: 'spf.brevo.com' },
  { label: 'Klaviyo', value: '_spf.klaviyo.com' },
  { label: 'Shopify', value: 'shops.shopify.com' },
  { label: 'Square', value: '_spf.squareup.com' },
  { label: 'Xero', value: '_spf.xero.com' },
  { label: 'QuickBooks', value: 'spf.intuit.com' },
];

// ── IS THIS NAME TAKEN ──────────────────────────────────────────────────────

export type DomainStatus = 'available' | 'taken' | 'unknown';

export interface DomainResult {
  domain: string;
  status: DomainStatus;
  /** Why we could not tell, when we could not. */
  note?: string;
}

/**
 * Ask the registry directly.
 *
 * RDAP is the modern replacement for WHOIS: it answers over HTTPS in JSON,
 * allows cross-origin requests, and is run by the registries themselves — so the
 * answer comes from the authority that would sell you the name, rather than from
 * somebody's cached list. A 404 means genuinely unregistered.
 *
 * Not every ending has an RDAP service, and a few rate-limit. Both come back as
 * `unknown` with a reason rather than being guessed at, because a wrong
 * "available" on this page is the kind of mistake somebody prints on a van.
 */
export async function checkDomain(domain: string, signal?: AbortSignal): Promise<DomainResult> {
  try {
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      signal,
      headers: { accept: 'application/rdap+json' },
    });

    if (response.status === 404) return { domain, status: 'available' };
    if (response.ok) return { domain, status: 'taken' };
    if (response.status === 429) {
      return {
        domain,
        status: 'unknown',
        note: 'The registry asked us to slow down. Try again shortly.',
      };
    }
    return {
      domain,
      status: 'unknown',
      note: `The registry for this ending did not give a clear answer (${response.status}).`,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return {
      domain,
      status: 'unknown',
      note: 'This ending does not offer a public lookup we can reach from a browser.',
    };
  }
}

/** The endings worth checking first, and why each is here. */
export const DOMAIN_ENDINGS = [
  { tld: 'com', note: 'Still the one people type from memory' },
  { tld: 'co', note: 'Short, widely available, reads as a company' },
  { tld: 'net', note: 'The old fallback' },
  { tld: 'org', note: 'Reads as non-profit, but open to anybody' },
  { tld: 'shop', note: 'Says what you do before anybody clicks' },
  { tld: 'store', note: 'The same, with more room' },
  { tld: 'studio', note: 'Salons, design, photography, makers' },
  { tld: 'cafe', note: 'Does exactly what it says' },
  { tld: 'io', note: 'Software habit, expensive, rarely right for a shop' },
  { tld: 'app', note: 'Requires HTTPS, which is handled for you anyway' },
  { tld: 'uk', note: 'For a business trading in the UK' },
  { tld: 'ca', note: 'For a business trading in Canada' },
];

/** Sanity-check what somebody typed before sending it anywhere. */
export function normaliseDomainInput(input: string): { name: string; error?: string } {
  const name = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');

  if (name === '') return { name, error: 'Type a name to check.' };
  if (/[^a-z0-9.-]/.test(name)) {
    return { name, error: 'Domain names use letters, numbers and hyphens only.' };
  }
  if (/^-|-$|\.\./.test(name)) {
    return { name, error: 'That is not a shape a domain name can have.' };
  }
  return { name };
}
