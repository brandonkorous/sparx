// Social post composition + lifecycle (docs/133 §5, §7). DB orchestration over
// social_posts / social_post_targets — the compose/list/edit/publish-now/delete
// surface. The actual publishing (token resolve, render, platform I/O) lives in the
// social-worker; here we only build the post + its fan-out rows and flip it to
// `publishing`, then emit `social.post.due` for the worker to drain.
//
// Lives in @wizeworks/social (not api-rest) so every transport — REST and MCP — drives
// the SAME service (one service, many transports); api-rest re-exports it.

import { withTenant } from '@wizeworks/db';
import { badRequest } from '@wizeworks/api-core/errors';

import type { SocialContext } from './context.js';

export interface SocialPostTargetView {
  id: string;
  socialTargetId: string;
  targetName: string;
  platform: string;
  status: string;
  externalId: string | null;
  permalink: string | null;
  error: string | null;
  publishedAt: string | null;
  /** The per-destination wording, so the composer can edit it after creation. */
  textOverride: string | null;
  firstComment: string | null;
  /** This destination's OWN send time; null = it goes with the post. */
  scheduledAt: string | null;
}

export interface SocialPostView {
  id: string;
  propertyId: string | null;
  body: string;
  link: string | null;
  mediaAssetIds: string[];
  status: string;
  source: string;
  sourceRef: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  /** Why a reviewer sent it back, when they did. */
  reviewNote: string | null;
  /** In the recycle pool the posting-slot filler draws from. */
  evergreen: boolean;
  targets: SocialPostTargetView[];
}

export interface PostRow {
  id: string;
  propertyId: string | null;
  body: string;
  link: string | null;
  mediaAssetIds: string[];
  status: string;
  source: string;
  sourceRef: string | null;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  reviewNote: string | null;
  evergreen: boolean;
  targets: {
    id: string;
    socialTargetId: string;
    targetName: string;
    platform: string;
    status: string;
    externalId: string | null;
    permalink: string | null;
    error: string | null;
    publishedAt: Date | null;
    textOverride: string | null;
    firstComment: string | null;
    scheduledAt: Date | null;
  }[];
}

export function toPostView(post: PostRow): SocialPostView {
  return {
    id: post.id,
    propertyId: post.propertyId,
    body: post.body,
    link: post.link,
    mediaAssetIds: post.mediaAssetIds,
    status: post.status,
    source: post.source,
    sourceRef: post.sourceRef,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    reviewNote: post.reviewNote,
    evergreen: post.evergreen,
    targets: post.targets.map((t) => ({
      id: t.id,
      socialTargetId: t.socialTargetId,
      targetName: t.targetName,
      platform: t.platform,
      status: t.status,
      externalId: t.externalId,
      permalink: t.permalink,
      error: t.error,
      publishedAt: t.publishedAt?.toISOString() ?? null,
      textOverride: t.textOverride,
      firstComment: t.firstComment,
      scheduledAt: t.scheduledAt?.toISOString() ?? null,
    })),
  };
}

// ── compose ─────────────────────────────────────────────────────────────────────

export interface CreateSocialPostTargetInput {
  /** A `social_targets.id` the tenant owns + has enabled. */
  targetId: string;
  textOverride?: string;
  firstComment?: string;
}

export interface CreateSocialPostInput {
  propertyId?: string | null;
  body: string;
  link?: string | null;
  mediaAssetIds?: string[];
  source?: string;
  sourceRef?: string | null;
  scheduledAt?: Date | null;
  targets: CreateSocialPostTargetInput[];
}

/** Create a draft post + one fan-out row per selected target. Target name + platform
 *  are denormalized onto each row so publish history survives a later disconnect. */
