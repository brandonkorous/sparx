// A raw message off the wire → the shape the engagement service records
// (docs/144 §5.3).
//
// PURE. The IMAP socket hands over bytes; everything about understanding them
// happens here, where it is tested against real message shapes in a
// millisecond.

import { header, parseAddressList, parseRawMessage, parseSingleAddress } from './mime';

/**
 * One inbound message, normalized.
 *
 * Matches `InboundMessageInput` field-for-field so the sync hands it straight
 * to `engagementService.recordInbound` with no adapter in between.
 */
export interface NormalizedInbound {
  rfcMessageId: string;
  inReplyTo: string | null;
  references: string | null;
  providerThreadId: string | null;
  subject: string | null;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  bodyHtml: string | null;
  bodyText: string | null;
  sentAt: string;
}

/**
 * Parse a raw RFC 822 message, or refuse it.
 *
 * NULL IN EXACTLY TWO CASES, and both are refusals rather than failures:
 *
 *  · No `Message-ID`. That header is the dedupe key AND the threading anchor.
 *    A message without one would re-import on every single poll, duplicating
 *    the customer's timeline daily, and nothing could ever reply to it
 *    correctly. Skipping it costs one message; storing it costs a broken table.
 *
 *  · No parseable `From`. A message with nobody on the other end cannot be
 *    matched to a contact, which means it cannot pass the privacy gate, which
 *    means it must not be stored.
 *
 * Everything else degrades. A missing Subject, an unreadable body, a Date the
 * sender's machine got wrong — none of those are reasons to drop a customer's
 * reply on the floor.
 */
export function parseRawInbound(raw: string): NormalizedInbound | null {
  const message = parseRawMessage(raw);
  const rfcMessageId = header(message.headers, 'message-id')?.trim();
  if (!rfcMessageId) return null;

  const fromAddress = parseSingleAddress(header(message.headers, 'from'));
  if (!fromAddress) return null;

  const dateHeader = header(message.headers, 'date');
  const parsed = dateHeader ? Date.parse(dateHeader) : NaN;

  return {
    rfcMessageId,
    inReplyTo: header(message.headers, 'in-reply-to')?.trim() ?? null,
    references: header(message.headers, 'references')?.trim() ?? null,
    // IMAP has no server-side conversation id — there is no provider grouping
    // to borrow, so threading rests entirely on the RFC chain and, last, on
    // subject-within-one-customer. Which is the correct order anyway.
    providerThreadId: null,
    subject: header(message.headers, 'subject'),
    fromAddress,
    toAddresses: parseAddressList(header(message.headers, 'to')),
    ccAddresses: parseAddressList(header(message.headers, 'cc')),
    bodyHtml: message.html,
    bodyText: message.text,
    // A `Date` written by a machine with a wrong clock is still better than
    // "now": it at least orders the conversation the way it happened. An absent
    // or unparseable one falls back to arrival time.
    sentAt: new Date(Number.isFinite(parsed) ? parsed : Date.now()).toISOString(),
  };
}

/**
 * Whether a message is one sparx should look at at all.
 *
 * Automated mail is excluded BEFORE the privacy gate, not after: a bounce
 * notification or an out-of-office from a known contact would otherwise sail
 * through the contact check and land on their timeline as though they had
 * written to us. `Auto-Submitted` and the `List-*` headers are how legitimate
 * automation announces itself, and honouring them is the whole reason they
 * exist.
 */
export function isAutomatedMessage(raw: string): boolean {
  const { headers } = parseRawMessage(raw);
  const autoSubmitted = header(headers, 'auto-submitted');
  if (autoSubmitted && autoSubmitted.toLowerCase() !== 'no') return true;
  if (headers.has('list-unsubscribe') || headers.has('list-id')) return true;
  if (
    header(headers, 'precedence')
      ?.toLowerCase()
      .match(/bulk|junk|auto_reply/)
  )
    return true;
  if (header(headers, 'x-autoreply') ?? header(headers, 'x-autorespond')) return true;
  // A null return-path is how a bounce and a vacation reply identify themselves.
  return header(headers, 'return-path')?.trim() === '<>';
}
