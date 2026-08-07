// The mail layer, tested against the shapes real mail servers actually send
// (docs/144 §5.2–§5.3).
//
// Every case here is a thing that has broken a mail integration somewhere: a
// folded References chain, a subject split across two encoded words, a
// multipart body whose closing boundary never arrived, an IMAP literal
// containing text that looks like a completion line, an out-of-office reply
// landing on a customer's timeline as though they had written it.

import { describe, expect, it } from 'vitest';

import {
  decodeBase64Url,
  decodeEncodedWords,
  decodeQuotedPrintable,
  header,
  headerParam,
  parseAddressList,
  parseHeaderBlock,
  parseRawMessage,
  parseSingleAddress,
  splitMultipart,
} from './mime';
import { isAutomatedMessage, parseRawInbound } from './inbound';
import { buildRfc822, dotStuff, encodeHeaderValue, foldHeader, toBase64Url } from './rfc822';
import {
  imapAppendCommand,
  imapDate,
  imapFetchCommand,
  imapQuote,
  imapSearchCommand,
  imapWantsLiteral,
  parseFetchResponse,
  parseSearchResponse,
  parseSelectResponse,
  parseSentFolder,
  scanImapResponse,
} from './imap';
import { ehloSupports, parseSmtpReply, smtpAccepted, smtpAuthPlain } from './smtp';

/* ── MIME ───────────────────────────────────────────────────────────────── */

describe('MIME reading', () => {
  it('decodes base64url, including Gmail’s unpadded form', () => {
    expect(decodeBase64Url('SGVsbG8sIERhbmE')).toBe('Hello, Dana');
    expect(decodeBase64Url('SGVsbG8sIERhbmE=')).toBe('Hello, Dana');
  });

  it('rejoins a multi-byte character split across quoted-printable escapes', () => {
    // The bug this prevents: decoding =C3 and =A9 separately yields two broken
    // characters instead of "é", and the customer's name renders as mojibake.
    expect(decodeQuotedPrintable('Ren=C3=A9e')).toBe('Renée');
    expect(decodeQuotedPrintable('long line=\r\ncontinues')).toBe('long linecontinues');
    // A stray `=` that is not a valid escape stays put rather than vanishing.
    expect(decodeQuotedPrintable('a=b')).toBe('a=b');
  });

  it('joins adjacent encoded words without the folding whitespace', () => {
    expect(decodeEncodedWords('=?utf-8?B?SGVsbG8=?= there')).toBe('Hello there');
    expect(decodeEncodedWords('=?utf-8?Q?Re=3A_pricing?=')).toBe('Re: pricing');
    // Two words that together form one string: the space between them is an
    // artifact of folding and must not survive.
    expect(decodeEncodedWords('=?utf-8?B?SGVs?= =?utf-8?B?bG8=?=')).toBe('Hello');
    expect(decodeEncodedWords('plain subject')).toBe('plain subject');
  });

  it('unfolds continuation lines into the header above', () => {
    const headers = parseHeaderBlock(
      ['Subject: A long one', '  that wrapped', 'To: dana@example.com', ''].join('\r\n')
    );
    expect(header(headers, 'subject')).toBe('A long one that wrapped');
    expect(header(headers, 'To')).toBe('dana@example.com');
    expect(header(headers, 'nonexistent')).toBeNull();
  });

  it('pulls addresses out of headers people actually send', () => {
    expect(parseAddressList('"Reed, Dana" <dana@example.com>, sam@example.com')).toEqual([
      'dana@example.com',
      'sam@example.com',
    ]);
    expect(parseSingleAddress('Dana Reed <DANA@Example.COM>')).toBe('dana@example.com');
    expect(parseAddressList(null)).toEqual([]);
    expect(parseAddressList('undisclosed-recipients:;')).toEqual([]);
  });

  it('reads a parameter off a structured header, quoted or not', () => {
    expect(headerParam('text/html; charset="utf-8"', 'charset')).toBe('utf-8');
    expect(headerParam('multipart/mixed; boundary=abc123', 'boundary')).toBe('abc123');
    expect(headerParam('text/plain', 'charset')).toBeNull();
  });

  it('parses a multipart/alternative message end to end', () => {
    const raw = [
      'From: Dana Reed <dana@example.com>',
      'To: sales@acme.test',
      'Subject: =?utf-8?B?UXVvdGU=?=',
      'Message-ID: <abc@example.com>',
      'Content-Type: multipart/alternative; boundary="B1"',
      '',
      '--B1',
      'Content-Type: text/plain; charset="utf-8"',
      '',
      'Plain version',
      '--B1',
      'Content-Type: text/html; charset="utf-8"',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      '<p>Ren=C3=A9e</p>',
      '--B1--',
      '',
    ].join('\r\n');

    const parsed = parseRawMessage(raw);
    expect(header(parsed.headers, 'subject')).toBe('Quote');
    expect(parsed.text?.trim()).toBe('Plain version');
    expect(parsed.html).toContain('Renée');
  });

  it('skips attachments instead of storing them as body text', () => {
    const raw = [
      'Content-Type: multipart/mixed; boundary="M"',
      '',
      '--M',
      'Content-Type: text/plain',
      '',
      'See attached.',
      '--M',
      'Content-Type: application/pdf; name="quote.pdf"',
      'Content-Disposition: attachment; filename="quote.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      'JVBERi0xLjQK',
      '--M--',
      '',
    ].join('\r\n');

    const parsed = parseRawMessage(raw);
    expect(parsed.text?.trim()).toBe('See attached.');
    expect(parsed.html).toBeNull();
  });

  it('still yields complete parts when the closing boundary never arrives', () => {
    // Truncation in transit is real, and losing the whole message over a
    // missing final `--B--` would be the wrong trade.
    const parts = splitMultipart(['--B', 'first', '--B', 'second'].join('\n'), 'B');
    expect(parts).toHaveLength(2);
    expect(parts[1]).toContain('second');
  });
});

