// Where a 1:1 sales email actually leaves the building (docs/144 §5.3).
//
// @sparx/crm composes the message, threads it and records it, then hands it to
// a sink. This is that sink, and it has TWO paths — which is the whole point of
// connecting a mailbox at all:
//
//   · NO CONNECTED MAILBOX → publish `email.send`, the same bus event every
//     other outbound email uses, consumed by `email-worker` and delivered
//     through Mailgun on the tenant's sending domain. That sameness matters:
//     suppression lists, bounce handling, per-site branding and the send log all
//     have ONE place to be kept correct.
//
//   · A CONNECTED MAILBOX → send over that mailbox's own SMTP server and file a
//     copy in its Sent folder. The message then comes FROM the rep, at their
//     real address, and appears in their own mail app where they expect it.
//     Routing it through the platform domain instead would mean the customer
//     replies to a noreply-ish address and the rep never sees their own sent
//     mail — which reads as sparx having emailed a customer behind their back.
//
// A send through a connected mailbox that fails FALLS BACK to the platform
// path. The message being delivered matters more than which envelope carried
// it, and a mail server that is down for ten minutes should not silently drop a
// rep's follow-up.

import type { FastifyBaseLogger } from 'fastify';
import { setOutboundMailSink, type OutboundMail } from '@sparx/crm';
import { mailboxService } from '@sparx/crm';
import { buildRfc822 } from '@sparx/crm/mail';
import { publish } from '@sparx/api-core/pubsub';

import { decryptMailboxSecret, isMailboxCryptoConfigured } from './crm-mailbox-crypto.js';
import { appendToSentFolder, type ImapConfig } from './crm-mailbox-imap.js';
import { sendSmtpMessage } from './crm-mailbox-smtp.js';

type Logger = FastifyBaseLogger | Console;

/** The platform path: one bus event, exactly like every other outbound email. */
async function publishPlatformSend(logger: Logger, mail: OutboundMail): Promise<void> {
  await publish(logger as never, 'email.send', mail.tenantId, null, {
    kind: 'raw',
    to: mail.to,
    ...(mail.cc?.length ? { cc: mail.cc } : {}),
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    // Carried so a reply's In-Reply-To matches what we sent, and so an open or
    // a click in `email_events` joins back to the exact message rather than to
    // "an email we sent that day".
    messageId: mail.rfcMessageId,
    // The site this is on behalf of, so the worker resolves that site's brand
    // rather than the tenant's (docs/49 Phase 7b).
    ...(mail.propertyId ? { propertyId: mail.propertyId } : {}),
    // A 1:1 email from a person is TRANSACTIONAL, not marketing: it is not a
    // campaign, it carries no unsubscribe footer, and treating it as marketing
    // would suppress it for anyone who opted out of newsletters while still
    // expecting a reply from their rep.
    marketing: false,
  });
}

/** The connected-mailbox path. Returns false when it could not be taken, so the
 *  caller falls back rather than losing the message. */
async function sendThroughMailbox(logger: Logger, mail: OutboundMail): Promise<boolean> {
  if (!mail.mailboxConnectionId || !isMailboxCryptoConfigured()) return false;

  const conn = await mailboxService
    .readCredentials({ tenantId: mail.tenantId }, mail.mailboxConnectionId)
    .catch(() => null);
  if (!conn?.smtpHost || !conn.appPasswordEnc) return false;

  const password = decryptMailboxSecret(conn.appPasswordEnc);
  const raw = buildRfc822({
    from: conn.emailAddress,
    fromName: conn.displayName,
    to: [mail.to],
    ...(mail.cc?.length ? { cc: mail.cc } : {}),
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    // The id sparx already recorded. Everything joins on it — the row, the open
    // events, and the In-Reply-To on whatever comes back.
    messageId: mail.rfcMessageId,
    inReplyTo: mail.inReplyTo,
    references: mail.references,
  });

  await sendSmtpMessage(
    {
      host: conn.smtpHost,
      port: conn.smtpPort ?? 587,
      user: conn.imapUser ?? conn.emailAddress,
      password,
    },
    { from: conn.emailAddress, to: [mail.to, ...(mail.cc ?? [])], raw }
  );

  // Filing the copy is best-effort and runs AFTER delivery: the customer
  // already has the message, so a server that refuses APPEND must not turn a
  // successful send into an error the rep sees.
  if (conn.imapHost) {
    const imap: ImapConfig = {
      host: conn.imapHost,
      port: conn.imapPort ?? 993,
      user: conn.imapUser ?? conn.emailAddress,
      password,
    };
    const filed = await appendToSentFolder(imap, raw).catch(() => false);
    if (!filed) {
      logger.warn(
        { tenantId: mail.tenantId, mailboxConnectionId: conn.id },
        'crm-engagement-mail: sent, but could not file a copy in the Sent folder'
      );
    }
  }
  return true;
}

export function installEngagementMailSink(logger: Logger): void {
  setOutboundMailSink({
    send: async (mail: OutboundMail) => {
      if (mail.mailboxConnectionId) {
        try {
          if (await sendThroughMailbox(logger, mail)) return;
        } catch (err) {
          logger.warn(
            { tenantId: mail.tenantId, err },
            'crm-engagement-mail: mailbox send failed — falling back to the sending domain'
          );
        }
      }
      await publishPlatformSend(logger, mail);
    },
  });
}
