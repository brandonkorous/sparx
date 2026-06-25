// Resolves the live ChannelAuth for a connection (docs/106 §4.6): decrypts the
// stored access token and, when it's at/near expiry, refreshes via the adapter and
// PERSISTS the rotated grant. Tokens are AES-256-GCM at rest (@sparx/channels/
// crypto) — the row never holds plaintext. The worker owns this write; adapters
// stay pure I/O.

import type { Logger } from 'pino';
import { withTenant } from '@sparx/db';
import { decryptChannelToken, encryptChannelToken } from '@sparx/channels/crypto';
import type { ChannelAdapter, ChannelAuth } from '@sparx/channels';

// Refresh a token already within a minute of expiry (clock-skew + push latency).
const REFRESH_SKEW_MS = 60_000;

export interface ConnectionTokenRow {
  id: string;
  externalId: string | null;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | null;
}

export async function resolveChannelAuth(
  tenantId: string,
  connection: ConnectionTokenRow,
  adapter: ChannelAdapter,
  log: Logger
): Promise<ChannelAuth | null> {
  if (!connection.accessTokenEnc) {
    log.warn(
      { connectionId: connection.id },
      'channel-sync: connection has no stored token — skipping'
    );
    return null;
  }
  if (!connection.externalId) {
    log.warn(
      { connectionId: connection.id },
      'channel-sync: connection has no external account id — needs re-auth, skipping'
    );
    return null;
  }

  let accessToken = decryptChannelToken(connection.accessTokenEnc);

  const expiresAt = connection.tokenExpiresAt?.getTime();
  const nearExpiry = expiresAt != null && expiresAt - Date.now() <= REFRESH_SKEW_MS;
  if (nearExpiry && adapter.refresh && connection.refreshTokenEnc) {
    try {
      const tokens = await adapter.refresh(decryptChannelToken(connection.refreshTokenEnc));
      accessToken = tokens.accessToken;
      await withTenant({ tenantId }, (tx) =>
        tx.channelConnection.update({
          where: { id: connection.id },
          data: {
            accessTokenEnc: encryptChannelToken(tokens.accessToken),
            // Some channels rotate the refresh token; keep the prior one otherwise.
            refreshTokenEnc: tokens.refreshToken
              ? encryptChannelToken(tokens.refreshToken)
              : connection.refreshTokenEnc,
            tokenExpiresAt: tokens.expiresInSeconds
              ? new Date(Date.now() + tokens.expiresInSeconds * 1000)
              : null,
          },
        })
      );
    } catch (err) {
      // A failed refresh is non-fatal — try the (possibly still-valid) current
      // token; a real 401 downstream surfaces as a recorded sync error.
      log.error(
        { connectionId: connection.id, err: err instanceof Error ? err.message : String(err) },
        'channel-sync: token refresh failed — proceeding with the current token'
      );
    }
  }

  return { externalId: connection.externalId, accessToken };
}
