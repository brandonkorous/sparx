// Mailbox sync orchestration (docs/144 §5.2) — the three flows the routes and
// the cron tick need:
//
//   · connectMailbox — verify the credentials, then store them encrypted
//   · syncMailbox    — poll one mailbox and record what arrived
//   · syncTenantMailboxes — every mailbox a tenant has, for the tick
//
// POLLING, NOT PUSH, AND THAT IS THE WHOLE DESIGN. IMAP has IDLE, which would
// mean holding an open socket per mailbox per tenant indefinitely — connections
// servers drop without telling you, in a pod that restarts on every deploy. A
// poll on a few-minute cadence costs one short-lived connection per mailbox,
// survives restarts with no state, and is well inside what a person means by
// "the email shows up on the record". The cursor is what keeps each poll cheap:
// after the first run it asks only for UIDs above where it left off.

import type { FastifyBaseLogger } from 'fastify';
import { badRequest } from '@sparx/api-core/errors';
import { engagementService, mailboxService } from '@sparx/crm';
import { isAutomatedMessage, parseRawInbound } from '@sparx/crm/mail';
import type { MailboxConnection } from '@sparx/db';

import {
  decryptMailboxSecret,
  encryptMailboxSecret,
  isMailboxCryptoConfigured,
} from './crm-mailbox-crypto.js';
import { fetchImapMessages, verifyImapLogin, type ImapConfig } from './crm-mailbox-imap.js';

/** How far back a first sync reaches. Deliberately short: a first connect that
 *  imported ten years of mail would run for hours and bury the timeline in
 *  history nobody asked to see. Recent correspondence is what a person is
 *  looking for on the day they connect a mailbox. */
const FIRST_SYNC_DAYS = 30;
/** Hard cap per run, so one enormous mailbox cannot monopolize the tick. What
 *  is left over is picked up by the next poll — the cursor advances either way. */
const MAX_PER_RUN = 200;

export interface SyncOutcome {
  ok: boolean;
  /** Messages actually written to a timeline. */
  stored: number;
  /** Seen and deliberately not stored: duplicates, automated mail, and — the
   *  important one — messages from people who are not contacts. */
  skipped: number;
  error?: string;
}

/** The credentials a poll or a send needs, decrypted at the last moment. */
export function imapConfigFor(conn: MailboxConnection): ImapConfig {
  if (!conn.imapHost || !conn.appPasswordEnc) {
    throw new Error('This mailbox is missing its incoming server or password.');
  }
  return {
    host: conn.imapHost,
    port: conn.imapPort ?? 993,
    user: conn.imapUser ?? conn.emailAddress,
    password: decryptMailboxSecret(conn.appPasswordEnc),
  };
}

/** `UIDVALIDITY:UID`, or nulls when there is no usable cursor yet. */
function parseCursor(cursor: string | null): { validity: number | null; uid: number | null } {
  const [validity, uid] = (cursor ?? '').split(':');
  const parsedValidity = Number(validity);
  const parsedUid = Number(uid);
  return {
    validity: Number.isInteger(parsedValidity) && parsedValidity > 0 ? parsedValidity : null,
    uid: Number.isInteger(parsedUid) && parsedUid > 0 ? parsedUid : null,
  };
}

/**
 * Connect a mailbox — verifying BEFORE storing.
 *
 * The login is attempted while the person is still looking at the form, so a
 * typo in the server name or a password that was never an app password is
 * reported as a sentence they can act on. Storing first and discovering it an
 * hour later, in a tick nobody is watching, is how a mailbox sits in a list
 * looking connected while quietly doing nothing.
 */
