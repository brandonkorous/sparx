// IMAP4rev1 (RFC 3501), the subset a CRM needs (docs/144 §5.2).
//
// PURE — command strings in, parsed structures out. The TLS socket that speaks
// this dialogue lives in api-rest; everything about the PROTOCOL is here, where
// it is unit-tested against captured server responses.
//
// WHY HAND-WRITTEN. IMAP/SMTP is not a consolation prize in this design — it is
// what keeps the platform off a two-vendor dependency for something as basic as
// reading mail, and it is the only path for the many businesses on Fastmail,
// Zoho, Rackspace or their own server. The general-purpose IMAP libraries are
// large, and this repo already hand-writes its iCal and CalDAV parsers for
// exactly this reason (`@sparx/scheduling` caldav-xml.ts, ical-parse.ts). The
// subset needed here — LOGIN, SELECT, UID SEARCH, UID FETCH — is small, frozen
// since 2003, and easier to own than to depend on.
//
// EVERYTHING WORKS IN LATIN-1 STRINGS. IMAP literals are byte-counted (`{2048}`
// means 2048 OCTETS), so the socket decodes as latin1 where one character is
// exactly one byte and the counts stay true. The MIME parser then decodes those
// bytes into real text using the charset the message declares. Reading the
// socket as UTF-8 instead would make every literal length wrong the moment a
// message contained a non-ASCII character.

/** A command line, with its tag. IMAP requires CRLF. */
export function imapCommand(tag: string, text: string): string {
  return `${tag} ${text}\r\n`;
}

/** Tags are sequential per connection: a1, a2, … The server echoes the tag on
 *  the completion line, which is how a reply is matched to its command. */
export function imapTag(sequence: number): string {
  return `a${String(sequence)}`;
}

/**
 * An IMAP string argument.
 *
 * A password with a space, a quote or a backslash in it is the entire reason
 * this exists — an unquoted LOGIN with such a password fails with a syntax
 * error that reads like a wrong password, and someone spends an afternoon on
 * it.
 */
export function imapQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export type ImapStatus = 'OK' | 'NO' | 'BAD';

export interface ImapScan {
  /** Whether the tagged completion line has arrived. */
  complete: boolean;
  status: ImapStatus | null;
  /** The completion line's human-readable remainder, for error reporting. */
  detail: string | null;
}

/**
 * Has this response finished, and how did it end?
 *
 * LITERAL-AWARE, which is the whole difficulty. A response is a sequence of
 * lines, EXCEPT that a line ending in `{N}` is followed by exactly N octets of
 * arbitrary data — which routinely contains text that looks exactly like a
 * tagged completion line. Scanning for `a3 OK` without honouring literals means
 * a message body quoting an IMAP session truncates the response, and the parse
 * is silently wrong rather than loudly broken.
 */
export function scanImapResponse(data: string, tag: string): ImapScan {
  let index = 0;
  while (index < data.length) {
    const lineEnd = data.indexOf('\r\n', index);
    if (lineEnd === -1) break; // partial line — wait for more
    const line = data.slice(index, lineEnd);
    index = lineEnd + 2;

    const literal = /\{(\d+)\}$/.exec(line);
    if (literal) {
      const length = Number(literal[1]);
      index += length;
      continue;
    }

    if (line.startsWith(`${tag} `)) {
      const match = /^\S+\s+(OK|NO|BAD)\s*(.*)$/.exec(line);
      return {
        complete: true,
        status: (match?.[1] as ImapStatus | undefined) ?? 'BAD',
        detail: match?.[2]?.trim() ?? line,
      };
    }
  }
  return { complete: false, status: null, detail: null };
}

/** The greeting a server sends on connect: `* OK …` means it is willing to
 *  talk, `* BYE` means it is not. */
export function imapGreetingOk(data: string): boolean {
  return /^\*\s+(OK|PREAUTH)\b/.test(data.trimStart());
}

/* ── SELECT ─────────────────────────────────────────────────────────────── */

export interface MailboxState {
  /** Bumps whenever the server invalidates every UID it has issued. When this
   *  changes, a stored cursor is meaningless and the sync must start over —
   *  resuming from an old UID against a new UIDVALIDITY reads the wrong
   *  messages, which is worse than re-reading the right ones. */
  uidValidity: number | null;
  /** The UID the next arriving message will get. */
  uidNext: number | null;
  exists: number | null;
}

export function parseSelectResponse(data: string): MailboxState {
  const validity = /\[UIDVALIDITY (\d+)\]/i.exec(data);
  const next = /\[UIDNEXT (\d+)\]/i.exec(data);
  const exists = /^\*\s+(\d+)\s+EXISTS/im.exec(data);
  return {
    uidValidity: validity ? Number(validity[1]) : null,
    uidNext: next ? Number(next[1]) : null,
    exists: exists ? Number(exists[1]) : null,
  };
}

/* ── SEARCH ─────────────────────────────────────────────────────────────── */

/** IMAP's date format is `12-Feb-2027`, in English, always — a locale-formatted
 *  date is rejected as a syntax error. */
