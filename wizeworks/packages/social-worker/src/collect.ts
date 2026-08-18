// The metrics-collection drain (docs/implementation/social.md "Measure") — the read-back
// sibling of publish.ts. Given a post that has gone out, pull each PUBLISHED target's
// numbers from its platform and snapshot them into social_post_metrics, so the Insights
// surface can show "how did it do?".
//
// Best-effort, per target: a platform whose adapter has no getMetrics, a target we can't
// re-authorize, or a transient API error is SKIPPED (the next collect tries again) —
// never failing the batch. Each collect writes a fresh snapshot row (a time series), so
// running it again an hour/day later captures the numbers as they matured.

import { withTenant } from '@wizeworks/db';
import { getSocialAdapter, type SocialPlatform, type SocialTargetRef } from '@wizeworks/social';
import { registerBuiltinSocialAdapters } from '@wizeworks/social/adapters';
import { isSocialTokenCryptoConfigured } from '@wizeworks/social/crypto';
import type { SocialPostMetrics } from '@wizeworks/social';
import type { Logger } from 'pino';

import { resolveSocialAuth } from './auth.js';
import { CONNECTION_SELECT, paramsFromTargetMeta } from './publish.js';

export interface CollectOutcome {
  postId: string;
  collected: number;
  skipped: number;
}

function errMsg(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 480);
}

/** Map an adapter's metrics into a snapshot row's nullable columns — `undefined` (a
 *  platform didn't report it) becomes NULL, never a misleading 0. Pure, so the mapping
 *  is unit-tested without a database. */
export function toMetricRow(metrics: SocialPostMetrics): {
  likes: number | null;
  comments: number | null;
  shares: number | null;
  impressions: number | null;
  reach: number | null;
} {
  return {
    likes: metrics.likes ?? null,
    comments: metrics.comments ?? null,
    shares: metrics.shares ?? null,
    impressions: metrics.impressions ?? null,
    reach: metrics.reach ?? null,
  };
}

/**
 * Which live destination should stand in for one whose row is gone?
 *
 * Reconnecting an account mints a NEW target row with a new id, so a post published
 * before the reconnect points at an id that no longer resolves. The post's `externalId`
 * is the platform's own post id and stays valid — all that is missing is a token for the
 * account that owns it.
 *
 * Name first, because that is the account's identity and `targetName` is captured onto
 * the post target at publish time for exactly this reason. Sole-account second, where
 * there is no ambiguity to get wrong. Otherwise NOTHING: attributing one Page's numbers
 * to another Page is worse than a gap, because a gap is visibly a gap.
 *
 * Pure, so the choice is unit-tested without a database — same reason `toMetricRow` is.
 */
export function pickReconnectedTarget<T extends { name: string }>(
  live: readonly T[],
  targetName: string
): T | null {
  return live.find((c) => c.name === targetName) ?? (live.length === 1 ? (live[0] ?? null) : null);
}