export async function connectMailbox(
  ctx: { tenantId: string; userId?: string },
  input: {
    emailAddress: string;
    appPassword: string;
    imapHost: string;
    imapPort?: number;
    smtpHost: string;
    smtpPort?: number;
    imapUser?: string;
    scope?: 'personal' | 'shared';
    userId?: string | null;
    displayName?: string | null;
    propertyId?: string | null;
  }
): Promise<mailboxService.MailboxView> {
  if (!isMailboxCryptoConfigured()) {
    throw badRequest('Connecting a mailbox is not switched on for this deployment.');
  }

  try {
    await verifyImapLogin({
      host: input.imapHost,
      port: input.imapPort ?? 993,
      user: input.imapUser ?? input.emailAddress,
      password: input.appPassword,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Could not sign in to that mailbox.';
    // Deliberately the server's own words: "Invalid credentials" or "Could not
    // reach imap.exmaple.com" tells someone which half is wrong, and a generic
    // "connection failed" tells them nothing.
    throw badRequest(`Could not connect to that mailbox. ${detail}`);
  }

  return mailboxService.connect(
    ctx,
    {
      provider: 'imap_smtp',
      scope: input.scope ?? 'personal',
      emailAddress: input.emailAddress,
      displayName: input.displayName ?? null,
      userId: input.userId ?? ctx.userId ?? null,
      propertyId: input.propertyId ?? null,
      imapHost: input.imapHost,
      imapPort: input.imapPort ?? 993,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort ?? 587,
      ...(input.imapUser ? { imapUser: input.imapUser } : {}),
      appPassword: input.appPassword,
    },
    { appPasswordEnc: encryptMailboxSecret(input.appPassword) }
  );
}

/**
 * Poll one mailbox.
 *
 * NEVER THROWS. A mailbox that cannot be reached records why on its own row and
 * the tick moves to the next tenant's — one unreachable server must not stop
 * every other mailbox on the platform from syncing.
 */
export async function syncMailbox(
  logger: FastifyBaseLogger,
  tenantId: string,
  connectionId: string
): Promise<SyncOutcome> {
  if (!isMailboxCryptoConfigured()) {
    return { ok: false, stored: 0, skipped: 0, error: 'not_configured' };
  }

  const ctx = { tenantId };
  let conn: MailboxConnection;
  try {
    conn = await mailboxService.readCredentials(ctx, connectionId);
  } catch {
    return { ok: false, stored: 0, skipped: 0, error: 'not_found' };
  }

  const cursor = parseCursor(conn.syncCursor);
  const since = new Date(Date.now() - FIRST_SYNC_DAYS * 24 * 60 * 60 * 1000);

  try {
    const result = await fetchImapMessages(imapConfigFor(conn), {
      cursorUid: cursor.uid,
      cursorValidity: cursor.validity,
      since,
      max: MAX_PER_RUN,
    });

    let stored = 0;
    let skipped = 0;
    for (const message of result.messages) {
      // Automated mail is filtered BEFORE the contact check, not after: a
      // bounce or an out-of-office from a known contact would otherwise land on
      // their timeline as though they had written to us.
      if (isAutomatedMessage(message.raw)) {
        skipped += 1;
        continue;
      }
      const parsed = parseRawInbound(message.raw);
      if (!parsed) {
        skipped += 1;
        continue;
      }
      // The privacy gate lives in the service, not here — one place decides
      // what a personal mailbox is allowed to keep, and it is the place with
      // the transaction.
      const outcome = await engagementService.recordInbound(ctx, {
        mailboxConnectionId: conn.id,
        ...parsed,
      });
      if (outcome.stored) stored += 1;
      else skipped += 1;
    }

    // The cursor advances even when everything was skipped. That is the point:
    // a mailbox full of newsletters must not be re-read from the same UID on
    // every poll forever.
    const nextCursor =
      result.uidValidity !== null && result.highestUid !== null
        ? `${String(result.uidValidity)}:${String(result.highestUid)}`
        : undefined;
    await mailboxService.recordSync(ctx, connectionId, {
      ...(nextCursor ? { syncCursor: nextCursor } : {}),
    });

    return { ok: true, stored, skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read that mailbox.';
    // A rejected login needs a person to fix something; a timeout does not.
    // Marking a merely-unreachable server `expired` would tell someone to
    // reconnect a mailbox that is fine.
    const credentialFailure =
      /AUTHENTICATIONFAILED|invalid credentials|login failed|authentication/i.test(message);
    await mailboxService
      .recordSync(ctx, connectionId, {
        status: credentialFailure ? 'expired' : 'error',
        error: message.slice(0, 500),
      })
      .catch(() => undefined);
    logger.warn({ tenantId, connectionId, err }, 'crm-mailbox: sync failed');
    return { ok: false, stored: 0, skipped: 0, error: message };
  }
}

/** Every mailbox a tenant has, one after another. Sequential on purpose: the
 *  count is small, and a burst of parallel connections to the same mail server
 *  is what gets an IP rate-limited. */
export async function syncTenantMailboxes(
  logger: FastifyBaseLogger,
  tenantId: string
): Promise<{ mailboxes: number; stored: number; skipped: number; failed: number }> {
  const connections = await mailboxService.listSyncable({ tenantId });
  let stored = 0;
  let skipped = 0;
  let failed = 0;
  for (const conn of connections) {
    const outcome = await syncMailbox(logger, tenantId, conn.id);
    stored += outcome.stored;
    skipped += outcome.skipped;
    if (!outcome.ok) failed += 1;
  }
  return { mailboxes: connections.length, stored, skipped, failed };
}