/* ── Inbound ────────────────────────────────────────────────────────────── */

describe('reading a message off the wire', () => {
  const message = (extra: string[] = []): string =>
    [
      'Return-Path: <dana@example.com>',
      'From: "Reed, Dana" <dana@example.com>',
      'To: sales@acme.test',
      'Cc: sam@acme.test',
      'Subject: =?utf-8?Q?Re=3A_pricing?=',
      'Message-ID: <reply-1@example.com>',
      'In-Reply-To: <orig-1@sparx.email>',
      'References: <orig-1@sparx.email>',
      'Date: Wed, 10 Feb 2027 09:00:00 +0000',
      ...extra,
      'Content-Type: text/plain; charset="utf-8"',
      '',
      'Still interested.',
      '',
    ].join('\r\n');

  it('normalizes a real reply', () => {
    const parsed = parseRawInbound(message());
    expect(parsed?.rfcMessageId).toBe('<reply-1@example.com>');
    expect(parsed?.inReplyTo).toBe('<orig-1@sparx.email>');
    expect(parsed?.subject).toBe('Re: pricing');
    expect(parsed?.fromAddress).toBe('dana@example.com');
    expect(parsed?.toAddresses).toEqual(['sales@acme.test']);
    expect(parsed?.ccAddresses).toEqual(['sam@acme.test']);
    expect(parsed?.bodyText?.trim()).toBe('Still interested.');
    expect(parsed?.sentAt).toBe(new Date('2027-02-10T09:00:00Z').toISOString());
  });

  it('refuses a message with no Message-ID', () => {
    // Without it there is no dedupe key, so the message re-imports on every
    // single poll and duplicates the customer's timeline daily.
    const raw = message().replace('Message-ID: <reply-1@example.com>\r\n', '');
    expect(parseRawInbound(raw)).toBeNull();
  });

  it('refuses a message with nobody on the other end', () => {
    // No From means no contact match, which means it cannot pass the privacy
    // gate, which means it must not be stored.
    const raw = message().replace('From: "Reed, Dana" <dana@example.com>\r\n', '');
    expect(parseRawInbound(raw)).toBeNull();
  });

  it('keeps a message whose Date is unparseable', () => {
    const raw = message().replace('Date: Wed, 10 Feb 2027 09:00:00 +0000', 'Date: yesterday');
    expect(parseRawInbound(raw)).not.toBeNull();
  });

  it('recognizes automated mail before it can reach a timeline', () => {
    // An out-of-office from a known contact would otherwise sail through the
    // contact check and appear as though they had written to us.
    expect(isAutomatedMessage(message(['Auto-Submitted: auto-replied']))).toBe(true);
    expect(isAutomatedMessage(message(['List-Unsubscribe: <mailto:x@y>']))).toBe(true);
    expect(isAutomatedMessage(message(['Precedence: bulk']))).toBe(true);
    expect(isAutomatedMessage(message().replace('<dana@example.com>', '<>'))).toBe(true);
    // `Auto-Submitted: no` is the explicit "a person wrote this" value.
    expect(isAutomatedMessage(message(['Auto-Submitted: no']))).toBe(false);
    expect(isAutomatedMessage(message())).toBe(false);
  });
});

/* ── Writing ────────────────────────────────────────────────────────────── */

