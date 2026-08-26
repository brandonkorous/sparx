import type { EmailProvider, SendableEmail } from '../types';

// Mailgun HTTP provider — POSTs to /v3/{domain}/messages. We're on Mailgun
// because GCP blocks outbound TCP/25 (so direct MX delivery from a GKE pod
// or Cloud Run is impossible), and Mailgun's smtp_relays-style approaches
// require SMTP AUTH that self-hosted Postal can't produce. The HTTP API
// route sidesteps both problems entirely.
//
// Multi-tenant: the sending domain rides in the URL path, not the API key.
// One account key authenticates calls against every verified domain in our
// Mailgun account, so per-tenant routing is just "swap the path segment."
//
// The path segment is chosen from the message's OWN `From` address, when that
// domain is one this account is authorized for (`domains`). It has to be: a
// message posted to /v3/a.example/messages carrying `From: someone@b.example`
// is signed by a.example's DKIM key and fails alignment for b.example, so it
// lands in spam or is rejected outright. A second platform brand with its own
// sending domain is exactly that case, and routing everything through one
// hardcoded default is what would have broken it.
//
// A From on a domain NOT in the list falls back to `defaultDomain` — that is a
// tenant's own address on a domain we cannot send for, and going out
// unaligned from the platform domain is what happens today.

export interface MailgunConfig {
  /** Account API key (private key from Mailgun → API Keys). */
  apiKey: string;
  /** The sending domain used when the `From` names none we are authorized for. */
  defaultDomain: string;
  /**
   * Every domain verified on this Mailgun account, `defaultDomain` included.
   * A `From` on one of these routes through it, so DKIM signs with the key that
   * matches the address. Omit for a single-domain account.
   */
  domains?: string[];
  /** "us" → api.mailgun.net, "eu" → api.eu.mailgun.net. */
  region?: 'us' | 'eu';
}

/** The domain part of a `From`, whether bare or in `Name <addr>` form. */
export function senderDomainOf(from: string): string | null {
  const address = /<([^>]+)>/.exec(from)?.[1] ?? from;
  const at = address.lastIndexOf('@');
  if (at === -1) return null;
  const domain = address
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return domain === '' ? null : domain;
}

/** A domain trimmed and lowercased, or null when there is nothing there. */
function normalizeDomain(value: string | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : null;
}

/** The `From`'s own domain, but only when this account may send for it. */
function pickAuthorizedSender(from: string, authorized: ReadonlySet<string>): string | null {
  const sender = senderDomainOf(from);
  return sender !== null && authorized.has(sender) ? sender : null;
}

/**
 * Mailgun rejected the message itself — bad recipient address, suppressed
 * recipient, malformed headers, etc. Same shape as PostalParameterError:
 * email-worker should ack the Pub/Sub message rather than nack, because a
 * redeliver of the same payload will fail identically.
 */
export class MailgunParameterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MailgunParameterError';
  }
}

interface MailgunSendResponse {
  id?: string;
  message?: string;
}

const REGION_HOSTS: Record<NonNullable<MailgunConfig['region']>, string> = {
  us: 'https://api.mailgun.net',
  eu: 'https://api.eu.mailgun.net',
};

export function createMailgunProvider(config: MailgunConfig): EmailProvider {
  const base = REGION_HOSTS[config.region ?? 'us'];
  const authHeader = `Basic ${Buffer.from(`api:${config.apiKey}`).toString('base64')}`;
  const authorized = new Set(
    [config.defaultDomain, ...(config.domains ?? [])].map((d) => d.trim().toLowerCase())
  );

  return {
    name: 'mailgun',
    async send(email: SendableEmail) {
      // Relay through the domain that can SIGN for this `From`, so DKIM aligns:
      //   1. the caller's explicit domain — a tenant's, proved verified by the
      //      row it was read from, which this layer cannot check for itself;
      //   2. else the `From`'s own domain, when it is a platform domain we are
      //      authorized for (a second brand sending as itself);
      //   3. else the platform default — a `From` we cannot sign for, which
      //      goes out misaligned exactly as it always has.
      // Length checks rather than `??`: an empty string here means "the caller
      // resolved nothing", which must fall through, and `??` would keep it.
      const domain =
        normalizeDomain(email.senderDomain) ??
        pickAuthorizedSender(email.from, authorized) ??
        config.defaultDomain;
      const url = `${base}/v3/${encodeURIComponent(domain)}/messages`;

      // Mailgun's send endpoint is form-encoded. url-encoded is fine for the
      // HTML+text body shape; the moment there is a file it has to be multipart,
      // which is what `FormData` gives us. Both are built the same way below and
      // only the container differs, so a field cannot be set on one and
      // forgotten on the other. Custom headers go in h:* fields; tags ride o:tag.
      const hasAttachments = (email.attachments?.length ?? 0) > 0;
      const form: URLSearchParams | FormData = hasAttachments
        ? new FormData()
        : new URLSearchParams();
      form.set('from', email.from);
      form.set('to', email.to);
      form.set('subject', email.subject);
      form.set('html', email.html);
      form.set('text', email.text);
      if (email.replyTo) form.set('h:Reply-To', email.replyTo);
      if (email.templateId) form.append('o:tag', email.templateId);
      if (email.tags) {
        for (const [k, v] of Object.entries(email.tags)) {
          form.append(`h:X-sparx-${k}`, v);
        }
      }
      // User variables — Mailgun echoes these in delivery/engagement webhooks
      // under event-data.user-variables, which is how the webhook receiver
      // attributes events to a tenant + broadcast/automation.
      if (email.variables) {
        for (const [k, v] of Object.entries(email.variables)) {
          form.append(`v:${k}`, v);
        }
      }

      if (form instanceof FormData) {
        for (const file of email.attachments ?? []) {
          form.append(
            'attachment',
            new Blob([Buffer.from(file.contentBase64, 'base64')], { type: file.contentType }),
            file.filename
          );
        }
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: authHeader,
          // Only set for the url-encoded case. `fetch` writes its own
          // content-type for FormData, boundary and all, and overriding it with
          // a hand-written value is how a multipart body arrives unparseable.
          ...(hasAttachments ? {} : { 'content-type': 'application/x-www-form-urlencoded' }),
        },
        body: form,
      });

      if (res.status >= 400 && res.status < 500) {
        // 4xx = the request is permanently bad (auth, bad recipient,
        // suppressed). Don't retry — surface as parameter error so the
        // worker can ack.
        const body = await res.text().catch(() => '');
        throw new MailgunParameterError(
          `Mailgun rejected message (${res.status} ${res.statusText}): ${body.slice(0, 200)}`
        );
      }

      if (!res.ok) {
        // 5xx / network — transient. Plain Error → worker nacks → Pub/Sub
        // redelivers with backoff.
        throw new Error(`Mailgun transient failure (${res.status} ${res.statusText})`);
      }

      const body = (await res.json()) as MailgunSendResponse;
      const id = body.id ?? `mailgun_${Date.now().toString(36)}`;

      return {
        id,
        provider: 'mailgun',
        acceptedAt: new Date().toISOString(),
      };
    },
  };
}
