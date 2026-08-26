// Provider-agnostic types for the sparx email pipeline.
//
// Every transactional or broadcast send goes through a single sendEmail()
// entrypoint; providers receive a rendered SendableEmail (HTML + text + subject)
// and only need to deliver it. Templates render to a SendableEmail via React
// Email — no provider ever sees raw template inputs.

export interface SendableEmail {
  /** Display name + address, or just an address. */
  from: string;
  /**
   * The sending domain to relay THROUGH — a tenant's own, once they have proved
   * they own it.
   *
   * The provider signs a message with the key belonging to the domain it is
   * posted to, so a `From` on the tenant's domain relayed through the
   * platform's is signed by the wrong key: SPF and DKIM alignment both fail,
   * DMARC fails if the tenant publishes a policy, and the mail their customer
   * was waiting for lands in spam. Verifying a domain bought a nicer `From` and
   * WORSE deliverability until this was carried through.
   *
   * The caller is the one that knows a domain is verified, so the provider
   * trusts this when set. Omit it and the provider falls back to the `From`'s
   * own domain when that is a platform domain it is authorized for, else the
   * platform default.
   */
  senderDomain?: string;
  /** Single recipient — we keep it 1:1 for transactional flows. */
  to: string;
  /** Optional reply-to override. */
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Logical template id (e.g. "password-reset"). Lets providers tag deliveries
   * for reputation isolation + lets the audit log group sends.
   */
  templateId?: string;
  /** Free-form key/value for provider tagging (Postal headers, etc.). */
  tags?: Record<string, string>;
  /**
   * Provider "user variables" echoed back on delivery/engagement webhooks
   * (Mailgun `v:*`). Used for tenant + broadcast/automation attribution so the
   * webhook receiver can write the right EmailEvent / EmailSuppression rows.
   */
  variables?: Record<string, string>;
  /**
   * Files to send with the message.
   *
   * Added for scheduled inventory reports (docs/146 Phase 10.4), where the
   * whole point is that the spreadsheet ARRIVES — a link to a login-walled
   * download is no use to the bookkeeper the report was addressed to.
   *
   * Deliberately small and deliberately capped by callers. An attachment
   * travels through the broker inside the `email.send` payload, and JetStream's
   * default message limit is 1 MB; a caller with a large file must link to it
   * instead and say so in the body, rather than producing an event that is
   * silently too big to deliver.
   */
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  /** As it should appear in the recipient's mail client. */
  filename: string;
  /** e.g. "text/csv". */
  contentType: string;
  /** The file itself, base64. Base64 rather than a Buffer because this crosses
   *  the event bus as JSON before it reaches a provider. */
  contentBase64: string;
}

export interface DeliveryResult {
  /** Provider-assigned identifier. */
  id: string;
  /** Friendly provider name — useful for logging + the test-send UI. */
  provider: string;
  /** ISO timestamp when the provider accepted the message. */
  acceptedAt: string;
}

export interface EmailProvider {
  /** Stable identifier surfaced in logs + DeliveryResult. */
  name: string;
  send(email: SendableEmail): Promise<DeliveryResult>;
}