export async function createSocialPost(
  ctx: SocialContext,
  input: CreateSocialPostInput
): Promise<SocialPostView> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const ids = input.targets.map((t) => t.targetId);
    const rows = await tx.socialTarget.findMany({
      where: { id: { in: ids }, tenantId: ctx.tenantId },
      select: { id: true, name: true, platform: true, enabled: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const t of input.targets) {
      const row = byId.get(t.targetId);
      if (!row) throw badRequest(`Unknown social target: ${t.targetId}`);
      if (!row.enabled) throw badRequest(`Target "${row.name}" is turned off.`);
    }

    const post = await tx.socialPost.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: input.propertyId ?? null,
        body: input.body,
        link: input.link ?? null,
        mediaAssetIds: input.mediaAssetIds ?? [],
        source: input.source ?? 'manual',
        sourceRef: input.sourceRef ?? null,
        scheduledAt: input.scheduledAt ?? null,
        createdById: ctx.userId,
        status: 'draft',
        targets: {
          create: input.targets.map((t) => {
            const row = byId.get(t.targetId)!;
            return {
              tenantId: ctx.tenantId,
              socialTargetId: t.targetId,
              targetName: row.name,
              platform: row.platform,
              textOverride: t.textOverride ?? null,
              firstComment: t.firstComment ?? null,
              status: 'pending',
            };
          }),
        },
      },
      include: { targets: { orderBy: { targetName: 'asc' } } },
    });
    return toPostView(post);
  });
}

// ── read ──────────────────────────────────────────────────────────────────────────

/**
 * The queue. `propertyId` scopes to one business's posts (plus any that predate
 * multi-site and carry no site) — the same rule the connections read uses, so switching
 * site swaps the whole social identity rather than pooling two brands into one list.
 */
export async function listSocialPosts(
  ctx: SocialContext,
  filter: { status?: string; propertyId?: string | null } = {}
): Promise<SocialPostView[]> {
  const posts = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialPost.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.propertyId
          ? { OR: [{ propertyId: filter.propertyId }, { propertyId: null }] }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { targets: { orderBy: { targetName: 'asc' } } },
    })
  );
  return posts.map(toPostView);
}

export async function getSocialPost(
  ctx: SocialContext,
  id: string
): Promise<SocialPostView | null> {
  const post = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialPost.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { targets: { orderBy: { targetName: 'asc' } } },
    })
  );
  return post ? toPostView(post) : null;
}

// ── edit ──────────────────────────────────────────────────────────────────────────

export interface UpdateSocialPostInput {
  body?: string;
  link?: string | null;
  mediaAssetIds?: string[];
  scheduledAt?: Date | null;
}

/** Editable states: a post can be edited until it starts publishing. */
const EDITABLE_STATUSES = new Set(['draft', 'pending_approval', 'scheduled', 'failed']);

export async function updateSocialPost(
  ctx: SocialContext,
  id: string,
  patch: UpdateSocialPostInput
): Promise<SocialPostView | null> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const existing = await tx.socialPost.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { status: true },
    });
    if (!existing) return null;
    if (!EDITABLE_STATUSES.has(existing.status)) {
      throw badRequest(`A ${existing.status} post can't be edited.`);
    }
    const post = await tx.socialPost.update({
      where: { id },
      data: {
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        ...(patch.link !== undefined ? { link: patch.link } : {}),
        ...(patch.mediaAssetIds !== undefined ? { mediaAssetIds: patch.mediaAssetIds } : {}),
        ...(patch.scheduledAt !== undefined ? { scheduledAt: patch.scheduledAt } : {}),
      },
      include: { targets: { orderBy: { targetName: 'asc' } } },
    });
    return toPostView(post);
  });
}

// ── edit the destinations ─────────────────────────────────────────────────────────

/** One change to where a post goes. */
export interface UpdatePostTargetsInput {
  /** Destinations to add (a `social_targets.id` the tenant owns and has enabled). */
  add?: CreateSocialPostTargetInput[];
  /** `social_post_targets.id` rows to drop. Only ones that haven't published. */
  remove?: string[];
  /** Per-destination tweaks, by `social_post_targets.id`. `null` clears a field. */
  update?: {
    id: string;
    textOverride?: string | null;
    firstComment?: string | null;
    scheduledAt?: Date | null;
  }[];
}

/**
 * Change where a post goes, and how it reads there, after it was created.
 *
 * Until this existed, destinations and per-destination wording were frozen at creation:
 * the create call was the only one that accepted them. That made an almost-right post a
 * rebuild — worst of all in the approvals inbox, where an automation-drafted post aimed
 * at the wrong account could only be rejected, never corrected.
 *
 * The guard rails are about not lying to anyone:
 *   · a post past `scheduled` is closed to changes — the same EDITABLE_STATUSES gate the
 *     body already uses, so "what you see is what will send" holds;
 *   · a destination that has ALREADY published can't be removed, because taking the row
 *     away would erase the permalink of a post that is live on someone's page. Turning
 *     the account off for future posts is a different, honest action.
 */
