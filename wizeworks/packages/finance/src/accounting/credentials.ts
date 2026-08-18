// The OAuth grant behind an accounting connection (docs/146 Phase 10.7–10.8).
//
// `upsertConnection` configures a connection; this is what puts a working grant
// inside one. Split out because the two have different failure modes and very
// different blast radii: getting the sync cadence wrong is an inconvenience,
// and getting token storage wrong is a credential leak.
//
// ── Three rules the code below exists to enforce ─────────────────────────────
//
// 1. A token is NEVER stored in plaintext. Encryption is AES-256-GCM through
//    @wizeworks/integration-framework's provider-secret box — the same box the
//    marketplace provider installs use, keyed by the same `PROVIDER_SECRET_KEY`
//    — rather than a fourth home-grown one. Without the key configured, storing
//    a grant is REFUSED. A connection nobody can make is better than a token
//    sitting in a column in the clear.
//
// 2. A rotated refresh token is written back the moment it arrives. Both
//    providers rotate on every refresh and invalidate the old one immediately,
//    so failing to persist the new one does not break this call — it breaks the
//    NEXT one, hours later, which is what makes it hard to diagnose.
//
// 3. An expired grant marks the connection `expired` and says to reconnect. It
//    does not throw a generic error and it does not retry: a dead grant is a
//    conversation with the owner, not a transient fault.

import {
  decryptProviderSecret,
  encryptProviderSecret,
  isProviderSecretCryptoConfigured,
} from '@wizeworks/integration-framework';
import { Prisma, withTenant, type FinanceAccountingConnection } from '@wizeworks/db';

import { FinanceError } from '../errors';

import { accountingAdapter, AccountingAuthError, type AccountingCredentials } from './providers';

/** Refresh this long before the stated expiry. A token that expires mid-request
 *  fails the request; a minute of slack costs nothing. */
const REFRESH_SKEW_MS = 60_000;

export class AccountingCredentialsError extends FinanceError {
  constructor(message: string) {
    super('ACCOUNTING_CREDENTIALS', message);
    this.name = 'AccountingCredentialsError';
  }
}

export interface StoreCredentialsInput {
  connectionId: string;
  accessToken: string;
  refreshToken: string | null;
  externalId: string | null;
  displayName?: string | null;
  expiresAt: Date | null;
  scopes?: string[];
}

/** Save a fresh grant against a connection, encrypted. */
export async function storeCredentials(
  tenantId: string,
  input: StoreCredentialsInput
): Promise<FinanceAccountingConnection> {
  if (!isProviderSecretCryptoConfigured()) {
    throw new AccountingCredentialsError(
      'This installation cannot store an accounting login safely yet. Use the spreadsheet export instead.'
    );
  }
  return withTenant({ tenantId }, (tx) =>
    tx.financeAccountingConnection.update({
      where: { id: input.connectionId },
      data: {
        status: 'active',
        accessTokenEnc: encryptProviderSecret(input.accessToken),
        refreshTokenEnc: input.refreshToken ? encryptProviderSecret(input.refreshToken) : null,
        tokenExpiresAt: input.expiresAt,
        externalId: input.externalId,
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.scopes ? { scopes: input.scopes } : {}),
        // `DbNull`, not `null` — a nullable Json column needs the sentinel, and
        // plain null would mean the JSON value `null` if Prisma accepted it.
        lastError: Prisma.DbNull,
      },
    })
  );
}

/**
 * The connection's live credentials, refreshed if they are about to expire.
 *
 * Returns credentials ready to use, and — importantly — has already written any
 * rotated refresh token back before returning. A caller cannot forget to do that
 * because a caller never sees it happen.
 */
export async function loadCredentials(
  tenantId: string,
  connectionId: string
): Promise<{ connection: FinanceAccountingConnection; credentials: AccountingCredentials }> {
  const connection = await withTenant({ tenantId }, (tx) =>
    tx.financeAccountingConnection.findFirst({ where: { id: connectionId } })
  );
  if (!connection) throw new AccountingCredentialsError('That accounting connection is gone.');
  if (!connection.accessTokenEnc) {
    throw new AccountingCredentialsError(
      `${connection.displayName ?? connection.provider} is set up but not signed in yet. Connect it to continue.`
    );
  }

  let credentials: AccountingCredentials = {
    accessToken: decryptProviderSecret(connection.accessTokenEnc),
    refreshToken: connection.refreshTokenEnc
      ? decryptProviderSecret(connection.refreshTokenEnc)
      : null,
    externalId: connection.externalId,
    expiresAt: connection.tokenExpiresAt,
  };

  const expiring =
    credentials.expiresAt !== null &&
    credentials.expiresAt.getTime() - REFRESH_SKEW_MS <= Date.now();
  if (!expiring) return { connection, credentials };

  const adapter = accountingAdapter(connection.provider);
  if (!adapter || !credentials.refreshToken) {
    await markExpired(tenantId, connectionId);
    throw new AccountingCredentialsError(
      `Your ${connection.displayName ?? connection.provider} connection has expired. Reconnect it to keep syncing.`
    );
  }

  try {
    const refreshed = await adapter.refresh(credentials.refreshToken);
    credentials = { ...credentials, ...refreshed };
    await storeCredentials(tenantId, {
      connectionId,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      externalId: connection.externalId,
      expiresAt: refreshed.expiresAt,
    });
  } catch (error) {
    if (error instanceof AccountingAuthError) {
      await markExpired(tenantId, connectionId);
      throw new AccountingCredentialsError(
        `Your ${connection.displayName ?? connection.provider} connection has expired. Reconnect it to keep syncing.`
      );
    }
    throw error;
  }

  return { connection, credentials };
}

/** A dead grant is a state, not an error to swallow — the surface has to be able
 *  to say "reconnect" rather than showing a sync that quietly stopped. */
export async function markExpired(tenantId: string, connectionId: string): Promise<void> {
  await withTenant({ tenantId }, (tx) =>
    tx.financeAccountingConnection.update({
      where: { id: connectionId },
      data: {
        status: 'expired',
        lastError: { message: 'The login expired. Reconnect to keep syncing.' },
      },
    })
  );
}

/** Forget the grant without deleting the connection — its mapping table and its
 *  sync history are worth keeping through a reconnect. */
export async function clearCredentials(tenantId: string, connectionId: string): Promise<void> {
  await withTenant({ tenantId }, (tx) =>
    tx.financeAccountingConnection.update({
      where: { id: connectionId },
      data: {
        status: 'revoked',
        accessTokenEnc: null,
        refreshTokenEnc: null,
        tokenExpiresAt: null,
      },
    })
  );
}
