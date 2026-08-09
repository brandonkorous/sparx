// Resolve a live SocialAuth for a connection: decrypt the access token, refresh it
// when near expiry (persisting the rotated grant + new expiry), and surface the
// platform params. Mirrors the channel-sync-worker's resolveConnectionAuth. Pure DB +
// crypto + adapter — no HTTP entrypoint concerns.

import { withTenant } from '@sparx/db';
import type { Prisma } from '@sparx/db';
import { paramsFromSocialMetadata } from '@sparx/social';
import type { SocialAdapter, SocialAuth } from '@sparx/social';
import { decryptSocialToken, encryptSocialToken } from '@sparx/social/crypto';

const REFRESH_SKEW_MS = 60_000;

export interface SocialConnectionAuthRow {
  id: string;
  externalId: string | null;
  status: string;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | null;
  metadata: Prisma.JsonValue;
}

/** Read the platform-specific params back off the connection metadata. Re-exported (not
 *  redefined) so the health sweep and the readiness check share one definition. */
export { paramsFromSocialMetadata as paramsFromMetadata };

/** Resolve a usable SocialAuth, or null when the connection is revoked / has no stored
 *  token. Refreshes + persists a near-expiry grant when the adapter supports it. */
export async function resolveSocialAuth(
  tenantId: string,
  connection: SocialConnectionAuthRow,
  adapter: SocialAdapter
): Promise<SocialAuth | null> {
  if (connection.status === 'revoked' || !connection.accessTokenEnc) return null;
  let accessToken = decryptSocialToken(connection.accessTokenEnc);
  const params = paramsFromSocialMetadata(connection.metadata);

  const expiresAt = connection.tokenExpiresAt?.getTime();
  const nearExpiry = expiresAt != null && expiresAt - Date.now() <= REFRESH_SKEW_MS;
  if (nearExpiry && adapter.refresh && connection.refreshTokenEnc) {
    const tokens = await adapter.refresh(decryptSocialToken(connection.refreshTokenEnc));
    accessToken = tokens.accessToken;
    await withTenant({ tenantId }, (tx) =>
      tx.socialConnection.update({
        where: { id: connection.id },
        data: {
          accessTokenEnc: encryptSocialToken(tokens.accessToken),
          refreshTokenEnc: tokens.refreshToken
            ? encryptSocialToken(tokens.refreshToken)
            : connection.refreshTokenEnc,
          tokenExpiresAt: tokens.expiresInSeconds
            ? new Date(Date.now() + tokens.expiresInSeconds * 1000)
            : null,
        },
      })
    );
  }

  return { externalId: connection.externalId ?? '', accessToken, params };
}
