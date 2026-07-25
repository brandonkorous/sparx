// The metrics-collection drain (docs/implementation/social.md "Measure") — the read-back
// sibling of publish.ts. Given a post that has gone out, pull each PUBLISHED target's
// numbers from its platform and snapshot them into social_post_metrics, so the Insights
// surface can show "how did it do?".
//
// Best-effort, per target: a platform whose adapter has no getMetrics, a target we can't
// re-authorize, or a transient API error is SKIPPED (the next collect tries again) —
// never failing the batch. Each collect writes a fresh snapshot row (a time series), so
// running it again an hour/day later captures the numbers as they matured.

import { withTenant } from '@sparx/db';
import { getSocialAdapter, type SocialPlatform, type SocialTargetRef } from '@sparx/social';
import { registerBuiltinSocialAdapters } from '@sparx/social/adapters';
import { isSocialTokenCryptoConfigured } from '@sparx/social/crypto';
import type { SocialPostMetrics } from '@sparx/social';
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
      // Platform can't report metrics yet — nothing to do for this target.
      skipped += 1;
      continue;
    }

    // socialTargetId is FK-less (history survives disconnect) → explicit lookup.
    const target = await withTenant({ tenantId }, (tx) =>
      tx.socialTarget.findFirst({
        where: { id: t.socialTargetId },
        include: { connection: { select: CONNECTION_SELECT } },
      })
    );
    if (!target) {
      skipped += 1;
      continue;
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
      skipped += 1;
      continue;
    }

    const ref: SocialTargetRef = {
      externalTargetId: target.externalTargetId,
      name: target.name,
      params: paramsFromTargetMeta(target.metadata),
    };

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
