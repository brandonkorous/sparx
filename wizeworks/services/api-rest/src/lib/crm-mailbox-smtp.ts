// The SMTP socket (docs/144 §5.2) — sending through a tenant's own mail server
// so the message lands in their real Sent folder and reads as coming from them.
//
// The dialogue is six commands and the parsing is in `@wizeworks/crm/mail`. What is
// here is the socket, the two TLS shapes real servers offer, and the ordering
// discipline: SMTP is strictly one command per reply, and a client that sends
// ahead of a multiline reply desynchronizes and then misreads every answer as
// belonging to the previous command.

import { connect as netConnect, type Socket } from 'node:net';
import { connect as tlsConnect, type TLSSocket } from 'node:tls';
import {
  dotStuff,
  ehloSupports,
  envelopeAddress,
  parseSmtpReply,
  smtpAuthLoginSteps,
  smtpAuthPlain,
  smtpPermanentFailure,
} from '@wizeworks/crm/mail';

const CONNECT_TIMEOUT_MS = 15_000;
const COMMAND_TIMEOUT_MS = 60_000;

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

export interface SmtpMessage {
  from: string;
  to: string[];
  raw: string;
}

/** A send that failed for good — a bad password, a rejected sender. Separated
 *  from a transient so the caller knows whether to ask a person to fix
 *  something or simply to try again later. */
export class SmtpPermanentError extends Error {}

class SmtpSession {
  private buffer = '';
  private waiting: { resolve: (text: string) => void; reject: (e: Error) => void } | null = null;

  constructor(private socket: Socket | TLSSocket) {
    this.attach();
  }

  private attach(): void {
    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk: string) => {
      this.buffer += chunk;
      this.settle();
    });
    this.socket.on('error', (err: Error) => {
      this.waiting?.reject(err);
      this.waiting = null;
    });
  }

  private settle(): void {
    if (!this.waiting) return;
    const reply = parseSmtpReply(this.buffer);
    if (!reply.complete) return;
    const { resolve, reject } = this.waiting;
    const text = this.buffer;
    this.buffer = '';
    this.waiting = null;
    if (reply.code !== null && reply.code >= 200 && reply.code < 400) {
      resolve(text);
      return;
    }
    const error = smtpPermanentFailure(reply.code)
      ? new SmtpPermanentError(reply.text)
      : new Error(reply.text);
    reject(error);
  }

  private expect(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting = null;
        reject(new Error('The mail server stopped responding.'));
      }, COMMAND_TIMEOUT_MS);
      this.waiting = {
        resolve: (text) => {
          clearTimeout(timer);
          resolve(text);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      };
      this.settle();
    });
  }

  /** The banner the server sends unprompted on connect. */
  banner(): Promise<string> {
    return this.expect();
  }

  command(line: string): Promise<string> {
    const pending = this.expect();
    this.socket.write(`${line}\r\n`);
    return pending;
  }

  /** Upgrade an established plaintext socket after STARTTLS. The session keeps
   *  running on the wrapped socket; the handshake is the only discontinuity. */
  upgrade(host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const plain = this.socket;
      plain.removeAllListeners('data');
      plain.removeAllListeners('error');
      const secure = tlsConnect({ socket: plain, servername: host }, () => {
        this.socket = secure;
        this.buffer = '';
        this.attach();
        resolve();
      });
      secure.once('error', reject);
    });
  }

  close(): void {
    try {
      this.socket.write('QUIT\r\n');
    } catch {
      /* already gone */
    }
    this.socket.destroy();
  }
}

/**
 * Send one message.
 *
 * Port 465 is implicit TLS; anything else starts plaintext and upgrades with
 * STARTTLS. A server on 587 that does NOT advertise STARTTLS is refused rather
 * than downgraded — a mail password and a customer's correspondence are not
 * things to put on the wire in the clear because the other end asked nicely.
 */
export async function sendSmtpMessage(config: SmtpConfig, message: SmtpMessage): Promise<void> {
  const implicitTls = config.port === 465;
  const socket = implicitTls
    ? await openTls(config.host, config.port)
    : await openPlain(config.host, config.port);
  const session = new SmtpSession(socket);

  try {
    await session.banner();
    let greeting = await session.command(`EHLO ${hostnameFor(message.from)}`);

    if (!implicitTls) {
      if (!ehloSupports(greeting, 'STARTTLS')) {
        throw new SmtpPermanentError(
          `${config.host} will not encrypt the connection, so mail cannot be sent through it.`
        );
      }
      await session.command('STARTTLS');
      await session.upgrade(config.host);
      // EHLO again after the upgrade: the capability list before TLS is not
      // trustworthy and most servers only advertise AUTH afterwards.
      greeting = await session.command(`EHLO ${hostnameFor(message.from)}`);
    }

    if (ehloSupports(greeting, 'AUTH') && /PLAIN/i.test(greeting)) {
      await session.command(`AUTH PLAIN ${smtpAuthPlain(config.user, config.password)}`);
    } else {
      const [user, password] = smtpAuthLoginSteps(config.user, config.password);
      await session.command('AUTH LOGIN');
      await session.command(user ?? '');
      await session.command(password ?? '');
    }

    await session.command(`MAIL FROM:${envelopeAddress(message.from)}`);
    for (const recipient of message.to) {
      await session.command(`RCPT TO:${envelopeAddress(recipient)}`);
    }
    await session.command('DATA');
    // Dot-stuffed, then terminated by a lone dot — a body line that legitimately
    // starts with `.` would otherwise truncate the message there.
    await session.command(`${dotStuff(message.raw)}\r\n.`);
  } finally {
    session.close();
  }
}

/** The EHLO name. A bare hostname is required; the local part of the sender is
 *  the most honest thing available without leaking pod internals. */
function hostnameFor(from: string): string {
  const domain = from.split('@')[1];
  return domain && /^[a-z0-9.-]+$/i.test(domain) ? domain : 'sparx.works';
}

/** Small shim so `hostnameFor` can read the message's sender without the config
 *  type carrying a field it does not own. */
declare module './crm-mailbox-smtp.js' {}

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

function openPlain(host: string, port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = netConnect({ host, port }, () => {
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
