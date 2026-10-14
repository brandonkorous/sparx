import type { EmailProvider } from '../types';
import { writeDevOutbox } from './dev-outbox';

// Dev provider — logs the rendered email to stdout and stashes the last send
// in-memory so tests / a debug UI can assert on it, and writes every send to the
// dev outbox (`dev-outbox.ts`) so any process's email can be opened and its links
// pressed: `pnpm dev:mail`. Never used in production;
// SPARX_EMAIL_PROVIDER selects between this and the Postal HTTP provider.

let lastSend: ConsoleSend | null = null;

export interface ConsoleSend {
  id: string;
  to: string;
  from: string;
  /** Where a reply goes, when the send set one: an email that says "reply to this"
   *  is only checkable against it. */
  replyTo?: string;
  /** The domain the send relays through, when the caller named one. */
  senderDomain?: string;
  subject: string;
  templateId?: string;
  html: string;
  text: string;
  /** Filenames only — a dev log is for reading, and a base64 spreadsheet is not
   *  readable. The bytes are still in the payload the provider received. */
  attachments?: string[];
  /** The message headers it carried: List-Unsubscribe is only checkable here. */
  headers?: Record<string, string>;
  acceptedAt: string;
}

export const consoleProvider: EmailProvider = {
  name: 'console',
  async send(email) {
    const id = `con_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const acceptedAt = new Date().toISOString();

    lastSend = {
      id,
      to: email.to,
      from: email.from,
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
      ...(email.senderDomain ? { senderDomain: email.senderDomain } : {}),
      subject: email.subject,
      templateId: email.templateId,
      html: email.html,
      text: email.text,
      ...(email.attachments?.length
        ? { attachments: email.attachments.map((a) => a.filename) }
        : {}),
      ...(email.headers && Object.keys(email.headers).length ? { headers: email.headers } : {}),
      acceptedAt,
    };

    // Compact, single-line summary by default; the text body follows as a
    // separate stdout line so reading dev logs is bearable. Set
    // SPARX_EMAIL_LOG_HTML=1 if you want the full HTML dumped too.
    const files = email.attachments?.length
      ? ` (+${email.attachments.map((a) => a.filename).join(', ')})`
      : '';
    console.log(
      `[email/console] ${email.templateId ?? 'unknown'} → ${email.to} :: ${email.subject}${files}`
    );
    if (process.env.SPARX_EMAIL_LOG_HTML === '1') {
      console.log(email.html);
    } else {
      console.log(email.text);
    }
    await writeDevOutbox(lastSend);

    return { id, provider: 'console', acceptedAt };
  },
};

export function lastConsoleSend(): ConsoleSend | null {
  return lastSend;
}

export function resetConsoleProvider(): void {
  lastSend = null;
}
