// mailboxService — the mailboxes sparx can send and receive through (docs/144 §5.2).
//
// ONE PROTOCOL: IMAP AND SMTP. Not the Gmail API, not Microsoft Graph. Reading
// mail through those needs Google's restricted-scope CASA assessment and
// Microsoft's publisher verification — a recurring third-party security audit as
// the standing price of a mailbox connector, and a vendor holding a veto over a
// feature customers have already paid for. IMAP reaches the same mailboxes
// (Gmail and Microsoft 365 both speak it) over an app password the tenant issues
// in their own account settings and revokes the same way, which puts them rather
// than us in the consent loop. One protocol also means one sync path to keep
// correct rather than three.
//
// CREDENTIALS NEVER LEAVE THIS FILE IN PLAINTEXT. Every read strips the
// encrypted column before returning, so a password cannot reach a REST response
// by someone forgetting to omit it. The one function that hands it out is named
// so that nobody calls it by accident.

import { ConnectMailboxInput, syncGateFor, type MailboxScope } from '@sparx/crm-schemas';
import { withTenant } from '@sparx/db';
import type { MailboxConnection } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { CrmConflictError, CrmNotFoundError } from '../errors';

/**
 * A mailbox as everything outside this file may see it — no app password.
 *
 * Returning the row directly would put ciphertext into API responses and logs.
 * It is only ciphertext — but a bundle that never leaves the database cannot be
 * captured from a log aggregator, and the cost of stripping it is one function.
 */
export interface MailboxView {
  id: string;
  provider: string;
  scope: string;
  userId: string | null;
  propertyId: string | null;
  emailAddress: string;
  displayName: string | null;
  imapHost: string | null;
  imapPort: number | null;
  smtpHost: string | null;
  smtpPort: number | null;
  status: string;
  lastSyncedAt: Date | null;
  lastError: string | null;
  /** Whether this connection stores everything or only known contacts. Surfaced
   *  because it is the promise the connect flow made, and a person should be
   *  able to check it afterwards. */
  syncGate: 'known_contacts_only' | 'everything';
  createdAt: Date;
}

function toView(row: MailboxConnection): MailboxView {
  return {
    id: row.id,
    provider: row.provider,
    scope: row.scope,
    userId: row.userId,
    propertyId: row.propertyId,
    emailAddress: row.emailAddress,
    displayName: row.displayName,
    imapHost: row.imapHost,
    imapPort: row.imapPort,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    status: row.status,
    lastSyncedAt: row.lastSyncedAt,
    lastError: row.lastError,
    syncGate: syncGateFor(row.scope as MailboxScope),
    createdAt: row.createdAt,
  };
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

export async function list(
  ctx: ServiceContext,
  args: { userId?: string; scope?: MailboxScope } = {}
): Promise<MailboxView[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.mailboxConnection.findMany({
      where: {
        ...(args.userId ? { userId: args.userId } : {}),
        ...(args.scope ? { scope: args.scope } : {}),
      },
      orderBy: [{ scope: 'asc' }, { emailAddress: 'asc' }],
    })
  );
  return rows.map(toView);
}

export async function get(ctx: ServiceContext, connectionId: string): Promise<MailboxView> {
  const row = await withTenant(ctx, (tx) =>
    tx.mailboxConnection.findUnique({ where: { id: connectionId } })
  );
  if (!row) throw new CrmNotFoundError('MailboxConnection', connectionId);
  return toView(row);
}

/**
 * Which mailboxes THIS person may send from: their own, plus every shared
 * address.
 *
 * The whole rule in one function, so no surface has to re-derive it. Sending as
 * a colleague's personal address is impersonation, and the fact that it is
 * technically possible is exactly why it is refused here rather than left to a
 * UI filter.
 */
export async function sendableBy(ctx: ServiceContext, userId: string): Promise<MailboxView[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.mailboxConnection.findMany({
      where: {
        status: 'active',
        OR: [{ scope: 'shared' }, { scope: 'personal', userId }],
      },
      orderBy: [{ scope: 'asc' }, { emailAddress: 'asc' }],
    })
  );
  return rows.map(toView);
}

/**
 * The credentials, decrypted by the caller.
 *
 * Named to be conspicuous at the call site. Only the mail sync and the sender
 * have any business calling it, and both are inside the trust boundary.
 */
