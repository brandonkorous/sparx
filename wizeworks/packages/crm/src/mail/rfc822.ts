// Writing a real email (docs/144 §5.3) — the wire format Gmail, Graph and SMTP
// all accept.
//
// PURE, and deterministic when the caller supplies the boundary and the date,
// which is what makes it testable byte-for-byte.
//
// WHY WE BUILD THE RAW MESSAGE OURSELVES rather than handing fields to each
// provider's convenience API: the Message-ID. sparx MINTS that id before the
// message is stored, because it is the join key between the row in
// `crm_engagement_messages`, the open/click rows in `email_events`, and the
// `In-Reply-To` on whatever the customer sends back. Gmail's and Graph's
// friendly send endpoints mint their OWN id and discard ours — so the reply
// comes back pointing at an id no table has ever seen, and the thread breaks.
// Sending raw is the only way to keep the id we recorded.

export interface Rfc822Message {
  /** The address the mail is FROM — a connected mailbox's own address. */
  from: string;
  /** The display name on the From line. A name here is why a customer sees
   *  "Dana Reed" rather than an address, which measurably changes whether a
   *  sales email gets opened. */
  fromName?: string | null;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  /** The Message-ID we minted and already recorded. Non-negotiable — see the
   *  file header. */
  messageId: string;
  inReplyTo?: string | null;
  references?: string | null;
  /** Injected so the output is deterministic under test. */
  date?: Date;
  boundary?: string;
}

const CRLF = '\r\n';

/**
 * Encode a header value only if it needs it.
 *
 * A plain-ASCII subject must stay legible in the raw message — encoding
 * everything "to be safe" makes a message that is harder to debug and, on a few
 * older gateways, scores worse for spam. Non-ASCII gets RFC 2047 base64, which
 * is what every client understands.
 */
export function encodeHeaderValue(value: string): string {
  // Anything outside printable ASCII — control characters included, since a
  // header carrying a raw newline is a header-injection vector, not a subject.
  if (!/[^\x20-\x7e]/.test(value)) return value;
  return `=?utf-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/** An address with an optional display name, correctly quoted. */
export function formatAddress(address: string, name?: string | null): string {
  if (!name) return address;
  return `${encodeHeaderValue(name).includes('=?') ? encodeHeaderValue(name) : `"${name.replace(/"/g, '\\"')}"`} <${address}>`;
}

/** Base64 in 76-character lines, as RFC 2045 requires — a body encoded as one
 *  enormous line is rejected outright by some servers. */
function base64Lines(value: string): string {
  const encoded = Buffer.from(value, 'utf8').toString('base64');
  return (encoded.match(/.{1,76}/g) ?? []).join(CRLF);
}

/**
 * A complete `multipart/alternative` message.
 *
 * Both halves are always present. A text/plain alternative is what a screen
 * reader, a smartwatch and several corporate mail gateways actually render, and
 * its absence is a spam signal in its own right — so "the HTML is enough" is
 * wrong twice over.
 */
export function buildRfc822(message: Rfc822Message): string {
  const boundary = message.boundary ?? `sparx_${Math.random().toString(36).slice(2, 18)}`;
  const date = message.date ?? new Date();

  const headers: string[] = [
    `From: ${formatAddress(message.from, message.fromName)}`,
    `To: ${message.to.join(', ')}`,
  ];
  if (message.cc?.length) headers.push(`Cc: ${message.cc.join(', ')}`);
  headers.push(
    `Subject: ${encodeHeaderValue(message.subject)}`,
    `Date: ${date.toUTCString()}`,
    `Message-ID: ${message.messageId}`
  );
  if (message.inReplyTo) headers.push(`In-Reply-To: ${message.inReplyTo}`);
  if (message.references) headers.push(`References: ${foldHeader(message.references)}`);
  headers.push('MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`);

  const body = [
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(message.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(message.html),
    `--${boundary}--`,
    '',
  ];

  return [...headers, ...body].join(CRLF);
}

/**
 * Fold a long header across continuation lines.
 *
 * RFC 5322 caps a line at 998 octets and a References chain on a long thread
 * blows past that. An unfolded over-length header is not "mostly fine" — some
 * servers truncate it, which silently breaks the threading it exists to carry.
 */
export function foldHeader(value: string, limit = 900): string {
  const tokens = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const token of tokens) {
    if (current === '') {
      current = token;
    } else if (current.length + token.length + 1 > limit) {
      lines.push(current);
      current = token;
    } else {
      current += ` ${token}`;
    }
  }
  if (current !== '') lines.push(current);
  return lines.join(`${CRLF} `);
}

/** Gmail's `users.messages.send` wants the whole message base64url-encoded. */
export function toBase64Url(raw: string): string {
  return Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * SMTP DATA dot-stuffing (RFC 5321 §4.5.2).
 *
 * A line consisting of a single `.` terminates the DATA command, so a body line
 * that legitimately starts with `.` must be doubled or the message is truncated
 * at that point and the rest is interpreted as SMTP commands. Base64 bodies
 * cannot produce a leading dot, but headers and future non-base64 parts can, so
 * this is applied unconditionally rather than reasoned about per call.
 */
export function dotStuff(raw: string): string {
  return raw.replace(/^\./gm, '..');
}
