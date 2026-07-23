// The publish drain (docs/133 §7) — the heart of the worker. Given a due post, walk
// its armed targets and publish each to its platform:
//   resolve + refresh the OAuth grant → render for the platform → adapter.publish
//   with a `postId:targetId` idempotency key → record the per-target result.
//
// Each target succeeds or fails INDEPENDENTLY (hence the post's partially_published
// state). A transient failure leaves the target `pending` with the error recorded and
// its attempt count bumped, up to MAX_ATTEMPTS, then it flips to `failed`; a re-drain
// (publish-again, or the Slice 5 scheduled sweep) only re-attempts still-pending
// targets, so a redelivered message never re-posts a succeeded target.

import { withTenant } from '@sparx/db';
import type { Prisma } from '@sparx/db';
import {
  getSocialAdapter,
  renderForTarget,
  type SocialPlatform,
  type SocialTargetRef,
  type TargetOverride,
} from '@sparx/social';
import { registerBuiltinSocialAdapters } from '@sparx/social/adapters';
import { isSocialTokenCryptoConfigured } from '@sparx/social/crypto';
import { createPublisher, publishEvent } from '@sparx/events';
import type { Logger } from 'pino';

import { env } from './env.js';
import { resolveSocialAuth } from './auth.js';
import { mediaRefsForPlatform, resolvePostAssets } from './media.js';

const MAX_ATTEMPTS = 5;

const CONNECTION_SELECT = {
  id: true,
  externalId: true,
  status: true,
  accessTokenEnc: true,
  refreshTokenEnc: true,
  tokenExpiresAt: true,
  metadata: true,
} as const;

export interface DrainOutcome {
  postId: string;
  status: string;
  published: number;
  failed: number;
  deferred: number;
  skipped: number;
}

function errMsg(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 480);
}

