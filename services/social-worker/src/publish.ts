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
  HttpError,
  isRetryableError,
  renderForTarget,
  socialRateLimiter,
  type SocialPlatform,
  type SocialTargetRef,
  type TargetOverride,
} from '@sparx/social';
import { registerBuiltinSocialAdapters } from '@sparx/social/adapters';
import { isSocialTokenCryptoConfigured } from '@sparx/social/crypto';
import { getSocialSettings } from '@sparx/social/service';
import { createPublisher, publishEvent } from '@sparx/events';
import type { Logger } from 'pino';

import { resolveSocialAuth } from './auth.js';
import { markConnectionExpired } from './health.js';
import { notifyPostFailure } from './notify.js';
import { mediaRefsForPlatform, resolvePostAssets } from './media.js';
import { tagSocialLink } from './utm.js';

const MAX_ATTEMPTS = 5;

/** The longest we'll hold a message open waiting for a rate-limit window. Beyond this,
 *  the target stays `pending` and the next drain picks it up — a Pub/Sub push has an ack
 *  deadline, and sleeping through a two-minute platform back-off would blow it. */
const MAX_INLINE_WAIT_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Whether a platform error means "this sign-in is no longer valid" rather than "this
 *  post is wrong". A 401/403 is the account's problem, not the post's, so it flips the
 *  CONNECTION to `expired` — otherwise every future post fails one at a time while the
 *  Connections screen keeps saying everything is fine (docs/social-audit GAP 1). */
export function isAuthRejection(e: unknown): boolean {
  return e instanceof HttpError && (e.status === 401 || e.status === 403);
}