export async function updateSocialPostTargets(
  ctx: SocialContext,
  postId: string,
  input: UpdatePostTargetsInput
): Promise<SocialPostView | null> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const post = await tx.socialPost.findFirst({
      where: { id: postId, tenantId: ctx.tenantId },
      select: { status: true },
    });
    if (!post) return null;
    if (!EDITABLE_STATUSES.has(post.status)) {
      throw badRequest(`Where a ${post.status} post goes can't be changed.`);
    }

    // ── remove ──
    if (input.remove?.length) {
      const rows = await tx.socialPostTarget.findMany({
        where: { id: { in: input.remove }, postId },
        select: { id: true, status: true, targetName: true },
      });
      for (const row of rows) {
        if (row.status === 'published') {
          throw badRequest(
            `"${row.targetName}" has already been posted to — it can't be removed from this post.`
          );
        }
      }
      await tx.socialPostTarget.deleteMany({
        where: { id: { in: rows.map((r) => r.id) }, postId },
      });
    }

    // ── add ──
    if (input.add?.length) {
      const ids = input.add.map((t) => t.targetId);
      const destinations = await tx.socialTarget.findMany({
        where: { id: { in: ids }, tenantId: ctx.tenantId },
        select: { id: true, name: true, platform: true, enabled: true },
      });
      const byId = new Map(destinations.map((d) => [d.id, d]));
      for (const t of input.add) {
        const row = byId.get(t.targetId);
        if (!row) throw badRequest(`Unknown social target: ${t.targetId}`);
        if (!row.enabled) throw badRequest(`Target "${row.name}" is turned off.`);
      }
      // `createMany` + skipDuplicates leans on the (post, target) unique, so adding a
      // destination the post already has is a no-op rather than an error — the composer
      // sends the whole selection, not a diff.
      await tx.socialPostTarget.createMany({
        data: input.add.map((t) => {
          const row = byId.get(t.targetId)!;
          return {
            tenantId: ctx.tenantId,
            postId,
            socialTargetId: t.targetId,
            targetName: row.name,
            platform: row.platform,
            textOverride: t.textOverride ?? null,
            firstComment: t.firstComment ?? null,
            status: 'pending',
          };
        }),
        skipDuplicates: true,
      });
    }

    // ── per-destination tweaks ──
    for (const patch of input.update ?? []) {
      await tx.socialPostTarget.updateMany({
        where: { id: patch.id, postId },
        data: {
          ...(patch.textOverride !== undefined ? { textOverride: patch.textOverride } : {}),
          ...(patch.firstComment !== undefined ? { firstComment: patch.firstComment } : {}),
          ...(patch.scheduledAt !== undefined ? { scheduledAt: patch.scheduledAt } : {}),
        },
      });
    }

    const updated = await tx.socialPost.findFirst({
      where: { id: postId },
      include: { targets: { orderBy: { targetName: 'asc' } } },
    });
    return updated ? toPostView(updated) : null;
  });
}

// ── retry one destination ─────────────────────────────────────────────────────────

/**
 * Re-arm ONE failed destination and hand the post back to the drain.
 *
 * The gap this closes: a post that reached three of four accounts is the most common real
 * failure, and it was a dead end — `partially_published` sat outside the editable
 * lifecycle, so the whole retry section was hidden and the only visible action was
 * delete. The server could always do this; nothing could ask it to.
 *
 * Only the named destination is re-armed. Its siblings — including ones that succeeded —
 * are untouched, and the worker's `postId:targetId` idempotency key means even a
 * redelivery can't re-post to an account that already has it.
 */
export async function retrySocialPostTarget(
  ctx: SocialContext,
  postId: string,
  postTargetId: string
): Promise<{ postId: string; postTargetId: string } | null> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const target = await tx.socialPostTarget.findFirst({
      where: { id: postTargetId, postId, tenantId: ctx.tenantId },
      select: { id: true, status: true, targetName: true },
    });
    if (!target) return null;
    if (target.status === 'published') {
      throw badRequest(`"${target.targetName}" already went out — there is nothing to retry.`);
    }
    if (target.status === 'publishing') {
      throw badRequest(`"${target.targetName}" is going out right now.`);
    }

    await tx.socialPostTarget.update({
      where: { id: postTargetId },
      // attemptCount resets: a manual retry is a deliberate new decision by a person, not
      // a continuation of the automatic budget that already gave up.
      data: { status: 'pending', error: null, attemptCount: 0, scheduledAt: null },
    });
    await tx.socialPost.update({ where: { id: postId }, data: { status: 'publishing' } });

    return { postId, postTargetId };
  });
}

