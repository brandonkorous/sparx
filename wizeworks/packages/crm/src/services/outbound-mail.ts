// Where a 1:1 sales email actually goes (docs/144 §5.3).
//
// The engagement service composes the message, threads it and records it; it
// does NOT know how mail leaves the building. That is deliberate and it matches
// the publisher pattern this package already uses for events: @wizeworks/crm has no
// transport dependency, so it can be unit-tested without standing one up, and
// the delivery path can change without a service-layer rewrite.
//
// In production api-rest installs a sink that publishes `email.send` to the bus,
// which `email-worker` consumes and hands to Mailgun — the SAME path every other
// outbound email takes. Adding a second delivery path for sales mail would mean
// two places where suppression, bounce handling and per-site branding have to be
// kept correct.
//
// The default sink logs and discards, so a developer who has not wired one gets
// a visible no-op rather than a silent failure or a crash.

/** One message, ready to leave. */
export interface OutboundMail {
  tenantId: string;
  /** The site this is sent on behalf of, for branding + analytics (docs/49). */
  propertyId: string | null;
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  /**
   * The RFC 5322 Message-ID we minted. Carried through so a reply's In-Reply-To
   * matches, and so an open or a click in `email_events` joins back to the exact
   * message rather than to "an email we sent that day".
   */
  rfcMessageId: string;
  /**
   * The connected mailbox to send THROUGH, so the mail leaves from that
   * person's own address, reads as coming from a person rather than a system,
   * and gets filed in their real Sent folder.
   *
   * Null sends through the tenant's sending domain instead, which is the right
   * default and the only option until somebody connects a mailbox.
   */
  mailboxConnectionId?: string | null;
  /** The From address and display name, when sending through a mailbox. */
  fromAddress?: string | null;
  fromName?: string | null;
  /** The reply chain, so a message sent into an existing conversation threads
   *  correctly in the RECIPIENT's client — which is where it matters most and
   *  the one place we have no control after the fact. */
  inReplyTo?: string | null;
  references?: string | null;
}

export interface OutboundMailSink {
  send(mail: OutboundMail): Promise<void>;
}

class LoggingMailSink implements OutboundMailSink {
  send(mail: OutboundMail): Promise<void> {
    // Intentional console.log — this is the wire boundary, not application code.
    console.log(
      '[crm-engagement-mail]',
      JSON.stringify({
        tenantId: mail.tenantId,
        to: mail.to,
        subject: mail.subject,
        rfcMessageId: mail.rfcMessageId,
      })
    );
    return Promise.resolve();
  }
}

let activeSink: OutboundMailSink = new LoggingMailSink();

export function setOutboundMailSink(sink: OutboundMailSink): void {
  activeSink = sink;
}

export async function sendOutboundMail(mail: OutboundMail): Promise<void> {
  await activeSink.send(mail);
}

/** Records what it was asked to send, for tests. */
export class RecordingMailSink implements OutboundMailSink {
  readonly sent: OutboundMail[] = [];
  send(mail: OutboundMail): Promise<void> {
    this.sent.push(mail);
    return Promise.resolve();
  }
  clear(): void {
    this.sent.length = 0;
  }
}

/**
 * Mint an RFC 5322 Message-ID.
 *
 * The local part is random rather than derived from the row id: a Message-ID is
 * visible to every mail server the message passes through, and leaking a
 * database id into that header tells anyone reading it how many records we have.
 *
 * The domain is the tenant's sending domain when we know it, because a
 * Message-ID whose domain does not match the From domain is a spam signal on
 * several major providers.
 */
export function mintMessageId(sendingDomain: string): string {
  const random = `${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 12)}`;
  return `<${random}@${sendingDomain}>`;
}

/**
 * The plain-text half of a message, from its HTML.
 *
 * Every email needs one: a text/plain alternative is what a screen reader, a
 * watch, and several corporate mail gateways actually show, and its absence is a
 * spam signal on its own. Deliberately simple — this is a 1:1 email a person
 * typed, not a rendered marketing template (those get React Email's own
 * `render({plainText:true})`, per the root CLAUDE.md rule).
 */
export function htmlToText(html: string): string {
  return (
    html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      // A paragraph break in plain text is a BLANK LINE, not a single newline —
      // one newline runs two paragraphs together and the reader loses the shape of
      // the message. List items and table rows get a single break, because they
      // are lines within one block rather than blocks of their own.
      .replace(/<\/(p|div|h[1-6]|blockquote)>/gi, '\n\n')
      .replace(/<\/(li|tr)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}
