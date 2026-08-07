// The IMAP socket (docs/144 §5.2) — the network half of the protocol whose
// parsing lives, pure and tested, in `@sparx/crm/mail`.
//
// This is the path for every business not on Gmail or Microsoft 365: Fastmail,
// Zoho, Rackspace, a host their web agency set up in 2014. It is not a fallback
// — it is what keeps the platform off a two-vendor dependency for reading mail.
//
// TWO THINGS HERE ARE LOAD-BEARING AND EASY TO GET WRONG:
//
//  1. THE SOCKET IS READ AS LATIN-1. IMAP literals are byte-counted (`{2048}`
//     means 2048 OCTETS). In latin1 one character is exactly one byte, so the
//     counts stay true; the MIME parser then decodes those bytes using the
//     charset the message itself declares. Reading as UTF-8 makes every literal
//     length wrong the moment a message contains an accented character.
//
//  2. UIDVALIDITY INVALIDATES THE CURSOR. When a server issues a new
//     UIDVALIDITY, every UID it ever gave us means something else now. Resuming
//     from the old cursor reads the WRONG MESSAGES — so a change resets the
//     sync to a date window instead.

import { connect as tlsConnect, type TLSSocket } from 'node:tls';
import {
  imapAppendCommand,
  imapCommand,
  imapFetchCommand,
  imapQuote,
  imapSearchCommand,
  imapTag,
  imapWantsLiteral,
  parseFetchResponse,
  parseSearchResponse,
  parseSelectResponse,
  parseSentFolder,
  scanImapResponse,
  SENT_FOLDER_CANDIDATES,
  type FetchedMessage,
} from '@sparx/crm/mail';

const CONNECT_TIMEOUT_MS = 15_000;
const COMMAND_TIMEOUT_MS = 45_000;
/** Bodies are capped so one enormous message cannot exhaust the pod's memory.
 *  A message over this is still recorded — with what fits — because a truncated
 *  reply on the timeline beats a missing one. */
const MAX_MESSAGE_BYTES = 2_000_000;

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

export interface ImapFetchOptions {
  /** The highest UID already imported, or null for a first sync. */
  cursorUid: number | null;
  /** The UIDVALIDITY the cursor was recorded under. A mismatch discards it. */
  cursorValidity: number | null;
  /** How far back a first (or reset) sync reaches. */
  since: Date;
  /** Hard cap on messages per run, so a first sync of a decade-old mailbox
   *  cannot run for hours or bury the timeline. */
  max: number;
}

export interface ImapFetchResult {
  messages: FetchedMessage[];
  uidValidity: number | null;
  /** The new cursor: the highest UID seen, or the old one when nothing arrived. */
  highestUid: number | null;
}

/** A minimal tagged-command IMAP session over one TLS socket. */
class ImapSession {
  private buffer = '';
  private sequence = 0;
  private waiting: {
    tag: string;
    /** APPEND sends its data only after the server answers `+`, so the pending
     *  command settles on a continuation line rather than on a tagged status. */
    continuation?: boolean;
    resolve: (text: string) => void;
    reject: (e: Error) => void;
  } | null = null;

  constructor(private readonly socket: TLSSocket) {
    socket.setEncoding('latin1');
    socket.on('data', (chunk: string) => {
      this.buffer += chunk;
      this.settle();
    });
    socket.on('error', (err: Error) => {
      this.waiting?.reject(err);
      this.waiting = null;
    });
    socket.on('close', () => {
      this.waiting?.reject(new Error('The mail server closed the connection.'));
      this.waiting = null;
    });
  }

  /** Resolve the pending command once its tagged completion line has arrived. */
  private settle(): void {
    if (!this.waiting) return;

    if (this.waiting.continuation) {
      // Either the server said "go ahead" or it refused outright; both end the
      // wait, and a refusal must surface rather than hang until the timeout.
      if (imapWantsLiteral(this.buffer)) {
        const { resolve } = this.waiting;
        this.buffer = '';
        this.waiting = null;
        resolve('');
        return;
      }
      const refused = scanImapResponse(this.buffer, this.waiting.tag);
      if (!refused.complete) return;
      const { reject } = this.waiting;
      this.buffer = '';
      this.waiting = null;
      reject(new Error(refused.detail ?? 'The mail server refused to file the message.'));
      return;
    }

    const scan = scanImapResponse(this.buffer, this.waiting.tag);
    if (!scan.complete) return;
    const { resolve, reject } = this.waiting;
    const text = this.buffer;
    this.buffer = '';
    this.waiting = null;
    if (scan.status === 'OK') {
      resolve(text);
      return;
    }
    reject(new Error(scan.detail ?? `IMAP command failed (${scan.status ?? 'unknown'}).`));
  }