export async function readCredentials(
  ctx: ServiceContext,
  connectionId: string
): Promise<MailboxConnection> {
  const row = await withTenant(ctx, (tx) =>
    tx.mailboxConnection.findUnique({ where: { id: connectionId } })
  );
  if (!row) throw new CrmNotFoundError('MailboxConnection', connectionId);
  return row;
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export interface ConnectOptions {
  /**
   * The app password as ciphertext, produced by the caller with the platform's
   * AES-256-GCM helper.
   *
   * This service never sees a key and never does crypto — the same split
   * scheduling uses, so there is ONE place key handling can be wrong instead of
   * two, and a service test needs no key material to run.
   */
  appPasswordEnc: string;
}

export async function connect(
  ctx: ServiceContext,
  rawInput: unknown,
  options: ConnectOptions
): Promise<MailboxView> {
  const input = ConnectMailboxInput.parse(rawInput);

  const row = await withTenant(ctx, async (tx) => {
    const clash = await tx.mailboxConnection.findFirst({
      where: { emailAddress: input.emailAddress },
    });
    if (clash) {
      // Connecting the same address twice would double every inbound message.
      throw new CrmConflictError(
        `${input.emailAddress} is already connected. Disconnect it first if you want to start again.`,
        'emailAddress'
      );
    }

    const created = await tx.mailboxConnection.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: input.propertyId ?? null,
        provider: input.provider,
        scope: input.scope,
        userId: input.userId ?? null,
        emailAddress: input.emailAddress,
        displayName: input.displayName ?? null,
        imapHost: input.imapHost,
        imapPort: input.imapPort,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        // Nearly every provider wants the address itself as the username, and
        // the ones that do not are the reason this is overridable.
        imapUser: input.imapUser ?? input.emailAddress,
        appPasswordEnc: options.appPasswordEnc,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.mailbox.connected',
      entityType: 'MailboxConnection',
      entityId: created.id,
      // The address and the scope, never the credentials.
      diff: { after: { emailAddress: created.emailAddress, scope: created.scope } },
    });
    return created;
  });

  return toView(row);
}

/**
 * Every mailbox the sync tick should visit.
 *
 * `error` connections are INCLUDED and `expired` ones are not. The difference
 * is whether trying again can help: an error is usually a timeout or a rate
 * limit and the next tick often clears it, whereas an expired grant needs a
 * person to reconnect and retrying it every minute just burns quota and keeps
 * writing the same error into the row.
 */
export async function listSyncable(ctx: ServiceContext): Promise<MailboxConnection[]> {
  return withTenant(ctx, (tx) =>
    tx.mailboxConnection.findMany({
      where: { status: { in: ['active', 'error'] } },
      orderBy: { lastSyncedAt: { sort: 'asc', nulls: 'first' } },
    })
  );
}

/**
 * Record where the sync got to, and whether it worked.
 *
 * ONE WRITER for the row's sync state, so there is a single place this can be
 * wrong. `updateMany` rather than `update` because a mailbox disconnected while
 * a poll was in flight must not turn a completed sync into an unhandled
 * rejection — the write simply affects nothing.
 */
export async function recordSync(
  ctx: ServiceContext,
  connectionId: string,
  update: {
    /** `UIDVALIDITY:UID` — where this run finished. */
    syncCursor?: string;
    /** Set on a credential failure. `expired` asks the person to reconnect;
     *  `error` is a transient the next tick may well clear on its own. */
    status?: 'active' | 'expired' | 'error';
    error?: string;
  } = {}
): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.mailboxConnection.updateMany({
      where: { id: connectionId },
      data: {
        ...(update.syncCursor !== undefined ? { syncCursor: update.syncCursor } : {}),
        lastSyncedAt: new Date(),
        // A recovered connection clears its own error. Leaving a stale one on a
        // working mailbox is how a person is told to fix something that is fine.
        status: update.status ?? (update.error ? 'error' : 'active'),
        lastError: update.error ?? null,
      },
    })
  );
}

/**
 * Disconnect a mailbox. The MESSAGES survive.
 *
 * Nobody disconnecting a mailbox means "delete the year of correspondence we
 * have with our customers" — the FK is SET NULL for exactly this reason. What
 * goes is the credential and the ability to send or receive through it.
 */
export async function disconnect(ctx: ServiceContext, connectionId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.mailboxConnection.findUnique({ where: { id: connectionId } });
    if (!before) throw new CrmNotFoundError('MailboxConnection', connectionId);

    await tx.mailboxConnection.delete({ where: { id: connectionId } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.mailbox.disconnected',
      entityType: 'MailboxConnection',
      entityId: connectionId,
      diff: { before: { emailAddress: before.emailAddress } },
    });
  });
}