/** Read a target's platform params back off its metadata. */
function paramsFromTargetMeta(metadata: Prisma.JsonValue): Record<string, string> | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const raw = (metadata as Record<string, unknown>).params;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export async function drainPost(
  tenantId: string,
  postId: string,
  logger: Logger
): Promise<DrainOutcome> {
  registerBuiltinSocialAdapters();

  if (!isSocialTokenCryptoConfigured()) {
    logger.warn({ postId }, 'SOCIAL_TOKEN_KEY unset — acking social.post.due without publishing');
    return { postId, status: 'skipped', published: 0, failed: 0, deferred: 0, skipped: 0 };
  }

  const post = await withTenant({ tenantId }, (tx) =>
    tx.socialPost.findFirst({
      where: { id: postId },
      include: { targets: { where: { status: { in: ['pending', 'publishing'] } } } },
    })
  );
  if (!post) {
    logger.warn({ postId }, 'social.post.due for a post that no longer exists; acking');
    return { postId, status: 'missing', published: 0, failed: 0, deferred: 0, skipped: 0 };
  }

  // Resolve the post's media once (base + crop variants); each target then gets the
  // crop nearest its platform's aspect (docs/133 §8).
  const assets = await resolvePostAssets(tenantId, post.mediaAssetIds);
  if (post.mediaAssetIds.length > 0 && assets.length < post.mediaAssetIds.length) {
    logger.warn(
      { postId, requested: post.mediaAssetIds.length, resolved: assets.length },
      'some media could not be resolved (unprocessed asset or no media base configured)'
    );
  }

  let published = 0;
  let failed = 0;
  let deferred = 0;
  let skipped = 0;

  /** Record a per-target failure; a `pending` verdict flips to `failed` at the cap. */
  async function recordFailure(
    targetId: string,
    attemptCount: number,
    verdict: 'failed' | 'pending',
    error: string
  ): Promise<void> {
    const next = attemptCount + 1;
    const finalStatus = verdict === 'pending' && next >= MAX_ATTEMPTS ? 'failed' : verdict;
    await withTenant({ tenantId }, (tx) =>
      tx.socialPostTarget.update({
        where: { id: targetId },
        data: { status: finalStatus, error, attemptCount: next },
      })
    );
    if (finalStatus === 'failed') failed += 1;
    else deferred += 1;
  }

  for (const t of post.targets) {
    // socialTargetId is FK-less (history survives disconnect) → explicit lookup.
    const target = await withTenant({ tenantId }, (tx) =>
      tx.socialTarget.findFirst({
        where: { id: t.socialTargetId },
        include: { connection: { select: CONNECTION_SELECT } },
      })
    );

    if (!target?.enabled) {
      await withTenant({ tenantId }, (tx) =>
        tx.socialPostTarget.update({
          where: { id: t.id },
          data: { status: 'skipped', error: 'Target is turned off or no longer connected.' },
        })
      );
      skipped += 1;
      continue;
    }

    const platform = t.platform as SocialPlatform;
    const adapter = getSocialAdapter(platform);
    if (!adapter) {
      await recordFailure(t.id, t.attemptCount, 'failed', `No adapter for ${t.platform}.`);
      continue;
    }

    let auth;
    try {
      auth = await resolveSocialAuth(tenantId, target.connection, adapter);
    } catch (e) {
      await recordFailure(t.id, t.attemptCount, 'pending', `Sign-in refresh failed: ${errMsg(e)}`);
      continue;
    }
    if (!auth) {
      await recordFailure(
        t.id,
        t.attemptCount,
        'failed',
        'Account disconnected — reconnect to publish.'
      );
      continue;
    }

    const override: TargetOverride = {};
    if (t.textOverride) override.text = t.textOverride;
    if (t.firstComment) override.firstComment = t.firstComment;
    const rendered = renderForTarget(
      {
        body: post.body,
        media: mediaRefsForPlatform(assets, platform),
        link: post.link ?? undefined,
      },
      platform,
      Object.keys(override).length ? override : undefined
    );
    if (!rendered.publishable) {
      const issue = rendered.issues.find((i) => i.severity === 'error');
      await recordFailure(
        t.id,
        t.attemptCount,
        'failed',
        issue?.message ?? 'Not valid for this platform.'
      );
      continue;
    }

    const ref: SocialTargetRef = {
      externalTargetId: target.externalTargetId,
      name: target.name,
      params: paramsFromTargetMeta(target.metadata),
    };
    try {
      const result = await adapter.publish(auth, ref, rendered.rendered, `${postId}:${t.id}`);
      await withTenant({ tenantId }, (tx) =>
        tx.socialPostTarget.update({
          where: { id: t.id },
          data: {
            status: 'published',
            externalId: result.externalId,
            permalink: result.permalink ?? null,
            error: null,
            publishedAt: new Date(),
            attemptCount: t.attemptCount + 1,
          },
        })
      );
      published += 1;
    } catch (e) {
      // Transient — leave pending for a re-drain (capped by MAX_ATTEMPTS).
      await recordFailure(t.id, t.attemptCount, 'pending', errMsg(e));
    }
  }

  const status = await recomputePostStatus(tenantId, postId);

  const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger });
  if (status === 'failed') {
    await publishEvent(publisher, 'social.post.failed', tenantId, null, { postId }, logger);
  } else if (status === 'published' || status === 'partially_published') {
    await publishEvent(
      publisher,
      'social.post.published',
      tenantId,
      null,
      { postId, status },
      logger
    );
  }

  return { postId, status, published, failed, deferred, skipped };
}

/** Derive the post status from its targets' statuses. Pure — the state machine that
 *  the drain and its tests both use:
 *   - anything still pending/publishing → `publishing` (a re-drain will finish it)
 *   - nothing published                → `failed`
 *   - some published + some failed      → `partially_published`
 *   - otherwise                         → `published` (skipped opt-outs don't demote) */
export function derivePostStatus(statuses: string[]): string {
  const anyPending = statuses.some((s) => s === 'pending' || s === 'publishing');
  if (anyPending) return 'publishing';
  const publishedCount = statuses.filter((s) => s === 'published').length;
  const failedCount = statuses.filter((s) => s === 'failed').length;
  if (publishedCount === 0) return 'failed';
  if (failedCount > 0) return 'partially_published';
  return 'published';
}

/** Recompute + persist the post status from ALL its targets (not just this drain's
 *  subset), stamping publishedAt once it reaches a terminal, at-least-one-published
 *  state. */
async function recomputePostStatus(tenantId: string, postId: string): Promise<string> {
  return withTenant({ tenantId }, async (tx) => {
    const targets = await tx.socialPostTarget.findMany({
      where: { postId },
      select: { status: true },
    });
    const status = derivePostStatus(targets.map((t) => t.status));
    const terminalWin = status === 'published' || status === 'partially_published';

    const data: Prisma.SocialPostUpdateInput = { status };
    if (terminalWin) data.publishedAt = new Date();
    await tx.socialPost.update({ where: { id: postId }, data });
    return status;
  });
}
