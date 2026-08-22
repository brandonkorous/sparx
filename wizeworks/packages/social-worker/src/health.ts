// Connection health (docs/social-audit GAP 1) — the drain that keeps a tenant's
// connected accounts working, and tells them the moment one stops.
//
// The failure this exists to prevent: a grant quietly dies (its token lapses, or the
// owner removes sparx from their Facebook settings), every later post fails, and the
// Connections screen still says "Connected" because nothing ever wrote otherwise. The
// tenant finds out days later, from a post that never went out.
//
// So this checks a grant on a schedule rather than at publish time, and it checks two
// different things, because they fail differently:
//
//   1. EXPIRY is predictable. A token carries an expiry; we refresh ahead of it, well
//      inside the window, so a grant renews itself indefinitely without anyone noticing.
//   2. REVOCATION is not. When someone removes the app, the expiry does not move — the
//      token simply stops working. The only way to know is to USE it, so we make one
//      cheap authenticated call (`listTargets`, which every adapter implements) and read
//      the answer.
//
// Either failure flips the connection to `expired` with the reason on the row, which is
// what lights up the "This account needs reconnecting" alert the Connections surface has
// always been able to render, and publishes `social.connection.expired` so the tenant is
// emailed. A TRANSIENT failure (the platform is down, the network blipped) must never do
// that — it leaves the connection alone and simply gets checked again next sweep.

import { Prisma, withTenant } from '@wizeworks/db';
import { getSocialAdapter, isRetryableError, type SocialPlatform } from '@wizeworks/social';
import { registerBuiltinSocialAdapters } from '@wizeworks/social/adapters';
import {
  decryptSocialToken,
  encryptSocialToken,
  isSocialTokenCryptoConfigured,
} from '@wizeworks/social/crypto';
import { createPublisher, publishEvent } from '@wizeworks/events';
import type { Logger } from 'pino';

import { paramsFromMetadata } from './auth.js';
import { notifyConnectionExpired } from './notify.js';

/** How far ahead of a token's expiry we renew it. Deliberately generous: a grant that
 *  renews a week early survives a worker outage, a platform incident, and a long
 *  weekend without anyone touching it. The old behaviour — refresh 60 SECONDS before
 *  expiry, at publish time — had no margin at all. */
const REFRESH_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;

export interface HealthOutcome {
  connectionId: string;
  /** ok = usable · refreshed = renewed · expired = needs reconnecting · deferred =
   *  couldn't tell this time, will re-check · skipped = nothing to check. */
  result: 'ok' | 'refreshed' | 'expired' | 'deferred' | 'skipped';
}

const CONNECTION_SELECT = {
  id: true,
  platform: true,
  status: true,
  displayName: true,
  externalId: true,
  accessTokenEnc: true,
  refreshTokenEnc: true,
  tokenExpiresAt: true,
  metadata: true,
} as const;

/** The shape written to `social_connections.last_error` — a single readable record of
 *  what went wrong and when, for the manage UI. */