  /** Wait for the server greeting before sending anything. */
  greeting(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('The mail server did not answer in time.')),
        CONNECT_TIMEOUT_MS
      );
      const check = (): void => {
        if (!this.buffer.includes('\r\n')) return;
        clearTimeout(timer);
        this.socket.off('data', check);
        if (/^\*\s+(OK|PREAUTH)\b/.test(this.buffer.trimStart())) {
          this.buffer = '';
          resolve();
          return;
        }
        reject(new Error(this.buffer.trim().slice(0, 200)));
      };
      this.socket.on('data', check);
      check();
    });
  }

  send(command: string): Promise<string> {
    this.sequence += 1;
    return this.awaitReply(imapTag(this.sequence), imapCommand(imapTag(this.sequence), command));
  }

  /**
   * A command whose data follows a `+` continuation — APPEND, and only APPEND.
   *
   * The literal is written as latin1 so the byte count in the command matches
   * what actually goes on the wire. Counting UTF-16 characters instead would
   * make the length wrong for any message containing an accent, and the server
   * would then read the next command as part of the message.
   */
  async sendLiteral(command: string, literal: string): Promise<string> {
    this.sequence += 1;
    const tag = imapTag(this.sequence);
    await this.awaitReply(tag, imapCommand(tag, command), true);
    const pending = this.awaitReply(tag, null);
    this.socket.write(`${literal}\r\n`, 'latin1');
    return pending;
  }

  private awaitReply(tag: string, write: string | null, continuation = false): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting = null;
        reject(new Error('The mail server stopped responding.'));
      }, COMMAND_TIMEOUT_MS);
      this.waiting = {
        tag,
        continuation,
        resolve: (text) => {
          clearTimeout(timer);
          resolve(text);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      };
      if (write !== null) this.socket.write(write);
      // Data may already be buffered from a previous over-read.
      this.settle();
    });
  }

  close(): void {
    // LOGOUT is a courtesy — the socket is destroyed either way, so a server
    // that ignores it cannot hang the sync.
    try {
      this.socket.write(imapCommand(imapTag(this.sequence + 1), 'LOGOUT'));
    } catch {
      /* already gone */
    }
    this.socket.destroy();
  }
}

/**
 * Pull whatever has arrived since the cursor.
 *
 * Opens a connection, logs in, selects INBOX, searches, fetches, and closes.
 * One connection per run rather than a pool: a poll every few minutes does not
 * justify holding sockets open against every tenant's mail server, and an idle
 * IMAP connection is a thing servers drop without telling you.
 */
export async function fetchImapMessages(
  config: ImapConfig,
  options: ImapFetchOptions
): Promise<ImapFetchResult> {
  const socket = await openTls(config.host, config.port);
  const session = new ImapSession(socket);
  try {
    await session.greeting();
    await session.send(`LOGIN ${imapQuote(config.user)} ${imapQuote(config.password)}`);

    const selected = parseSelectResponse(await session.send('SELECT INBOX'));

    // A changed UIDVALIDITY makes every stored UID mean something else. Resuming
    // would read the wrong messages, so the cursor is discarded and the run
    // falls back to the date window.
    const validityMatches =
      options.cursorValidity !== null && options.cursorValidity === selected.uidValidity;
    const cursorUid = validityMatches ? options.cursorUid : null;

    const searchText = await session.send(imapSearchCommand(cursorUid, options.since));
    const found = parseSearchResponse(searchText)
      // `UID <n>:*` answers with the highest existing UID when nothing is newer,
      // so filter against our own cursor rather than trusting the result set.
      .filter((uid) => (cursorUid === null ? true : uid > cursorUid))
      .sort((a, b) => a - b);

    if (found.length === 0) {
      return { messages: [], uidValidity: selected.uidValidity, highestUid: cursorUid };
    }

    // Oldest first, capped — a first sync reads the most recent `max` rather
    // than the oldest, because recent mail is what a person is looking for.
    const wanted = found.slice(-options.max);
    const messages: FetchedMessage[] = [];
    // Batched so one FETCH cannot buffer an entire mailbox in memory.
    for (let i = 0; i < wanted.length; i += 25) {
      const batch = wanted.slice(i, i + 25);
      const text = await session.send(imapFetchCommand(batch));
      for (const message of parseFetchResponse(text)) {
        messages.push({ uid: message.uid, raw: message.raw.slice(0, MAX_MESSAGE_BYTES) });
      }
    }

    const highest = messages.reduce((max, m) => Math.max(max, m.uid), cursorUid ?? 0);
    return {
      messages,
      uidValidity: selected.uidValidity,
      highestUid: highest > 0 ? highest : cursorUid,
    };
  } finally {
    session.close();
  }
}

