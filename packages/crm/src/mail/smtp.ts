// SMTP (RFC 5321), the subset needed to send one message (docs/144 §5.2).
//
// PURE — reply parsing and command encoding. The TLS socket lives in api-rest.
// Hand-written for the same reason as the IMAP side: the dialogue is six
// commands, frozen since 2008.

export interface SmtpReply {
  /** Whether the whole reply has arrived. A multiline reply uses `250-` on
   *  every line but the last, which uses `250 ` — reading the first line and
   *  proceeding is how a client desynchronizes from the server and every
   *  subsequent command answers the previous one's reply. */
  complete: boolean;
  code: number | null;
  text: string;
}

export function parseSmtpReply(data: string): SmtpReply {
  const lines = data.split(/\r?\n/).filter((line) => line !== '');
  if (lines.length === 0) return { complete: false, code: null, text: '' };
  const last = lines[lines.length - 1] ?? '';
  const final = /^(\d{3})\s(.*)$/.exec(last);
  if (!final) return { complete: false, code: null, text: data };
  return {
    complete: true,
    code: Number(final[1]),
    text: lines
      .map((line) => line.slice(4))
      .join(' ')
      .trim(),
  };
}

/** 2xx is success, 3xx means "carry on" (DATA, AUTH challenges). Anything else
 *  failed, and 4xx vs 5xx is the difference between "try again later" and
 *  "never going to work" — which decides whether the connection is marked
 *  errored or expired. */
export function smtpAccepted(code: number | null): boolean {
  return code !== null && code >= 200 && code < 400;
}

export function smtpPermanentFailure(code: number | null): boolean {
  return code !== null && code >= 500;
}

/**
 * AUTH LOGIN — username and password each base64, each as its own line after a
 * server challenge.
 *
 * Ancient and technically deprecated, and still what a large share of hosts
 * offer. AUTH PLAIN is preferred when the server advertises it (one round trip
 * instead of three); this is the fallback, not the first choice.
 */
export function smtpAuthLoginSteps(username: string, password: string): string[] {
  return [
    Buffer.from(username, 'utf8').toString('base64'),
    Buffer.from(password, 'utf8').toString('base64'),
  ];
}

/** AUTH PLAIN — `\0user\0pass`, base64, in one command. */
export function smtpAuthPlain(username: string, password: string): string {
  return Buffer.from(`\0${username}\0${password}`, 'utf8').toString('base64');
}

/** Whether the EHLO response advertises a capability. Case-insensitive because
 *  servers are inconsistent about it. */
export function ehloSupports(greeting: string, keyword: string): boolean {
  return new RegExp(`^\\d{3}[- ]${keyword}\\b`, 'im').test(greeting);
}

/** An address in the angle-bracket form the envelope commands require.
 *  `MAIL FROM: dana@example.com` without brackets is a syntax error on strict
 *  servers, which is a confusing way to discover a formatting rule. */
export function envelopeAddress(address: string): string {
  return `<${address.trim()}>`;
}