describe('RFC 822 building', () => {
  it('keeps the Message-ID we minted', () => {
    // The whole reason for building raw rather than using a provider's friendly
    // send API: their API mints its own id and discards ours, so the reply comes
    // back pointing at an id no table has ever seen.
    const raw = buildRfc822({
      from: 'dana@acme.test',
      fromName: 'Dana Reed',
      to: ['customer@example.com'],
      subject: 'Your quote',
      html: '<p>Here it is</p>',
      text: 'Here it is',
      messageId: '<minted-1@sparx.email>',
      date: new Date('2027-02-10T09:00:00Z'),
      boundary: 'B1',
    });
    expect(raw).toContain('Message-ID: <minted-1@sparx.email>');
    expect(raw).toContain('From: "Dana Reed" <dana@acme.test>');
    expect(raw).toContain('Content-Type: multipart/alternative; boundary="B1"');
    // Both halves, always — a missing text/plain is a spam signal on its own.
    expect(raw).toContain('Content-Type: text/plain; charset="utf-8"');
    expect(raw).toContain('Content-Type: text/html; charset="utf-8"');
    expect(raw.split('\r\n').every((line) => line.length <= 998)).toBe(true);
  });

  it('carries the reply chain when replying', () => {
    const raw = buildRfc822({
      from: 'dana@acme.test',
      to: ['customer@example.com'],
      subject: 'Re: Your quote',
      html: '<p>Yes</p>',
      text: 'Yes',
      messageId: '<minted-2@sparx.email>',
      inReplyTo: '<their-1@example.com>',
      references: '<orig@sparx.email> <their-1@example.com>',
      boundary: 'B2',
    });
    expect(raw).toContain('In-Reply-To: <their-1@example.com>');
    expect(raw).toContain('References: <orig@sparx.email> <their-1@example.com>');
  });

  it('encodes a non-ASCII subject and leaves a plain one legible', () => {
    expect(encodeHeaderValue('Your quote')).toBe('Your quote');
    expect(encodeHeaderValue('Devis Renée')).toMatch(/^=\?utf-8\?B\?/);
  });

  it('folds a long References chain under the line limit', () => {
    const chain = Array.from({ length: 60 }, (_v, i) => `<msg-${String(i)}@example.com>`).join(' ');
    const folded = foldHeader(chain);
    expect(folded).toContain('\r\n ');
    expect(folded.split('\r\n').every((line) => line.length <= 901)).toBe(true);
  });

  it('dot-stuffs a body line that would otherwise end the DATA command', () => {
    expect(dotStuff('normal\n.hidden\n..already')).toBe('normal\n..hidden\n...already');
    expect(toBase64Url('a+b/c')).not.toMatch(/[+/=]/);
  });

  it('round-trips: what we build is what the reader parses back', () => {
    // The two halves of this file meeting in the middle. If the builder and the
    // parser ever disagree, a reply to our own message stops threading.
    const raw = buildRfc822({
      from: 'dana@acme.test',
      to: ['customer@example.com'],
      subject: 'Devis Renée',
      html: '<p>Bonjour</p>',
      text: 'Bonjour',
      messageId: '<round-trip@sparx.email>',
      boundary: 'RT',
    });
    const parsed = parseRawInbound(raw);
    expect(parsed?.rfcMessageId).toBe('<round-trip@sparx.email>');
    expect(parsed?.subject).toBe('Devis Renée');
    expect(parsed?.bodyText?.trim()).toBe('Bonjour');
    expect(parsed?.bodyHtml?.trim()).toBe('<p>Bonjour</p>');
  });
});

/* ── IMAP ───────────────────────────────────────────────────────────────── */