// ── post again ────────────────────────────────────────────────────────────────────

/**
 * Copy a post into a fresh draft — same words, same pictures, same destinations.
 *
 * The cheapest real leverage in the module. A business that posts the same seasonal
 * offer every year, or wants last month's best post to run again, was retyping it and
 * re-picking the image; the composer had no "post again" at all. The copy is an ordinary
 * draft: nothing about it is special-cased, so it can be edited, rescheduled, or thrown
 * away like anything else.
 *
 * Destinations that no longer exist or have been turned off are dropped rather than
 * copied — a duplicate aimed at a disconnected Page would only fail later.
 */
export async function duplicateSocialPost(
  ctx: SocialContext,
  postId: string
): Promise<SocialPostView | null> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const source = await tx.socialPost.findFirst({
      where: { id: postId, tenantId: ctx.tenantId },
      include: { targets: { orderBy: { targetName: 'asc' } } },
    });
    if (!source) return null;

    const liveTargets = await tx.socialTarget.findMany({
      where: {
        id: { in: source.targets.map((t) => t.socialTargetId) },
        enabled: true,
      },
      select: { id: true, name: true, platform: true },
    });
    const live = new Map(liveTargets.map((t) => [t.id, t]));

    const copy = await tx.socialPost.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: source.propertyId,
        body: source.body,
        link: source.link,
        mediaAssetIds: source.mediaAssetIds,
        // A copy starts fresh: no schedule, no approval, not itself in the evergreen
        // pool (the ORIGINAL is the pool entry — see the slot filler).
        status: 'draft',
        source: source.source,
        sourceRef: source.sourceRef,
        createdById: ctx.userId,
        targets: {
          create: source.targets
            .filter((t) => live.has(t.socialTargetId))
            .map((t) => ({
              tenantId: ctx.tenantId,
              socialTargetId: t.socialTargetId,
              targetName: live.get(t.socialTargetId)?.name ?? t.targetName,
              platform: t.platform,
              // The per-destination wording comes with it — that tuning was work.
              textOverride: t.textOverride,
              firstComment: t.firstComment,
              status: 'pending',
            })),
        },
      },
      include: { targets: { orderBy: { targetName: 'asc' } } },
    });
    return toPostView(copy);
  });
}

/** Put a post in (or take it out of) the evergreen pool the slot filler draws from. */
export async function setSocialPostEvergreen(
  ctx: SocialContext,
  postId: string,
  evergreen: boolean
): Promise<SocialPostView | null> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const result = await tx.socialPost.updateMany({
      where: { id: postId, tenantId: ctx.tenantId },
      data: { evergreen },
    });
    if (result.count === 0) return null;
    const post = await tx.socialPost.findFirst({
      where: { id: postId },
      include: { targets: { orderBy: { targetName: 'asc' } } },
    });
    return post ? toPostView(post) : null;
  });
}

export async function deleteSocialPost(ctx: SocialContext, id: string): Promise<boolean> {
  const result = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialPost.deleteMany({ where: { id, tenantId: ctx.tenantId } })
  );
  return result.count > 0;
}

// ── publish now ─────────────────────────────────────────────────────────────────

export interface PublishNowResult {
  postId: string;
  targetCount: number;
}

/** Flip a post to `publishing` and (re)arm its targets for a drain: any pending OR
 *  previously-failed target is reset to `pending` (so "publish again" retries a
 *  failure), succeeded targets are left alone (the worker skips them — idempotent).
 *  Returns null if the post doesn't exist, throws if it has no armable target. */
export async function markPostPublishing(
  ctx: SocialContext,
  id: string
): Promise<PublishNowResult | null> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const post = await tx.socialPost.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { targets: { select: { id: true, status: true } } },
    });
    if (!post) return null;

    const armable = post.targets.filter((t) => t.status === 'pending' || t.status === 'failed');
    if (armable.length === 0) {
      throw badRequest('This post has no target left to publish.');
    }

    await tx.socialPostTarget.updateMany({
      where: { postId: id, status: { in: ['pending', 'failed'] } },
      data: { status: 'pending', error: null },
    });
    await tx.socialPost.update({ where: { id }, data: { status: 'publishing' } });

    return { postId: id, targetCount: armable.length };
  });
}