export async function collectPostMetrics(
  tenantId: string,
  postId: string,
  logger: Logger
): Promise<CollectOutcome> {
  registerBuiltinSocialAdapters();

  if (!isSocialTokenCryptoConfigured()) {
    logger.warn(
      { postId },
      'SOCIAL_TOKEN_KEY unset — acking social.metrics.collect without pulling'
    );
    return { postId, collected: 0, skipped: 0 };
  }

  // Only targets that actually went out and carry the platform's own post id.
  const targets = await withTenant({ tenantId }, (tx) =>
    tx.socialPostTarget.findMany({
      where: { postId, status: 'published', externalId: { not: null } },
    })
  );
  if (targets.length === 0) {
    return { postId, collected: 0, skipped: 0 };
  }

  let collected = 0;
  let skipped = 0;

  for (const t of targets) {
    const platform = t.platform as SocialPlatform;
    const adapter = getSocialAdapter(platform);
    if (!adapter?.getMetrics || !t.externalId) {
      // Says WHICH of the two it was: "this platform cannot report numbers" is a
      // permanent property of the adapter, while a missing externalId means the publish
      // never recorded the platform's post id and this destination can never be read
      // back. They want opposite responses, so they must not look alike in the log.
      logger.info(
        { postId, targetId: t.id, platform: t.platform },
        !adapter?.getMetrics
          ? 'metrics skipped: this platform has no metrics support yet'
          : 'metrics skipped: destination has no external post id recorded'
      );
      skipped += 1;
      continue;
    }

    // socialTargetId is FK-less (history survives disconnect) → explicit lookup.
    //
    // RECONNECTING AN ACCOUNT MINTS A NEW TARGET ROW WITH A NEW ID, so this lookup
    // misses for every post published before the reconnect — and reconnecting is
    // routine, not exceptional: re-authorizing after a token expiry, switching Pages,
    // or fixing a scope all do it. The id being FK-less is what lets the post's history
    // survive; it is not a promise that the id still resolves.
    //
    // Left as an id-only lookup it read as "nothing to collect" and skipped in silence,
    // which is how a tenant's numbers stop moving with nothing broken and nothing
    // logged. Measured on this database: 19 published destinations, 5 still resolving.
    //
    // So fall back to the live destination that IS the same account. The post's
    // `externalId` is the platform's own post id and stays valid across a reconnect —
    // all that is missing is a token for the account that owns it, which any current
    // target on the same platform + name carries. Name is what `targetName` is FOR: it
    // is captured on the post target at publish time precisely because the target row
    // may not outlive the post.
    let target = await withTenant({ tenantId }, (tx) =>
      tx.socialTarget.findFirst({
        where: { id: t.socialTargetId },
        include: { connection: { select: CONNECTION_SELECT } },
      })
    );
    let viaReconnect = false;
    if (!target) {
      const live = await withTenant({ tenantId }, (tx) =>
        tx.socialTarget.findMany({
          where: { platform: t.platform },
          include: { connection: { select: CONNECTION_SELECT } },
        })
      );
      target = pickReconnectedTarget(live, t.targetName);
      viaReconnect = target !== null;
      if (!target) {
        logger.info(
          { postId, targetId: t.id, platform: t.platform, targetName: t.targetName },
          live.length === 0
            ? 'metrics skipped: no connected account for this platform — reconnect it to resume numbers'
            : 'metrics skipped: original destination is gone and more than one account matches by name'
        );
        skipped += 1;
        continue;
      }
    }

    let auth;
    try {
      auth = await resolveSocialAuth(tenantId, target.connection, adapter);
    } catch (e) {
      logger.warn({ postId, targetId: t.id, err: errMsg(e) }, 'metrics auth refresh failed');
      skipped += 1;
      continue;
    }
    if (!auth) {
      // The grant is gone or unreadable (revoked, expired past refresh, or a token this
      // SOCIAL_TOKEN_KEY can no longer decrypt). Reconnecting is the only fix, so say so
      // — silence here reads exactly like "this post has no numbers".
      logger.info(
        { postId, targetId: t.id, platform: t.platform, targetName: t.targetName },
        'metrics skipped: account needs reconnecting — no usable access token'
      );
      skipped += 1;
      continue;
    }

    const ref: SocialTargetRef = {
      externalTargetId: target.externalTargetId,
      name: target.name,
      params: paramsFromTargetMeta(target.metadata),
    };
    if (viaReconnect) {
      logger.info(
        { postId, targetId: t.id, platform: t.platform, targetName: t.targetName },
        'metrics: original destination gone; reading through the reconnected account'
      );
    }

    try {
      const metrics = await adapter.getMetrics(auth, ref, t.externalId);
      await withTenant({ tenantId }, (tx) =>
        tx.socialPostMetric.create({
          data: {
            tenantId,
            postId,
            postTargetId: t.id,
            platform: t.platform,
            ...toMetricRow(metrics),
          },
        })
      );
      collected += 1;
    } catch (e) {
      // Transient (rate limit, hiccup) — leave it; the next collect re-tries.
      logger.warn({ postId, targetId: t.id, err: errMsg(e) }, 'metrics pull failed');
      skipped += 1;
    }
  }

  logger.info({ postId, collected, skipped }, 'social.metrics.collect processed');
  return { postId, collected, skipped };
}