describe('IMAP protocol', () => {
  it('quotes a password containing a quote or a backslash', () => {
    expect(imapQuote('p"a\\ss')).toBe('"p\\"a\\\\ss"');
  });

  it('does not mistake a completion line INSIDE a literal for the real one', () => {
    // This is the bug the literal-aware scan exists to prevent: a customer
    // quoting an IMAP session in their email would truncate the response.
    const body = 'a3 OK FETCH completed\r\nnot really\r\n';
    const data = `* 1 FETCH (UID 9 BODY[] {${String(body.length)}}\r\n${body})\r\n`;
    expect(scanImapResponse(data, 'a3').complete).toBe(false);
    expect(scanImapResponse(`${data}a3 OK done\r\n`, 'a3')).toMatchObject({
      complete: true,
      status: 'OK',
    });
  });

  it('reports a failed command with the server’s reason', () => {
    const scan = scanImapResponse('a2 NO [AUTHENTICATIONFAILED] Invalid credentials\r\n', 'a2');
    expect(scan.status).toBe('NO');
    expect(scan.detail).toContain('Invalid credentials');
  });

  it('reads UIDVALIDITY, which invalidates a stored cursor when it changes', () => {
    const state = parseSelectResponse(
      [
        '* 42 EXISTS',
        '* OK [UIDVALIDITY 3857529045] UIDs valid',
        '* OK [UIDNEXT 4392] Predicted',
      ].join('\r\n')
    );
    expect(state).toEqual({ uidValidity: 3_857_529_045, uidNext: 4392, exists: 42 });
  });

  it('asks for new mail by UID when it has a cursor, by date when it does not', () => {
    expect(imapSearchCommand(4391, new Date())).toBe('UID SEARCH UID 4392:*');
    expect(imapSearchCommand(null, new Date('2027-02-12T00:00:00Z'))).toBe(
      'UID SEARCH SINCE 12-Feb-2027'
    );
    expect(imapDate(new Date('2027-12-01T00:00:00Z'))).toBe('01-Dec-2027');
  });

  it('uses BODY.PEEK so reading does not mark the mail as read', () => {
    expect(imapFetchCommand([1, 2, 3])).toBe('UID FETCH 1,2,3 (UID BODY.PEEK[])');
  });

  it('parses SEARCH results and an empty result set', () => {
    expect(parseSearchResponse('* SEARCH 4392 4393 4400\r\na4 OK\r\n')).toEqual([4392, 4393, 4400]);
    expect(parseSearchResponse('* SEARCH\r\na4 OK\r\n')).toEqual([]);
  });

  it('files a sent copy in whichever folder the server calls Sent', () => {
    // SMTP sends a message; it does not put a copy in the sender's Sent folder.
    // Without APPEND, a rep emails from sparx and then cannot find that email in
    // their own mail app — which reads as sparx having sent it behind their back.
    expect(parseSentFolder('* LIST (\\HasNoChildren \\Sent) "/" "[Gmail]/Sent Mail"\r\n')).toBe(
      '[Gmail]/Sent Mail'
    );
    expect(parseSentFolder('* LIST (\\HasNoChildren) "/" "INBOX"\r\n')).toBeNull();
    expect(imapAppendCommand('Sent Items', 1234)).toBe('APPEND "Sent Items" (\\Seen) {1234}');
    expect(imapWantsLiteral('+ go ahead\r\n')).toBe(true);
    expect(imapWantsLiteral('a7 NO cannot\r\n')).toBe(false);
  });

  it('pulls each message body out of a multi-item FETCH response', () => {
    const first = 'Subject: One\r\n\r\nBody one';
    const second = 'Subject: Two\r\n\r\nBody two';
    const data =
      `* 1 FETCH (UID 10 BODY[] {${String(first.length)}}\r\n${first})\r\n` +
      `* 2 FETCH (UID 11 BODY[] {${String(second.length)}}\r\n${second})\r\n` +
      'a5 OK FETCH completed\r\n';
    const messages = parseFetchResponse(data);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ uid: 10 });
    expect(messages[1]?.raw).toContain('Body two');
  });
});

/* ── SMTP ───────────────────────────────────────────────────────────────── */

describe('SMTP protocol', () => {
  it('waits for the last line of a multiline reply', () => {
    // Acting on the first line desynchronizes the client from the server, and
    // every subsequent command then answers the previous command's reply.
    expect(parseSmtpReply('250-mail.example.com\r\n250-PIPELINING\r\n').complete).toBe(false);
    const reply = parseSmtpReply(
      '250-mail.example.com\r\n250-PIPELINING\r\n250 AUTH LOGIN PLAIN\r\n'
    );
    expect(reply).toMatchObject({ complete: true, code: 250 });
    expect(reply.text).toContain('AUTH LOGIN PLAIN');
  });

  it('separates try-again from never-going-to-work', () => {
    expect(smtpAccepted(250)).toBe(true);
    expect(smtpAccepted(354)).toBe(true);
    expect(smtpAccepted(451)).toBe(false);
    expect(smtpAccepted(535)).toBe(false);
  });

  it('encodes AUTH PLAIN and detects advertised capabilities', () => {
    expect(Buffer.from(smtpAuthPlain('dana', 'pw'), 'base64').toString('utf8')).toBe('\0dana\0pw');
    const greeting = '250-mail.example.com\r\n250-STARTTLS\r\n250 AUTH LOGIN PLAIN\r\n';
    expect(ehloSupports(greeting, 'STARTTLS')).toBe(true);
    expect(ehloSupports(greeting, 'SMTPUTF8')).toBe(false);
  });
});
