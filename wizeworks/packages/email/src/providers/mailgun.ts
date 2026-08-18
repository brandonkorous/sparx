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
// Today we send only from sparx.email; when tenant domains land, the
// caller passes `senderDomain` to override the default.

export interface MailgunConfig {
  /** Account API key (private key from Mailgun → API Keys). */
  apiKey: string;
  /** Default sending domain, e.g. "sparx.email". Overridable per-send. */
  defaultDomain: string;
  /** "us" → api.mailgun.net, "eu" → api.eu.mailgun.net. */
  region?: 'us' | 'eu';
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

  return {
    name: 'mailgun',
    async send(email: SendableEmail) {
      const domain = config.defaultDomain;
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