export function imapDate(date: Date): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${String(date.getUTCDate()).padStart(2, '0')}-${months[date.getUTCMonth()] ?? 'Jan'}-${String(date.getUTCFullYear())}`;
}

/**
 * Which messages to fetch.
 *
 * A stored UID cursor wins: `UID <n>:*` asks only for what has arrived since,
 * which is one round trip on a quiet mailbox. Without one, fall back to a DATE
 * window — never a bare `ALL`, which on a ten-year-old mailbox asks the server
 * for a hundred thousand UIDs and then downloads them.
 */
export function imapSearchCommand(cursorUid: number | null, since: Date): string {
  return cursorUid && cursorUid > 0
    ? `UID SEARCH UID ${String(cursorUid + 1)}:*`
    : `UID SEARCH SINCE ${imapDate(since)}`;
}

/**
 * UIDs off a `* SEARCH …` line.
 *
 * `UID <n>:*` has a quirk worth knowing: when nothing is newer than `n`, most
 * servers answer with the single highest existing UID rather than with nothing.
 * The caller therefore filters against its own cursor rather than trusting the
 * result set to be strictly newer — otherwise the newest message is re-fetched
 * on every poll forever (harmless, because the Message-ID dedupe catches it,
 * but it is a request per mailbox per minute for no reason).
 */
export function parseSearchResponse(data: string): number[] {
  const line = /^\*\s+SEARCH\s*(.*)$/im.exec(data);
  if (!line?.[1]) return [];
  return line[1]
    .trim()
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

/* ── FETCH ──────────────────────────────────────────────────────────────── */

/** `BODY.PEEK[]` rather than `BODY[]`: PEEK is what stops the fetch from
 *  marking the customer's mail as read in their own client. Reading someone's
 *  inbox must not change what they see in it. */
export function imapFetchCommand(uids: number[]): string {
  return `UID FETCH ${uids.join(',')} (UID BODY.PEEK[])`;
}

export interface FetchedMessage {
  uid: number;
  /** The raw RFC 822 message, latin1 bytes-as-characters. */
  raw: string;
}

/* ── APPEND ─────────────────────────────────────────────────────────────── */

/**
 * The candidate names for the Sent folder, most likely first.
 *
 * There is no standard name. `Sent` is the common case, Gmail-over-IMAP uses
 * `[Gmail]/Sent Mail`, Microsoft uses `Sent Items`, and a French or German
 * account may be localized. The RFC 6154 `\Sent` special-use flag is the right
 * answer where a server advertises it, and this list is the fallback for the
 * many that do not.
 */
export const SENT_FOLDER_CANDIDATES = [
  'Sent',
  'INBOX.Sent',
  'Sent Items',
  'Sent Messages',
  '[Gmail]/Sent Mail',
];

/** The mailbox a server has flagged `\Sent`, out of a LIST response. Preferred
 *  over guessing, because it is the server telling us rather than us hoping. */
export function parseSentFolder(listResponse: string): string | null {
  const match = /^\*\s+LIST\s+\([^)]*\\Sent[^)]*\)\s+("[^"]*"|\S+)\s+(.+)$/im.exec(listResponse);
  if (!match?.[2]) return null;
  return match[2].trim().replace(/^"|"$/g, '');
}

/**
 * The APPEND command line for filing a copy of an outbound message.
 *
 * WHY THIS EXISTS AT ALL: SMTP sends a message; it does not put a copy in the
 * sender's Sent folder. Every mail client does that itself, with exactly this
 * command. Without it, a rep emails a customer from sparx and then cannot find
 * that email in their own mail app — which reads as sparx having sent something
 * behind their back, and is the fastest way to lose their trust in the feature.
 *
 * `\Seen` because you have obviously read a message you just wrote. The literal
 * length is in OCTETS, so the caller measures the latin1 byte length.
 */
export function imapAppendCommand(folder: string, byteLength: number): string {
  return `APPEND ${imapQuote(folder)} (\\Seen) {${String(byteLength)}}`;
}

/** Whether the server answered an APPEND literal with the `+` continuation
 *  request that means "go ahead, send the bytes". */
export function imapWantsLiteral(data: string): boolean {
  return /^\+/m.test(data);
}

/**
 * Pull the messages out of a FETCH response.
 *
 * Same literal-aware walk as {@link scanImapResponse}, because the bodies ARE
 * the literals. Anything without both a UID and a literal is skipped rather
 * than guessed at — a FETCH item we cannot read is a message we will see again
 * on the next poll, whereas a mis-parsed one becomes a permanent wrong row.
 */
export function parseFetchResponse(data: string): FetchedMessage[] {
  const out: FetchedMessage[] = [];
  let index = 0;
  let pendingUid: number | null = null;

  while (index < data.length) {
    const lineEnd = data.indexOf('\r\n', index);
    if (lineEnd === -1) break;
    const line = data.slice(index, lineEnd);
    index = lineEnd + 2;

    const literal = /\{(\d+)\}$/.exec(line);
    if (!literal) {
      // A new FETCH item starts here; remember its UID for the literal below.
      if (/^\*\s+\d+\s+FETCH/i.test(line)) {
        const uid = /\bUID\s+(\d+)/i.exec(line);
        pendingUid = uid ? Number(uid[1]) : null;
      }
      continue;
    }

    if (/^\*\s+\d+\s+FETCH/i.test(line)) {
      const uid = /\bUID\s+(\d+)/i.exec(line);
      if (uid) pendingUid = Number(uid[1]);
    }

    const length = Number(literal[1]);
    const raw = data.slice(index, index + length);
    index += length;
    if (pendingUid !== null) {
      out.push({ uid: pendingUid, raw });
      pendingUid = null;
    }
  }
  return out;
}