/** Confirm a host, port and password actually work — run at connect time so a
 *  typo is reported while the person is still looking at the form, rather than
 *  discovered by a silent tick an hour later. */
export async function verifyImapLogin(config: ImapConfig): Promise<void> {
  const socket = await openTls(config.host, config.port);
  const session = new ImapSession(socket);
  try {
    await session.greeting();
    await session.send(`LOGIN ${imapQuote(config.user)} ${imapQuote(config.password)}`);
    await session.send('SELECT INBOX');
  } finally {
    session.close();
  }
}

/**
 * File a copy of an outbound message in the mailbox's Sent folder.
 *
 * WHY THIS IS NOT OPTIONAL. SMTP sends a message; it does not put a copy
 * anywhere. Every mail client does that itself, with exactly this command.
 * Without it a rep emails a customer from sparx, opens their own mail app, and
 * cannot find the email they just sent — which reads as sparx having sent
 * something behind their back, and is the fastest way to lose their trust in
 * the whole feature.
 *
 * BEST-EFFORT BY DESIGN. The message has already been delivered by the time
 * this runs, so a server that refuses APPEND, or names its Sent folder
 * something unguessable, must not turn a successful send into a failure the
 * person sees. It returns whether it managed to file the copy, and the caller
 * logs rather than throws.
 */
export async function appendToSentFolder(config: ImapConfig, raw: string): Promise<boolean> {
  const socket = await openTls(config.host, config.port);
  const session = new ImapSession(socket);
  try {
    await session.greeting();
    await session.send(`LOGIN ${imapQuote(config.user)} ${imapQuote(config.password)}`);

    // Ask the server which folder it considers Sent (RFC 6154). That beats
    // guessing, because there is no standard name — `[Gmail]/Sent Mail`,
    // `Sent Items`, `Éléments envoyés`, all real.
    const listed = await session
      .send('LIST (SPECIAL-USE) "" "*"')
      .catch(() => session.send('LIST "" "*"').catch(() => ''));
    const advertised = parseSentFolder(listed);
    const candidates = [...(advertised ? [advertised] : []), ...SENT_FOLDER_CANDIDATES];

    // latin1 length, because that is what goes on the wire and what the literal
    // byte count has to describe.
    const byteLength = Buffer.byteLength(raw, 'latin1') + 2;
    for (const folder of candidates) {
      try {
        await session.sendLiteral(imapAppendCommand(folder, byteLength), raw);
        return true;
      } catch {
        // Wrong folder name — try the next candidate rather than giving up.
      }
    }
    return false;
  } finally {
    session.close();
  }
}

/** Implicit TLS (993). STARTTLS-on-143 is deliberately not offered: it is
 *  downgrade-attackable, every provider worth connecting to has supported
 *  implicit TLS for a decade, and a mail password is not a credential to send
 *  over a negotiable channel. */
function openTls(host: string, port: number): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tlsConnect({ host, port, servername: host }, () => {
      socket.setTimeout(0);
      resolve(socket);
    });
    socket.setTimeout(CONNECT_TIMEOUT_MS, () => {
      socket.destroy();
      reject(new Error(`Could not reach ${host} on port ${String(port)}.`));
    });
    socket.once('error', (err: Error) => {
      socket.destroy();
      reject(err);
    });
  });
}