function errorRecord(code: string, message: string): Prisma.InputJsonValue {
  return { at: new Date().toISOString(), code, message: message.slice(0, 480) };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Flip a connection to `expired` and record why, then announce it. Idempotent: a
 * connection already `expired` is left alone (so a re-check doesn't re-notify and spam
 * the owner about the same dead account every sweep).
 *
 * Exported because the publish drain calls it too — if a post fails with a `401`, the
 * grant is dead and the tenant should hear about it from the account, not only from the
 * post.
 */
export async function markConnectionExpired(
  tenantId: string,
  connectionId: string,
  code: string,
  message: string,
  logger: Logger
): Promise<boolean> {
  const flipped = await withTenant({ tenantId }, async (tx) => {
    const result = await tx.socialConnection.updateMany({
      // The status guard IS the idempotency: only an active grant transitions.
      where: { id: connectionId, status: 'active' },
      data: {
        status: 'expired',
        lastError: errorRecord(code, message),
        healthCheckedAt: new Date(),
      },
    });
    return result.count > 0;
  });

  if (!flipped) return false;

  logger.warn({ connectionId, code, message }, 'social connection expired — reconnect needed');
  const publisher = createPublisher({ logger });
  await publishEvent(
    publisher,
    'social.connection.expired',
    tenantId,
    null,
    { connectionId, code, message },
    logger
  );
  // Tell the person. The status flip is what the UI reads; this is what reaches them
  // when they aren't looking at the UI — which is most of the time.
  await notifyConnectionExpired(tenantId, connectionId, logger);
  return true;
}

/**
 * Check one connection: renew it if it is nearing expiry, then prove it still works.
 *
 * The order matters. Refresh FIRST (so the liveness probe runs against the token we
 * would actually publish with), then probe. A probe against a stale token would report
 * a dead account that is merely a refresh away from working.
 */
export async function checkConnection(
  tenantId: string,
  connectionId: string,
  logger: Logger
): Promise<HealthOutcome> {
  registerBuiltinSocialAdapters();

  if (!isSocialTokenCryptoConfigured()) {
    logger.warn({ connectionId }, 'SOCIAL_TOKEN_KEY unset — acking connection check');
    return { connectionId, result: 'skipped' };
  }

  const connection = await withTenant({ tenantId }, (tx) =>
    tx.socialConnection.findFirst({ where: { id: connectionId }, select: CONNECTION_SELECT })
  );
  if (!connection) {
    logger.warn({ connectionId }, 'health check for a connection that no longer exists; acking');
    return { connectionId, result: 'skipped' };
  }
  // Only an active grant is worth checking. A revoked one was deliberately disconnected;
  // an expired one is already telling the tenant what to do.
  if (connection.status !== 'active' || !connection.accessTokenEnc) {
    return { connectionId, result: 'skipped' };
  }

  const adapter = getSocialAdapter(connection.platform as SocialPlatform);
  if (!adapter) {
    logger.warn(
      { connectionId, platform: connection.platform },
      'no adapter for platform; skipping health check'
    );
    return { connectionId, result: 'skipped' };
  }

  // OUR app credentials are missing on THIS process — the tenant's grant is fine.
  //
  // Checked here, before any platform call, because every path below would otherwise
  // reach requireCreds() and throw. That throw is correctly non-retryable (nothing
  // clears an unset env var), and non-retryable in the refresh/probe handlers below
  // means `markConnectionExpired` — which would tell the tenant to reconnect an account
  // that never broke, for a fault that reconnecting cannot fix. A false "your TikTok
  // stopped working" is worse than no check at all.
  //
  // So: leave the connection ACTIVE, stamp the cursor so the sweep stops re-dispatching
  // this every 15 minutes, and log at error — this is an ops problem, and the log is the
  // only place it can surface. (2026-07-28: the worker ran without TIKTOK_CLIENT_KEY and
  // this loop was re-armed ~81×/hour.)
  if (adapter.isConfigured() !== true) {
    await touchChecked(tenantId, connectionId);
    logger.error(
      { connectionId, platform: connection.platform },
      'platform OAuth app credentials missing on the worker — cannot health-check; connection left active'
    );
    return { connectionId, result: 'skipped' };
  }

  let accessToken = decryptSocialToken(connection.accessTokenEnc);
  let refreshed = false;

  // ── 1. Renew ahead of expiry ────────────────────────────────────────────────
  const expiresAt = connection.tokenExpiresAt?.getTime();
  const nearExpiry = expiresAt != null && expiresAt - Date.now() <= REFRESH_AHEAD_MS;

  if (nearExpiry) {
    if (adapter.refresh && connection.refreshTokenEnc) {
      try {
        const tokens = await adapter.refresh(decryptSocialToken(connection.refreshTokenEnc));
        accessToken = tokens.accessToken;
        refreshed = true;
        await withTenant({ tenantId }, (tx) =>
          tx.socialConnection.update({
            where: { id: connectionId },
            data: {
              accessTokenEnc: encryptSocialToken(tokens.accessToken),
              refreshTokenEnc: tokens.refreshToken
                ? encryptSocialToken(tokens.refreshToken)
                : connection.refreshTokenEnc,
              tokenExpiresAt: tokens.expiresInSeconds
                ? new Date(Date.now() + tokens.expiresInSeconds * 1000)
                : null,
              lastError: Prisma.DbNull,
            },
          })
        );
      } catch (e) {
        // A permanent refusal (invalid_grant, revoked) means the grant is gone for good.
        // A transient one means try again next sweep — we have a week of margin.
        if (!isRetryableError(e)) {
          await markConnectionExpired(
            tenantId,
            connectionId,
            'refresh_failed',
            `The connection could not be renewed: ${errMsg(e)}`,
            logger
          );
          return { connectionId, result: 'expired' };
        }
        await touchChecked(tenantId, connectionId);
        logger.warn(
          { connectionId, err: e },
          'social connection refresh deferred — will re-check next sweep'
        );
        return { connectionId, result: 'deferred' };
      }
    } else if (expiresAt != null && expiresAt <= Date.now()) {
      // Already lapsed with no way to renew — the tenant has to sign in again.
      await markConnectionExpired(
        tenantId,
        connectionId,
        'token_expired',
        'The permission this account gave has run out.',
        logger
      );
      return { connectionId, result: 'expired' };
    }
  }

  // ── 2. Prove it still works ─────────────────────────────────────────────────
  // One cheap authenticated call. This is the ONLY way to catch a revoked grant, whose
  // recorded expiry says nothing is wrong.
  try {
    await adapter.listTargets({
      externalId: connection.externalId ?? '',
      accessToken,
      params: paramsFromMetadata(connection.metadata),
    });
  } catch (e) {
    if (!isRetryableError(e)) {
      await markConnectionExpired(
        tenantId,
        connectionId,
        'token_rejected',
        `${adapter.name} no longer accepts this sign-in: ${errMsg(e)}`,
        logger
      );
      return { connectionId, result: 'expired' };
    }
    await touchChecked(tenantId, connectionId);
    logger.warn(
      { connectionId, err: e },
      'social connection probe deferred — platform unreachable, will re-check'
    );
    return { connectionId, result: 'deferred' };
  }

  // Healthy. Clear any stale error so a connection that recovered stops nagging.
  await withTenant({ tenantId }, (tx) =>
    tx.socialConnection.update({
      where: { id: connectionId },
      data: { healthCheckedAt: new Date(), lastError: Prisma.DbNull },
    })
  );
  return { connectionId, result: refreshed ? 'refreshed' : 'ok' };
}

/** Stamp the check cursor without touching status — so a connection we could not reach
 *  moves to the back of the sweep queue instead of being retried in a tight loop. */
async function touchChecked(tenantId: string, connectionId: string): Promise<void> {
  await withTenant({ tenantId }, (tx) =>
    tx.socialConnection.update({
      where: { id: connectionId },
      data: { healthCheckedAt: new Date() },
    })
  );
}