export const CONNECTION_SELECT = {
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
export function paramsFromTargetMeta(
  metadata: Prisma.JsonValue
): Record<string, string> | undefined {
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
      include: {
        targets: {
          where: {
            status: { in: ['pending', 'publishing'] },
            // A destination with its OWN send time waits for it (docs/133 §8): the post
            // may be `publishing` because its 9am Facebook slot came due while the 5pm
            // LinkedIn one is still hours away. `null` means "go with the post", which
            // is the common case, so it must pass this filter.
            OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
          },
        },
      },
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

  // One timestamp for the whole drain, so every target of this post shares the same
  // attribution campaign month (utm_campaign=social-<yyyy-mm>).
  const publishTime = new Date();

  // Link tagging is on by default — an untagged link makes social look like it drives
  // nothing — but a tenant can turn it off, because the tag is visible in the URL a
  // customer sees.
  const { trackLinks } = await getSocialSettings(tenantId);

  let published = 0;
  let failed = 0;
  let deferred = 0;
  let skipped = 0;

  /** Record a per-target failure; a `pending` verdict flips to `failed` at the cap.
   *  ALWAYS logs the platform error — the failure is otherwise written only to the
   *  target row, which left prod publish failures invisible in the logs (the reason
   *  "Facebook photo post: 400 …" took a browser React-tree dig to surface). */
  async function recordFailure(
    targetId: string,
    platform: string,
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
    if (finalStatus === 'failed') {
      failed += 1;
      logger.error(
        { postId, targetId, platform, attempt: next, error },
        'social publish target failed permanently'
      );
    } else {
      deferred += 1;
      logger.warn(
        { postId, targetId, platform, attempt: next, error },
        'social publish target deferred — will retry'
      );
    }
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
      await recordFailure(
        t.id,
        t.platform,
        t.attemptCount,
        'failed',
        `No adapter for ${t.platform}.`
      );
      continue;
    }

    // OUR app credentials are missing on THIS process. Fail the destination — the post
    // genuinely did not go out and the queue must say so — but do NOT touch the
    // connection: the tenant's grant is fine, and the expiry branch below would tell them
    // to reconnect an account that never broke. The message is written for the person
    // reading the queue, not for the log; `isConfigured()` is checked here rather than
    // letting requireCreds() throw precisely so that distinction survives.
    if (adapter.isConfigured() !== true) {
      logger.error(
        { targetId: t.id, platform: t.platform },
        'platform OAuth app credentials missing on the worker — cannot publish'
      );
      await recordFailure(
        t.id,
        t.platform,
        t.attemptCount,
        'failed',
        `Posting to ${adapter.name} isn't switched on yet. Nothing is wrong with your account — we're finishing the setup on our side.`
      );
      continue;
    }

    let auth;
    try {
      auth = await resolveSocialAuth(tenantId, target.connection, adapter);
    } catch (e) {
      // A permanent refresh failure (revoked grant → 400 invalid_grant) fails fast;
      // a transient one (5xx / network) stays pending for a re-drain. Permanent also
      // means the ACCOUNT is dead, not just this post — say so on the connection.
      if (!isRetryableError(e)) {
        await markConnectionExpired(
          tenantId,
          target.connection.id,
          'refresh_failed',
          `The connection could not be renewed: ${errMsg(e)}`,
          logger
        );
      }
      await recordFailure(
        t.id,
        t.platform,
        t.attemptCount,
        isRetryableError(e) ? 'pending' : 'failed',
        `Sign-in refresh failed: ${errMsg(e)}`
      );
      continue;
    }
    if (!auth) {
      await recordFailure(
        t.id,
        t.platform,
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
        // Tag the outbound link for attribution, per platform (docs/80). A link the
        // author already tagged, or a non-http one, passes through untouched — as does
        // every link when the tenant has turned tagging off.
        link: trackLinks
          ? tagSocialLink(post.link ?? undefined, platform, publishTime)
          : (post.link ?? undefined),
      },
      platform,
      Object.keys(override).length ? override : undefined
    );
    if (!rendered.publishable) {
      const issue = rendered.issues.find((i) => i.severity === 'error');
      await recordFailure(
        t.id,
        t.platform,
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

    // Pace the fan-out per GRANT. Several destinations under one connection share that
    // account's quota, so they take turns rather than racing each other into a 429. A
    // short wait is simply waited out; a long one (a platform-imposed back-off) leaves
    // the target pending for the next drain instead of holding this message open.
    const waitMs = socialRateLimiter.take(target.connection.id);
    if (waitMs > 0) {
      if (waitMs > MAX_INLINE_WAIT_MS) {
        await recordFailure(
          t.id,
          t.platform,
          t.attemptCount,
          'pending',
          `${t.platform} asked us to slow down — this will go out shortly.`
        );
        continue;
      }
      await sleep(waitMs);
      socialRateLimiter.take(target.connection.id);
    }

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
      // A 401/403 is the ACCOUNT failing, not the post. Flip the connection so the
      // tenant is told to reconnect once, instead of watching post after post fail while
      // Connections still reads "Connected" (docs/social-audit GAP 1).
      if (isAuthRejection(e)) {
        await markConnectionExpired(
          tenantId,
          target.connection.id,
          'token_rejected',
          `${t.platform} rejected the sign-in while publishing: ${errMsg(e)}`,
          logger
        );
      }
      // The platform said "slow down". Honour the number it gave us, and apply it to the
      // whole GRANT — every destination under it shares the quota, so letting the next
      // one straight through would just earn another rejection, and eventually a longer
      // block.
      if (e instanceof HttpError && e.status === 429) {
        socialRateLimiter.backOff(target.connection.id, e.retryAfterSeconds ?? 60);
        logger.warn(
          { postId, targetId: t.id, retryAfter: e.retryAfterSeconds },
          'platform rate-limited this connection — backing off'
        );
      }
      // Retry a TRANSIENT failure (5xx / 429 / network) for a re-drain, capped by
      // MAX_ATTEMPTS; fail a PERMANENT one (4xx — a bad image/caption/token) immediately
      // so a doomed post doesn't churn every attempt before giving up.
      await recordFailure(
        t.id,
        t.platform,
        t.attemptCount,
        isRetryableError(e) ? 'pending' : 'failed',
        isAuthRejection(e)
          ? `${t.platform} needs reconnecting — the sign-in was rejected.`
          : errMsg(e)
      );
    }
  }

  const status = await recomputePostStatus(tenantId, postId);

  const publisher = createPublisher({ logger });
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

  // Tell the business when a post did not reach somewhere it was meant to. Both terminal
  // failure states qualify — `partially_published` especially, since it reads as a
  // success in every list until someone opens it (docs/social-audit GAP 2).
  if (status === 'failed' || status === 'partially_published') {
    await notifyPostFailure(tenantId, postId, logger);
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
